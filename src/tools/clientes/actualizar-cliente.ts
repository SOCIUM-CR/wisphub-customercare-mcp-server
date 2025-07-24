/**
 * Actualizar Cliente MCP Tool
 * Update client contact information and settings
 */

import { z } from 'zod';
import { ClienteService } from '../../services/cliente.service.js';
import { ActualizarClienteInputSchema } from '../../validators/schemas.js';
import { Logger } from '../../utils/logger.js';
import type { ActualizarClienteInput } from '../../types/wisphub.types.js';

// Service instance
const clienteService = new ClienteService();

/**
 * Tool definition for MCP
 */
export const actualizarClienteTool = {
  name: 'actualizar_cliente',
  description: `Actualiza la información técnica y configuraciones de un cliente.

⚠️ **LIMITACIONES DE API:** Los campos de contacto personal (email, teléfono, dirección) 
no pueden actualizarse vía API WispHub. Para estos campos, usar panel administrativo.

Esta herramienta puede actualizar:
- ✅ **Configuraciones**: Notificaciones SMS y push
- ✅ **Notas**: Comentarios adicionales del cliente  
- ⚠️ **Contacto**: Email, teléfono, dirección (limitación de API - no persisten)

Casos de uso recomendados:
- "Habilitar notificaciones SMS para cliente ID 111"
- "Agregar comentario al cliente ID 123"
- "Configurar notificaciones push para cliente ID 456"

Importante: Al menos un campo debe ser proporcionado para la actualización.`,

  inputSchema: {
    type: 'object',
    properties: {
      id_servicio: {
        type: 'number',
        minimum: 1,
        description: 'ID del servicio del cliente a actualizar'
      },
      email: {
        type: 'string',
        format: 'email',
        description: 'Nueva dirección de email del cliente'
      },
      telefono: {
        type: 'string',
        description: 'Nuevo número de teléfono'
      },
      direccion: {
        type: 'string',
        description: 'Nueva dirección física'
      },
      localidad: {
        type: 'string',
        description: 'Nueva localidad'
      },
      ciudad: {
        type: 'string',
        description: 'Nueva ciudad'
      },
      comentarios: {
        type: 'string',
        description: 'Comentarios o notas adicionales sobre el cliente'
      },
      notificacion_sms: {
        type: 'boolean',
        description: 'Habilitar o deshabilitar notificaciones SMS'
      },
      notificaciones_push: {
        type: 'boolean',
        description: 'Habilitar o deshabilitar notificaciones push'
      }
    },
    required: ['id_servicio'],
    additionalProperties: false,
    description: 'Parámetros para actualizar información del cliente. Al menos un campo opcional debe ser proporcionado.'
  },

  /**
   * Tool handler
   */
  async handler(args: unknown): Promise<string> {
    const timer = Logger.startTimer();
    
    try {
      // Validate input
      const validatedArgs = ActualizarClienteInputSchema.parse(args);
      
      // Check that at least one update field is provided
      const updateFields = Object.keys(validatedArgs).filter(key => key !== 'id_servicio');
      
      if (updateFields.length === 0) {
        return `❌ Error: Debe proporcionar al menos un campo para actualizar (comentarios, notificacion_sms, etc.)`;
      }

      // Separate fields by API capability (based on testing)
      const contactFields = ['email', 'telefono', 'direccion', 'localidad', 'ciudad'];
      const technicalFields = ['comentarios', 'notificacion_sms', 'notificaciones_push'];
      
      const requestedContactFields = updateFields.filter(field => contactFields.includes(field));
      const requestedTechnicalFields = updateFields.filter(field => technicalFields.includes(field));
      
      // Inform about API limitations for contact fields
      let limitationWarning = '';
      if (requestedContactFields.length > 0) {
        limitationWarning = `\n⚠️ **LIMITACIÓN DE API DETECTADA:**\nLos campos de contacto (${requestedContactFields.join(', ')}) no pueden actualizarse vía API WispHub.\nSe intentará la actualización pero es probable que no persistan los cambios.\n**Recomendación:** Usar panel administrativo de WispHub para actualizar información de contacto.\n\n`;
      }
      
      Logger.info('Actualizar cliente iniciado', {
        tool: 'actualizar_cliente',
        id_servicio: validatedArgs.id_servicio,
        campos_actualizados: updateFields
      });

      // Get current client data for comparison
      const clienteActualResult = await clienteService.obtenerCliente(validatedArgs.id_servicio.toString());
      
      if (!clienteActualResult.success || !clienteActualResult.data) {
        return `❌ Error: Cliente con ID ${validatedArgs.id_servicio} no encontrado`;
      }

      const clienteActual = clienteActualResult.data;

      // Call service
      const result = await clienteService.actualizarCliente(validatedArgs);
      
      const duration = timer();

      if (!result.success) {
        Logger.error('Actualizar cliente falló', new Error(result.error || 'Unknown error'));
        return `❌ Error: ${result.error}`;
      }

      const clienteActualizado = result.data;
      
      Logger.info('Actualizar cliente completado', {
        tool: 'actualizar_cliente',
        id_servicio: validatedArgs.id_servicio,
        duration_ms: duration,
        exitoso: true
      });

      // Format response for MCP client with debugging info and limitation warning
      return limitationWarning + formatClienteUpdateResponse(
        clienteActual, 
        clienteActualizado, 
        validatedArgs,
        result.debugInfo
      );

    } catch (error) {
      const duration = timer();
      Logger.error('Actualizar cliente error', error, {
        tool: 'actualizar_cliente',
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
function formatClienteUpdateResponse(
  clienteAnterior: any, 
  clienteActualizado: any, 
  cambios: ActualizarClienteInput,
  debugInfo?: any
): string {
  const statusIcon = getStatusIcon(clienteActualizado.estado);
  
  const response = [
    `✅ **Cliente Actualizado Exitosamente**`,
    ``,
    `## ${statusIcon} ${clienteActualizado.nombre_completo} (ID: ${clienteActualizado.id_servicio})`,
    ``,
    `### 🔄 Cambios Realizados`
  ];

  // Show specific changes made
  const changesList = [];
  
  if (cambios.email !== undefined) {
    changesList.push(`- **Email:** "${clienteAnterior.email || 'Sin email'}" → "${clienteActualizado.email}"`);
  }
  if (cambios.telefono !== undefined) {
    changesList.push(`- **Teléfono:** "${clienteAnterior.telefono || 'Sin teléfono'}" → "${clienteActualizado.telefono}"`);
  }
  if (cambios.direccion !== undefined) {
    changesList.push(`- **Dirección:** "${clienteAnterior.direccion || 'Sin dirección'}" → "${clienteActualizado.direccion}"`);
  }
  if (cambios.localidad !== undefined) {
    changesList.push(`- **Localidad:** "${clienteAnterior.localidad || 'Sin localidad'}" → "${clienteActualizado.localidad}"`);
  }
  if (cambios.ciudad !== undefined) {
    changesList.push(`- **Ciudad:** "${clienteAnterior.ciudad || 'Sin ciudad'}" → "${clienteActualizado.ciudad}"`);
  }
  if (cambios.comentarios !== undefined) {
    changesList.push(`- **Comentarios:** Actualizado`);
  }
  if (cambios.notificacion_sms !== undefined) {
    const smsStatus = cambios.notificacion_sms ? '✅ Habilitado' : '❌ Deshabilitado';
    changesList.push(`- **Notificaciones SMS:** ${smsStatus}`);
  }
  if (cambios.notificaciones_push !== undefined) {
    const pushStatus = cambios.notificaciones_push ? '✅ Habilitado' : '❌ Deshabilitado';
    changesList.push(`- **Notificaciones Push:** ${pushStatus}`);
  }

  response.push(...changesList);
  response.push(``);

  // Show current complete information
  response.push(`### 📋 Información Actual del Cliente`);
  response.push(`- **Usuario:** ${clienteActualizado.usuario}`);
  response.push(`- **Email:** ${clienteActualizado.email || 'No registrado'}`);
  response.push(`- **Teléfono:** ${clienteActualizado.telefono || 'No registrado'}`);
  response.push(`- **Dirección:** ${clienteActualizado.direccion || 'No registrada'}`);
  response.push(`- **Localidad:** ${clienteActualizado.localidad || 'No especificada'}`);
  response.push(`- **Ciudad:** ${clienteActualizado.ciudad || 'No especificada'}`);
  response.push(`- **Plan:** ${clienteActualizado.plan} (${clienteActualizado.precio_plan})`);
  response.push(`- **Estado:** ${statusIcon} ${clienteActualizado.estado}`);
  response.push(`- **Zona:** ${clienteActualizado.zona_nombre}`);
  response.push(``);

  // Notification settings
  if (cambios.notificacion_sms !== undefined || cambios.notificaciones_push !== undefined) {
    response.push(`### 📱 Configuración de Notificaciones`);
    response.push(`- **SMS:** ${getNotificationStatus(clienteActualizado.notificacion_sms)}`);
    response.push(`- **Push:** ${getNotificationStatus(clienteActualizado.notificaciones_push)}`);
    response.push(``);
  }

  // Comments if updated
  if (cambios.comentarios !== undefined && clienteActualizado.comentarios) {
    response.push(`### 💬 Comentarios`);
    response.push(`${clienteActualizado.comentarios}`);
    response.push(``);
  }

  // Quick actions
  response.push(`### 🛠️ Acciones Disponibles`);
  response.push(`- \`obtener_cliente clienteId:"${clienteActualizado.id_servicio}"\` - Ver información completa actualizada`);
  response.push(`- \`consultar_saldo_cliente id_servicio:${clienteActualizado.id_servicio}\` - Verificar estado financiero`);
  response.push(`- \`crear_ticket servicio:${clienteActualizado.id_servicio}\` - Crear ticket para seguimiento`);
  response.push(`- \`actualizar_cliente id_servicio:${clienteActualizado.id_servicio}\` - Realizar más actualizaciones`);

  // ALWAYS add debug information to understand what's happening (like in tickets)
  if (debugInfo) {
    response.push(``, `### 🔧 DEBUG - Información Técnica`);
    response.push(`**📤 Datos enviados a la API:**`);
    response.push(`\`\`\`json`);
    response.push(JSON.stringify(debugInfo?.sentToAPI || {}, null, 2));
    response.push(`\`\`\``);
    
    response.push(`**📥 Respuesta de la API:**`);
    response.push(`\`\`\`json`);
    response.push(JSON.stringify(debugInfo?.apiResponse || {}, null, 2));
    response.push(`\`\`\``);
    
    if (debugInfo?.verifiedCliente) {
      response.push(`**🔍 Estado verificado después de actualización:**`);
      response.push(`\`\`\`json`);
      response.push(JSON.stringify(debugInfo.verifiedCliente, null, 2));
      response.push(`\`\`\``);
    }
    
    response.push(`**📊 Cliente transformado final:**`);
    response.push(`\`\`\`json`);
    response.push(JSON.stringify(debugInfo?.transformedCliente || clienteActualizado, null, 2));
    response.push(`\`\`\``);
    
    response.push(`**🎯 Análisis:**`);
    response.push(`- Enviamos a API: ${debugInfo?.sentToAPI ? Object.keys(debugInfo.sentToAPI).join(', ') : 'Sin datos'}`);
    response.push(`- API respondió: ${debugInfo?.apiResponse ? 'Sí' : 'No'}`);
    response.push(`- Verificación funcionó: ${debugInfo?.verifiedCliente ? 'Sí' : 'No'}`);
    
    // Check specific field updates if available
    if (debugInfo?.verifiedCliente && debugInfo?.sentToAPI) {
      const verifiedFields = [];
      for (const [field, sentValue] of Object.entries(debugInfo.sentToAPI)) {
        const currentValue = debugInfo.verifiedCliente[field];
        const matches = sentValue === currentValue;
        verifiedFields.push(`${field}: ${sentValue} → ${currentValue} → ${matches ? '✅ COINCIDE' : '❌ NO COINCIDE'}`);
      }
      if (verifiedFields.length > 0) {
        response.push(`**🔍 Verificación por campo:**`);
        verifiedFields.forEach(field => response.push(`- ${field}`));
      }
    }
    
    if (debugInfo?.verificationFailed) {
      response.push(`- ⚠️ **VERIFICACIÓN FALLÓ** - Los datos podrían no haberse guardado correctamente`);
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

function getNotificationStatus(enabled: boolean | undefined): string {
  if (enabled === undefined) return '❓ No definido';
  return enabled ? '✅ Habilitado' : '❌ Deshabilitado';
}