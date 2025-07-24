# 🖥️ Integración con Claude Desktop

Guía completa para configurar el servidor WispHub CustomerCare MCP con Claude Desktop.

## 📋 Prerrequisitos

### 1. Servidor MCP Funcionando
```bash
# Verificar que el servidor esté compilado y funcionando
cd /ruta/a/wisphub-customercare-mcp
npm run build
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js
```

### 2. Claude Desktop Instalado
- Descargar desde: https://claude.ai/download
- Versión mínima requerida: 0.7.0+

## 🔧 Configuración Paso a Paso

### Paso 1: Localizar Archivo de Configuración

**macOS**:
```bash
open ~/Library/Application\ Support/Claude/
# Editar: claude_desktop_config.json
```

**Windows**:
```cmd
explorer %APPDATA%\Claude\
# Editar: claude_desktop_config.json
```

**Linux**:
```bash
mkdir -p ~/.config/Claude
# Editar: ~/.config/Claude/claude_desktop_config.json
```

### Paso 2: Configuración JSON

#### Configuración Básica

**Para macOS/Linux**:
```json
{
  "mcpServers": {
    "wisphub-customercare": {
      "command": "node",
      "args": ["/ruta/absoluta/a/wisphub-customercare-mcp/dist/index.js"],
      "env": {
        "WISPHUB_API_KEY": "tu_api_key_de_wisphub",
        "WISPHUB_BASE_URL": "https://api.wisphub.app",
        "NODE_ENV": "production",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

**Para Windows**:
```json
{
  "mcpServers": {
    "wisphub-customercare": {
      "command": "node",
      "args": ["C:\\ruta\\absoluta\\a\\wisphub-customercare-mcp\\dist\\index.js"],
      "env": {
        "WISPHUB_API_KEY": "tu_api_key_de_wisphub",
        "WISPHUB_BASE_URL": "https://api.wisphub.app",
        "NODE_ENV": "production",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

#### Configuración Avanzada (Desarrollo)

**Para macOS/Linux**:
```json
{
  "mcpServers": {
    "wisphub-customercare": {
      "command": "node",
      "args": ["/ruta/absoluta/a/wisphub-customercare-mcp/dist/index.js"],
      "env": {
        "WISPHUB_API_KEY": "tu_api_key_de_wisphub",
        "WISPHUB_BASE_URL": "https://api.wisphub.app",
        "NODE_ENV": "development",
        "LOG_LEVEL": "debug",
        "WISPHUB_TIMEOUT": "30000",
        "WISPHUB_RETRY_ATTEMPTS": "3",
        "WISPHUB_CACHE_CLIENTES": "300000"
      }
    }
  }
}
```

**Para Windows**:
```json
{
  "mcpServers": {
    "wisphub-customercare": {
      "command": "node",
      "args": ["C:\\ruta\\absoluta\\a\\wisphub-customercare-mcp\\dist\\index.js"],
      "env": {
        "WISPHUB_API_KEY": "tu_api_key_de_wisphub",
        "WISPHUB_BASE_URL": "https://api.wisphub.app",
        "NODE_ENV": "development",
        "LOG_LEVEL": "debug",
        "WISPHUB_TIMEOUT": "30000",
        "WISPHUB_RETRY_ATTEMPTS": "3",
        "WISPHUB_CACHE_CLIENTES": "300000"
      }
    }
  }
}
```

#### Configuración Múltiples Servidores
```json
{
  "mcpServers": {
    "wisphub-customercare": {
      "command": "node",
      "args": ["/ruta/a/customercare/dist/index.js"],
      "env": {
        "WISPHUB_API_KEY": "tu_api_key",
        "WISPHUB_BASE_URL": "https://api.wisphub.app"
      }
    },
    "wisphub-financial": {
      "command": "node", 
      "args": ["/ruta/a/financial/dist/index.js"],
      "env": {
        "WISPHUB_API_KEY": "tu_api_key",
        "WISPHUB_BASE_URL": "https://api.wisphub.app"
      }
    }
  }
}
```

### Paso 3: Obtener Ruta Absoluta

**En macOS/Linux**:
```bash
cd /ruta/a/wisphub-customercare-mcp
pwd
# Copia la salida completa para usar en "args"
```

**En Windows**:
```cmd
cd C:\ruta\a\wisphub-customercare-mcp
echo %cd%
# Copia la salida y reemplaza \ por / o \\
```

### Paso 4: Configurar API Key

1. **Obtener API Key de WispHub**:
   - Iniciar sesión en tu panel WispHub
   - Ir a **Configuración → API** o **Integraciones**
   - Copiar tu API Key

2. **Configurar en JSON**:
   ```json
   "WISPHUB_API_KEY": "tu_api_key_real_aqui"
   ```

### Paso 5: Reiniciar Claude Desktop

1. **Cerrar completamente Claude Desktop**
2. **Reiniciar la aplicación**
3. **Verificar que no hay errores**

## ✅ Verificación de Funcionamiento

### Paso 1: Verificar Conexión MCP
En Claude Desktop, deberías ver:
- 🟢 **MCP Connected** en la esquina inferior
- **Nuevo icono de herramientas** disponible

### Paso 2: Probar Herramientas
Prueba estos comandos en Claude Desktop:

```
"Mostrar lista de clientes de WispHub"
```

```
"Buscar clientes activos en la zona 1"
```

```  
"¿Cuántos tickets abiertos hay?"
```

### Paso 3: Verificar Logs (Opcional)
Si hay problemas, activar logs detallados:

```json
{
  "env": {
    "LOG_LEVEL": "debug"
  }
}
```

## 🚨 Troubleshooting

### Error: "MCP server failed to start"

**Causa común**: Ruta incorrecta a dist/index.js

**Solución**:
1. Verificar que la ruta sea absoluta
2. Verificar que `dist/index.js` exista
3. Ejecutar `npm run build` si es necesario

### Error: "WISPHUB_API_KEY environment variable is required"

**Causa**: API Key no configurada correctamente

**Solución**:
1. Verificar que el API Key esté en el JSON
2. Verificar que no haya espacios extra
3. Verificar que el API Key sea válido

### Error: "Request failed with status code 403"

**Causa**: API Key inválida o sin permisos

**Solución**:
1. Verificar API Key en panel WispHub
2. Verificar permisos del API Key
3. Verificar URL base: `https://api.wisphub.app`

### MCP Connected pero herramientas no aparecen

**Causa**: Servidor MCP no registra herramientas

**Solución**:
1. Verificar logs de Claude Desktop
2. Probar servidor manualmente:
   ```bash
   echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js
   ```
3. Revisar compilación TypeScript

### Rendimiento lento

**Causa**: Cache desactivado o timeout muy bajo

**Solución**:
```json
{
  "env": {
    "WISPHUB_CACHE_CLIENTES": "300000",
    "WISPHUB_TIMEOUT": "30000"
  }
}
```

## 📝 Configuraciones de Ejemplo

### Desarrollo Local
```json
{
  "mcpServers": {
    "wisphub-customercare-dev": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"],
      "cwd": "/ruta/a/wisphub-customercare-mcp",
      "env": {
        "WISPHUB_API_KEY": "tu_api_key_de_desarrollo",
        "WISPHUB_BASE_URL": "https://api.wisphub.app",
        "NODE_ENV": "development",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

### Producción con Cache Optimizado
```json
{
  "mcpServers": {
    "wisphub-customercare": {
      "command": "node",
      "args": ["/opt/wisphub-mcp/customercare/dist/index.js"],
      "env": {
        "WISPHUB_API_KEY": "tu_api_key_de_produccion",
        "WISPHUB_BASE_URL": "https://api.wisphub.app",
        "NODE_ENV": "production",
        "LOG_LEVEL": "warn",
        "WISPHUB_CACHE_CLIENTES": "600000",
        "WISPHUB_CACHE_TICKETS": "300000",
        "WISPHUB_CACHE_SALDOS": "60000"
      }
    }
  }
}
```

## 🔄 Comandos Útiles

### Verificar Estado del Servidor
```bash
# Probar servidor manualmente
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js

# Probar conectividad API
node dev-tools/scripts/test-connectivity.js

# Ver logs en tiempo real (si LOG_LEVEL=debug)
tail -f ~/.claude/logs/mcp-server.log
```

### Actualizar Servidor
```bash
# 1. Actualizar código
git pull origin main

# 2. Reinstalar dependencias
npm install

# 3. Recompilar
npm run build

# 4. Reiniciar Claude Desktop
```

### Backup de Configuración
```bash
# Respaldar configuración
cp ~/.config/Claude/claude_desktop_config.json \
   ~/.config/Claude/claude_desktop_config.json.backup

# Restaurar si es necesario
cp ~/.config/Claude/claude_desktop_config.json.backup \
   ~/.config/Claude/claude_desktop_config.json
```

---

## ✨ Casos de Uso en Claude Desktop

Una vez configurado, podrás usar el servidor con comandos naturales:

### Gestión de Clientes
- "Mostrar todos los clientes activos"
- "Buscar cliente por nombre María González" 
- "Listar clientes suspendidos de la zona 3"
- "¿Cuántos clientes hay en total?"

### Información de Servicios  
- "Mostrar saldo pendiente del cliente 1234"
- "Listar clientes con plan Premium"
- "¿Hay clientes con servicios vencidos?"

### Soporte Técnico
- "Crear ticket de soporte para cliente 1234"
- "Mostrar tickets pendientes de hoy"
- "¿Qué tickets están asignados al técnico Juan?"

---

**📞 Para más ayuda**: Consultar `docs/troubleshooting.md` o `dev-tools/examples/`