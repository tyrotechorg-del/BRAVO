/**
 * middleware/securityHeaders.js
 *
 * Adds the security headers helmet's defaults don't quite cover
 * the way we want for this API.
 *
 * Order of operations:
 *   1. server.js wires helmet() with most security headers
 *   2. server.js then calls applySecurityHeaders to add the
 *      ones that need custom values: CSP, Referrer-Policy,
 *      Permissions-Policy.
 *
 * ============================================================
 * NOTES ON CSP FOR AN API SERVER
 * ============================================================
 * This is primarily an API — JSON responses don't render in a
 * browser. But three paths DO serve content that's rendered:
 *
 *   1. Static uploads (/uploads, /static/*) — images, audio,
 *      video files that get embedded in the frontend.
 *   2. The bare root `GET /` — a small JSON status page.
 *   3. Error pages and the 404 handler — JSON only.
 *
 * The CSP set here matters mostly for case 1 (if a malicious
 * file were uploaded and served as text/html, CSP prevents it
 * from executing). It also defeats clickjacking via X-Frame-
 * Options and frame-ancestors.
 *
 * The frontend itself is served from `bravomusics.com` (a
 * SEPARATE domain) so the frontend's CSP is set by the static-
 * file server, not here.
 */

export function applySecurityHeaders(req, res, next) {
    // Content-Security-Policy
    //   - default-src 'none': nothing loads unless explicitly listed
    //   - script-src 'none': no JS execution from this domain
    //     (this is an API — JSON doesn't have scripts; serving an
    //     uploaded file as HTML can't execute embedded JS)
    //   - frame-ancestors 'none': can't be embedded in iframes
    //     (anti-clickjacking)
    //   - img-src 'self' data: blob: https:
    //     (for static images the API serves)
    //   - media-src 'self' blob: https:
    //     (for static audio/video the API serves)
    //   - object-src 'none': no <embed>, <object>
    //   - base-uri 'none'
    res.setHeader('Content-Security-Policy', [
        "default-src 'none'",
        "script-src 'none'",
        "style-src 'self' 'unsafe-inline'",   // for the bare-JSON 404/health pages
        "img-src 'self' data: blob: https:",
        "media-src 'self' blob: https:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "form-action 'none'",
        "object-src 'none'",
        "base-uri 'none'"
    ].join('; '));

    // Referrer-Policy — don't leak the API path to third-party referrers
    res.setHeader('Referrer-Policy', 'no-referrer');

    // Permissions-Policy — disable a bunch of browser APIs we never use
    res.setHeader('Permissions-Policy', [
        'accelerometer=()',
        'autoplay=()',
        'camera=()',
        'cross-origin-isolated=()',
        'display-capture=()',
        'encrypted-media=()',
        'fullscreen=(self)',
        'geolocation=()',
        'gyroscope=()',
        'magnetometer=()',
        'microphone=()',
        'midi=()',
        'payment=()',
        'picture-in-picture=()',
        'publickey-credentials-get=()',
        'sync-xhr=()',
        'usb=()'
    ].join(', '));

    // X-Frame-Options is the legacy version of CSP frame-ancestors.
    // Some old browsers honor it but not CSP — keep it for defense in depth.
    res.setHeader('X-Frame-Options', 'DENY');

    // X-Content-Type-Options — prevent MIME sniffing.
    // (helmet already sets this — duplicate is harmless.)
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Server header reveals the Express version. Strip it.
    res.removeHeader('X-Powered-By');

    next();
}
