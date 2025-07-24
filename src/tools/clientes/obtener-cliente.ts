/**
 * Obtener Cliente MCP Tool
 * Get detailed information for a specific client
 */

import { z } from 'zod';
import { ClienteService } from '../../services/cliente.service.js';
import { ObtenerClienteInputSchema } from '../../validators/schemas.js';
import { Logger } from '../../utils/logger.js';
import { ErrorHandler } from '../../utils/error-handler.js';
import type { ObtenerClienteInput } from '../../types/wisphub.types.js';

// Service instance
const clienteService = new ClienteService();

/**
 * Tool definition for MCP
 */
export const obtenerClienteTool = {
  name: 'obtener_cliente',
  description: `Obtiene información detallada de un cliente específico por ID o email.

Esta herramienta proporciona toda la información disponible de un cliente:
- Datos personales completos (nombre, contacto, dirección)
- Estado del servicio y configuración técnica
- Información de facturación y saldo
- Historial de cambios recientes
- Configuración de red (IP, MAC, VLAN)
- Planes contratados y características

Casos de uso típicos:
- "Obtener detalles del cliente con ID 12345"
- "Buscar información del cliente juan@email.com"
- "Ver perfil completo del cliente ID 987"

La información mostrada es más completa que en la lista general de clientes.`,

  inputSchema: {
    type: 'object',
    properties: {
      clienteId: {
        type: 'string',
        minLength: 1,
        description: 'ID del cliente, email, o número de servicio'
      }
    },
    required: ['clienteId'],
    additionalProperties: false,
    description: 'Identificador del cliente a consultar'
  },

  /**
   * Tool handler
   */
  async handler(args: unknown): Promise<string> {
    const timer = Logger.startTimer();
    
    try {
      // Validate input
      const validatedArgs = ObtenerClienteInputSchema.parse(args);
      
      Logger.info('Obtener cliente iniciado', {
        tool: 'obtener_cliente',
        clienteId: validatedArgs.clienteId
      });

      // Call service
      const result = await clienteService.obtenerCliente(validatedArgs.clienteId);
      
      const duration = timer();

      if (!result.success) {
        Logger.error('Obtener cliente falló', new Error(result.error || 'Unknown error'));
        return `❌ Error: ${result.error}`;
      }

      const cliente = result.data;
      
      if (!cliente) {
        Logger.info('Cliente no encontrado', {
          tool: 'obtener_cliente',
          clienteId: validatedArgs.clienteId,
          duration_ms: duration
        });
        return `🔍 Cliente no encontrado: "${validatedArgs.clienteId}"

💡 **Sugerencias:**
- Verifica que el ID del cliente sea correcto
- Prueba buscar por email completo
- Usa \`consultar_clientes\` para listar clientes disponibles`;
      }
      
      Logger.info('Obtener cliente completado', {
        tool: 'obtener_cliente',
        clienteId: validatedArgs.clienteId,
        duration_ms: duration,
        encontrado: true
      });

      // Format response for MCP client with debug info
      return formatClienteDetailResponse(cliente, result.debugInfo);

    } catch (error) {
      const duration = timer();
      return ErrorHandler.handleError(error, {
        tool: 'obtener_cliente',
        operation: 'buscar_cliente',
        duration
      });
    }
  }
};

/**
 * Format response for MCP client consumption
 */
function formatClienteDetailResponse(cliente: any, debugInfo?: any): string {
  const statusIcon = getStatusIcon(cliente.estado);
  const saldoIcon = getSaldoIcon(cliente.saldo_numerico);
  
  const response = [
    `👤 **Perfil Completo del Cliente**`,
    ``,
    `## ${statusIcon} ${cliente.nombre_completo} (ID: ${cliente.id_servicio})`,
    ``,
    `### 📞 Información de Contacto`,
    `- **Usuario:** ${cliente.usuario}`,
    `- **Email:** ${cliente.email || 'No registrado'}`,
    `- **Teléfono:** ${cliente.telefono || 'No registrado'}`,
    `- **Dirección:** ${cliente.direccion || 'No registrada'}`,
    `- **Localidad:** ${cliente.localidad || 'No especificada'}`,
    `- **Ciudad:** ${cliente.ciudad || 'No especificada'}`,
    `- **Zona:** ${cliente.zona} (${cliente.zona_nombre})`,
    ``,
    `### 🌐 Configuración de Red`,
    `- **IP Asignada:** ${cliente.configuracion_red.ip}`,
    `- **IP Local:** ${cliente.configuracion_red.ip_local || 'No configurada'}`,
    `- **MAC Address:** ${cliente.configuracion_red.mac}`,
    `- **Interfaz LAN:** ${cliente.configuracion_red.interfaz_lan}`,
    `- **Router:** ${cliente.configuracion_red.router_nombre}`,
    ``,
    `### 📡 WiFi Router`,
    `- **Modelo:** ${cliente.configuracion_red.router_wifi.modelo || 'No especificado'}`,
    `- **IP Router WiFi:** ${cliente.configuracion_red.router_wifi.ip || 'No configurada'}`,
    `- **MAC Router WiFi:** ${cliente.configuracion_red.router_wifi.mac || 'No registrada'}`,
    `- **SSID:** ${cliente.configuracion_red.router_wifi.ssid || 'No configurado'}`,
    ``,
    `### 📦 Plan y Servicio`,
    `- **Plan Contratado:** ${cliente.plan}`,
    `- **Precio:** ${cliente.precio_plan}`,
    `- **Estado:** ${statusIcon} ${cliente.estado}`,
    `- **Estado Facturas:** ${cliente.estado_facturas}`,
    `- **Fecha de Instalación:** ${cliente.fecha_instalacion}`,
    `- **Fecha de Corte:** ${cliente.fecha_corte}`,
    `- **Último Cambio:** ${cliente.fecha_ultimo_cambio}`,
    ``
  ];

  // Información financiera
  response.push(`### 💰 Estado Financiero`);
  response.push(`- **Saldo Actual:** ${saldoIcon} ${cliente.saldo_formateado}`);
  response.push(`- **Último Pago:** ${cliente.ultimo_pago || 'No registrado'}`);
  response.push(`- **Fecha Vencimiento:** ${cliente.fecha_vencimiento || 'No definida'}`);
  
  if (cliente.saldo_numerico < 0) {
    const diasAtraso = cliente.dias_atraso || 0;
    response.push(`- **Días de Atraso:** ${diasAtraso} días`);
  }
  response.push('');

  // Técnico asignado
  if (cliente.tecnico?.nombre) {
    response.push(`### 👨‍💻 Técnico Asignado`);
    response.push(`- **Nombre:** ${cliente.tecnico.nombre}`);
    response.push(`- **ID:** ${cliente.tecnico.id}`);
    response.push('');
  }

  // Ubicación
  if (cliente.coordenadas) {
    response.push(`### 📍 Ubicación`);
    response.push(`- **Coordenadas:** ${cliente.coordenadas}`);
    response.push('');
  }

  // Comentarios y notas
  if (cliente.comentarios) {
    response.push(`### 💬 Comentarios`);
    response.push(`${cliente.comentarios}`);
    response.push('');
  }

  // Información técnica adicional
  if (cliente.configuracion_red.mikrotik_id || cliente.configuracion_red.switch_port) {
    response.push(`### 🔧 Información Técnica`);
    if (cliente.configuracion_red.mikrotik_id) {
      response.push(`- **Mikrotik ID:** ${cliente.configuracion_red.mikrotik_id}`);
    }
    if (cliente.configuracion_red.switch_port) {
      response.push(`- **Puerto Switch:** ${cliente.configuracion_red.switch_port}`);
    }
    response.push('');
  }

  // Quick actions
  response.push(`### 🛠️ Acciones Disponibles`);
  response.push(`- \`consultar_saldo_cliente clienteId:"${cliente.id_servicio}"\` - Ver detalles financieros`);
  response.push(`- \`obtener_tickets_cliente clienteId:"${cliente.id_servicio}"\` - Ver historial de tickets`);
  response.push(`- \`crear_ticket\` - Crear nuevo ticket para este cliente`);
  
  if (cliente.estado === 'activo') {
    response.push(`- \`cambiar_estado_servicio\` - Suspender servicio`);
  } else if (cliente.estado === 'suspendido') {
    response.push(`- \`cambiar_estado_servicio\` - Reactivar servicio`);
  }

  // Add debug information if available (for reliability analysis)
  if (debugInfo) {
    response.push(``, `### 🔧 DEBUG - Información de Confiabilidad`);
    
    if (debugInfo.attempts && debugInfo.attempts.length > 0) {
      response.push(`**📊 Intentos de consulta:**`);
      debugInfo.attempts.forEach((attempt: any, index: number) => {
        const icon = attempt.success ? '✅' : '❌';
        const cache = attempt.usedCache ? '📄' : '🌐';
        response.push(`- ${icon} Intento ${attempt.attempt}: ${attempt.duration}ms ${cache} ${attempt.hasData ? 'con datos' : 'sin datos'}`);
      });
      response.push(``);
    }
    
    response.push(`**🎯 Análisis de confiabilidad:**`);
    response.push(`- Cliente ID consultado: ${debugInfo.clienteId}`);
    response.push(`- Endpoint usado: ${debugInfo.endpoint}`);
    if (debugInfo.successfulAttempt) {
      response.push(`- ✅ Éxito en intento: ${debugInfo.successfulAttempt}`);
    }
    if (debugInfo.noDataFound) {
      response.push(`- ⚠️ No se encontraron datos (normal si ID no existe)`);
    }
    if (debugInfo.allAttemptsFailed) {
      response.push(`- ❌ Todos los intentos fallaron (revisar conectividad)`);
    }
    response.push(`- Duración total: ${debugInfo.totalDuration}ms`);
    
    if (debugInfo.attempts && debugInfo.attempts.length > 1) {
      const successfulAttempts = debugInfo.attempts.filter((a: any) => a.success).length;
      const failedAttempts = debugInfo.attempts.filter((a: any) => !a.success).length;
      response.push(`- Tasa de éxito: ${successfulAttempts}/${debugInfo.attempts.length} (${Math.round(successfulAttempts/debugInfo.attempts.length*100)}%)`);
      
      if (failedAttempts > 0) {
        response.push(`- ⚠️ **Nota:** Se detectaron ${failedAttempts} fallos - posible problema de conectividad`);
      }
    }
  }

  return response.join('\n');
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

function getSaldoIcon(saldo: number): string {
  if (saldo >= 0) return '✅';
  if (saldo >= -500) return '⚠️';
  return '❌';
}