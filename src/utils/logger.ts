/**
 * Structured logging utility for the MCP server
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  timestamp: string;
  server: 'CustomerCare';
  tool?: string;
  request_id?: string;
  action: string;
  duration_ms?: number;
  error?: string;
  meta?: object;
}

export class Logger {
  private static isDevelopment = process.env.NODE_ENV !== 'production';

  private static log(level: LogLevel, action: string, meta?: object): void {
    const entry: LogEntry = {
      level,
      timestamp: new Date().toISOString(),
      server: 'CustomerCare',
      action,
      ...meta
    };

    // In development, also log to console with formatting
    if (this.isDevelopment) {
      const levelColors = {
        debug: '\x1b[36m', // Cyan
        info: '\x1b[32m',  // Green
        warn: '\x1b[33m',  // Yellow
        error: '\x1b[31m'  // Red
      };
      
      const resetColor = '\x1b[0m';
      const color = levelColors[level];
      
      console.error(`${color}[${level.toUpperCase()}]${resetColor} ${action}`, 
        meta ? JSON.stringify(meta, null, 2) : '');
    }

    // Always log structured JSON to stderr for external log collectors
    console.error(JSON.stringify(entry));
  }

  static debug(action: string, meta?: object): void {
    if (this.isDevelopment) {
      this.log('debug', action, meta);
    }
  }

  static info(action: string, meta?: object): void {
    this.log('info', action, meta);
  }

  static warn(action: string, meta?: object): void {
    this.log('warn', action, meta);
  }

  static error(action: string, error: any, meta?: object): void {
    const errorMeta = {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ...meta
    };
    this.log('error', action, errorMeta);
  }

  /**
   * Tool-specific logging utilities
   */
  static toolStart(toolName: string, args: object): string {
    const requestId = this.generateRequestId();
    this.info(`Tool ${toolName} started`, {
      tool: toolName,
      request_id: requestId,
      args: this.sanitizeArgs(args)
    });
    return requestId;
  }

  static toolEnd(toolName: string, requestId: string, duration: number, result?: object): void {
    this.info(`Tool ${toolName} completed`, {
      tool: toolName,
      request_id: requestId,
      duration_ms: duration,
      result_type: result ? typeof result : undefined,
      result_size: result ? JSON.stringify(result).length : 0
    });
  }

  static toolError(toolName: string, requestId: string, error: any, duration?: number): void {
    this.error(`Tool ${toolName} failed`, error, {
      tool: toolName,
      request_id: requestId,
      duration_ms: duration
    });
  }

  /**
   * API call logging utilities
   */
  static apiCall(method: string, url: string, params?: object): string {
    const requestId = this.generateRequestId();
    this.debug(`API ${method} ${url}`, {
      request_id: requestId,
      method,
      url,
      params
    });
    return requestId;
  }

  static apiSuccess(requestId: string, duration: number, responseSize: number): void {
    this.debug('API call successful', {
      request_id: requestId,
      duration_ms: duration,
      response_size_bytes: responseSize
    });
  }

  static apiError(requestId: string, error: any, duration?: number): void {
    this.error('API call failed', error, {
      request_id: requestId,
      duration_ms: duration
    });
  }

  /**
   * Cache logging utilities
   */
  static cacheHit(key: string, tool?: string): void {
    this.debug('Cache hit', {
      cache_key: key,
      tool
    });
  }

  static cacheMiss(key: string, tool?: string): void {
    this.debug('Cache miss', {
      cache_key: key,
      tool
    });
  }

  static cacheSet(key: string, ttl: number, tool?: string): void {
    this.debug('Cache set', {
      cache_key: key,
      ttl_ms: ttl,
      tool
    });
  }

  /**
   * Utility functions
   */
  private static generateRequestId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private static sanitizeArgs(args: object): object {
    // Remove sensitive data from logs
    const sanitized = { ...args };
    const sensitiveKeys = ['password', 'token', 'key', 'secret'];
    
    for (const key of sensitiveKeys) {
      if (key in sanitized) {
        (sanitized as any)[key] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  /**
   * Performance monitoring
   */
  static startTimer(): () => number {
    const start = Date.now();
    return () => Date.now() - start;
  }

  /**
   * Log server startup
   */
  static serverStart(port?: number): void {
    this.info('Server starting', {
      port,
      node_version: process.version,
      environment: process.env.NODE_ENV || 'development'
    });
  }

  /**
   * Log server shutdown
   */
  static serverShutdown(): void {
    this.info('Server shutting down');
  }
}