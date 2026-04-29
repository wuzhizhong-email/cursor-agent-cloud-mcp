import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import * as z from 'zod/v4';

/**
 * wzzTest MCP — Streamable HTTP on POST /mcp
 *
 * Env:
 *   MCP_PORT - listen port (default 8080)
 *   SECURITY_CODE_UPSTREAM_URL - override upstream base URL (loginMode is appended)
 *   MCP_ALLOWED_HOSTS - comma-separated Host allowlist (DNS rebinding protection)
 */
const DEFAULT_UPSTREAM =
    'https://youxuer8.test.xdf.cn/api/sysmanage/securityCode/getSecurityCode';
const UPSTREAM_URL = process.env.SECURITY_CODE_UPSTREAM_URL?.trim() || DEFAULT_UPSTREAM;

function stripDataUrlPrefix(s) {
    const m = /^data:[^;]+;base64,(.+)$/s.exec(String(s).trim());
    return m ? m[1] : String(s).trim();
}

function extractBase64FromJson(value, depth = 0) {
    if (depth > 8) return null;
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') {
        const t = value.trim();
        if (/^data:[^;]+;base64,/.test(t)) return stripDataUrlPrefix(t);
        if (t.length > 80 && /^[A-Za-z0-9+/=\s]+$/.test(t.replace(/\s/g, ''))) {
            return t.replace(/\s/g, '');
        }
        return null;
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            const found = extractBase64FromJson(item, depth + 1);
            if (found) return found;
        }
        return null;
    }
    if (typeof value === 'object') {
        const preferredKeys = [
            'img',
            'image',
            'base64',
            'data',
            'securityCode',
            'code',
            'captcha',
            'content'
        ];
        for (const k of preferredKeys) {
            if (k in value) {
                const found = extractBase64FromJson(value[k], depth + 1);
                if (found) return found;
            }
        }
        for (const k of Object.keys(value)) {
            const found = extractBase64FromJson(value[k], depth + 1);
            if (found) return found;
        }
    }
    return null;
}

async function fetchSecurityCodePayload(loginMode) {
    const url = new URL(UPSTREAM_URL);
    url.searchParams.set('loginMode', loginMode);

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 30000);
    try {
        const res = await fetch(url, {
            signal: ac.signal,
            headers: { Accept: 'application/json, image/*, */*' }
        });
        if (!res.ok) {
            throw new Error(`Upstream HTTP ${res.status}`);
        }
        const contentType = (res.headers.get('content-type') || '').toLowerCase();
        const buf = Buffer.from(await res.arrayBuffer());

        if (
            contentType.includes('application/json') ||
            contentType.includes('text/json') ||
            (buf.length > 0 && buf[0] === 0x7b /* { */)
        ) {
            let parsed;
            try {
                parsed = JSON.parse(buf.toString('utf8'));
            } catch {
                parsed = null;
            }
            if (parsed) {
                const b64 = extractBase64FromJson(parsed);
                if (b64) {
                    return {
                        base64: b64,
                        mimeType: guessMimeFromJson(parsed) || 'image/jpeg'
                    };
                }
            }
        }

        const mime = contentType.split(';')[0].trim() || 'image/jpeg';
        return { base64: buf.toString('base64'), mimeType: mime };
    } finally {
        clearTimeout(timer);
    }
}

function guessMimeFromJson(obj) {
    if (!obj || typeof obj !== 'object') return null;
    const t =
        obj.mimeType ||
        obj.contentType ||
        obj.type ||
        obj.imgType ||
        obj.imageType;
    if (typeof t === 'string' && t.includes('/')) return t;
    return null;
}

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
                'Call the security code API and return the captcha image as base64 (via MCP image content).',
            inputSchema: {
                login_mode: z
                    .string()
                    .optional()
                    .default('Front')
                    .describe('loginMode query parameter (default: Front)')
            }
        },
        async ({ login_mode: loginMode }) => {
            const { base64, mimeType } = await fetchSecurityCodePayload(loginMode ?? 'Front');
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
