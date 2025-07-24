/**
 * Saldo service - Business logic layer for financial operations
 */

import { WispHubClient } from '../clients/wisphub-client.js';
import { DataTransformer } from '../utils/data-transformer.js';
import { Logger } from '../utils/logger.js';
import { getConfig } from '../config/server-config.js';
import type {
  ApiSaldo,
  SaldoDetalle,
  ToolResponse
} from '../types/wisphub.types.js';

export class SaldoService {
  private httpClient: WispHubClient;
  private config = getConfig();

  constructor() {
    this.httpClient = new WispHubClient();
  }

  /**
   * Consultar saldo detallado de un cliente
   */
  async consultarSaldo(servicioId: number): Promise<ToolResponse<SaldoDetalle>> {
    const timer = Logger.startTimer();
    const requestId = Logger.toolStart('consultar_saldo', { servicioId });

    try {
      // Validate service ID
      if (!DataTransformer.isValidServicioId(servicioId)) {
        throw new Error('ID de servicio inválido');
      }

      // Call API with caching (saldo info is cached for short time)
      const response = await this.httpClient.get<ApiSaldo>(
        `/api/clientes/${servicioId}/saldo/`,
        {},
        this.config.cache.saldos
      );

      // Validate response structure
      if (!response || typeof response !== 'object') {
        throw new Error('Respuesta inválida de la API de saldo');
      }

      // Handle array responses (some endpoints return arrays)
      let saldoData: ApiSaldo;
      if (Array.isArray(response)) {
        if (response.length === 0) {
          throw new Error('No se encontró información de saldo para este cliente');
        }
        saldoData = response[0];
      } else if ('results' in response && Array.isArray(response.results)) {
        if (response.results.length === 0) {
          throw new Error('No se encontró información de saldo para este cliente');
        }
        saldoData = response.results[0];
      } else {
        saldoData = response as ApiSaldo;
      }

      // Log raw API data for debugging
      Logger.info('Raw saldo API response', {
        servicioId,
        apiData: saldoData,
        hasFacturasPendientes: !!(saldoData as any).facturas_pendientes,
        facturasPendientesLength: ((saldoData as any).facturas_pendientes || []).length,
        saldoActual: (saldoData as any).saldo_actual
      });

      // Transform to user-friendly format
      const saldoDetalle = DataTransformer.saldoToUserFriendly(saldoData);

      const duration = timer();
      Logger.toolEnd('consultar_saldo', requestId, duration, saldoDetalle);

      return {
        success: true,
        data: saldoDetalle,
        timestamp: new Date().toISOString(),
        debugInfo: {
          endpoint: `/api/clientes/${servicioId}/saldo/`,
          rawApiData: saldoData,
          transformedData: saldoDetalle,
          analysis: {
            hasFacturas: !!(saldoData as any).facturas_pendientes,
            facturaCount: ((saldoData as any).facturas_pendientes || []).length,
            rawSaldo: (saldoData as any).saldo_actual,
            formattedSaldo: saldoDetalle.saldo_actual_formateado
          }
        }
      };

    } catch (error) {
      const duration = timer();
      Logger.toolError('consultar_saldo', requestId, error, duration);
      
      return {
        success: false,
        error: `Error consultando saldo: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Registrar pago de cliente (para futuras implementaciones)
   */
  async registrarPago(servicioId: number, monto: number, metodoPago: string): Promise<ToolResponse<any>> {
    const timer = Logger.startTimer();
    const requestId = Logger.toolStart('registrar_pago', { servicioId, monto, metodoPago });

    try {
      // Validate service ID
      if (!DataTransformer.isValidServicioId(servicioId)) {
        throw new Error('ID de servicio inválido');
      }

      if (monto <= 0) {
        throw new Error('El monto del pago debe ser mayor a 0');
      }

      // Prepare API data
      const apiData = {
        servicio: servicioId,
        monto: monto,
        metodo_pago: metodoPago,
        fecha_pago: new Date().toISOString()
      };

      // Call API (no caching for payment operations)
      const response = await this.httpClient.post(
        `/api/pagos/`,
        apiData
      );

      const duration = timer();
      Logger.toolEnd('registrar_pago', requestId, duration);

      return {
        success: true,
        data: {
          servicio: servicioId,
          monto_registrado: DataTransformer.formatMoney(monto),
          metodo_pago: metodoPago,
          resultado: 'Pago registrado exitosamente'
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const duration = timer();
      Logger.toolError('registrar_pago', requestId, error, duration);
      
      return {
        success: false,
        error: `Error registrando pago: ${error instanceof Error ? error.message : String(error)}`,
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
      Logger.error('Error getting saldo service stats', error);
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
    Logger.info('Saldo service cache cleared');
  }
}