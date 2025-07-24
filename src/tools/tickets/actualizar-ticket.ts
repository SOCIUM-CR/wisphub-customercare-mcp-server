/**
 * Actualizar Ticket MCP Tool
 * Update ticket status, priority, technician, and add notes
 */

import { z } from 'zod';
import { TicketService } from '../../services/ticket.service.js';
import { ActualizarTicketInputSchema } from '../../validators/schemas.js';
import { Logger } from '../../utils/logger.js';
import type { ActualizarTicketInput } from '../../types/wisphub.types.js';

// Service instance
const ticketService = new TicketService();

/**
 * Tool definition for MCP
 */
export const actualizarTicketTool = {
  name: 'actualizar_ticket',
  description: `Actualiza el estado, prioridad o información de un ticket existente.

Esta herramienta permite gestionar el ciclo de vida completo de tickets:
- Cambiar estado (abierto → en_proceso → cerrado)
- Modificar prioridad (baja, media, alta, critica)
- Reasignar técnico responsable
- Agregar notas de seguimiento

Casos de uso típicos:
- "Cerrar ticket ID 123 porque se resolvió el problema"
- "Cambiar prioridad del ticket 456 a alta"
- "Asignar ticket 789 al técnico 3288010"
- "Agregar nota de seguimiento al ticket 111"

Importante: Al menos uno de los campos opcionales debe ser proporcionado.`,

  inputSchema: {
    type: 'object',
    properties: {
      ticketId: {
        type: 'number',
        minimum: 1,
        description: 'ID del ticket a actualizar'
      },
      estado: {
        type: 'string',
        enum: ['nuevo', 'en_progreso', 'resuelto', 'cerrado'],
        description: 'Nuevo estado del ticket (nuevo, en_progreso, resuelto, cerrado)'
      },
      prioridad: {
        type: 'string',
        enum: ['baja', 'normal', 'alta', 'muy_alta'],
        description: 'Nueva prioridad del ticket (baja, normal, alta, muy_alta)'
      },
      tecnico: {
        type: 'string',
        description: 'ID del técnico asignado (ej: 3288010 para admin@almacreativa)'
      },
      notas: {
        type: 'string',
        description: 'Notas adicionales sobre la actualización o seguimiento'
      }
    },
    required: ['ticketId'],
    additionalProperties: false,
    description: 'Parámetros para actualizar un ticket existente. Al menos un campo opcional debe ser proporcionado.'
  },

  /**
   * Tool handler
   */
  async handler(args: unknown): Promise<string> {
    const timer = Logger.startTimer();
    
    try {
      // Validate input
      const validatedArgs = ActualizarTicketInputSchema.parse(args);
      
      // Check that at least one update field is provided
      const hasUpdates = validatedArgs.estado || validatedArgs.prioridad || 
                        validatedArgs.tecnico || validatedArgs.notas;
      
      if (!hasUpdates) {
        return `❌ Error: Debe proporcionar al menos un campo para actualizar (estado, prioridad, tecnico, o notas)`;
      }
      
      Logger.info('Actualizar ticket iniciado', {
        tool: 'actualizar_ticket',
        ticketId: validatedArgs.ticketId,
        updates: {
          estado: validatedArgs.estado,
          prioridad: validatedArgs.prioridad,
          tecnico: validatedArgs.tecnico,
          hasNotas: !!validatedArgs.notas
        }
      });

      // Prepare updates object for service
      const updates: any = {};
      if (validatedArgs.estado) updates.estado = validatedArgs.estado;
      if (validatedArgs.prioridad) updates.prioridad = validatedArgs.prioridad;
      if (validatedArgs.tecnico) updates.tecnico = validatedArgs.tecnico;
      if (validatedArgs.notas) updates.notas = validatedArgs.notas;

      // Call service
      const result = await ticketService.actualizarTicket(validatedArgs.ticketId, updates);
      
      const duration = timer();

      if (!result.success) {
        Logger.error('Actualizar ticket falló', new Error(result.error || 'Unknown error'));
        return `❌ Error: ${result.error}`;
      }

      const ticket = result.data;
      
      Logger.info('Actualizar ticket completado', {
        tool: 'actualizar_ticket',
        ticketId: validatedArgs.ticketId,
        duration_ms: duration,
        actualizado: true
      });

      // Format response for MCP client with debugging info
      return formatTicketUpdateResponse(ticket, validatedArgs, result.debugInfo);

    } catch (error) {
      const duration = timer();
      Logger.error('Actualizar ticket error', error, {
        tool: 'actualizar_ticket',
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
function formatTicketUpdateResponse(ticket: any, updates: ActualizarTicketInput, debugInfo?: any): string {
  // Safe access to ticket properties with fallbacks
  const ticketId = ticket?.id || updates.ticketId || 'Desconocido';
  const asunto = ticket?.asunto || 'No disponible';
  const estado = ticket?.estado || 'desconocido';
  const prioridad = ticket?.prioridad || 'media';
  const tecnico = ticket?.tecnico || 'No asignado';
  const servicio = ticket?.servicio || updates.ticketId || 'Desconocido';
  
  const statusIcon = getStatusIcon(estado);
  const priorityIcon = getPriorityIcon(prioridad);
  
  const response = [
    `✅ **Ticket Actualizado Exitosamente**`,
    ``,
    `## ${statusIcon} Ticket #${ticketId}`,
    ``,
    `### 📋 Información Actualizada`,
    `- **Asunto:** ${asunto}`,
    `- **Estado:** ${statusIcon} ${estado}`,
    `- **Prioridad:** ${priorityIcon} ${prioridad}`,
    `- **Técnico:** ${tecnico}`,
    `- **Servicio:** ${servicio}`,
    ``,
    `### 🔄 Cambios Realizados`
  ];

  // Show what was updated
  const cambios = [];
  if (updates.estado) cambios.push(`- **Estado:** ${getStatusIcon(updates.estado)} ${updates.estado}`);
  if (updates.prioridad) cambios.push(`- **Prioridad:** ${getPriorityIcon(updates.prioridad)} ${updates.prioridad}`);
  if (updates.tecnico) cambios.push(`- **Técnico:** ${updates.tecnico}`);
  if (updates.notas) cambios.push(`- **Notas:** ${updates.notas}`);

  if (cambios.length > 0) {
    response.push(...cambios);
  } else {
    response.push(`- Sin cambios específicos registrados`);
  }

  response.push(``);
  response.push(`### 📅 Fechas`);
  response.push(`- **Creado:** ${ticket?.fecha_creacion || 'No disponible'}`);
  if (ticket?.fecha_cierre) {
    response.push(`- **Cerrado:** ${ticket.fecha_cierre}`);
  }

  // Quick actions based on current state
  response.push(``, `### 🛠️ Acciones Disponibles`);
  
  if (estado === 'nuevo') {
    response.push(`- \`actualizar_ticket ticketId:${ticketId} estado:"en_progreso"\` - Marcar como en progreso`);
    response.push(`- \`actualizar_ticket ticketId:${ticketId} prioridad:"alta"\` - Aumentar prioridad`);
  } else if (estado === 'en_progreso') {
    response.push(`- \`actualizar_ticket ticketId:${ticketId} estado:"resuelto"\` - Marcar como resuelto`);
    response.push(`- \`actualizar_ticket ticketId:${ticketId} notas:"Actualizando progreso..."\` - Agregar notas`);
  } else if (estado === 'resuelto') {
    response.push(`- \`actualizar_ticket ticketId:${ticketId} estado:"cerrado"\` - Cerrar ticket`);
  } else if (estado === 'cerrado') {
    response.push(`- \`actualizar_ticket ticketId:${ticketId} estado:"nuevo"\` - Reabrir ticket`);
  }
  
  response.push(`- \`obtener_cliente clienteId:"${servicio}"\` - Ver detalles del cliente`);

  // ALWAYS add debug information to understand what's happening
  response.push(``, `### 🔧 DEBUG - Información Técnica`);
  response.push(`**📤 Datos enviados a la API:**`);
  response.push(`\`\`\`json`);
  response.push(JSON.stringify(debugInfo?.sentToAPI || {}, null, 2));
  response.push(`\`\`\``);
  
  response.push(`**📥 Respuesta de la API:**`);
  response.push(`\`\`\`json`);
  response.push(JSON.stringify(debugInfo?.apiResponse || {}, null, 2));
  response.push(`\`\`\``);
  
  if (debugInfo?.verifiedTicket) {
    response.push(`**🔍 Estado verificado después de actualización:**`);
    response.push(`\`\`\`json`);
    response.push(JSON.stringify(debugInfo.verifiedTicket, null, 2));
    response.push(`\`\`\``);
  }
  
  response.push(`**📊 Ticket transformado final:**`);
  response.push(`\`\`\`json`);
  response.push(JSON.stringify(debugInfo?.transformedTicket || ticket, null, 2));
  response.push(`\`\`\``);
  
  response.push(`**🎯 Análisis:**`);
  response.push(`- Enviamos a API: ${debugInfo?.sentToAPI ? Object.keys(debugInfo.sentToAPI).join(', ') : 'Sin datos'}`);
  response.push(`- API respondió: ${debugInfo?.apiResponse ? 'Sí' : 'No'}`);
  response.push(`- Verificación funcionó: ${debugInfo?.verifiedTicket ? 'Sí' : 'No'}`);
  if (updates.estado && debugInfo?.verifiedTicket) {
    const sentEstado = debugInfo.sentToAPI?.estado;
    const currentEstado = debugInfo.verifiedTicket?.estado;
    response.push(`- Estado enviado: ${sentEstado} → Estado actual: ${currentEstado} → ${sentEstado === currentEstado ? '✅ COINCIDE' : '❌ NO COINCIDE'}`);
  }

  return response.join('\\n');
}

/**
 * Helper functions
 */
function getStatusIcon(estado: string): string {
  const icons = {
    'nuevo': '🔴',
    'en_progreso': '🟡', 
    'resuelto': '🟢',
    'cerrado': '✅'
  };
  return icons[estado as keyof typeof icons] || '❓';
}

function getPriorityIcon(prioridad: string): string {
  const icons = {
    'baja': '🔵',
    'normal': '🟡',
    'alta': '🟠',
    'muy_alta': '🔴'
  };
  return icons[prioridad as keyof typeof icons] || '❓';
}