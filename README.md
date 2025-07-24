# WispHub CustomerCare MCP Server

Un potente servidor de Protocolo de Contexto de Modelo (MCP) que proporciona herramientas completas de servicio al cliente y soporte técnico para la plataforma de gestión de ISP WispHub.

## Características

- **Gestión de Clientes**: Busca, recupera y actualiza la información de los clientes.
- **Operaciones Financieras**: Consultas de saldo y seguimiento del estado de los pagos.
- **Tickets de Soporte**: Crea, actualiza y gestiona los tickets de soporte de los clientes.
- **Gestión de Servicios**: Controla el estado y la configuración de los servicios.

## Prerrequisitos

- [Node.js](https://nodejs.org/) 18.0 o superior.
- Una aplicación cliente compatible con MCP (como Claude Desktop).
- Credenciales de acceso a la API de WispHub.

## Instalación

1.  **Clona el repositorio:**
    ```bash
    git clone https://github.com/SOCIUM-CR/wisphub-customercare-mcp-server.git
    cd wisphub-customercare-mcp-server
    ```

2.  **Instala las dependencias:**
    ```bash
    npm install
    ```

3.  **Construye el proyecto:**
    ```bash
    npm run build
    ```

## Configuración

Este servidor se configura mediante variables de entorno. Puedes establecerlas en tu sistema operativo o usar un archivo `.env`.

- `WISPHUB_API_KEY`: Tu clave de API de WispHub.
- `WISPHUB_BASE_URL`: La URL base de la API de WispHub (por ejemplo, `https://api.wisphub.app`).

### Para Claude Desktop

Si estás utilizando Claude Desktop, puedes configurar el servidor en el archivo `claude_desktop_config.json`:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

Añade la siguiente configuración:

```json
{
  "mcpServers": {
    "wisphub-customercare": {
      "command": "node",
      "args": ["/ruta/absoluta/a/tu/proyecto/dist/index.js"],
      "env": {
        "WISPHUB_API_KEY": "tu_clave_de_api_de_wisphub",
        "WISPHUB_BASE_URL": "https://api.wisphub.app"
      }
    }
  }
}
```

**Nota:** Reemplaza `/ruta/absoluta/a/tu/proyecto/` con la ruta absoluta real al directorio del proyecto.

## Uso

Para ejecutar el servidor, utiliza el siguiente comando:

```bash
npm start
```

Si quieres ejecutarlo en modo de desarrollo (con recarga automática), usa:

```bash
npm run dev
```

## Herramientas Disponibles

El servidor proporciona un conjunto de herramientas para interactuar con WispHub:

- `consultar_clientes`: Búsqueda avanzada de clientes con filtros.
- `obtener_cliente`: Recupera información detallada del cliente.
- `actualizar_cliente`: Actualiza las configuraciones del cliente.
- `consultar_saldo_cliente`: Comprueba el estado financiero y los saldos.
- `cambiar_estado_servicio`: Gestiona los cambios de estado del servicio.
- `obtener_tickets_cliente`: Obtiene el historial de tickets de soporte del cliente.
- `crear_ticket`: Crea nuevos tickets de soporte.
- `actualizar_ticket`: Actualiza los tickets de soporte existentes.

## Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo [LICENSE](LICENSE) para más detalles.
