#!/usr/bin/env node

/**
 * WispHub CustomerCare MCP Server
 * Entry point - handles server initialization and tool registration
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Import tools
import { consultarClientesTool } from './tools/clientes/consultar-clientes.js';
import { obtenerClienteTool } from './tools/clientes/obtener-cliente.js';
import { consultarSaldoTool } from './tools/clientes/consultar-saldo.js';
import { actualizarClienteTool } from './tools/clientes/actualizar-cliente.js';
import { crearTicketTool } from './tools/tickets/crear-ticket.js';
import { obtenerTicketsClienteTool } from './tools/tickets/obtener-tickets-cliente.js';
import { actualizarTicketTool } from './tools/tickets/actualizar-ticket.js';
import { cambiarEstadoServicioTool } from './tools/servicios/cambiar-estado-servicio.js';

/**
 * Server configuration
 */
const server = new Server({
  name: 'wisphub-customercare',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {}
  }
});

/**
 * Tool registration
 */
const tools = [
  // Client tools
  consultarClientesTool,
  obtenerClienteTool,
  consultarSaldoTool,
  actualizarClienteTool,
  
  // Ticket tools
  crearTicketTool,
  obtenerTicketsClienteTool,
  actualizarTicketTool,
  
  // Service tools
  cambiarEstadoServicioTool
];

/**
 * List tools handler
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema || {}
    }))
  };
});

/**
 * Call tool handler
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  const tool = tools.find(t => t.name === name);
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }
  
  try {
    const result = await tool.handler(args);
    return {
      content: [
        {
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    throw new Error(`Tool ${name} failed: ${error instanceof Error ? error.message : String(error)}`);
  }
});

/**
 * Start server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('WispHub CustomerCare MCP server running');
}

// Handle shutdown gracefully  
process.on('SIGINT', async () => {
  console.error('Shutting down...');
  process.exit(0);
});

if (require.main === module) {
  main().catch(console.error);
}