#!/bin/bash

# 🚀 WispHub CustomerCare MCP - Script de Instalación Local
# Este script automatiza la instalación del servidor MCP en tu sistema local

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
INSTALL_DIR="$HOME/.local/bin/wisphub-mcp"
NODE_MIN_VERSION="18"

# Helper functions
print_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}  WispHub CustomerCare MCP - Instalación Local${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""
}

print_step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Node.js version
check_node_version() {
    if ! command_exists node; then
        print_error "Node.js no está instalado"
        print_info "Instala Node.js desde: https://nodejs.org"
        exit 1
    fi

    local node_version=$(node --version | sed 's/v//' | cut -d. -f1)
    if [ "$node_version" -lt "$NODE_MIN_VERSION" ]; then
        print_error "Node.js versión $NODE_MIN_VERSION+ requerida. Versión actual: $(node --version)"
        exit 1
    fi

    print_success "Node.js $(node --version) ✓"
}

# Check npm
check_npm() {
    if ! command_exists npm; then
        print_error "npm no está instalado (debería venir con Node.js)"
        exit 1
    fi

    print_success "npm $(npm --version) ✓"
}

# Detect OS and set Claude config path
detect_claude_config() {
    case "$(uname -s)" in
        Darwin)
            CLAUDE_CONFIG_DIR="$HOME/Library/Application Support/Claude"
            ;;
        Linux)
            CLAUDE_CONFIG_DIR="$HOME/.config/Claude"
            ;;
        CYGWIN*|MINGW*|MSYS*)
            CLAUDE_CONFIG_DIR="$APPDATA/Claude"
            ;;
        *)
            print_warning "OS no detectado. Usando ruta Linux por defecto."
            CLAUDE_CONFIG_DIR="$HOME/.config/Claude"
            ;;
    esac

    CLAUDE_CONFIG_FILE="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"
}

# Get API Key from user
get_api_key() {
    echo ""
    print_step "Configuración de API Key"
    
    if [ -z "$WISPHUB_API_KEY" ]; then
        echo -e "${YELLOW}Ingresa tu API Key de WispHub:${NC}"
        read -r WISPHUB_API_KEY
        
        if [ -z "$WISPHUB_API_KEY" ]; then
            print_error "API Key es requerida"
            exit 1
        fi
    fi

    # Validate API key format (basic check)
    if [[ ! "$WISPHUB_API_KEY" =~ ^wh_(live|test)_[a-zA-Z0-9]{20,}$ ]]; then
        print_warning "El formato de API Key no parece válido (esperado: wh_live_... o wh_test_...)"
        echo -e "${YELLOW}¿Continuar de todos modos? (y/N):${NC}"
        read -r continue_anyway
        if [[ ! "$continue_anyway" =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi

    print_success "API Key configurada"
}

# Get base URL
get_base_url() {
    echo ""
    print_step "URL Base de WispHub"
    
    if [ -z "$WISPHUB_BASE_URL" ]; then
        echo -e "${YELLOW}Ingresa la URL base de WispHub (default: https://app.wisphub.net):${NC}"
        read -r WISPHUB_BASE_URL
        
        if [ -z "$WISPHUB_BASE_URL" ]; then
            WISPHUB_BASE_URL="https://app.wisphub.net"
        fi
    fi

    print_success "URL base: $WISPHUB_BASE_URL"
}

# Install dependencies and build
install_and_build() {
    echo ""
    print_step "Instalación de dependencias y compilación"
    
    cd "$PROJECT_DIR"
    
    print_info "Instalando dependencias..."
    npm install
    
    print_info "Compilando TypeScript..."
    npm run build
    
    print_success "Proyecto compilado exitosamente"
}

# Create installation directory
create_install_dir() {
    echo ""
    print_step "Creando directorio de instalación"
    
    mkdir -p "$INSTALL_DIR/customercare"
    print_success "Directorio creado: $INSTALL_DIR/customercare"
}

# Copy files to installation directory
copy_files() {
    echo ""
    print_step "Copiando archivos"
    
    # Copy compiled JavaScript
    cp -r "$PROJECT_DIR/dist"/* "$INSTALL_DIR/customercare/"
    
    # Copy package.json
    cp "$PROJECT_DIR/package.json" "$INSTALL_DIR/customercare/"
    
    # Copy node_modules (for dependencies)
    cp -r "$PROJECT_DIR/node_modules" "$INSTALL_DIR/customercare/"
    
    print_success "Archivos copiados a $INSTALL_DIR/customercare"
}

# Create or update Claude Desktop config
update_claude_config() {
    echo ""
    print_step "Configurando Claude Desktop"
    
    # Create Claude config directory if it doesn't exist
    mkdir -p "$CLAUDE_CONFIG_DIR"
    
    # Generate config JSON
    local config_json='{
  "mcpServers": {
    "wisphub-customercare": {
      "command": "node",
      "args": ["'$INSTALL_DIR'/customercare/index.js"],
      "env": {
        "WISPHUB_API_KEY": "'$WISPHUB_API_KEY'",
        "WISPHUB_BASE_URL": "'$WISPHUB_BASE_URL'",
        "NODE_ENV": "production"
      }
    }
  }
}'

    # Check if config file exists
    if [ -f "$CLAUDE_CONFIG_FILE" ]; then
        print_warning "Claude Desktop config ya existe"
        echo -e "${YELLOW}¿Sobrescribir la configuración existente? (y/N):${NC}"
        read -r overwrite_config
        
        if [[ "$overwrite_config" =~ ^[Yy]$ ]]; then
            echo "$config_json" > "$CLAUDE_CONFIG_FILE"
            print_success "Configuración actualizada"
        else
            print_info "Configuración manual requerida:"
            echo ""
            echo -e "${BLUE}Añade esta configuración a $CLAUDE_CONFIG_FILE:${NC}"
            echo "$config_json"
            echo ""
        fi
    else
        echo "$config_json" > "$CLAUDE_CONFIG_FILE"
        print_success "Configuración de Claude Desktop creada"
    fi
    
    print_info "Archivo de configuración: $CLAUDE_CONFIG_FILE"
}

# Test installation
test_installation() {
    echo ""
    print_step "Probando instalación"
    
    cd "$INSTALL_DIR/customercare"
    
    # Test basic execution
    print_info "Probando ejecución básica..."
    if timeout 5s node index.js 2>/dev/null; then
        print_success "Servidor ejecuta correctamente"
    else
        local exit_code=$?
        if [ $exit_code -eq 124 ]; then
            print_success "Servidor ejecuta correctamente (timeout esperado)"
        else
            print_warning "Posibles problemas de ejecución (código: $exit_code)"
        fi
    fi
}

# Print installation summary
print_summary() {
    echo ""
    echo -e "${GREEN}================================================${NC}"
    echo -e "${GREEN}  ✅ Instalación Completada Exitosamente${NC}"
    echo -e "${GREEN}================================================${NC}"
    echo ""
    echo -e "${BLUE}📍 Ubicación del servidor:${NC} $INSTALL_DIR/customercare"
    echo -e "${BLUE}📍 Configuración Claude:${NC} $CLAUDE_CONFIG_FILE"
    echo ""
    echo -e "${PURPLE}🚀 Próximos pasos:${NC}"
    echo "1. Reinicia Claude Desktop completamente"
    echo "2. Abre Claude Desktop"
    echo "3. Prueba escribiendo: '¿Qué herramientas MCP tienes disponibles?'"
    echo "4. Deberías ver 'consultar_clientes' en la lista"
    echo ""
    echo -e "${PURPLE}🧪 Prueba rápida:${NC}"
    echo "Escribe en Claude: 'Usa consultar_clientes para mostrar los primeros 5 clientes'"
    echo ""
    echo -e "${YELLOW}📚 Documentación:${NC}"
    echo "- INSTALLATION.md - Guía detallada"
    echo "- CONFIG-EXAMPLES.md - Ejemplos de configuración"
    echo "- DECISIONS.md - Decisiones arquitecturales"
    echo ""
    echo -e "${GREEN}¡Listo para usar WispHub CustomerCare MCP! 🎉${NC}"
}

# Main installation process
main() {
    print_header
    
    print_step "Verificando prerrequisitos"
    check_node_version
    check_npm
    
    detect_claude_config
    get_api_key
    get_base_url
    
    install_and_build
    create_install_dir
    copy_files
    update_claude_config
    test_installation
    
    print_summary
}

# Handle script interruption
trap 'echo -e "\n${RED}Instalación interrumpida por el usuario${NC}"; exit 1' INT

# Run main function
main "$@"