/**
 * Global Error Handler - Standardized error handling for MCP tools
 */

import { z } from 'zod';
import { Logger } from './logger.js';

export interface ErrorDetails {
  code: string;
  message: string;
  userMessage: string;
  context?: any;
  suggestions?: string[];
}

export class ErrorHandler {
  
  /**
   * Handle and format errors consistently across all tools
   */
  static handleError(error: unknown, context: {
    tool: string;
    operation: string;
    duration?: number;
    requestId?: string;
  }): string {
    const errorDetails = this.analyzeError(error, context);
    
    // Log error with context
    Logger.error(`${context.tool} error in ${context.operation}`, error, {
      tool: context.tool,
      operation: context.operation,
      duration_ms: context.duration,
      requestId: context.requestId,
      errorCode: errorDetails.code
    });

    // Return user-friendly formatted message
    return this.formatErrorMessage(errorDetails);
  }

  /**
   * Analyze error and categorize it
   */
  private static analyzeError(error: unknown, context: any): ErrorDetails {
    // Zod validation errors
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(issue => 
        `${issue.path.join('.')}: ${issue.message}`
      ).join(', ');
      
      return {
        code: 'VALIDATION_ERROR',
        message: `Validation failed: ${issues}`,
        userMessage: `❌ Error de validación: ${issues}`,
        context: { zodIssues: error.issues },
        suggestions: [
          'Verificar que todos los parámetros requeridos estén presentes',
          'Revisar tipos de datos (números, strings, etc.)',
          'Consultar la documentación de la herramienta'
        ]
      };
    }

    // Network/API errors
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED') || 
          error.message.includes('network') ||
          error.message.includes('timeout')) {
        return {
          code: 'NETWORK_ERROR',
          message: error.message,
          userMessage: `❌ Error de conexión: No se pudo conectar a la API de WispHub`,
          context: { originalError: error.message },
          suggestions: [
            'Verificar conexión a internet',
            'Confirmar que la API de WispHub esté funcionando',
            'Revisar configuración de red y firewall',
            'Intentar nuevamente en unos minutos'
          ]
        };
      }

      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        return {
          code: 'AUTH_ERROR',
          message: error.message,
          userMessage: `❌ Error de autenticación: Credenciales inválidas`,
          context: { originalError: error.message },
          suggestions: [
            'Verificar que WISPHUB_API_KEY esté configurada correctamente',
            'Confirmar que la API key no haya expirado',
            'Contactar al administrador del sistema'
          ]
        };
      }

      if (error.message.includes('404') || error.message.includes('Not Found')) {
        return {
          code: 'NOT_FOUND_ERROR',
          message: error.message,
          userMessage: `❌ Recurso no encontrado: ${this.extractResourceFromContext(context)}`,
          context: { originalError: error.message },
          suggestions: [
            'Verificar que el ID proporcionado sea correcto',
            'Confirmar que el recurso existe en el sistema',
            'Intentar buscar el recurso con otros criterios'
          ]
        };
      }

      if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
        return {
          code: 'SERVER_ERROR',
          message: error.message,
          userMessage: `❌ Error del servidor: Problema interno en WispHub API`,
          context: { originalError: error.message },
          suggestions: [
            'Intentar nuevamente en unos minutos',
            'Reportar el problema al equipo técnico',
            'Verificar el estado del servicio WispHub'
          ]
        };
      }

      // Generic error fallback
      return {
        code: 'UNKNOWN_ERROR',
        message: error.message,
        userMessage: `❌ Error inesperado: ${error.message}`,
        context: { originalError: error.message },
        suggestions: [
          'Intentar nuevamente',
          'Verificar los parámetros de entrada',
          'Contactar soporte técnico si el problema persiste'
        ]
      };
    }

    // Non-Error objects
    return {
      code: 'UNKNOWN_ERROR',
      message: String(error),
      userMessage: `❌ Error inesperado: ${String(error)}`,
      context: { originalError: String(error) },
      suggestions: [
        'Intentar nuevamente',
        'Contactar soporte técnico'
      ]
    };
  }

  /**
   * Format response for MCP client consumption
   */
  private static formatErrorMessage(errorDetails: ErrorDetails): string {
    const parts = [
      errorDetails.userMessage,
      ``
    ];

    // Add suggestions if available
    if (errorDetails.suggestions && errorDetails.suggestions.length > 0) {
      parts.push(`### 💡 Sugerencias para resolver:`);
      errorDetails.suggestions.forEach(suggestion => {
        parts.push(`- ${suggestion}`);
      });
      parts.push(``);
    }

    // Add technical details for debugging
    parts.push(`### 🔧 Detalles técnicos:`);
    parts.push(`- **Código de error:** ${errorDetails.code}`);
    parts.push(`- **Mensaje técnico:** ${errorDetails.message}`);
    
    if (errorDetails.context) {
      parts.push(`- **Contexto adicional:** Disponible en logs del sistema`);
    }

    return parts.join('\n');
  }

  /**
   * Extract resource information from context for better error messages
   */
  private static extractResourceFromContext(context: any): string {
    if (context.tool) {
      if (context.tool.includes('cliente')) return 'cliente';
      if (context.tool.includes('ticket')) return 'ticket';
      if (context.tool.includes('saldo')) return 'información de saldo';
      if (context.tool.includes('servicio')) return 'servicio';
    }
    return 'recurso solicitado';
  }

  /**
   * Check if error indicates API limitation (like actualizar_cliente issues)
   */
  static isApiLimitation(error: unknown, apiResponse?: any): boolean {
    // Check for successful API response but no actual data change
    if (apiResponse && !error) {
      return true; // This might be an API limitation case
    }

    if (error instanceof Error) {
      const limitationKeywords = [
        'no puede actualizarse',
        'no soportado',
        'limitación',
        'no disponible'
      ];
      
      return limitationKeywords.some(keyword => 
        error.message.toLowerCase().includes(keyword)
      );
    }

    return false;
  }

  /**
   * Create standardized timeout error
   */
  static createTimeoutError(operation: string, timeoutMs: number): ErrorDetails {
    return {
      code: 'TIMEOUT_ERROR',
      message: `Operation ${operation} timed out after ${timeoutMs}ms`,
      userMessage: `❌ Tiempo de espera agotado: La operación tardó más de ${timeoutMs/1000} segundos`,
      suggestions: [
        'Intentar nuevamente',
        'Verificar la conectividad de red',
        'Contactar soporte si el problema persiste'
      ]
    };
  }

  /**
   * Create standardized rate limit error
   */
  static createRateLimitError(retryAfter?: number): ErrorDetails {
    const waitTime = retryAfter ? `${retryAfter} segundos` : 'unos minutos';
    
    return {
      code: 'RATE_LIMIT_ERROR',
      message: `Rate limit exceeded, retry after ${retryAfter || 'unknown'} seconds`,
      userMessage: `❌ Límite de solicitudes excedido: Esperar ${waitTime} antes de intentar nuevamente`,
      suggestions: [
        `Esperar ${waitTime} antes del próximo intento`,
        'Reducir la frecuencia de solicitudes',
        'Considerar implementar lógica de reintento con backoff'
      ]
    };
  }
}