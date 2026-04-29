# cursor-agent-cloud-mcp

## wzzTest MCP service

This repository provides a local HTTP MCP service named `wzzTest`.

### Features

- MCP tool: `health_check`
- MCP tool: `get_security_code_image(login_mode="Front")`
  - Calls upstream endpoint:
    `https://youxuer8.test.xdf.cn/api/sysmanage/securityCode/getSecurityCode?loginMode=Front`
  - Returns base64 image payload and metadata

### Run locally

```bash
python3 -m pip install --user -r requirements.txt
python3 wzztest_mcp_server.py
```

Default server settings:

- host: `0.0.0.0`
- port: `8765`
- MCP HTTP path: `/mcp`

You can override them:

```bash
MCP_HOST=0.0.0.0 MCP_PORT=8765 MCP_PATH=/mcp python3 wzztest_mcp_server.py
```

### Agent Cloud MCP config (HTTP)

Use this URL in your MCP client/agent config:

```text
http://<your-host>:8765/mcp
```
