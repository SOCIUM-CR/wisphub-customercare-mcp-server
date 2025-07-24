/**
 * Data transformation utilities for API ↔ MCP format conversion
 */

import { format, parse } from 'date-fns';
import type {
  ApiCliente,
  ApiTicket,
  ApiSaldo,
  Cliente,
  Ticket,
  SaldoDetalle,
  EstadoCliente,
  EstadoTicket,
  PrioridadTicket
} from '../types/wisphub.types.js';

/**
 * Estado mappings - WispHub usa strings, no números
 */
const ESTADO_CLIENTE_MAP: Record<string, EstadoCliente> = {
  'Activo': 'activo',
  'Suspendido': 'suspendido',
  'Cancelado': 'cancelado',
  'Cortado': 'suspendido', // Mapear cortado como suspendido
  'Inactivo': 'cancelado'
};

const ESTADO_CLIENTE_REVERSE_MAP: Record<EstadoCliente, string> = {
  'activo': 'Activo',
  'suspendido': 'Suspendido', 
  'cancelado': 'Cancelado'
};

const ESTADO_TICKET_MAP: Record<number, EstadoTicket> = {
  1: 'nuevo',
  2: 'en_progreso', 
  3: 'resuelto',
  4: 'cerrado'
};

const ESTADO_TICKET_REVERSE_MAP: Record<EstadoTicket, number> = {
  'nuevo': 1,
  'en_progreso': 2,
  'resuelto': 3,
  'cerrado': 4
};

const PRIORIDAD_TICKET_MAP: Record<number, PrioridadTicket> = {
  1: 'baja',
  2: 'normal',
  3: 'alta',
  4: 'muy_alta'
};

const PRIORIDAD_TICKET_REVERSE_MAP: Record<PrioridadTicket, number> = {
  'baja': 1,
  'normal': 2,
  'alta': 3,
  'muy_alta': 4
};

export class DataTransformer {
  
  /**
   * Transform API cliente to user-friendly format
   */
  static clienteToUserFriendly(apiCliente: ApiCliente): Cliente {
    return {
      id_servicio: apiCliente.id_servicio,
      usuario: apiCliente.usuario,
      nombre_completo: (apiCliente.nombre || '').trim(),
      email: apiCliente.email || '',
      telefono: apiCliente.telefono || '',
      direccion: apiCliente.direccion || '',
      localidad: apiCliente.localidad || '',
      ciudad: apiCliente.ciudad || '',
      zona: apiCliente.zona?.id || 0,
      zona_nombre: apiCliente.zona?.nombre || '',
      plan: apiCliente.plan_internet?.nombre || '',
      precio_plan: this.formatMoney(parseFloat(apiCliente.precio_plan || '0')),
      estado: this.estadoClienteStringToEnum(apiCliente.estado),
      estado_facturas: apiCliente.estado_facturas || '',
      fecha_instalacion: this.dateApiToISO(apiCliente.fecha_instalacion),
      fecha_corte: this.dateApiToISO(apiCliente.fecha_corte),
      fecha_ultimo_cambio: this.dateApiToISO(apiCliente.ultimo_cambio),
      saldo_formateado: this.formatMoney(parseFloat(apiCliente.saldo || '0')),
      saldo_numerico: parseFloat(apiCliente.saldo || '0'),
      configuracion_red: {
        ip: apiCliente.ip || '',
        ip_local: apiCliente.ip_local || undefined,
        mac: apiCliente.mac_cpe || '',
        interfaz_lan: apiCliente.interfaz_lan || '',
        router_nombre: apiCliente.router?.nombre || '',
        router_wifi: {
          modelo: apiCliente.modelo_router_wifi || '',
          ip: apiCliente.ip_router_wifi || undefined,
          mac: apiCliente.mac_router_wifi || '',
          ssid: apiCliente.ssid_router_wifi || ''
        }
      },
      tecnico: {
        id: apiCliente.tecnico?.id || 0,
        nombre: apiCliente.tecnico?.nombre || ''
      },
      comentarios: apiCliente.comentarios || '',
      coordenadas: apiCliente.coordenadas || ''
    };
  }

  /**
   * Transform API ticket to user-friendly format
   */
  static ticketToUserFriendly(apiTicket: ApiTicket): Ticket {
    return {
      id: apiTicket.id,
      servicio: apiTicket.servicio,
      asunto: apiTicket.asunto,
      descripcion: apiTicket.descripcion,
      estado: this.estadoTicketToString(apiTicket.estado),
      prioridad: this.prioridadTicketToString(apiTicket.prioridad),
      tecnico: apiTicket.tecnico,
      fecha_creacion: this.dateApiToISO(apiTicket.fecha_creacion),
      fecha_cierre: apiTicket.fecha_cierre ? this.dateApiToISO(apiTicket.fecha_cierre) : undefined
    };
  }

  /**
   * Transform API saldo to user-friendly format
   */
  static saldoToUserFriendly(apiSaldo: ApiSaldo): SaldoDetalle {
    // Handle different API field names: facturas_pendientes OR facturas
    const facturas = (apiSaldo as any).facturas_pendientes || (apiSaldo as any).facturas || [];
    
    // Calculate dias_vencido for each factura if not provided
    const facturasWithVencimiento = facturas.map((factura: any) => {
      let diasVencido = factura.dias_vencido || 0;
      
      // If dias_vencido not provided, calculate from fecha_vencimiento
      if (diasVencido === 0 && factura.fecha_vencimiento) {
        const fechaVencimiento = new Date(factura.fecha_vencimiento);
        const hoy = new Date();
        const diffTime = hoy.getTime() - fechaVencimiento.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        diasVencido = Math.max(0, diffDays);
      }
      
      return {
        ...factura,
        dias_vencido: diasVencido,
        monto: factura.monto || factura.total || 0, // Handle different amount field names
        id_factura: factura.id_factura || factura.id || 0
      };
    });
    
    const estadoCuenta = this.determinarEstadoCuenta(facturasWithVencimiento);
    
    // Get saldo from multiple possible field names
    const saldoRaw = (apiSaldo as any).saldo_actual || (apiSaldo as any).saldo || 0;
    
    return {
      id_servicio: (apiSaldo as any).id_servicio || 0,
      saldo_actual_formateado: this.formatMoney(saldoRaw),
      saldo_actual_numerico: saldoRaw,
      fecha_ultimo_pago: this.dateApiToISO((apiSaldo as any).fecha_ultimo_pago),
      estado_cuenta: estadoCuenta,
      facturas_pendientes: {
        cantidad: facturasWithVencimiento.length,
        total_adeudado: this.formatMoney(
          facturasWithVencimiento.reduce((sum: number, f: any) => sum + (f.monto || 0), 0)
        ),
        facturas: facturasWithVencimiento.map((factura: any) => ({
          id_factura: factura.id_factura,
          monto_formateado: this.formatMoney(factura.monto || 0),
          monto_numerico: factura.monto || 0,
          fecha_vencimiento: this.dateApiToISO(factura.fecha_vencimiento),
          dias_vencido: factura.dias_vencido,
          estado_vencimiento: this.determinarEstadoVencimiento(factura.dias_vencido)
        }))
      }
    };
  }

  /**
   * Estado conversions - API to MCP
   */
  static estadoClienteToString(estado: number): EstadoCliente {
    // Método legacy - mantener por compatibilidad pero no se usa en WispHub real
    const legacyMap: Record<number, EstadoCliente> = {
      1: 'activo',
      2: 'suspendido', 
      3: 'cancelado'
    };
    return legacyMap[estado] || 'cancelado';
  }

  static estadoClienteStringToEnum(estado: string): EstadoCliente {
    return ESTADO_CLIENTE_MAP[estado] || 'cancelado';
  }

  static estadoTicketToString(estado: number): EstadoTicket {
    return ESTADO_TICKET_MAP[estado] || 'abierto';
  }

  static prioridadTicketToString(prioridad: number): PrioridadTicket {
    return PRIORIDAD_TICKET_MAP[prioridad] || 'media';
  }

  /**
   * Estado conversions - MCP to API
   */
  static estadoClienteToNumber(estado: EstadoCliente): number {
    // Método legacy - mantener por compatibilidad
    const legacyMap: Record<EstadoCliente, number> = {
      'activo': 1,
      'suspendido': 2,
      'cancelado': 3
    };
    return legacyMap[estado] || 1;
  }

  static estadoClienteEnumToString(estado: EstadoCliente): string {
    return ESTADO_CLIENTE_REVERSE_MAP[estado] || 'Activo';
  }

  static estadoTicketToNumber(estado: EstadoTicket): number {
    return ESTADO_TICKET_REVERSE_MAP[estado] || 1;
  }

  static prioridadTicketToNumber(prioridad: PrioridadTicket): number {
    return PRIORIDAD_TICKET_REVERSE_MAP[prioridad] || 2;
  }

  /**
   * Date transformations
   */
  static dateApiToISO(dateStr: string): string {
    try {
      // API format: "DD/MM/YYYY HH:mm" or "DD/MM/YYYY"
      const formats = ['dd/MM/yyyy HH:mm', 'dd/MM/yyyy'];
      
      for (const formatStr of formats) {
        try {
          const parsed = parse(dateStr, formatStr, new Date());
          return parsed.toISOString();
        } catch {
          continue;
        }
      }
      
      // Fallback - try direct parse
      return new Date(dateStr).toISOString();
    } catch (error) {
      // Return current date as fallback
      return new Date().toISOString();
    }
  }

  static dateISOToApi(isoStr: string): string {
    try {
      const date = new Date(isoStr);
      return format(date, 'dd/MM/yyyy HH:mm');
    } catch (error) {
      return format(new Date(), 'dd/MM/yyyy HH:mm');
    }
  }

  /**
   * Money formatting
   */
  static formatMoney(amount: number, currency: string = 'MXN'): string {
    const formatted = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency
    }).format(amount);
    
    return formatted;
  }

  static parseMoney(formattedAmount: string): number {
    // Remove currency symbols and parse
    const cleaned = formattedAmount.replace(/[^0-9.-]/g, '');
    return parseFloat(cleaned) || 0;
  }

  /**
   * Business logic helpers
   */
  private static determinarEstadoCuenta(facturas: any[]): 'al_corriente' | 'con_atraso' | 'muy_atrasado' {
    if (!facturas || facturas.length === 0) {
      return 'al_corriente';
    }

    const maxDiasVencido = Math.max(...facturas.map(f => f.dias_vencido || 0));
    
    if (maxDiasVencido <= 0) {
      return 'al_corriente';
    } else if (maxDiasVencido <= 30) {
      return 'con_atraso';
    } else {
      return 'muy_atrasado';
    }
  }

  private static determinarEstadoVencimiento(diasVencido: number): 'vigente' | 'vencida' | 'muy_vencida' {
    if (diasVencido <= 0) {
      return 'vigente';
    } else if (diasVencido <= 30) {
      return 'vencida';
    } else {
      return 'muy_vencida';
    }
  }

  /**
   * Search query helpers
   */
  static prepareSearchQuery(search: string): string {
    return search
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Remove accents
  }

  /**
   * Validation helpers
   */
  static isValidServicioId(id: any): boolean {
    return Number.isInteger(Number(id)) && Number(id) > 0;
  }

  static isValidEstadoCliente(estado: any): estado is EstadoCliente {
    return ['activo', 'suspendido', 'cancelado'].includes(estado);
  }

  static isValidEstadoTicket(estado: any): estado is EstadoTicket {
    return ['abierto', 'en_proceso', 'cerrado'].includes(estado);
  }

  static isValidPrioridadTicket(prioridad: any): prioridad is PrioridadTicket {
    return ['baja', 'media', 'alta', 'critica'].includes(prioridad);
  }
}