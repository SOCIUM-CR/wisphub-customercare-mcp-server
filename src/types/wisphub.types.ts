/**
 * WispHub API types and interfaces
 */

// API Response types (raw from WispHub) - Estructura real
export interface ApiCliente {
  id_servicio: number;
  usuario: string;
  nombre: string; // Nombre completo (no hay apellido separado)
  email: string;
  cedula: string;
  direccion: string;
  localidad: string;
  ciudad: string;
  telefono: string;
  descuento: string;
  saldo: string; // STRING en la API
  rfc: string;
  informacion_adicional: string | null;
  notificacion_sms: boolean;
  aviso_pantalla: boolean;
  notificaciones_push: boolean;
  auto_activar_servicio: boolean;
  firewall: boolean;
  servicio: string;
  password_servicio: string;
  server_hotspot: string;
  ip: string;
  ip_local: string | null;
  estado: string; // STRING: "Activo", "Suspendido", etc.
  modelo_antena: string | null;
  password_cpe: string;
  mac_cpe: string;
  interfaz_lan: string;
  modelo_router_wifi: string;
  ip_router_wifi: string | null;
  mac_router_wifi: string;
  usuario_router_wifi: string;
  password_router_wifi: string;
  ssid_router_wifi: string;
  password_ssid_router_wifi: string;
  comentarios: string;
  coordenadas: string;
  costo_instalacion: string;
  precio_plan: string;
  forma_contratacion: string;
  sn_onu: string;
  estado_facturas: string;
  fecha_instalacion: string; // DD/MM/YYYY HH:mm:ss
  fecha_cancelacion: string | null;
  fecha_corte: string; // D/MM/YYYY
  ultimo_cambio: string;
  plan_internet: {
    id: number;
    nombre: string;
  };
  zona: {
    id: number;
    nombre: string;
  };
  router: {
    id: number;
    nombre: string;
    falla_general: boolean;
    falla_general_descripcion: string;
  };
  sectorial: any | null;
  tecnico: {
    id: number;
    nombre: string;
  };
}

export interface ApiTicket {
  id: number;
  servicio: number;
  asunto: string;
  descripcion: string;
  estado: number; // 1=abierto, 2=en_proceso, 3=cerrado
  prioridad: number; // 1=baja, 2=media, 3=alta, 4=critica
  tecnico: string;
  fecha_creacion: string;
  fecha_cierre?: string;
}

export interface ApiSaldo {
  id_servicio: number;
  saldo_actual: number;
  fecha_ultimo_pago: string;
  facturas_pendientes: ApiFacturaPendiente[];
}

export interface ApiFacturaPendiente {
  id_factura: number;
  monto: number;
  fecha_vencimiento: string;
  dias_vencido: number;
}

// API Pagination types (Django REST Framework style)
export interface PaginatedApiResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Union type for API responses (can be direct array or paginated)
export type ApiClienteResponse = ApiCliente[] | PaginatedApiResponse<ApiCliente>;
export type ApiTicketResponse = ApiTicket[] | PaginatedApiResponse<ApiTicket>;

// MCP-friendly types (transformed for client consumption)
export type EstadoCliente = 'activo' | 'suspendido' | 'cancelado';
export type EstadoTicket = 'nuevo' | 'en_progreso' | 'resuelto' | 'cerrado';
export type PrioridadTicket = 'baja' | 'normal' | 'alta' | 'muy_alta';

export interface Cliente {
  id_servicio: number;
  usuario: string;
  nombre_completo: string;
  email: string;
  telefono: string;
  direccion: string;
  localidad: string;
  ciudad: string;
  zona: number;
  zona_nombre: string;
  plan: string;
  precio_plan: string;
  estado: EstadoCliente;
  estado_facturas: string;
  fecha_instalacion: string; // ISO format
  fecha_corte: string; // ISO format
  fecha_ultimo_cambio: string; // ISO format
  saldo_formateado: string; // "$XXX.XX MXN"
  saldo_numerico: number;
  configuracion_red: {
    ip: string;
    ip_local?: string;
    mac: string;
    interfaz_lan: string;
    router_nombre: string;
    router_wifi: {
      modelo: string;
      ip?: string;
      mac: string;
      ssid: string;
    };
  };
  tecnico: {
    id: number;
    nombre: string;
  };
  comentarios: string;
  coordenadas: string;
}

export interface Ticket {
  id: number;
  servicio: number;
  asunto: string;
  descripcion: string;
  estado: EstadoTicket;
  prioridad: PrioridadTicket;
  tecnico: string;
  fecha_creacion: string; // ISO format
  fecha_cierre?: string; // ISO format
}

export interface SaldoDetalle {
  id_servicio: number;
  saldo_actual_formateado: string;
  saldo_actual_numerico: number;
  fecha_ultimo_pago: string; // ISO format
  estado_cuenta: 'al_corriente' | 'con_atraso' | 'muy_atrasado';
  facturas_pendientes: {
    cantidad: number;
    total_adeudado: string;
    facturas: FacturaPendiente[];
  };
}

export interface FacturaPendiente {
  id_factura: number;
  monto_formateado: string;
  monto_numerico: number;
  fecha_vencimiento: string; // ISO format
  dias_vencido: number;
  estado_vencimiento: 'vigente' | 'vencida' | 'muy_vencida';
}

// Input schemas for tools
export interface ConsultarClientesInput {
  estado?: EstadoCliente;
  zona?: number;
  plan?: string;
  search?: string; // Search in name/email
  limit?: number;
  offset?: number;
}

export interface ObtenerClienteInput {
  clienteId: string;
}

export interface CrearTicketInput {
  servicio: number;
  asunto: string;
  descripcion: string;
  prioridad?: PrioridadTicket;
}

export interface ActualizarTicketInput {
  ticketId: number;
  estado?: EstadoTicket;
  prioridad?: PrioridadTicket;
  tecnico?: string;
  notas?: string;
}

export interface ConsultarSaldoInput {
  id_servicio: number;
}

export interface ActivarServicioInput {
  id_servicio: number;
  motivo?: string;
}

export interface DesactivarServicioInput {
  id_servicio: number;
  motivo?: string;
}

export interface CambiarEstadoServicioInput {
  id_servicio: number;
  nuevo_estado: EstadoCliente;
  motivo: string;
}

export interface ActualizarClienteInput {
  id_servicio: number;
  email?: string;
  telefono?: string;
  direccion?: string;
  localidad?: string;
  ciudad?: string;
  comentarios?: string;
  notificacion_sms?: boolean;
  notificaciones_push?: boolean;
}

// API Error response
export interface ApiError {
  error: string;
  message: string;
  code?: number;
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

// Tool response wrapper
export interface ToolResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
  debugInfo?: any;
}