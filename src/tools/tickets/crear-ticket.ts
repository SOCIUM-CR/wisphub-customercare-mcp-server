/**
 * Crear Ticket MCP Tool
 * Create support tickets for customer issues
 */

import { z } from 'zod';
import { TicketService } from '../../services/ticket.service.js';
import { CrearTicketInputSchema } from '../../validators/schemas.js';
import { Logger } from '../../utils/logger.js';
import type { CrearTicketInput } from '../../types/wisphub.types.js';

// Service instance
const ticketService = new TicketService();

/**
 * Tool definition for MCP
 */
export const crearTicketTool = {
  name: 'crear_ticket',
  description: `Crea un nuevo ticket de soporte para un cliente.

Esta herramienta permite crear tickets de soporte técnico con toda la información necesaria:
- Asociado a un cliente específico por ID de servicio
- Asunto descriptivo del problema
- Descripción detallada de la incidencia
- Prioridad configurable (baja, media, alta, crítica)
- Se asigna automáticamente según las reglas de negocio

Casos de uso típicos:
- "Crear ticket para cliente 12345: problema de conectividad"
- "Reportar corte de internet para servicio 987"
- "Ticket de alta prioridad: cliente sin servicio desde ayer"

El ticket se crea inmediatamente y queda disponible para seguimiento por parte del equipo técnico.`,

  inputSchema: {
    type: 'object',
    properties: {
      servicio: {
        type: 'number',
        minimum: 1,
        description: 'ID del servicio del cliente'
      },
      asunto: {
        type: 'string',
        minLength: 1,
        maxLength: 255,
        description: 'Asunto o título del ticket (máximo 255 caracteres)'
      },
      descripcion: {
        type: 'string',
        minLength: 1,
        description: 'Descripción detallada del problema o solicitud'
      },
      prioridad: {
        type: 'string',
        enum: ['baja', 'media', 'alta', 'critica'],
        default: 'media',
        description: 'Prioridad del ticket (por defecto: media)'
      }
    },
    required: ['servicio', 'asunto', 'descripcion'],
    additionalProperties: false,
    description: 'Datos necesarios para crear un nuevo ticket de soporte'
  },

  /**
   * Tool handler
   */
  async handler(args: unknown): Promise<string> {
    const timer = Logger.startTimer();
    
    try {
      // Validate input
      const validatedArgs = CrearTicketInputSchema.parse(args);
      
      Logger.info('Crear ticket iniciado', {
        tool: 'crear_ticket',
        servicio: validatedArgs.servicio,
        asunto: validatedArgs.asunto,
        prioridad: validatedArgs.prioridad
      });

      // Call service
      const result = await ticketService.crearTicket(validatedArgs);
      
      const duration = timer();

      if (!result.success) {
        Logger.error('Crear ticket falló', new Error(result.error || 'Unknown error'));
        return `❌ Error: ${result.error}`;
      }

      const ticket = result.data;
      
      if (!ticket) {
        Logger.error('Crear ticket falló', new Error('No ticket data returned'));
        return `❌ Error: No se pudo crear el ticket`;
      }
      
      Logger.info('Crear ticket completado', {
        tool: 'crear_ticket',
        duration_ms: duration,
        ticket_id: ticket.id,
        servicio: validatedArgs.servicio
      });

      // Format response for MCP client
      return formatTicketCreatedResponse(ticket, validatedArgs);

    } catch (error) {
      const duration = timer();
      Logger.error('Crear ticket error', error, {
        tool: 'crear_ticket',
        duration_ms: duration
      });

      if (error instanceof z.ZodError) {
        const issues = error.issues.map(issue => 
          `${issue.path.join('.')}: ${issue.message}`
        ).join(', ');
        return `❌ Error de validación: ${issues}`;
      }

      return `❌ Error inesperado: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
};

/**
 * Format response for MCP client consumption
 */
function formatTicketCreatedResponse(ticket: any, input: CrearTicketInput): string {
  const prioridadIcon = getPrioridadIcon(ticket.prioridad);
  const estadoIcon = getEstadoIcon(ticket.estado);
  
  const response = [
    `🎫 **Ticket Creado Exitosamente**`,
    ``,
    `## ${estadoIcon} Ticket #${ticket.id}`,
    ``,
    `### 📋 Información del Ticket`,
    `- **ID:** ${ticket.id}`,
    `- **Cliente/Servicio:** ${ticket.servicio}`,
    `- **Asunto:** ${ticket.asunto}`,
    `- **Estado:** ${estadoIcon} ${ticket.estado}`,
    `- **Prioridad:** ${prioridadIcon} ${ticket.prioridad}`,
    `- **Creado:** ${ticket.fecha_creacion}`,
    ``,
    `### 📝 Descripción`,
    `${ticket.descripcion}`,
    ``
  ];

  // Información de asignación
  if (ticket.tecnico) {
    response.push(`### 👨‍💻 Asignación`);
    response.push(`- **Técnico Asignado:** ${ticket.tecnico}`);
    response.push('');
  } else {
    response.push(`### ⏳ Asignación`);
    response.push(`- **Estado:** Pendiente de asignación automática`);
    response.push(`- **Prioridad:** ${ticket.prioridad} - se asignará según disponibilidad`);
    response.push('');
  }

  // Próximos pasos según prioridad
  response.push(`### 🚀 Próximos Pasos`);
  switch (ticket.prioridad) {
    case 'critica':
      response.push(`- ⚡ **Atención inmediata:** El técnico será notificado de urgencia`);
      response.push(`- 📞 Se contactará al cliente en los próximos 15 minutos`);
      break;
    case 'alta':
      response.push(`- 🔴 **Atención prioritaria:** Respuesta en 1-2 horas`);
      response.push(`- 📧 Cliente será contactado por email`);
      break;
    case 'media':
      response.push(`- 🟡 **Atención normal:** Respuesta en 4-8 horas laborales`);
      response.push(`- 📧 Cliente recibirá actualizaciones por email`);
      break;
    case 'baja':
      response.push(`- 🟢 **Atención programada:** Respuesta en 24-48 horas`);
      response.push(`- 📧 Se incluirá en la revisión diaria de tickets`);
      break;
  }
  response.push('');

  // Acciones disponibles
  response.push(`### 🛠️ Acciones Disponibles`);
  response.push(`- \`obtener_tickets_cliente servicio:${ticket.servicio}\` - Ver todos los tickets del cliente`);
  response.push(`- \`obtener_cliente clienteId:"${ticket.servicio}"\` - Ver información del cliente`);
  response.push(`- \`actualizar_ticket\` - Modificar estado o agregar notas`);

  // Tracking information
  response.push(`### 📊 Seguimiento`);
  response.push(`- **Número de referencia:** TICK-${ticket.id}`);
  response.push(`- **Para consultas:** Referenciar ticket #${ticket.id}`);
  response.push(`- **Sistema de notificaciones:** Activado para este ticket`);

  return response.join('\n');
}

/**
 * Helper functions
 */
function getPrioridadIcon(prioridad: string): string {
  const icons = {
    'baja': '🟢',
    'media': '🟡',
    'alta': '🔴',
    'critica': '⚡'
  };
  return icons[prioridad as keyof typeof icons] || '❓';
}

function getEstadoIcon(estado: string): string {
  const icons = {
    'abierto': '🆕',
    'en_proceso': '⚙️',
    'cerrado': '✅'
  };
  return icons[estado as keyof typeof icons] || '❓';
}