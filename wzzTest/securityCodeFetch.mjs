/**
 * Shared upstream fetch for security code / captcha (same as MCP get_security_code_image).
 */

const DEFAULT_UPSTREAM =
    'https://youxuer8.test.xdf.cn/api/sysmanage/securityCode/getSecurityCode';
export const UPSTREAM_URL = process.env.SECURITY_CODE_UPSTREAM_URL?.trim() || DEFAULT_UPSTREAM;

const LOGIN_MODE = 'Front';

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

export async function fetchSecurityCodePayload() {
    const url = new URL(UPSTREAM_URL);
    url.searchParams.set('loginMode', LOGIN_MODE);

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
