/**
 * Zod validation schemas for MCP tools
 */

import { z } from 'zod';

/**
 * Estado enums
 */
export const EstadoClienteSchema = z.enum(['activo', 'suspendido', 'cancelado']);
export const EstadoTicketSchema = z.enum(['nuevo', 'en_progreso', 'resuelto', 'cerrado']);
export const PrioridadTicketSchema = z.enum(['baja', 'normal', 'alta', 'muy_alta']);

/**
 * Consultar Clientes Input Schema
 */
export const ConsultarClientesInputSchema = z.object({
  estado: EstadoClienteSchema.optional(),
  zona: z.number().positive().optional(),
  plan: z.string().min(1).optional(),
  search: z.string().min(1).optional().describe('Buscar en nombre, apellido o email'),
  limit: z.number().min(1).max(100).default(20).describe('Número máximo de resultados'),
  offset: z.number().min(0).default(0).describe('Número de resultados a omitir para paginación')
}).strict().describe('Filtros para consultar clientes');

/**
 * Obtener Cliente Input Schema
 */
export const ObtenerClienteInputSchema = z.object({
  clienteId: z.string().min(1).describe('ID del cliente, email, o número de servicio')
}).strict().describe('Parámetros para obtener un cliente específico');

/**
 * Crear Ticket Input Schema
 */
export const CrearTicketInputSchema = z.object({
  servicio: z.number().positive().describe('ID del servicio del cliente'),
  asunto: z.string().min(1).max(255).describe('Asunto del ticket'),
  descripcion: z.string().min(1).describe('Descripción detallada del problema'),
  prioridad: PrioridadTicketSchema.default('normal').describe('Prioridad del ticket')
}).strict().describe('Datos para crear un nuevo ticket de soporte');

/**
 * Listar Tickets Input Schema
 */
export const ListarTicketsInputSchema = z.object({
  estado: EstadoTicketSchema.optional(),
  prioridad: PrioridadTicketSchema.optional(),
  tecnico: z.string().optional().describe('Filtrar por técnico asignado'),
  servicio: z.number().positive().optional().describe('Filtrar por ID de servicio'),
  fecha_desde: z.string().optional().describe('Fecha desde (ISO format)'),
  fecha_hasta: z.string().optional().describe('Fecha hasta (ISO format)'),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0)
}).strict().describe('Filtros para listar tickets');

/**
 * Actualizar Ticket Input Schema
 */
export const ActualizarTicketInputSchema = z.object({
  ticketId: z.number().positive().describe('ID del ticket a actualizar'),
  estado: EstadoTicketSchema.optional().describe('Nuevo estado del ticket'),
  prioridad: PrioridadTicketSchema.optional().describe('Nueva prioridad del ticket'),
  tecnico: z.string().optional().describe('ID del técnico asignado'),
  notas: z.string().optional().describe('Notas adicionales sobre la actualización')
}).strict().describe('Parámetros para actualizar un ticket existente');

/**
 * Consultar Saldo Input Schema
 */
export const ConsultarSaldoInputSchema = z.object({
  id_servicio: z.number().positive().describe('ID del servicio del cliente')
}).strict().describe('Parámetros para consultar saldo de cliente');

/**
 * Activar Servicio Input Schema
 */
export const ActivarServicioInputSchema = z.object({
  id_servicio: z.number().positive().describe('ID del servicio a activar'),
  motivo: z.string().optional().describe('Motivo de la activación')
}).strict().describe('Parámetros para activar un servicio');

/**
 * Desactivar Servicio Input Schema
 */
export const DesactivarServicioInputSchema = z.object({
  id_servicio: z.number().positive().describe('ID del servicio a desactivar'),
  motivo: z.string().min(1).describe('Motivo obligatorio de la desactivación')
}).strict().describe('Parámetros para desactivar un servicio');

/**
 * Cambiar Estado Servicio Input Schema
 */
export const CambiarEstadoServicioInputSchema = z.object({
  id_servicio: z.number().positive().describe('ID del servicio a modificar'),
  nuevo_estado: EstadoClienteSchema.describe('Nuevo estado del servicio'),
  motivo: z.string().min(1).describe('Motivo del cambio de estado')
}).strict().describe('Parámetros para cambiar el estado de un servicio');

/**
 * Actualizar Cliente Input Schema
 */
export const ActualizarClienteInputSchema = z.object({
  id_servicio: z.number().positive().describe('ID del servicio del cliente'),
  email: z.string().email().optional().describe('Nueva dirección de email'),
  telefono: z.string().optional().describe('Nuevo número de teléfono'),
  direccion: z.string().optional().describe('Nueva dirección'),
  localidad: z.string().optional().describe('Nueva localidad'),
  ciudad: z.string().optional().describe('Nueva ciudad'),
  comentarios: z.string().optional().describe('Comentarios o notas del cliente'),
  notificacion_sms: z.boolean().optional().describe('Habilitar notificaciones SMS'),
  notificaciones_push: z.boolean().optional().describe('Habilitar notificaciones push')
}).strict().describe('Parámetros para actualizar información del cliente');

/**
 * Editar Cliente Input Schema
 */
export const EditarClienteInputSchema = z.object({
  id_servicio: z.number().positive().describe('ID del servicio del cliente'),
  datos: z.object({
    telefono: z.string().optional(),
    email: z.string().email().optional(),
    direccion: z.string().optional(),
    comentarios: z.string().optional()
  }).strict().describe('Datos a actualizar del cliente')
}).strict().describe('Parámetros para editar información de cliente');

/**
 * Common validation utilities
 */

/**
 * Validate service ID exists and is accessible
 */
export const validateServicioId = (id: number): boolean => {
  return Number.isInteger(id) && id > 0;
};

/**
 * Validate date format (ISO 8601)
 */
export const validateISODate = (date: string): boolean => {
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
  return isoDateRegex.test(date) && !isNaN(Date.parse(date));
};

/**
 * Validate pagination parameters
 */
export const validatePagination = (limit: number, offset: number): boolean => {
  return limit > 0 && limit <= 100 && offset >= 0;
};

/**
 * Sanitize search input
 */
export const sanitizeSearchInput = (search: string): string => {
  return search.trim().replace(/[<>\"'&]/g, '');
};