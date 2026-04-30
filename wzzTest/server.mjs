import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { fetchSecurityCodePayload } from './securityCodeFetch.mjs';

/**
 * wzzTest MCP — Streamable HTTP on POST /mcp
 *
 * Default: listen on http://0.0.0.0:8080/mcp (Streamable HTTP POST).
 *
 * Env:
 *   MCP_PORT - listen port (default 8080)
 *   SECURITY_CODE_UPSTREAM_URL - override upstream base URL (loginMode is always Front)
 *   MCP_ALLOWED_HOSTS - comma-separated Host allowlist (DNS rebinding protection)
 */

function buildServer() {
    const server = new McpServer(
        {
            name: 'wzzTest',
            version: '1.0.0'
        },
        { capabilities: {} }
    );

    server.registerTool(
        'get_security_code_image',
        {
            description:
                'Call the security code API (loginMode=Front) and return the captcha image as base64 (via MCP image content).',
            inputSchema: {}
        },
        async () => {
            const { base64, mimeType } = await fetchSecurityCodePayload();
            return {
                content: [
                    {
                        type: 'image',
                        data: base64,
                        mimeType
                    },
                    {
                        type: 'text',
                        text: `Captcha image (base64): ${base64}`
                    }
                ]
            };
        }
    );

    server.registerTool(
        'health_check',
        {
            description: 'Simple health check for MCP deployment validation.',
            inputSchema: {}
        },
        async () => ({
            content: [{ type: 'text', text: 'ok' }]
        })
    );

    return server;
}

const PORT = Number.parseInt(process.env.MCP_PORT || '8080', 10);

const tunnelHosts = process.env.MCP_ALLOWED_HOSTS?.split(',')
    .map((h) => h.trim())
    .filter(Boolean);

const appOpts = { host: '0.0.0.0' };
if (tunnelHosts?.length) {
    appOpts.allowedHosts = tunnelHosts;
}

const app = createMcpExpressApp(appOpts);

app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'wzzTest' });
});

app.post('/mcp', async (req, res) => {
    const server = buildServer();
    try {
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined
        });
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        res.on('close', () => {
            transport.close();
            server.close();
        });
    } catch (err) {
        console.error(err);
        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: '2.0',
                error: {
                    code: -32603,
                    message: err instanceof Error ? err.message : 'Internal server error'
                },
                id: null
            });
        }
    }
});

app.get('/mcp', async (_req, res) => {
    res.status(405).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Method not allowed.' },
        id: null
    });
});

app.delete('/mcp', async (_req, res) => {
    res.status(405).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Method not allowed.' },
        id: null
    });
});

app.listen(PORT, '0.0.0.0', (err) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`wzzTest MCP listening on http://0.0.0.0:${PORT}/mcp (Streamable HTTP)`);
});
