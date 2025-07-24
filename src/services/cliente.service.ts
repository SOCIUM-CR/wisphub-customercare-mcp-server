/**
 * Cliente service - Business logic layer for client operations
 */

import { WispHubClient } from '../clients/wisphub-client.js';
import { DataTransformer } from '../utils/data-transformer.js';
import { Logger } from '../utils/logger.js';
import { getConfig } from '../config/server-config.js';
import type {
  ApiCliente,
  ApiClienteResponse,
  Cliente,
  ConsultarClientesInput,
  ObtenerClienteInput,
  ActivarServicioInput,
  DesactivarServicioInput,
  ActualizarClienteInput,
  PaginatedResponse,
  ToolResponse
} from '../types/wisphub.types.js';

export class ClienteService {
  private httpClient: WispHubClient;
  private config = getConfig();

  constructor() {
    this.httpClient = new WispHubClient();
  }

  /**
   * Consultar lista de clientes con filtros
   */
  async consultarClientes(params: ConsultarClientesInput): Promise<ToolResponse<Cliente[]>> {
    const timer = Logger.startTimer();
    const requestId = Logger.toolStart('consultar_clientes', params);

    try {
      // Build API parameters
      const apiParams: any = {
        limit: params.limit || 20,
        offset: params.offset || 0
      };

      if (params.estado) {
        apiParams.estado = DataTransformer.estadoClienteEnumToString(params.estado);
      }

      if (params.zona) {
        apiParams.zona = params.zona;
      }

      if (params.plan) {
        apiParams.plan = params.plan;
      }

      if (params.search) {
        // WispHub API might support search - adjust endpoint accordingly
        apiParams.search = DataTransformer.prepareSearchQuery(params.search);
      }

      // Call API with caching
      const response = await this.httpClient.get<ApiClienteResponse>(
        '/api/clientes/',
        apiParams,
        this.config.cache.clientes
      );

      // Transform to user-friendly format
      // Handle Django REST Framework pagination structure
      const clientes = Array.isArray(response) ? response : response.results || [];
      const transformedClientes = clientes.map((cliente: ApiCliente) => 
        DataTransformer.clienteToUserFriendly(cliente)
      );

      const duration = timer();
      Logger.toolEnd('consultar_clientes', requestId, duration, transformedClientes);

      return {
        success: true,
        data: transformedClientes,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const duration = timer();
      Logger.toolError('consultar_clientes', requestId, error, duration);
      
      return {
        success: false,
        error: `Error consultando clientes: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Obtener cliente individual por ID, email o número de servicio
   */
  async obtenerCliente(clienteId: string): Promise<ToolResponse<Cliente>> {
    return this.obtenerClienteWithRetry(clienteId, 3);
  }

  /**
   * Obtener cliente with retry logic for better reliability
   */
  private async obtenerClienteWithRetry(clienteId: string, maxRetries: number = 3): Promise<ToolResponse<Cliente>> {
    const timer = Logger.startTimer();
    const requestId = Logger.toolStart('obtener_cliente', { clienteId, maxRetries });

    let lastError: any = null;
    let attempts: any[] = [];

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        Logger.info(`Obtener cliente attempt ${attempt}/${maxRetries}`, { clienteId, attempt });

        let endpoint: string;
        let searchParams: any = {};

        // Determine if clienteId is numeric (service ID) or string (email/search)
        const isNumericId = /^\d+$/.test(clienteId);
        
        if (isNumericId) {
          // Direct ID lookup
          const id = parseInt(clienteId, 10);
          if (!DataTransformer.isValidServicioId(id)) {
            throw new Error('ID de servicio inválido');
          }
          endpoint = `/api/clientes/${id}/`;
        } else {
          // Search by email or other identifier
          endpoint = '/api/clientes/';
          if (clienteId.includes('@')) {
            searchParams.email = clienteId;
          } else {
            searchParams.search = clienteId;
          }
        }

        const attemptStart = Date.now();
        
        // Call API - disable cache on retries to avoid cache issues
        const useCache = attempt === 1 ? this.config.cache.clientes : undefined;
        const response = await this.httpClient.get<ApiCliente | ApiClienteResponse>(
          endpoint,
          searchParams,
          useCache
        );

        const attemptDuration = Date.now() - attemptStart;

        Logger.info(`Obtener cliente attempt ${attempt} response received`, {
          clienteId,
          attempt,
          duration: attemptDuration,
          hasResponse: !!response,
          responseType: Array.isArray(response) ? 'array' : typeof response,
          arrayLength: Array.isArray(response) ? response.length : undefined
        });

        let cliente: Cliente | null = null;
        
        if (Array.isArray(response)) {
          // Direct array result - take first match
          if (response.length > 0) {
            cliente = DataTransformer.clienteToUserFriendly(response[0]);
          }
        } else if (response && typeof response === 'object') {
          // Check if it's a paginated response with results
          if ('results' in response && Array.isArray(response.results)) {
            // Paginated search results - take first match
            if (response.results.length > 0) {
              cliente = DataTransformer.clienteToUserFriendly(response.results[0]);
            }
          } else {
            // Direct single object result (direct ID lookup)
            cliente = DataTransformer.clienteToUserFriendly(response as ApiCliente);
          }
        }

        // Record successful attempt
        attempts.push({
          attempt,
          success: true,
          duration: attemptDuration,
          hasData: !!cliente,
          endpoint,
          searchParams,
          usedCache: !!useCache
        });

        if (cliente) {
          const totalDuration = timer();
          Logger.toolEnd('obtener_cliente', requestId, totalDuration, cliente);

          return {
            success: true,
            data: cliente,
            timestamp: new Date().toISOString(),
            debugInfo: {
              attempts,
              totalDuration,
              successfulAttempt: attempt,
              clienteId,
              endpoint,
              searchParams
            }
          };
        }

        // No data found - this might not be an error, just no match
        if (attempt === maxRetries) {
          const totalDuration = timer();
          Logger.toolEnd('obtener_cliente', requestId, totalDuration, undefined);

          return {
            success: true,
            data: undefined,
            timestamp: new Date().toISOString(),
            debugInfo: {
              attempts,
              totalDuration,
              clienteId,
              endpoint,
              searchParams,
              noDataFound: true
            }
          };
        }

        // Record attempt with no data and continue
        attempts.push({
          attempt,
          success: true,
          duration: attemptDuration,
          hasData: false,
          endpoint,
          searchParams,
          usedCache: !!useCache
        });

      } catch (error) {
        const attemptDuration = Date.now() - timer();
        lastError = error;

        Logger.warn(`Obtener cliente attempt ${attempt} failed`, {
          clienteId,
          attempt,
          error: error instanceof Error ? error.message : String(error),
          duration: attemptDuration
        });

        attempts.push({
          attempt,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration: attemptDuration
        });

        // If this is the last attempt, break and return error
        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff between retries
        const backoffMs = 1000 * attempt;
        Logger.info(`Waiting ${backoffMs}ms before retry`, { clienteId, attempt });
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    // All attempts failed
    const totalDuration = timer();
    Logger.toolError('obtener_cliente', requestId, lastError, totalDuration);
    
    return {
      success: false,
      error: `Error obteniendo cliente después de ${maxRetries} intentos: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
      timestamp: new Date().toISOString(),
      debugInfo: {
        attempts,
        totalDuration,
        clienteId,
        maxRetries,
        allAttemptsFailed: true
      }
    };
  }

  /**
   * Activar servicio de cliente
   */
  async activarServicio(params: ActivarServicioInput): Promise<ToolResponse<any>> {
    const timer = Logger.startTimer();
    const requestId = Logger.toolStart('activar_servicio', params);

    try {
      // Validate service ID
      if (!DataTransformer.isValidServicioId(params.id_servicio)) {
        throw new Error('ID de servicio inválido');
      }

      // Prepare API data - send direct estado change
      const apiData: any = {
        estado: 'Activo'
      };

      if (params.motivo) {
        apiData.comentarios = params.motivo;
      }

      // Call API (no caching for actions)
      const response = await this.httpClient.patch(
        `/api/clientes/${params.id_servicio}/`,
        apiData
      );

      const duration = timer();
      Logger.toolEnd('activar_servicio', requestId, duration);

      return {
        success: true,
        data: {
          id_servicio: params.id_servicio,
          accion: 'activar',
          motivo: params.motivo,
          resultado: 'Servicio activado exitosamente'
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const duration = timer();
      Logger.toolError('activar_servicio', requestId, error, duration);
      
      return {
        success: false,
        error: `Error activando servicio: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Desactivar servicio de cliente
   */
  async desactivarServicio(params: DesactivarServicioInput): Promise<ToolResponse<any>> {
    const timer = Logger.startTimer();
    const requestId = Logger.toolStart('desactivar_servicio', params);

    try {
      // Validate service ID
      if (!DataTransformer.isValidServicioId(params.id_servicio)) {
        throw new Error('ID de servicio inválido');
      }

      // Motivo is required for deactivation
      if (!params.motivo || params.motivo.trim().length === 0) {
        throw new Error('Motivo es obligatorio para desactivar servicio');
      }

      // Prepare API data - send direct estado change
      const apiData = {
        estado: 'Suspendido',
        comentarios: params.motivo.trim()
      };

      // Call API (no caching for actions) with debugging like actualizar_cliente
      const response = await this.httpClient.patch(
        `/api/clientes/${params.id_servicio}/`,
        apiData
      );

      // Clear cache to ensure fresh data for verification
      this.httpClient.clearCache();

      // Verify change by getting updated client data (like in actualizar_cliente)
      const verifiedClienteResult = await this.obtenerCliente(params.id_servicio.toString());
      const verifiedCliente = verifiedClienteResult.success ? verifiedClienteResult.data : null;

      const duration = timer();
      Logger.toolEnd('desactivar_servicio', requestId, duration);

      return {
        success: true,
        data: {
          id_servicio: params.id_servicio,
          accion: 'desactivar',
          motivo: params.motivo,
          resultado: 'Servicio desactivado exitosamente'
        },
        timestamp: new Date().toISOString(),
        debugInfo: {
          method: 'PATCH',
          endpoint: `/api/clientes/${params.id_servicio}/`,
          sentToAPI: apiData,
          apiResponse: response,
          verifiedCliente: verifiedCliente,
          verificationWorked: !!verifiedCliente,
          statusChanged: verifiedCliente ? verifiedCliente.estado === 'suspendido' : false
        }
      };

    } catch (error) {
      const duration = timer();
      Logger.toolError('desactivar_servicio', requestId, error, duration);
      
      return {
        success: false,
        error: `Error desactivando servicio: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Cancelar servicio de cliente
   */
  async cancelarServicio(params: DesactivarServicioInput): Promise<ToolResponse<any>> {
    const timer = Logger.startTimer();
    const requestId = Logger.toolStart('cancelar_servicio', params);

    try {
      // Validate service ID
      if (!DataTransformer.isValidServicioId(params.id_servicio)) {
        throw new Error('ID de servicio inválido');
      }

      // Motivo is required for cancellation
      if (!params.motivo || params.motivo.trim().length === 0) {
        throw new Error('Motivo es obligatorio para cancelar servicio');
      }

      // Prepare API data - send direct estado change
      const apiData = {
        estado: 'Cancelado',
        comentarios: params.motivo.trim()
      };

      // Call API (no caching for actions)
      const response = await this.httpClient.patch(
        `/api/clientes/${params.id_servicio}/`,
        apiData
      );

      const duration = timer();
      Logger.toolEnd('cancelar_servicio', requestId, duration);

      return {
        success: true,
        data: {
          id_servicio: params.id_servicio,
          accion: 'cancelar',
          motivo: params.motivo,
          resultado: 'Servicio cancelado exitosamente'
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const duration = timer();
      Logger.toolError('cancelar_servicio', requestId, error, duration);
      
      return {
        success: false,
        error: `Error cancelando servicio: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get service statistics for monitoring
   */
  async getServiceStats(): Promise<any> {
    try {
      return {
        cache_stats: this.httpClient.getCacheStats(),
        server_status: 'healthy',
        last_check: new Date().toISOString()
      };
    } catch (error) {
      Logger.error('Error getting service stats', error);
      return {
        cache_stats: null,
        server_status: 'error',
        last_check: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Actualizar información del cliente
   */
  async actualizarCliente(params: ActualizarClienteInput): Promise<ToolResponse<Cliente>> {
    const timer = Logger.startTimer();
    const requestId = Logger.toolStart('actualizar_cliente', params);

    try {
      // Validate service ID
      if (!DataTransformer.isValidServicioId(params.id_servicio)) {
        throw new Error('ID de servicio inválido');
      }

      // Prepare API data - only include provided fields
      const apiData: any = {};
      
      if (params.email !== undefined) apiData.email = params.email.trim();
      if (params.telefono !== undefined) apiData.telefono = params.telefono.trim();
      if (params.direccion !== undefined) apiData.direccion = params.direccion.trim();
      if (params.localidad !== undefined) apiData.localidad = params.localidad.trim();
      if (params.ciudad !== undefined) apiData.ciudad = params.ciudad.trim();
      if (params.comentarios !== undefined) apiData.comentarios = params.comentarios.trim();
      if (params.notificacion_sms !== undefined) apiData.notificacion_sms = params.notificacion_sms;
      if (params.notificaciones_push !== undefined) apiData.notificaciones_push = params.notificaciones_push;

      // Check that at least one field is being updated
      if (Object.keys(apiData).length === 0) {
        throw new Error('Debe proporcionar al menos un campo para actualizar');
      }

      Logger.info('Sending cliente update to API', {
        id_servicio: params.id_servicio,
        fields: Object.keys(apiData),
        apiData: apiData
      });

      // Try multiple endpoints - WispHub might separate contact info from technical info
      let response: any = null;
      let usedEndpoint = '';
      
      // Try different endpoints for client updates
      const endpointsToTry = [
        `/api/clientes/${params.id_servicio}/`,  // Technical endpoint
        `/api/clients/${params.id_servicio}/`,   // Alternative naming
        `/api/usuarios/${params.id_servicio}/`,  // User data endpoint
        `/api/contactos/${params.id_servicio}/`, // Contact info endpoint
      ];
      
      for (const endpoint of endpointsToTry) {
        try {
          Logger.info(`Trying endpoint: ${endpoint}`, { id_servicio: params.id_servicio });
          
          response = await this.httpClient.put<ApiCliente>(endpoint, apiData);
          usedEndpoint = endpoint;
          
          Logger.info(`Endpoint ${endpoint} succeeded`, { 
            id_servicio: params.id_servicio,
            hasResponse: !!response 
          });
          break;
          
        } catch (endpointError) {
          Logger.warn(`Endpoint ${endpoint} failed`, { 
            id_servicio: params.id_servicio,
            error: endpointError instanceof Error ? endpointError.message : String(endpointError)
          });
          
          // If this is the last endpoint and it failed, throw the error
          if (endpoint === endpointsToTry[endpointsToTry.length - 1]) {
            throw endpointError;
          }
        }
      }

      Logger.info('Cliente update API response received', {
        id_servicio: params.id_servicio,
        hasResponse: !!response,
        responseKeys: response ? Object.keys(response) : []
      });

      if (!response) {
        throw new Error('La API no devolvió datos del cliente actualizado');
      }

      // Verify the update was actually saved by getting the cliente again
      let verifiedCliente: any = null;
      try {
        Logger.info('Verifying cliente update was saved', { id_servicio: params.id_servicio });
        const verifyResponse = await this.httpClient.get<ApiCliente>(`/api/clientes/${params.id_servicio}/`);
        if (Array.isArray(verifyResponse)) {
          verifiedCliente = verifyResponse.length > 0 ? verifyResponse[0] : null;
        } else if (verifyResponse && typeof verifyResponse === 'object') {
          if ('results' in verifyResponse && Array.isArray(verifyResponse.results)) {
            verifiedCliente = verifyResponse.results.length > 0 ? verifyResponse.results[0] : null;
          } else {
            verifiedCliente = verifyResponse;
          }
        }

        if (verifiedCliente) {
          Logger.info('Cliente verification successful', {
            id_servicio: params.id_servicio,
            verifiedState: {
              email: verifiedCliente.email,
              telefono: verifiedCliente.telefono,
              direccion: verifiedCliente.direccion,
              localidad: verifiedCliente.localidad,
              ciudad: verifiedCliente.ciudad,
              notificacion_sms: verifiedCliente.notificacion_sms,
              notificaciones_push: verifiedCliente.notificaciones_push
            }
          });
          
          // Use the verified cliente data for the response
          const cliente = DataTransformer.clienteToUserFriendly(verifiedCliente);
          
          const duration = timer();
          Logger.toolEnd('actualizar_cliente', requestId, duration, cliente);

          return {
            success: true,
            data: cliente,
            timestamp: new Date().toISOString(),
            debugInfo: {
              method: 'PUT',
              endpoint: usedEndpoint,
              sentToAPI: apiData,
              apiResponse: response,
              verifiedCliente: verifiedCliente,
              transformedCliente: cliente
            }
          };
        } else {
          Logger.warn('Could not verify cliente update', { id_servicio: params.id_servicio });
        }
      } catch (verifyError) {
        Logger.warn('Cliente verification failed', { 
          id_servicio: params.id_servicio, 
          error: verifyError instanceof Error ? verifyError.message : String(verifyError) 
        });
        // Continue with original response even if verification fails
      }

      // Transform to user-friendly format (fallback if verification failed)
      const cliente = DataTransformer.clienteToUserFriendly(response);

      const duration = timer();
      Logger.toolEnd('actualizar_cliente', requestId, duration, cliente);

      return {
        success: true,
        data: cliente,
        timestamp: new Date().toISOString(),
        debugInfo: {
          method: 'PUT',
          endpoint: usedEndpoint,
          sentToAPI: apiData,
          apiResponse: response,
          verifiedCliente: null,
          transformedCliente: cliente,
          verificationFailed: true
        }
      };

    } catch (error) {
      const duration = timer();
      Logger.toolError('actualizar_cliente', requestId, error, duration);
      
      return {
        success: false,
        error: `Error actualizando cliente: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Clear service cache (useful for testing)
   */
  clearCache(): void {
    this.httpClient.clearCache();
    Logger.info('Cliente service cache cleared');
  }
}