/**
 * Obtener Tickets Cliente MCP Tool
 * Get all tickets for a specific client
 */

import { z } from 'zod';
import { TicketService } from '../../services/ticket.service.js';
import { ConsultarSaldoInputSchema } from '../../validators/schemas.js'; // Reuse schema with id_servicio
import { Logger } from '../../utils/logger.js';

// Service instance
const ticketService = new TicketService();

/**
 * Tool definition for MCP
 */
export const obtenerTicketsClienteTool = {
  name: 'obtener_tickets_cliente',
  description: `Obtiene el historial completo de tickets de soporte de un cliente específico.

Esta herramienta muestra todos los tickets asociados a un cliente:
- Tickets abiertos, en proceso y cerrados
- Información completa: asunto, descripción, prioridad, estado
- Fechas de creación y cierre
- Técnico asignado
- Historial cronológico ordenado

Casos de uso típicos:
- "Ver todos los tickets del cliente 12345"
- "Revisar historial de soporte del servicio 987"
- "Consultar incidencias anteriores antes de crear nuevo ticket"

Útil para entender el historial de problemas y dar seguimiento personalizado.`,

  inputSchema: {
    type: 'object',
    properties: {
      servicio: {
        type: 'number',
        minimum: 1,
        description: 'ID del servicio del cliente'
      }
    },
    required: ['servicio'],
    additionalProperties: false,
    description: 'ID del servicio para consultar tickets'
  },

  /**
   * Tool handler
   */
  async handler(args: unknown): Promise<string> {
    const timer = Logger.startTimer();
    
    try {
      // Validate input using existing schema (reusing ConsultarSaldoInputSchema structure)
      const schema = z.object({
        servicio: z.number().positive().describe('ID del servicio del cliente')
      });
      const validatedArgs = schema.parse(args);
      
      Logger.info('Obtener tickets cliente iniciado', {
        tool: 'obtener_tickets_cliente',
        servicio: validatedArgs.servicio
      });

      // Call service
      const result = await ticketService.obtenerTicketsCliente(validatedArgs.servicio);
      
      const duration = timer();

      if (!result.success) {
        Logger.error('Obtener tickets cliente falló', new Error(result.error || 'Unknown error'));
        return `❌ Error: ${result.error}`;
      }

      const tickets = result.data || [];
      
      Logger.info('Obtener tickets cliente completado', {
        tool: 'obtener_tickets_cliente',
        servicio: validatedArgs.servicio,
        duration_ms: duration,
        tickets_count: tickets.length
      });

      // Format response for MCP client
      return formatTicketsHistoryResponse(tickets, validatedArgs.servicio);

    } catch (error) {
      const duration = timer();
      Logger.error('Obtener tickets cliente error', error, {
        tool: 'obtener_tickets_cliente',
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
function formatTicketsHistoryResponse(tickets: any[], servicioId: number): string {
  if (tickets.length === 0) {
    return `📋 **Historial de Tickets - Servicio ${servicioId}**

🔍 No se encontraron tickets para este cliente.

💡 **Información:**
- Este cliente no ha reportado ninguna incidencia
- Es un cliente sin problemas técnicos registrados
- Puede crear un nuevo ticket si necesita reportar algún problema

🛠️ **Acciones disponibles:**
- \`crear_ticket\` - Crear nuevo ticket de soporte
- \`obtener_cliente clienteId:"${servicioId}"\` - Ver información del cliente`;
  }

  const ticketsAbiertos = tickets.filter(t => t.estado === 'abierto').length;
  const ticketsEnProceso = tickets.filter(t => t.estado === 'en_proceso').length;
  const ticketsCerrados = tickets.filter(t => t.estado === 'cerrado').length;

  const response = [
    `📋 **Historial de Tickets - Servicio ${servicioId}**`,
    ``,
    `### 📊 Resumen`,
    `- **Total de tickets:** ${tickets.length}`,
    `- **🆕 Abiertos:** ${ticketsAbiertos}`,
    `- **⚙️ En proceso:** ${ticketsEnProceso}`,
    `- **✅ Cerrados:** ${ticketsCerrados}`,
    ``,
    `### 🎫 Listado de Tickets (más recientes primero)`,
    ``
  ];

  // Sort tickets by creation date (newest first)
  const sortedTickets = [...tickets].sort((a, b) => 
    new Date(b.fecha_creacion).getTime() - new Date(a.fecha_creacion).getTime()
  );

  sortedTickets.forEach((ticket, index) => {
    const estadoIcon = getEstadoIcon(ticket.estado);
    const prioridadIcon = getPrioridadIcon(ticket.prioridad);
    const isRecent = index < 3; // Highlight 3 most recent
    
    response.push(`${isRecent ? '🔥 ' : ''}**#${ticket.id}** ${estadoIcon} ${ticket.asunto}`);
    response.push(`   📅 ${ticket.fecha_creacion} | ${prioridadIcon} ${ticket.prioridad}`);
    response.push(`   👨‍💻 ${ticket.tecnico || 'Sin asignar'} | Estado: ${ticket.estado}`);
    response.push(`   📝 ${ticket.descripcion.substring(0, 100)}${ticket.descripcion.length > 100 ? '...' : ''}`);
    
    if (ticket.fecha_cierre) {
      response.push(`   ✅ Cerrado: ${ticket.fecha_cierre}`);
    }
    
    response.push(''); // Empty line between tickets
  });

  // Add statistics and insights
  if (tickets.length > 1) {
    response.push(`### 📈 Análisis del Historial`);
    
    const avgDiasResolucion = calcularPromedioResolucion(tickets.filter(t => t.fecha_cierre));
    if (avgDiasResolucion > 0) {
      response.push(`- **Tiempo promedio de resolución:** ${avgDiasResolucion.toFixed(1)} días`);
    }
    
    const problemasFrecuentes = analizarProblemasComunes(tickets);
    if (problemasFrecuentes.length > 0) {
      response.push(`- **Problemas más frecuentes:** ${problemasFrecuentes.join(', ')}`);
    }
    
    response.push('');
  }

  // Quick actions
  response.push(`### 🛠️ Acciones Disponibles`);
  response.push(`- \`crear_ticket\` - Crear nuevo ticket para este cliente`);
  response.push(`- \`obtener_cliente clienteId:"${servicioId}"\` - Ver información completa del cliente`);
  response.push(`- \`consultar_saldo_cliente servicio:${servicioId}\` - Verificar estado de cuenta`);
  
  if (ticketsAbiertos > 0 || ticketsEnProceso > 0) {
    response.push(`- \`actualizar_ticket\` - Modificar estado de tickets pendientes`);
  }

  return response.join('\n');
}

/**
 * Helper functions
 */
function getEstadoIcon(estado: string): string {
  const icons = {
    'abierto': '🆕',
    'en_proceso': '⚙️',
    'cerrado': '✅'
  };
  return icons[estado as keyof typeof icons] || '❓';
}

function getPrioridadIcon(prioridad: string): string {
  const icons = {
    'baja': '🟢',
    'media': '🟡',
    'alta': '🔴',
    'critica': '⚡'
  };
  return icons[prioridad as keyof typeof icons] || '❓';
}

function calcularPromedioResolucion(ticketsCerrados: any[]): number {
  if (ticketsCerrados.length === 0) return 0;
  
  const tiemposResolucion = ticketsCerrados.map(ticket => {
    const inicio = new Date(ticket.fecha_creacion);
    const fin = new Date(ticket.fecha_cierre);
    return (fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24); // días
  });
  
  return tiemposResolucion.reduce((sum, tiempo) => sum + tiempo, 0) / tiemposResolucion.length;
}

function analizarProblemasComunes(tickets: any[]): string[] {
  // Simple analysis of common keywords in subjects
  const keywords = ['internet', 'conectividad', 'velocidad', 'wifi', 'cable', 'router', 'señal'];
  const problemas: { [key: string]: number } = {};
  
  tickets.forEach(ticket => {
    const asunto = ticket.asunto.toLowerCase();
    keywords.forEach(keyword => {
      if (asunto.includes(keyword)) {
        problemas[keyword] = (problemas[keyword] || 0) + 1;
      }
    });
  });
  
  return Object.entries(problemas)
    .filter(([_, count]) => count > 1) // Only show if appears more than once
    .sort(([_, a], [__, b]) => b - a) // Sort by frequency
    .slice(0, 3) // Top 3
    .map(([keyword, count]) => `${keyword} (${count})`);
}