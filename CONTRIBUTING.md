# Contributing to WispHub CustomerCare MCP Server

## 🤝 Welcome Contributors

Thank you for your interest in contributing to the WispHub CustomerCare MCP Server! This document provides guidelines for contributing to this project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Architecture Guidelines](#architecture-guidelines)

## Code of Conduct

This project adheres to a code of conduct. By participating, you are expected to uphold this code:

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

- Node.js 18.0 or higher
- npm 9.0 or higher
- Basic understanding of TypeScript
- Familiarity with MCP (Model Context Protocol)
- Access to WispHub API for testing

### First Contribution

1. Look for issues labeled `good first issue` or `help wanted`
2. Comment on the issue to express interest
3. Wait for maintainer approval before starting work
4. Follow the development setup below

## Development Setup

1. **Fork and clone the repository**
```bash
git clone https://github.com/your-username/wisphub-customercare-mcp.git
cd wisphub-customercare-mcp
```

2. **Install dependencies**
```bash
npm install
```

3. **Build the project**
```bash
npm run build
```

4. **Set up environment variables**
```bash
# Copy config template
cp config-templates/development.json .env
# Edit .env with your test API credentials
```

5. **Verify setup**
```bash
npm run test
```

## Making Changes

### Branch Naming

Use descriptive branch names with prefixes:
- `feature/`: New features
- `fix/`: Bug fixes
- `docs/`: Documentation changes
- `refactor/`: Code refactoring
- `test/`: Adding or updating tests

Examples:
- `feature/add-client-search-filters`
- `fix/saldo-calculation-bug`
- `docs/update-windows-installation`

### Commit Messages

Follow conventional commit format:
```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only changes
- `style`: Changes that don't affect code meaning
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to build process or auxiliary tools

Examples:
```
feat(clients): add advanced search filters for client lookup

fix(saldo): correct calculation for overdue invoices
- Handle different API field names (facturas vs facturas_pendientes)
- Add automatic calculation of dias_vencido
- Fix transformer for multiple amount field names

docs(windows): update installation guide for Windows users
```

### Code Style

- Use TypeScript for all new code
- Follow existing code formatting (we use Prettier)
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Include error handling for all API calls

### Adding New Tools

When adding new MCP tools:

1. **Create tool file** in appropriate directory (`src/tools/`)
2. **Add service method** if needed in `src/services/`
3. **Add type definitions** in `src/types/wisphub.types.ts`
4. **Add validation schema** in `src/validators/schemas.ts`
5. **Export tool** in `src/index.ts`
6. **Add documentation** for the new tool
7. **Add tests** for the tool functionality

### File Structure for New Tools

```typescript
// src/tools/example/new-tool.ts
import { z } from 'zod';
import { ExampleService } from '../../services/example.service.js';
import { Logger } from '../../utils/logger.js';
import { ErrorHandler } from '../../utils/error-handler.js';

export const newTool = {
  name: 'new_tool',
  description: 'Description of what this tool does',
  inputSchema: {
    // Zod schema definition
  },
  async handler(args: unknown): Promise<string> {
    // Implementation with proper error handling
  }
};
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

- Write unit tests for all new functions
- Add integration tests for API interactions
- Mock external dependencies appropriately
- Test both success and error scenarios

### Test Structure

```typescript
describe('NewTool', () => {
  describe('handler', () => {
    it('should return expected result for valid input', async () => {
      // Test implementation
    });

    it('should handle API errors gracefully', async () => {
      // Error handling test
    });
  });
});
```

## Submitting Changes

1. **Ensure your code passes all tests**
```bash
npm test
npm run build
```

2. **Update documentation** if needed
3. **Create a pull request** with:
   - Clear title and description
   - Reference to related issues
   - Screenshots if UI changes
   - Test results

4. **Pull request template**:
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tests pass locally
- [ ] New tests added for new functionality
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

## Architecture Guidelines

### Service Layer

- Keep business logic in service classes
- Use dependency injection where appropriate
- Handle errors at service level
- Return consistent response formats

### Tool Layer

- Keep tools focused and single-purpose
- Use proper input validation
- Format responses for MCP client consumption
- Include debug information when helpful

### Error Handling

- Use the centralized ErrorHandler class
- Provide user-friendly error messages
- Log technical details appropriately
- Include context for debugging

### API Integration

- Use the WispHubClient for all API calls
- Implement proper caching strategies
- Handle rate limiting gracefully
- Include retry logic for transient failures

## Security Guidelines

- Never commit API keys or credentials
- Validate all inputs thoroughly
- Use environment variables for configuration
- Follow principle of least privilege
- Sanitize data before logging

## Documentation

When updating documentation:

- Keep README.md up to date
- Update DEPLOYMENT-GUIDE.md for setup changes
- Add troubleshooting entries for common issues
- Include examples for new features
- Maintain Windows compatibility notes

## Getting Help

- Check existing issues and documentation first
- Join community discussions
- Ask questions in pull request comments
- Reach out to maintainers for guidance

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes for significant contributions
- Special thanks for major features or fixes

Thank you for contributing to WispHub CustomerCare MCP Server! 🎉