/**
 * Server configuration and environment variables
 */

export interface ServerConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  cache: {
    clientes: number;
    tickets: number; 
    saldos: number;
    planes: number;
  };
  wisphub: {
    defaultValues?: {
      asuntoDefault?: number;
      departamentoDefault?: number;
      tecnicoDefault?: number;
      departamentoSoporte?: number;
    };
  };
}

/**
 * Default configuration
 */
export const defaultConfig: ServerConfig = {
  apiKey: process.env.WISPHUB_API_KEY || '',
  baseUrl: process.env.WISPHUB_BASE_URL || 'https://app.wisphub.net',
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
  cache: {
    clientes: 300000,  // 5 minutes
    tickets: 300000,   // 5 minutes  
    saldos: 60000,     // 1 minute
    planes: 3600000    // 1 hour
  },
  wisphub: {
    defaultValues: {
      asuntoDefault: parseInt(process.env.WISPHUB_ASUNTO_DEFAULT || '1'),
      departamentoDefault: parseInt(process.env.WISPHUB_DEPARTAMENTO_DEFAULT || '1'),
      tecnicoDefault: parseInt(process.env.WISPHUB_TECNICO_DEFAULT || '1'),
      departamentoSoporte: parseInt(process.env.WISPHUB_DEPARTAMENTO_SOPORTE || '1')
    }
  }
};

/**
 * Validate required configuration
 */
export function validateConfig(config: ServerConfig): void {
  if (!config.apiKey) {
    throw new Error('WISPHUB_API_KEY environment variable is required');
  }
  
  if (!config.baseUrl) {
    throw new Error('WISPHUB_BASE_URL environment variable is required');
  }
}

/**
 * Get current configuration
 */
export function getConfig(): ServerConfig {
  const config = { ...defaultConfig };
  validateConfig(config);
  return config;
}