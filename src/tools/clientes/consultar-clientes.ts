/**
 * Consultar Clientes MCP Tool
 * Most used tool - client listing with advanced filters
 */

import { z } from 'zod';
import { ClienteService } from '../../services/cliente.service.js';
import { ConsultarClientesInputSchema } from '../../validators/schemas.js';
import { Logger } from '../../utils/logger.js';
import type { ConsultarClientesInput } from '../../types/wisphub.types.js';

// Service instance
const clienteService = new ClienteService();

/**
 * Tool definition for MCP
 */
export const consultarClientesTool = {
  name: 'consultar_clientes',
  description: `Lista clientes del sistema WispHub con filtros avanzados.

Esta herramienta permite consultar la base de clientes con múltiples filtros:
- Estado: activo, suspendido, cancelado
- Zona: filtrar por zona específica
- Plan: filtrar por tipo de plan
- Búsqueda: buscar en nombre, apellido o email
- Paginación: limit y offset para grandes listas

Casos de uso típicos:
- "Mostrar clientes activos de la zona 5"
- "Buscar clientes con plan 'Premium'"
- "Listar clientes suspendidos"
- "Buscar cliente por nombre 'Juan'"

Respuesta incluye información completa: contacto, estado, saldo, configuración de red.`,

  inputSchema: {
    type: 'object',
    properties: {
      estado: {
        type: 'string',
        enum: ['activo', 'suspendido', 'cancelado'],
        description: 'Filtrar por estado del servicio'
      },
      zona: {
        type: 'number',
        minimum: 1,
        description: 'Filtrar por zona específica'
      },
      plan: {
        type: 'string',
        minLength: 1,
        description: 'Filtrar por tipo de plan'
      },
      search: {
        type: 'string',
        minLength: 1,
        description: 'Buscar en nombre, apellido o email del cliente'
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 100,
        default: 20,
        description: 'Número máximo de resultados (default: 20, max: 100)'
      },
      offset: {
        type: 'number',
        minimum: 0,
        default: 0,
        description: 'Número de resultados a omitir para paginación (default: 0)'
      }
    },
    additionalProperties: false,
    description: 'Filtros opcionales para la consulta de clientes'
  },

  /**
   * Tool handler
   */
  async handler(args: unknown): Promise<string> {
    const timer = Logger.startTimer();
    
    try {
      // Validate input
      const validatedArgs = ConsultarClientesInputSchema.parse(args);
      
      Logger.info('Consultar clientes iniciado', {
        tool: 'consultar_clientes',
        filters: validatedArgs
      });

      // Call service
      const result = await clienteService.consultarClientes(validatedArgs);
      
      const duration = timer();

      if (!result.success) {
        Logger.error('Consultar clientes falló', new Error(result.error || 'Unknown error'));
        return `❌ Error: ${result.error}`;
      }

      const clientes = result.data || [];
      
      Logger.info('Consultar clientes completado', {
        tool: 'consultar_clientes',
        duration_ms: duration,
        results_count: clientes.length
      });

      // Format response for MCP client
      return formatClientesResponse(clientes, validatedArgs);

    } catch (error) {
      const duration = timer();
      Logger.error('Consultar clientes error', error, {
        tool: 'consultar_clientes',
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
function formatClientesResponse(clientes: any[], filters: ConsultarClientesInput): string {
  if (clientes.length === 0) {
    return `🔍 No se encontraron clientes con los filtros especificados.

**Filtros aplicados:**
${formatFilters(filters)}

💡 **Sugerencias:**
- Prueba ampliar los criterios de búsqueda
- Verifica que la zona o plan existan
- Usa \`estado: 'activo'\` para ver solo clientes activos`;
  }

  const response = [`📋 **Clientes encontrados: ${clientes.length}**\n`];

  // Add filter summary
  if (hasActiveFilters(filters)) {
    response.push(`**Filtros aplicados:**`);
    response.push(formatFilters(filters));
    response.push('');
  }

  // Add client list
  clientes.forEach((cliente, index) => {
    const statusIcon = getStatusIcon(cliente.estado);
    const saldoIcon = getSaldoIcon(cliente.saldo_numerico);
    
    response.push(`${index + 1}. ${statusIcon} **${cliente.nombre_completo}** (ID: ${cliente.id_servicio})`);
    response.push(`   👤 ${cliente.usuario} | 📧 ${cliente.email} | 📱 ${cliente.telefono}`);
    response.push(`   🏠 ${cliente.direccion}${cliente.localidad ? `, ${cliente.localidad}` : ''}${cliente.ciudad ? `, ${cliente.ciudad}` : ''}`);
    response.push(`   🌐 Zona ${cliente.zona} (${cliente.zona_nombre}) | 📦 Plan: ${cliente.plan} (${cliente.precio_plan})`);
    response.push(`   💰 ${saldoIcon} ${cliente.saldo_formateado} | 📋 Facturas: ${cliente.estado_facturas}`);
    response.push(`   🌐 IP: ${cliente.configuracion_red.ip} | 🔗 MAC: ${cliente.configuracion_red.mac}`);
    
    if (cliente.tecnico?.nombre) {
      response.push(`   👨‍💻 Técnico: ${cliente.tecnico.nombre}`);
    }
    
    if (cliente.comentarios) {
      response.push(`   💬 ${cliente.comentarios}`);
    }
    
    response.push(''); // Empty line between clients
  });

  // Add pagination info
  if (filters.limit && clientes.length === filters.limit) {
    response.push(`📄 **Paginación:** Mostrando ${filters.limit} resultados desde ${filters.offset || 0}`);
    response.push(`💡 Para ver más resultados, usa \`offset: ${(filters.offset || 0) + filters.limit}\``);
  }

  // Add quick actions
  response.push(`\n🛠️ **Acciones disponibles:**`);
  response.push(`- \`obtener_cliente\` para ver detalles completos`);
  response.push(`- \`consultar_saldo\` para verificar estado de cuenta`);
  response.push(`- \`crear_ticket\` para reportar problemas`);
  response.push(`- \`activar_servicio\` / \`desactivar_servicio\` para cambiar estado`);

  return response.join('\n');
}

/**
 * Helper functions
 */
function hasActiveFilters(filters: ConsultarClientesInput): boolean {
  return !!(filters.estado || filters.zona || filters.plan || filters.search);
}

function formatFilters(filters: ConsultarClientesInput): string {
  const filterParts = [];
  
  if (filters.estado) filterParts.push(`Estado: ${filters.estado}`);
  if (filters.zona) filterParts.push(`Zona: ${filters.zona}`);
  if (filters.plan) filterParts.push(`Plan: ${filters.plan}`);
  if (filters.search) filterParts.push(`Búsqueda: "${filters.search}"`);
  if (filters.limit !== 20) filterParts.push(`Límite: ${filters.limit}`);
  if (filters.offset && filters.offset > 0) filterParts.push(`Offset: ${filters.offset}`);

  return filterParts.length > 0 ? filterParts.join(' | ') : 'Sin filtros';
}

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