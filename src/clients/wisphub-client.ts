/**
 * WispHub HTTP client with retry, caching, and error handling
 */

import axios, { AxiosInstance, AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getConfig } from '../config/server-config.js';
import { Logger } from '../utils/logger.js';
import { CacheManager } from '../utils/cache.js';
import type { ApiError } from '../types/wisphub.types.js';

export class WispHubClient {
  private http: AxiosInstance;
  private cache: CacheManager;
  private config = getConfig();

  constructor() {
    this.cache = new CacheManager();
    
    this.http = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Authorization': 'Api-Key ' + this.config.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for logging
    this.http.interceptors.request.use(
      (config) => {
        Logger.debug('HTTP Request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          params: config.params
        });
        return config;
      },
      (error) => {
        Logger.error('HTTP Request Error', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging and error handling
    this.http.interceptors.response.use(
      (response) => {
        Logger.debug('HTTP Response', {
          status: response.status,
          url: response.config.url,
          duration: Date.now() - (response.config as any).startTime
        });
        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & {
          _retry?: boolean;
          _retryCount?: number;
        };
        
        // Log error details
        Logger.error('HTTP Response Error', {
          status: error.response?.status,
          url: originalRequest?.url,
          message: error.message,
          data: error.response?.data
        });

        // Retry logic for 5xx errors and network issues
        if (
          originalRequest && 
          !originalRequest._retry && 
          this.shouldRetry(error)
        ) {
          originalRequest._retry = true;
          
          // Exponential backoff
          const retryDelay = Math.pow(2, (originalRequest._retryCount || 0)) * 1000;
          await this.delay(retryDelay);
          
          originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
          
          if (originalRequest._retryCount <= this.config.retryAttempts) {
            Logger.info('Retrying request', {
              url: originalRequest.url,
              attempt: originalRequest._retryCount
            });
            return this.http(originalRequest);
          }
        }

        return Promise.reject(this.formatError(error));
      }
    );
  }

  private shouldRetry(error: AxiosError): boolean {
    // Retry on network errors or 5xx server errors
    return !error.response || (error.response.status >= 500);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private formatError(error: AxiosError): Error {
    if (error.response?.data) {
      const apiError = error.response.data as any;
      
      // Log the full error response for debugging
      Logger.error('API Error Response', error, {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: error.response.headers
      });
      
      // Try different error message formats
      const errorMessage = apiError.message || apiError.error || apiError.detail || 
                          JSON.stringify(apiError) || 'Unknown API error';
      
      return new Error(`WispHub API Error (${error.response.status}): ${errorMessage}`);
    }
    
    if (error.code === 'ECONNABORTED') {
      return new Error('Request timeout - WispHub API is not responding');
    }
    
    return new Error(`Network error: ${error.message}`);
  }

  /**
   * GET request with caching
   */
  async get<T>(endpoint: string, params?: object, cacheTtl?: number): Promise<T> {
    const cacheKey = this.getCacheKey('GET', endpoint, params);
    
    // Try cache first
    if (cacheTtl && cacheTtl > 0) {
      const cached = this.cache.get<T>(cacheKey);
      if (cached) {
        Logger.debug('Cache hit', { endpoint, cacheKey });
        return cached;
      }
    }

    // Add timestamp for duration calculation
    const requestConfig = { 
      params,
      metadata: { startTime: Date.now() }
    };
    
    const response: AxiosResponse<T> = await this.http.get(endpoint, requestConfig);
    
    // Cache successful response
    if (cacheTtl && cacheTtl > 0) {
      this.cache.set(cacheKey, response.data, cacheTtl);
      Logger.debug('Response cached', { endpoint, cacheKey, ttl: cacheTtl });
    }
    
    return response.data;
  }

  /**
   * POST request (no caching)
   */
  async post<T>(endpoint: string, data?: object): Promise<T> {
    const response: AxiosResponse<T> = await this.http.post(endpoint, data);
    return response.data;
  }

  /**
   * PUT request (no caching)
   */
  async put<T>(endpoint: string, data?: object): Promise<T> {
    const response: AxiosResponse<T> = await this.http.put(endpoint, data);
    return response.data;
  }

  /**
   * PATCH request (no caching)
   */
  async patch<T>(endpoint: string, data?: object): Promise<T> {
    const response: AxiosResponse<T> = await this.http.patch(endpoint, data);
    return response.data;
  }

  /**
   * DELETE request (no caching)
   */
  async delete<T>(endpoint: string): Promise<T> {
    const response: AxiosResponse<T> = await this.http.delete(endpoint);
    return response.data;
  }

  /**
   * Generate cache key for request
   */
  private getCacheKey(method: string, endpoint: string, params?: object): string {
    const paramString = params ? JSON.stringify(params) : '';
    return `${method}:${endpoint}:${paramString}`;
  }

  /**
   * Clear cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.cache.clear();
    Logger.info('Cache cleared');
  }

  /**
   * Get cache stats for monitoring
   */
  getCacheStats(): object {
    return this.cache.getStats();
  }
}