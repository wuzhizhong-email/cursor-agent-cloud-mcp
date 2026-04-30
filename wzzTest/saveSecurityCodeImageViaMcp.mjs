#!/usr/bin/env node
/**
 * Calls MCP tool get_security_code_image over Streamable HTTP and writes the image to repo image/.
 *
 * Env:
 *   MCP_HTTP_URL - MCP endpoint (default http://127.0.0.1:8080/mcp)
 *
 * Requires wzzTest MCP server running (npm start).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const IMAGE_DIR = path.join(REPO_ROOT, 'image');

const MCP_HTTP_URL = process.env.MCP_HTTP_URL?.trim() || 'http://127.0.0.1:8080/mcp';

function extFromMime(mimeType) {
    const m = String(mimeType || '').toLowerCase().split(';')[0].trim();
    if (m === 'image/png') return 'png';
    if (m === 'image/gif') return 'gif';
    if (m === 'image/webp') return 'webp';
    if (m === 'image/jpeg' || m === 'image/jpg') return 'jpg';
    return 'jpg';
}

async function main() {
    const url = new URL(MCP_HTTP_URL);
    const client = new Client({ name: 'save-security-code-cli', version: '1.0.0' }, { capabilities: {} });
    const transport = new StreamableHTTPClientTransport(url);
    await client.connect(transport);
    try {
        const result = await client.callTool({
            name: 'get_security_code_image',
            arguments: {}
        });
        const items = result.content || [];
        const imageItem = items.find((c) => c.type === 'image');
        if (!imageItem || typeof imageItem.data !== 'string') {
            throw new Error('MCP result has no image content block');
        }
        const { data: base64, mimeType = 'image/jpeg' } = imageItem;
        await fs.mkdir(IMAGE_DIR, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const ext = extFromMime(mimeType);
        const filename = `security-code-mcp-${stamp}.${ext}`;
        const outPath = path.join(IMAGE_DIR, filename);
        await fs.writeFile(outPath, Buffer.from(base64, 'base64'));
        console.log(outPath);
    } finally {
        await transport.close();
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
