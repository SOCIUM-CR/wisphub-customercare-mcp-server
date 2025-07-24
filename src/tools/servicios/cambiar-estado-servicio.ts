/**
 * Cambiar Estado Servicio MCP Tool
 * Suspend or reactivate client services
 */

import { z } from 'zod';
import { ClienteService } from '../../services/cliente.service.js';
import { CambiarEstadoServicioInputSchema } from '../../validators/schemas.js';
import { Logger } from '../../utils/logger.js';
import type { CambiarEstadoServicioInput } from '../../types/wisphub.types.js';

// Service instance
const clienteService = new ClienteService();

/**
 * Tool definition for MCP
 */
export const cambiarEstadoServicioTool = {
  name: 'cambiar_estado_servicio',
  description: `Gestiona cambios de estado de servicios con transparencia total sobre limitaciones de API.

⚠️ **LIMITACIÓN DE API DETECTADA:** Los cambios de estado no persisten vía API WispHub. 
La API acepta el cambio pero el sistema lo revierte automáticamente a "Activo".

Esta herramienta puede:
- ✅ **Documentar motivos**: Los comentarios sí persisten para auditoría
- ✅ **Registrar intención**: Queda evidencia del cambio solicitado  
- ⚠️ **Estado físico**: Debe cambiarse manualmente en panel administrativo

Casos de uso recomendados:
- "Documentar suspensión por falta de pago" (registro de motivo)
- "Registrar intención de cancelación" (auditoría interna)
- "Crear evidencia para gestión manual" (workflow híbrido)

**Workflow recomendado**: Esta herramienta + cambio manual en panel admin.`,

  inputSchema: {
    type: 'object',
    properties: {
      id_servicio: {
        type: 'number',
        minimum: 1,
        description: 'ID del servicio del cliente a modificar'
      },
      nuevo_estado: {
        type: 'string',
        enum: ['activo', 'suspendido', 'cancelado'],
        description: 'Nuevo estado del servicio'
      },
      motivo: {
        type: 'string',
        minLength: 1,
        description: 'Motivo obligatorio del cambio de estado'
      }
    },
    required: ['id_servicio', 'nuevo_estado', 'motivo'],
    additionalProperties: false,
    description: 'Parámetros para cambiar el estado de un servicio'
  },

  /**
   * Tool handler
   */
  async handler(args: unknown): Promise<string> {
    const timer = Logger.startTimer();
    
    try {
      // Validate input
      const validatedArgs = CambiarEstadoServicioInputSchema.parse(args);
      
      Logger.info('Cambiar estado servicio iniciado', {
        tool: 'cambiar_estado_servicio',
        id_servicio: validatedArgs.id_servicio,
        nuevo_estado: validatedArgs.nuevo_estado,
        motivo: validatedArgs.motivo
      });

      // Get current client state first
      const clienteResult = await clienteService.obtenerCliente(validatedArgs.id_servicio.toString());
      
      if (!clienteResult.success || !clienteResult.data) {
        return `❌ Error: Cliente con ID ${validatedArgs.id_servicio} no encontrado`;
      }

      const cliente = clienteResult.data;
      const estadoActual = cliente.estado;

      // Check if change is necessary
      if (estadoActual === validatedArgs.nuevo_estado) {
        return `⚠️ El servicio ID ${validatedArgs.id_servicio} ya está en estado "${validatedArgs.nuevo_estado}"`;
      }

      // Proactive warning about API limitation (like in actualizar_cliente)
      const limitationWarning = `\n⚠️ **LIMITACIÓN DE API DETECTADA:**\nLos cambios de estado no persisten vía API WispHub. El sistema revierte automáticamente a "Activo".\n**Se registrará el motivo para auditoría, pero el estado físico debe cambiarse manualmente en el panel administrativo.**\n**URL Admin Panel:** [Acceder al panel de administración de WispHub]\n\n`;

      // Call appropriate service method based on target state
      let result;
      
      if (validatedArgs.nuevo_estado === 'activo') {
        result = await clienteService.activarServicio({
          id_servicio: validatedArgs.id_servicio,
          motivo: validatedArgs.motivo
        });
      } else if (validatedArgs.nuevo_estado === 'suspendido') {
        result = await clienteService.desactivarServicio({
          id_servicio: validatedArgs.id_servicio,
          motivo: validatedArgs.motivo
        });
      } else {
        // For 'cancelado', use the dedicated cancelarServicio method
        result = await clienteService.cancelarServicio({
          id_servicio: validatedArgs.id_servicio,
          motivo: validatedArgs.motivo
        });
      }
      
      const duration = timer();

      if (!result.success) {
        Logger.error('Cambiar estado servicio falló', new Error(result.error || 'Unknown error'));
        return `❌ Error: ${result.error}`;
      }
      
      Logger.info('Cambiar estado servicio completado', {
        tool: 'cambiar_estado_servicio',
        id_servicio: validatedArgs.id_servicio,
        estado_anterior: estadoActual,
        estado_nuevo: validatedArgs.nuevo_estado,
        duration_ms: duration,
        exitoso: true
      });

      // Format response for MCP client with debug info and limitation warning
      return limitationWarning + formatEstadoChangeResponse(
        cliente, 
        estadoActual, 
        validatedArgs.nuevo_estado, 
        validatedArgs.motivo,
        result.debugInfo
      );

    } catch (error) {
      const duration = timer();
      Logger.error('Cambiar estado servicio error', error, {
        tool: 'cambiar_estado_servicio',
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
function formatEstadoChangeResponse(
  cliente: any, 
  estadoAnterior: string, 
  estadoNuevo: string, 
  motivo: string,
  debugInfo?: any
): string {
  const oldIcon = getStatusIcon(estadoAnterior);
  const newIcon = getStatusIcon(estadoNuevo);
  const actionIcon = getActionIcon(estadoNuevo);
  
  const response = [
    `${actionIcon} **Estado de Servicio Actualizado**`,
    ``,
    `## 👤 ${cliente.nombre_completo} (ID: ${cliente.id_servicio})`,
    ``,
    `### 🔄 Cambio de Estado`,
    `- **Estado Anterior:** ${oldIcon} ${estadoAnterior}`,
    `- **Estado Nuevo:** ${newIcon} ${estadoNuevo}`,
    `- **Motivo:** ${motivo}`,
    `- **Fecha:** ${new Date().toLocaleString('es-MX')}`,
    ``,
    `### 📋 Información del Cliente`,
    `- **Usuario:** ${cliente.usuario}`,
    `- **Plan:** ${cliente.plan} (${cliente.precio_plan})`,
    `- **Zona:** ${cliente.zona_nombre}`,
    `- **Saldo:** ${cliente.saldo_formateado}`,
    `- **IP:** ${cliente.configuracion_red.ip}`,
    ``
  ];

  // Add specific guidance based on new state
  response.push(`### 📝 Acciones Recomendadas`);
  
  if (estadoNuevo === 'activo') {
    response.push(`- ✅ Servicio reactivado - verificar conectividad del cliente`);
    response.push(`- 📞 Contactar al cliente para confirmar funcionamiento`);
    response.push(`- 🔍 Monitorear estabilidad en las próximas 24 horas`);
  } else if (estadoNuevo === 'suspendido') {
    response.push(`- ⏸️ Servicio suspendido - acceso a internet bloqueado`);
    response.push(`- 📧 Notificar al cliente sobre la suspensión`);
    response.push(`- 💰 Si es por pago, enviar recordatorio de factura`);
  } else if (estadoNuevo === 'cancelado') {
    response.push(`- 🚫 Servicio cancelado definitivamente`);
    response.push(`- 📦 Programar recolección de equipos`);
    response.push(`- 📋 Procesar liquidación final de cuenta`);
  }

  // Quick actions
  response.push(``, `### 🛠️ Acciones Disponibles`);
  response.push(`- \`obtener_cliente clienteId:"${cliente.id_servicio}"\` - Ver estado actualizado`);
  response.push(`- \`consultar_saldo_cliente id_servicio:${cliente.id_servicio}\` - Verificar estado financiero`);
  response.push(`- \`crear_ticket servicio:${cliente.id_servicio}\` - Crear ticket de seguimiento`);
  
  if (estadoNuevo !== 'activo') {
    response.push(`- \`cambiar_estado_servicio id_servicio:${cliente.id_servicio} nuevo_estado:"activo"\` - Reactivar servicio`);
  }

  // Add debug information like in actualizar_cliente for troubleshooting
  if (debugInfo) {
    response.push(``, `### 🔧 DEBUG - Verificación de Cambio de Estado`);
    response.push(`**📤 Datos enviados a la API:**`);
    response.push(`\`\`\`json`);
    response.push(JSON.stringify(debugInfo.sentToAPI || {}, null, 2));
    response.push(`\`\`\``);
    
    response.push(`**📥 Respuesta de la API:**`);
    response.push(`\`\`\`json`);
    response.push(JSON.stringify(debugInfo.apiResponse || {}, null, 2));
    response.push(`\`\`\``);
    
    if (debugInfo.verifiedCliente) {
      response.push(`**🔍 Cliente verificado después del cambio:**`);
      response.push(`\`\`\`json`);
      response.push(JSON.stringify(debugInfo.verifiedCliente, null, 2));
      response.push(`\`\`\``);
    }
    
    response.push(`**🎯 Análisis de Verificación:**`);
    response.push(`- Método usado: ${debugInfo.method}`);
    response.push(`- Endpoint: ${debugInfo.endpoint}`);
    response.push(`- API respondió: ${debugInfo.apiResponse ? 'Sí' : 'No'}`);
    response.push(`- Verificación funcionó: ${debugInfo.verificationWorked ? 'Sí' : 'No'}`);
    response.push(`- Estado cambió correctamente: ${debugInfo.statusChanged ? '✅ SÍ' : '❌ NO'}`);
    
    if (debugInfo.verifiedCliente) {
      response.push(`- Estado actual en sistema: ${debugInfo.verifiedCliente.estado}`);
      response.push(`- Estado esperado: ${estadoNuevo}`);
      
      if (!debugInfo.statusChanged) {
        response.push(`- ⚠️ **POSIBLE ISSUE:** Estado no cambió en el sistema - verificar API`);
      }
    }
  }

  return response.join('\\n');
}

/**
 * Helper functions
 */
function getStatusIcon(estado: string): string {
  const icons = {
    'activo': '🟢',
    'suspendido': '🟡',
    'cancelado': '🔴'
  };
  return icons[estado as keyof typeof icons] || '❓';
}

function getActionIcon(estadoNuevo: string): string {
  const icons = {
    'activo': '✅',
    'suspendido': '⏸️',
    'cancelado': '🚫'
  };
  return icons[estadoNuevo as keyof typeof icons] || '🔄';
}