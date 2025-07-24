/**
 * Consultar Saldo Cliente MCP Tool
 * Get detailed financial information for a specific client
 */

import { z } from 'zod';
import { SaldoService } from '../../services/saldo.service.js';
import { ConsultarSaldoInputSchema } from '../../validators/schemas.js';
import { Logger } from '../../utils/logger.js';
import type { ConsultarSaldoInput } from '../../types/wisphub.types.js';

// Service instance
const saldoService = new SaldoService();

/**
 * Tool definition for MCP
 */
export const consultarSaldoTool = {
  name: 'consultar_saldo_cliente',
  description: `Consulta información financiera detallada de un cliente específico.

Esta herramienta proporciona información completa del estado de cuenta:
- Saldo actual del cliente
- Estado de pagos (al corriente, con atraso, muy atrasado)
- Facturas pendientes de pago
- Fecha del último pago registrado
- Días de atraso si los hay
- Análisis del riesgo financiero

Casos de uso típicos:
- "Consultar saldo del cliente 12345"
- "Verificar estado de cuenta antes de suspender servicio"
- "Revisar facturas pendientes para negociación de pago"

Esencial para decisiones de cobranza y atención al cliente.`,

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
    description: 'ID del servicio para consultar saldo'
  },

  /**
   * Tool handler
   */
  async handler(args: unknown): Promise<string> {
    const timer = Logger.startTimer();
    
    try {
      // Validate input using existing schema
      const schema = z.object({
        servicio: z.number().positive().describe('ID del servicio del cliente')
      });
      const validatedArgs = schema.parse(args);
      
      Logger.info('Consultar saldo iniciado', {
        tool: 'consultar_saldo_cliente',
        servicio: validatedArgs.servicio
      });

      // Call service
      const result = await saldoService.consultarSaldo(validatedArgs.servicio);
      
      const duration = timer();

      if (!result.success) {
        Logger.error('Consultar saldo falló', new Error(result.error || 'Unknown error'));
        return `❌ Error: ${result.error}`;
      }

      const saldoDetalle = result.data;
      
      if (!saldoDetalle) {
        Logger.error('Consultar saldo falló', new Error('No saldo data returned'));
        return `❌ Error: No se pudo obtener información de saldo para el servicio ${validatedArgs.servicio}`;
      }
      
      Logger.info('Consultar saldo completado', {
        tool: 'consultar_saldo_cliente',
        servicio: validatedArgs.servicio,
        duration_ms: duration,
        saldo: saldoDetalle.saldo_actual_numerico,
        estado: saldoDetalle.estado_cuenta
      });

      // Format response for MCP client with debug info
      return formatSaldoDetailResponse(saldoDetalle, validatedArgs.servicio, result.debugInfo);

    } catch (error) {
      const duration = timer();
      Logger.error('Consultar saldo error', error, {
        tool: 'consultar_saldo_cliente',
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
function formatSaldoDetailResponse(saldo: any, servicioId: number, debugInfo?: any): string {
  const estadoIcon = getEstadoCuentaIcon(saldo.estado_cuenta);
  const saldoIcon = getSaldoIcon(saldo.saldo_actual_numerico);
  
  const response = [
    `💰 **Estado Financiero - Servicio ${servicioId}**`,
    ``,
    `## ${estadoIcon} Resumen del Estado de Cuenta`,
    ``,
    `### 💳 Saldo Actual`,
    `- **Saldo:** ${saldoIcon} ${saldo.saldo_actual_formateado}`,
    `- **Estado de cuenta:** ${estadoIcon} ${saldo.estado_cuenta.replace('_', ' ').toUpperCase()}`,
    `- **Último pago:** ${saldo.fecha_ultimo_pago || 'No registrado'}`,
    ``
  ];

  // Análisis financiero
  if (saldo.saldo_actual_numerico >= 0) {
    response.push(`### ✅ Situación Financiera`);
    response.push(`- **Cliente al corriente:** Sin deudas pendientes`);
    response.push(`- **Crédito disponible:** ${saldo.saldo_actual_formateado}`);
    response.push(`- **Riesgo:** Bajo - Cliente confiable`);
  } else {
    response.push(`### ⚠️ Situación Financiera`);
    response.push(`- **Deuda total:** ${saldo.saldo_actual_formateado.replace('-', '')}`);
    response.push(`- **Riesgo:** ${getRiesgoNivel(saldo.estado_cuenta)}`);
    
    if (saldo.estado_cuenta === 'con_atraso') {
      response.push(`- **Acción recomendada:** Recordatorio de pago`);
    } else if (saldo.estado_cuenta === 'muy_atrasado') {
      response.push(`- **Acción recomendada:** Gestión de cobranza urgente`);
    }
  }
  response.push('');

  // Facturas pendientes
  if (saldo.facturas_pendientes.cantidad > 0) {
    response.push(`### 📄 Facturas Pendientes (${saldo.facturas_pendientes.cantidad})`);
    response.push(`- **Total adeudado:** ${saldo.facturas_pendientes.total_adeudado}`);
    response.push('');
    
    response.push(`**Detalle por factura:**`);
    saldo.facturas_pendientes.facturas.forEach((factura: any, index: number) => {
      const vencimientoIcon = getVencimientoIcon(factura.estado_vencimiento);
      response.push(`${index + 1}. ${vencimientoIcon} Factura #${factura.id_factura}`);
      response.push(`   💰 ${factura.monto_formateado} | Vence: ${factura.fecha_vencimiento}`);
      
      if (factura.dias_vencido > 0) {
        response.push(`   ⏰ ${factura.dias_vencido} días vencida`);
      }
      response.push('');
    });
  } else {
    response.push(`### ✅ Sin Facturas Pendientes`);
    response.push(`- No hay facturas por pagar`);
    response.push(`- Cliente al día con sus obligaciones`);
    response.push('');
  }

  // Recomendaciones según el estado
  response.push(`### 💡 Recomendaciones`);
  
  switch (saldo.estado_cuenta) {
    case 'al_corriente':
      response.push(`- ✅ Cliente en excelente estado financiero`);
      response.push(`- ✅ Elegible para upgrades de plan`);
      response.push(`- ✅ Sin restricciones de servicio`);
      break;
      
    case 'con_atraso':
      response.push(`- 📞 Contactar para recordatorio de pago`);
      response.push(`- 📧 Enviar estado de cuenta por email`);
      response.push(`- ⏱️ Monitorear en próximos 7 días`);
      response.push(`- ❌ Suspender upgrades hasta regularizar`);
      break;
      
    case 'muy_atrasado':
      response.push(`- 🚨 Gestión de cobranza inmediata`);
      response.push(`- 📞 Llamada urgente para negociar pago`);
      response.push(`- ⚠️ Evaluar suspensión de servicio`);
      response.push(`- 📋 Documentar gestiones realizadas`);
      break;
  }
  response.push('');

  // Acciones disponibles
  response.push(`### 🛠️ Acciones Disponibles`);
  response.push(`- \`obtener_cliente clienteId:"${servicioId}"\` - Ver información completa del cliente`);
  response.push(`- \`obtener_tickets_cliente servicio:${servicioId}\` - Revisar historial de soporte`);
  
  if (saldo.saldo_actual_numerico < 0) {
    response.push(`- \`crear_ticket\` - Crear ticket para gestión de cobranza`);
    if (saldo.estado_cuenta === 'muy_atrasado') {
      response.push(`- \`cambiar_estado_servicio\` - Suspender servicio por falta de pago`);
    }
  } else {
    response.push(`- \`crear_ticket\` - Crear ticket de soporte general`);
  }

  // Add debug information for saldo analysis
  if (debugInfo) {
    response.push(``, `### 🔧 DEBUG - Análisis de Saldo`);
    response.push(`**📊 Datos de API:**`);
    response.push(`\`\`\`json`);
    response.push(JSON.stringify(debugInfo.rawApiData, null, 2));
    response.push(`\`\`\``);
    
    response.push(`**🎯 Análisis:**`);
    response.push(`- Endpoint usado: ${debugInfo.endpoint}`);
    response.push(`- Facturas encontradas: ${debugInfo.analysis.facturaCount}`);
    response.push(`- Saldo API raw: ${debugInfo.analysis.rawSaldo}`);
    response.push(`- Saldo transformado: ${debugInfo.analysis.formattedSaldo}`);
    response.push(`- Estado calculado: ${debugInfo.transformedData.estado_cuenta}`);
    
    if (debugInfo.analysis.facturaCount > 0 && debugInfo.analysis.rawSaldo === 0) {
      response.push(`- ⚠️ **POSIBLE ISSUE:** Hay facturas pero saldo es 0 - revisar lógica`);
    }
    
    if (debugInfo.rawApiData.facturas_pendientes && debugInfo.rawApiData.facturas_pendientes.length > 0) {
      response.push(`**📋 Facturas pendientes raw:**`);
      debugInfo.rawApiData.facturas_pendientes.forEach((f: any, i: number) => {
        response.push(`- Factura ${i+1}: Monto ${f.monto}, Vencimiento ${f.fecha_vencimiento}, Días vencido ${f.dias_vencido}`);
      });
    }
  }

  return response.join('\n');
}

/**
 * Helper functions
 */
function getEstadoCuentaIcon(estado: string): string {
  const icons = {
    'al_corriente': '✅',
    'con_atraso': '⚠️',
    'muy_atrasado': '🚨'
  };
  return icons[estado as keyof typeof icons] || '❓';
}

function getSaldoIcon(saldo: number): string {
  if (saldo >= 0) return '✅';
  if (saldo >= -500) return '⚠️';
  return '❌';
}

function getVencimientoIcon(estado: string): string {
  const icons = {
    'vigente': '🟢',
    'vencida': '🟡',
    'muy_vencida': '🔴'
  };
  return icons[estado as keyof typeof icons] || '❓';
}

function getRiesgoNivel(estadoCuenta: string): string {
  const riesgo = {
    'al_corriente': 'Bajo',
    'con_atraso': 'Medio - Requiere seguimiento',
    'muy_atrasado': 'Alto - Gestión urgente'
  };
  return riesgo[estadoCuenta as keyof typeof riesgo] || 'No evaluado';
}