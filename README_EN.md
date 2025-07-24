# WispHub CustomerCare MCP Server

A powerful Model Context Protocol (MCP) server that provides comprehensive customer service and technical support tools for the WispHub ISP management platform.

## Features

- **Client Management**: Search, retrieve, and update client information.
- **Financial Operations**: Balance inquiries and payment status tracking.
- **Support Tickets**: Create, update, and manage customer support tickets.
- **Service Management**: Control service status and configurations.

## Prerequisites

- [Node.js](https://nodejs.org/) 18.0 or higher.
- An MCP-compatible client application (like Claude Desktop).
- WispHub API access credentials.

## Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/SOCIUM-CR/wisphub-customercare-mcp-server.git
    cd wisphub-customercare-mcp-server
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Build the project:**
    ```bash
    npm run build
    ```

## Configuration

This server is configured via environment variables. You can set them in your operating system or use a `.env` file.

- `WISPHUB_API_KEY`: Your WispHub API key.
- `WISPHUB_BASE_URL`: The base URL for the WispHub API (e.g., `https://api.wisphub.app`).

### For Claude Desktop

If you are using Claude Desktop, you can configure the server in the `claude_desktop_config.json` file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

Add the following configuration:

```json
{
  "mcpServers": {
    "wisphub-customercare": {
      "command": "node",
      "args": ["/absolute/path/to/your/project/dist/index.js"],
      "env": {
        "WISPHUB_API_KEY": "your_wisphub_api_key",
        "WISPHUB_BASE_URL": "https://api.wisphub.app"
      }
    }
  }
}
```

**Note:** Replace `/absolute/path/to/your/project/` with the actual absolute path to the project directory.

## Usage

To run the server, use the following command:

```bash
npm start
```

If you want to run it in development mode (with auto-reloading), use:

```bash
npm run dev
```

## Available Tools

The server provides a suite of tools for interacting with WispHub:

- `consultar_clientes`: Advanced client search with filters.
- `obtener_cliente`: Retrieve detailed client information.
- `actualizar_cliente`: Update client configurations.
- `consultar_saldo_cliente`: Check financial status and balances.
- `cambiar_estado_servicio`: Manage service status changes.
- `obtener_tickets_cliente`: Get customer support ticket history.
- `crear_ticket`: Create new support tickets.
- `actualizar_ticket`: Update existing support tickets.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
