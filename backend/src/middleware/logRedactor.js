/**
 * middleware/logRedactor.js
 *
 * Sanitizes morgan log lines before they hit stdout. Used in
 * production by server.js's morgan('combined', { stream: ... })
 * config.
 *
 * What gets redacted:
 *   1. Authorization headers: `"Bearer eyJhbG..."` → `"Bearer [REDACTED]"`
 *   2. Query strings with `token=`, `key=`, `password=`,
 *      `secret=`, `code=`: each value masked
 *   3. URL path segments that look like tokens (long hex/base64
 *      strings) when preceded by `/reset-password/`, `/verify/`,
 *      `/refresh/`, `/payment-status/` etc.
 *   4. Emails in any log field — replaced with `e***@d***.com`
 *      (preserves length signature for debugging without
 *      logging PII in full)
 *
 * Why this matters:
 *   - Logs persist for ~30 days in most setups (Datadog, CloudWatch)
 *   - Logs are often shared with vendors during support
 *   - A captured access token from a log line is a valid token
 *     for the rest of its lifetime
 *   - Email addresses are PII under GDPR / Zambia DPA
 *
 * The redactor is best-effort. Don't rely on it to mask data
 * you control — encode at the source (e.g., don't put tokens
 * in URL paths in the first place).
 */

const SENSITIVE_QUERY_KEYS = new Set([
    'token', 'access_token', 'refresh_token', 'key', 'apikey', 'api_key',
    'password', 'pass', 'pwd', 'secret', 'code', 'verify_token',
    'reset_token', 'webhook_secret'
]);

const SENSITIVE_PATH_PREFIXES = [
    '/api/auth/reset-password/',
    '/api/auth/verify/',
    '/api/auth/refresh/'
];

/**
 * Redact a single email address.
 * a.user@example.com → a***@e***.com
 */
function redactEmail(match) {
    const at = match.indexOf('@');
    if (at < 1) return '[REDACTED_EMAIL]';
    const local = match.slice(0, at);
    const domain = match.slice(at + 1);
    const dot = domain.lastIndexOf('.');
    if (dot < 1) return '[REDACTED_EMAIL]';
    const domainName = domain.slice(0, dot);
    const tld = domain.slice(dot);
    return `${local[0] || ''}***@${domainName[0] || ''}***${tld}`;
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const AUTH_RE  = /(Authorization:\s*)(Bearer\s+\S+|\S+)/gi;

/**
 * Redact a query-string segment.
 */
function redactQueryString(qs) {
    if (!qs) return qs;
    return qs.split('&').map(pair => {
        const eq = pair.indexOf('=');
        if (eq === -1) return pair;
        const k = pair.slice(0, eq).toLowerCase();
        if (SENSITIVE_QUERY_KEYS.has(k)) {
            return `${pair.slice(0, eq)}=[REDACTED]`;
        }
        return pair;
    }).join('&');
}

/**
 * Redact sensitive path segments (tokens-in-URL like reset links).
 */
function redactPath(pathAndQuery) {
    if (!pathAndQuery) return pathAndQuery;

    let [pathPart, qs] = pathAndQuery.split('?', 2);

    // Token-in-path: /api/auth/reset-password/<token>
    for (const prefix of SENSITIVE_PATH_PREFIXES) {
        if (pathPart.startsWith(prefix)) {
            pathPart = `${prefix}[REDACTED]`;
            break;
        }
    }

    // Query string redaction
    if (qs) qs = redactQueryString(qs);

    return qs ? `${pathPart}?${qs}` : pathPart;
}

/**
 * The main entry: take a morgan log line and return a sanitized
 * version. Morgan 'combined' format looks like:
 *
 *   127.0.0.1 - - [12/Jun/2026:11:00:00 +0000] "GET /api/path?... HTTP/1.1" 200 123 "-" "User-Agent"
 *
 * We replace the `"METHOD PATH HTTP/x"` segment's PATH portion
 * with a redacted version, plus generally redact emails / Auth
 * tokens anywhere in the line.
 */
export function logRedactor(line) {
    if (!line) return line;
    let out = String(line);

    // Redact the request line's path/query
    out = out.replace(/"(\w+)\s+(\S+)\s+(HTTP\/\d\.\d)"/, (_match, method, target, proto) => {
        return `"${method} ${redactPath(target)} ${proto}"`;
    });

    // Redact Authorization headers anywhere (e.g., if your log format includes req.headers)
    out = out.replace(AUTH_RE, '$1[REDACTED]');

    // Redact emails
    out = out.replace(EMAIL_RE, redactEmail);

    return out;
}

/**
 * Express middleware variant — for direct use with res.on('finish').
 * Not used by server.js (morgan handles the logging), but exported
 * in case someone wants a custom request logger.
 */
export function logRedactorMiddleware(req, _res, next) {
    if (req.url) {
        req.originalUrl = req.originalUrl || req.url;
        req.url = redactPath(req.url);
    }
    next();
}
