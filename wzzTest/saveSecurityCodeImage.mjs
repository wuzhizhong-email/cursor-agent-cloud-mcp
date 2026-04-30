#!/usr/bin/env node
/**
 * Same upstream as MCP tool get_security_code_image; writes binary image under repo image/.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchSecurityCodePayload } from './securityCodeFetch.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const IMAGE_DIR = path.join(REPO_ROOT, 'image');

function extFromMime(mimeType) {
    const m = String(mimeType || '').toLowerCase().split(';')[0].trim();
    if (m === 'image/png') return 'png';
    if (m === 'image/gif') return 'gif';
    if (m === 'image/webp') return 'webp';
    if (m === 'image/jpeg' || m === 'image/jpg') return 'jpg';
    return 'jpg';
}

async function main() {
    const { base64, mimeType } = await fetchSecurityCodePayload();
    await fs.mkdir(IMAGE_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ext = extFromMime(mimeType);
    const filename = `security-code-${stamp}.${ext}`;
    const outPath = path.join(IMAGE_DIR, filename);
    await fs.writeFile(outPath, Buffer.from(base64, 'base64'));
    console.log(outPath);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
