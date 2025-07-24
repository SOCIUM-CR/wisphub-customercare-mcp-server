---
name: Bug report
about: Create a report to help us improve
title: '[BUG] '
labels: 'bug'
assignees: ''

---

## 🐛 Bug Description
A clear and concise description of what the bug is.

## 🔄 Steps to Reproduce
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

## ✅ Expected Behavior
A clear and concise description of what you expected to happen.

## ❌ Actual Behavior
A clear and concise description of what actually happened.

## 📱 Environment Information

### System Details
- **OS**: [e.g. Windows 11, macOS 13.0, Ubuntu 22.04]
- **Node.js version**: [run `node --version`]
- **npm version**: [run `npm --version`]
- **Claude Desktop version**: [if applicable]

### WispHub CustomerCare MCP Server
- **Version**: [e.g. 1.0.0]
- **Installation method**: [e.g. git clone, npm install, release download]

### WispHub API
- **Base URL**: [e.g. https://api.wisphub.app]
- **API version**: [if known]

## 📋 Tool Information
- **Tool affected**: [e.g. consultar_clientes, obtener_cliente]
- **Input parameters**: [what parameters were used]
- **Error message**: [exact error message received]

## 📄 Logs and Error Messages

### Error Message
```
Paste the exact error message here
```

### Debug Information
```json
Paste any debug information from the tool response here
```

### Console Logs
```
Paste relevant console logs here
```

## 📸 Screenshots
If applicable, add screenshots to help explain your problem.

## 🔧 Configuration

### Claude Desktop Config
```json
{
  "mcpServers": {
    "wisphub-customercare": {
      // Your configuration (remove sensitive data like API keys)
    }
  }
}
```

### Environment Variables
```bash
# List environment variables (remove sensitive values)
NODE_ENV=production
WISPHUB_BASE_URL=https://api.wisphub.app
# WISPHUB_API_KEY=[REDACTED]
```

## 🔍 Additional Context

### Frequency
- [ ] This happens every time
- [ ] This happens sometimes
- [ ] This happened once

### When did it start?
- [ ] After updating the server
- [ ] After changing configuration
- [ ] From the beginning
- [ ] After a system update

### Workarounds
Have you found any workarounds for this issue?

### Related Issues
Are there any related issues or similar problems?

## 📝 Additional Information
Add any other context about the problem here.

---

## ✅ Checklist
- [ ] I have searched existing issues to make sure this is not a duplicate
- [ ] I have provided all the requested information
- [ ] I have removed any sensitive information (API keys, passwords, etc.)
- [ ] I have tested this with the latest version of the server