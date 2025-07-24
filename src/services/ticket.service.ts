/**
 * Ticket service - Business logic layer for ticket operations
 */

import { WispHubClient } from '../clients/wisphub-client.js';
import { DataTransformer } from '../utils/data-transformer.js';
import { Logger } from '../utils/logger.js';
import { getConfig } from '../config/server-config.js';
import type {
  ApiTicket,
  Ticket,
  CrearTicketInput,
  ActualizarTicketInput,
  ToolResponse
} from '../types/wisphub.types.js';

export class TicketService {
  private httpClient: WispHubClient;
  private config = getConfig();

  constructor() {
    this.httpClient = new WispHubClient();
  }

  /**
   * Crear nuevo ticket de soporte
   */
  async crearTicket(params: CrearTicketInput): Promise<ToolResponse<Ticket>> {
    const timer = Logger.startTimer();
    const requestId = Logger.toolStart('crear_ticket', params);

    try {
      // Validate service ID
      if (!DataTransformer.isValidServicioId(params.servicio)) {
        throw new Error('ID de servicio inválido');
      }

      // Prepare API data with required fields based on WispHub form structure
      const apiData = {
        servicio: params.servicio,
        asunto: params.asunto.trim(),
        descripcion: params.descripcion.trim(),
        prioridad: DataTransformer.prioridadTicketToNumber(params.prioridad || 'normal'),
        estado: 1, // 1 = nuevo (new tickets are always "nuevo")
        
        // Required fields with WispHub defaults
        asuntos_default: this.getDefaultAsunto(params.asunto),
        departamentos_default: "Soporte Técnico", // Default department for technical issues
        tecnico: "3288010", // admin@almacreativa (main admin)
        departamento: "Soporte Técnico", // Same as departamentos_default
        origen_reporte: "portal_cliente" // Reported from client portal (MCP)
      };

      // Call API (no caching for creating tickets)
      const response = await this.httpClient.post<ApiTicket>(
        '/api/tickets/',
        apiData
      );

      // Transform to user-friendly format
      const ticket = DataTransformer.ticketToUserFriendly(response);

      const duration = timer();
      Logger.toolEnd('crear_ticket', requestId, duration, ticket);

      return {
        success: true,
        data: ticket,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const duration = timer();
      Logger.toolError('crear_ticket', requestId, error, duration);
      
      return {
        success: false,
        error: `Error creando ticket: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Obtener tickets de un cliente específico
   */
  async obtenerTicketsCliente(servicioId: number): Promise<ToolResponse<Ticket[]>> {
    const timer = Logger.startTimer();
    const requestId = Logger.toolStart('obtener_tickets_cliente', { servicioId });

    try {
      // Validate service ID
      if (!DataTransformer.isValidServicioId(servicioId)) {
        throw new Error('ID de servicio inválido');
      }

      // Call API with caching
      const response = await this.httpClient.get<ApiTicket[]>(
        '/api/tickets/',
        { servicio: servicioId },
        this.config.cache.tickets
      );

      // Transform to user-friendly format
      const tickets = Array.isArray(response) ? response : [];
      const transformedTickets = tickets.map(ticket => 
        DataTransformer.ticketToUserFriendly(ticket)
      );

      const duration = timer();
      Logger.toolEnd('obtener_tickets_cliente', requestId, duration, transformedTickets);

      return {
        success: true,
        data: transformedTickets,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const duration = timer();
      Logger.toolError('obtener_tickets_cliente', requestId, error, duration);
      
      return {
        success: false,
        error: `Error obteniendo tickets del cliente: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Actualizar estado o información de un ticket
   */
  async actualizarTicket(ticketId: number, updates: Partial<{
    estado: string;
    prioridad: string;
    tecnico: string;
    notas: string;
  }>): Promise<ToolResponse<Ticket>> {
    const timer = Logger.startTimer();
    const requestId = Logger.toolStart('actualizar_ticket', { ticketId, updates });

    try {
      // Prepare API data with ALL required fields for WispHub
      const apiData: any = {};
      let putData: any = {};

      if (updates.estado) {
        const estadoNumber = DataTransformer.estadoTicketToNumber(updates.estado as any);
        apiData.estado = estadoNumber;
        
        // Date handling will be done after getting current ticket data
        
        // Always include razon_falla when updating estado
        if (!apiData.razon_falla) {
          // Map estado to appropriate razon_falla
          const razonMap = {
            'nuevo': '',
            'en_progreso': 'Internet Intermitente',
            'resuelto': 'Otro',
            'cerrado': 'Otro'
          };
          apiData.razon_falla = razonMap[updates.estado as keyof typeof razonMap] || 'Otro';
        }
      }

      if (updates.prioridad) {
        const prioridadNumber = DataTransformer.prioridadTicketToNumber(updates.prioridad as any);
        apiData.prioridad = prioridadNumber;
      }

      if (updates.tecnico) {
        // Only set tecnico if it's a valid ID (numbers only) or valid email
        const tecnicoTrimmed = updates.tecnico.trim();
        if (/^\d+$/.test(tecnicoTrimmed) || tecnicoTrimmed.includes('@')) {
          apiData.tecnico = tecnicoTrimmed;
          apiData.email_tecnico = tecnicoTrimmed.includes('@') ? tecnicoTrimmed : '';
        }
      }

      // Notes will be handled after getting current ticket data

      // Log what we're sending to the API
      Logger.info('Sending ticket update to API', {
        ticketId,
        endpoint: `/api/tickets/${ticketId}/`,
        method: 'PATCH',
        apiData: apiData,
        originalUpdates: updates
      });

      // Try PUT instead of PATCH with complete ticket object
      // First get the current ticket to have complete data
      Logger.info('Getting current ticket for PUT update', { ticketId });
      const currentTicket = await this.httpClient.get<ApiTicket>(`/api/tickets/${ticketId}/`);
      
      let completeTicketData: any;
      if (Array.isArray(currentTicket)) {
        completeTicketData = currentTicket.length > 0 ? currentTicket[0] : null;
      } else if (currentTicket && typeof currentTicket === 'object') {
        if ('results' in currentTicket && Array.isArray(currentTicket.results)) {
          completeTicketData = currentTicket.results.length > 0 ? currentTicket.results[0] : null;
        } else {
          completeTicketData = currentTicket;
        }
      }

      if (!completeTicketData) {
        throw new Error('Could not get current ticket data for update');
      }

      // Clean and fix the data before merging
      const cleanedCurrentData = { ...completeTicketData };
      
      // Convert text values to numeric IDs that WispHub expects
      if (cleanedCurrentData.prioridad === 'Alta') {
        cleanedCurrentData.prioridad = 3; // 3 = Alta
      } else if (cleanedCurrentData.prioridad === 'Normal') {
        cleanedCurrentData.prioridad = 2; // 2 = Normal  
      } else if (cleanedCurrentData.prioridad === 'Baja') {
        cleanedCurrentData.prioridad = 1; // 1 = Baja
      }
      
      // Convert estado text to number if it's still text
      if (typeof cleanedCurrentData.estado === 'string') {
        const estadoMap: Record<string, number> = {
          'Nuevo': 1,
          'En Progreso': 2,
          'Resuelto': 3,
          'Cerrado': 4
        };
        cleanedCurrentData.estado = estadoMap[cleanedCurrentData.estado] || 1;
      }
      
      // Fix asuntos_default - map to valid option
      if (cleanedCurrentData.asunto) {
        cleanedCurrentData.asuntos_default = this.getDefaultAsunto(cleanedCurrentData.asunto);
      }
      
      // Fix origen_reporte
      cleanedCurrentData.origen_reporte = "portal_cliente"; // Use lowercase underscore format
      
      // Clean tecnico field - remove if empty or invalid
      if (!cleanedCurrentData.tecnico || cleanedCurrentData.tecnico.trim() === '') {
        delete cleanedCurrentData.tecnico;
        delete cleanedCurrentData.email_tecnico;
      }
      
      // Handle notes by appending to descripcion
      if (updates.notas) {
        const currentDescripcion = cleanedCurrentData.descripcion || '';
        const timestamp = new Date().toLocaleString('es-MX', { 
          timeZone: 'America/Mexico_City',
          year: 'numeric',
          month: '2-digit', 
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
        cleanedCurrentData.descripcion = currentDescripcion + 
          `\n\n--- ACTUALIZACIÓN ${timestamp} ---\n` + 
          updates.notas.trim();
      }
      
      // Handle dates based on estado changes - use WispHub format
      if (updates.estado) {
        const now = new Date();
        const wisphubDateFormat = now.toLocaleDateString('es-MX', {
          timeZone: 'America/Mexico_City',
          day: '2-digit',
          month: '2-digit', 
          year: 'numeric'
        }) + ' ' + now.toLocaleTimeString('es-MX', {
          timeZone: 'America/Mexico_City',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
        
        if (updates.estado === 'en_progreso') {
          // Starting work on ticket
          if (!cleanedCurrentData.fecha_inicio) {
            cleanedCurrentData.fecha_inicio = wisphubDateFormat;
          }
        } else if (updates.estado === 'resuelto' || updates.estado === 'cerrado') {
          // Finishing ticket
          cleanedCurrentData.fecha_fin = wisphubDateFormat;
          cleanedCurrentData.finalizado_por = "admin@almacreativa";
          if (!cleanedCurrentData.fecha_inicio) {
            cleanedCurrentData.fecha_inicio = wisphubDateFormat;
          }
        }
      }
      
      // Remove fields that might cause issues
      delete cleanedCurrentData.tickets_mensual;
      delete cleanedCurrentData.tickets_anual; 
      delete cleanedCurrentData.vencimiento;
      delete cleanedCurrentData.archivo_ticket;
      delete cleanedCurrentData.respuestas;
      
      // Merge current data with updates  
      putData = {
        ...cleanedCurrentData,
        ...apiData,
        // Force the ID to be included
        id_ticket: ticketId
      };

      Logger.info('Using PUT with complete ticket data', {
        ticketId,
        method: 'PUT',
        putData: putData
      });

      // Try PUT instead of PATCH
      const response = await this.httpClient.put<ApiTicket>(
        `/api/tickets/${ticketId}/`,
        putData
      );

      // Log the raw response for debugging
      Logger.info('API Response for actualizar_ticket', {
        ticketId,
        responseType: typeof response,
        response: response
      });

      // Transform to user-friendly format
      let ticket;
      
      // Handle different response formats from WispHub API
      if (Array.isArray(response)) {
        // If API returns array, take first item
        ticket = response.length > 0 ? DataTransformer.ticketToUserFriendly(response[0]) : null;
      } else if (response && typeof response === 'object') {
        // Check if it's a paginated response
        if ('results' in response && Array.isArray(response.results)) {
          ticket = response.results.length > 0 ? DataTransformer.ticketToUserFriendly(response.results[0]) : null;
        } else {
          // Direct object response
          ticket = DataTransformer.ticketToUserFriendly(response);
        }
      } else {
        throw new Error(`Respuesta inesperada de la API: ${typeof response}`);
      }

      if (!ticket) {
        throw new Error('La API no devolvió datos del ticket actualizado');
      }

      // Verify the update was actually saved by getting the ticket again
      let verifiedTicket: any = null;
      try {
        Logger.info('Verifying ticket update was saved', { ticketId });
        const verifyResponse = await this.httpClient.get<ApiTicket>(`/api/tickets/${ticketId}/`);
        if (Array.isArray(verifyResponse)) {
          verifiedTicket = verifyResponse.length > 0 ? verifyResponse[0] : null;
        } else if (verifyResponse && typeof verifyResponse === 'object') {
          if ('results' in verifyResponse && Array.isArray(verifyResponse.results)) {
            verifiedTicket = verifyResponse.results.length > 0 ? verifyResponse.results[0] : null;
          } else {
            verifiedTicket = verifyResponse;
          }
        }

        if (verifiedTicket) {
          Logger.info('Ticket verification successful', {
            ticketId,
            verifiedState: {
              estado: verifiedTicket.estado,
              prioridad: verifiedTicket.prioridad,
              tecnico: verifiedTicket.tecnico,
              hasNotas: !!verifiedTicket.notas
            }
          });
          
          // Use the verified ticket data for the response
          ticket = DataTransformer.ticketToUserFriendly(verifiedTicket);
        } else {
          Logger.warn('Could not verify ticket update', { ticketId });
        }
      } catch (verifyError) {
        Logger.warn('Ticket verification failed', { ticketId, error: verifyError instanceof Error ? verifyError.message : String(verifyError) });
        // Continue with original response even if verification fails
      }

      const duration = timer();
      Logger.toolEnd('actualizar_ticket', requestId, duration, ticket);

      return {
        success: true,
        data: ticket,
        timestamp: new Date().toISOString(),
        debugInfo: {
          method: 'PUT',
          sentToAPI: putData,
          originalApiData: apiData,
          apiResponse: response,
          verifiedTicket: verifiedTicket,
          transformedTicket: ticket
        }
      };

    } catch (error) {
      const duration = timer();
      Logger.toolError('actualizar_ticket', requestId, error, duration);
      
      return {
        success: false,
        error: `Error actualizando ticket: ${error instanceof Error ? error.message : String(error)}`,
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
      Logger.error('Error getting ticket service stats', error);
      return {
        cache_stats: null,
        server_status: 'error',
        last_check: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Clear service cache (useful for testing)
   */
  clearCache(): void {
    this.httpClient.clearCache();
    Logger.info('Ticket service cache cleared');
  }

  /**
   * Map generic subject to WispHub predefined subjects
   */
  private getDefaultAsunto(asunto: string): string {
    const asuntoLower = asunto.toLowerCase();
    
    // Map common issues to predefined subjects
    const asuntoMap: Record<string, string> = {
      // Connection issues
      'internet': 'Internet Lento',
      'lento': 'Internet Lento',
      'velocidad': 'Internet Lento',
      'no internet': 'No Tiene Internet',
      'sin internet': 'No Tiene Internet',
      'conexion': 'No Tiene Internet',
      'intermitente': 'Internet Intermitente',
      'cortes': 'Internet Intermitente',
      'desconexion': 'Internet Intermitente',
      
      // Equipment issues
      'antena': 'Antena Desalineada',
      'router': 'No Responde el Router Wifi',
      'wifi': 'No Responde el Router Wifi',
      'cable': 'Cable UTP Dañado',
      'poe': 'PoE Dañado',
      'conector': 'Conector Dañado',
      'fibra': 'Cable Fibra Dañado',
      'jumper': 'Jumper Dañado',
      
      // Service changes
      'cambio': 'Cambio de Domicilio',
      'domicilio': 'Cambio de Domicilio',
      'mudanza': 'Cambio de Domicilio',
      'reconexion': 'Reconexion',
      'reactivar': 'Reconexion',
      'cancelacion': 'Cancelación',
      'cancelar': 'Cancelación',
      'baja': 'Desconexión',
      'recoleccion': 'Recolección De Equipos'
    };

    // Check for keyword matches
    for (const [keyword, defaultAsunto] of Object.entries(asuntoMap)) {
      if (asuntoLower.includes(keyword)) {
        return defaultAsunto;
      }
    }

    // Default fallback
    return 'Otro Asunto';
  }
}