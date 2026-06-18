/**
 * Password reveal toggle — auto-wires every <input type="password"> on the
 * page with a show/hide eye icon. No per-page setup required.
 *
 * Mechanism:
 *   1. On script load: scan + wrap existing password inputs
 *   2. MutationObserver: catch inputs added by future page renders
 *   3. Wrap each input in a positioned container; inject a button
 *      that flips input.type between 'password' and 'text'
 *
 * Skips inputs already wrapped (idempotent) and inputs marked with
 * data-no-reveal (in case some flow ever needs to opt out).
 *
 * Accessibility:
 *   - Button has aria-label that flips with state
 *   - Button has aria-pressed reflecting the show/hide state
 *   - Tab order: input then button
 *   - Keyboard: Enter / Space toggles
 */

(function () {
    'use strict';

    const WRAPPER_CLASS = 'pw-reveal-wrap';
    const BUTTON_CLASS = 'pw-reveal-btn';

    // Inject CSS once
    const style = document.createElement('style');
    style.textContent = `
        .${WRAPPER_CLASS} {
            position: relative;
            display: block;
        }
        .${WRAPPER_CLASS} > input[type="password"],
        .${WRAPPER_CLASS} > input[type="text"] {
            padding-right: 44px !important;
        }
        .${BUTTON_CLASS} {
            position: absolute;
            top: 50%;
            right: 4px;
            transform: translateY(-50%);
            width: 36px;
            height: 36px;
            background: transparent;
            border: none;
            color: #8a8aa3;
            cursor: pointer;
            border-radius: 6px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 15px;
            transition: color 0.15s, background 0.15s;
            -webkit-tap-highlight-color: transparent;
            padding: 0;
        }
        .${BUTTON_CLASS}:hover {
            color: #e8e8f0;
            background: rgba(255, 255, 255, 0.05);
        }
        .${BUTTON_CLASS}:focus-visible {
            outline: 2px solid #6c63ff;
            outline-offset: -2px;
            color: #e8e8f0;
        }
        .${BUTTON_CLASS}[aria-pressed="true"] {
            color: #6c63ff;
        }
        .light-theme .${BUTTON_CLASS} {
            color: #888;
        }
        .light-theme .${BUTTON_CLASS}:hover {
            background: rgba(0, 0, 0, 0.05);
            color: #1a1a2e;
        }
    `;
    document.head.appendChild(style);

    function wireInput(input) {
        if (!input || input.dataset.noReveal === 'true') return;
        // Already wrapped?
        if (input.parentElement && input.parentElement.classList.contains(WRAPPER_CLASS)) return;
        // Not actually a password input (might have been re-typed by us already)
        if (input.type !== 'password') return;

        const parent = input.parentElement;
        if (!parent) return;

        // Wrap the input
        const wrap = document.createElement('span');
        wrap.className = WRAPPER_CLASS;
        parent.insertBefore(wrap, input);
        wrap.appendChild(input);

        // Build the toggle button
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = BUTTON_CLASS;
        btn.tabIndex = 0;
        btn.setAttribute('aria-label', 'Show password');
        btn.setAttribute('aria-pressed', 'false');
        btn.title = 'Show password';
        btn.innerHTML = '<i class="fas fa-eye" aria-hidden="true"></i>';

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const showing = input.type === 'text';
            if (showing) {
                input.type = 'password';
                btn.setAttribute('aria-pressed', 'false');
                btn.setAttribute('aria-label', 'Show password');
                btn.title = 'Show password';
                btn.innerHTML = '<i class="fas fa-eye" aria-hidden="true"></i>';
            } else {
                input.type = 'text';
                btn.setAttribute('aria-pressed', 'true');
                btn.setAttribute('aria-label', 'Hide password');
                btn.title = 'Hide password';
                btn.innerHTML = '<i class="fas fa-eye-slash" aria-hidden="true"></i>';
            }
            // Keep focus on the input — feels more natural for typing flow
            input.focus();
            // Cursor goes to the end so users can keep typing
            const len = input.value.length;
            try { input.setSelectionRange(len, len); } catch (_) { /* some input types don't support */ }
        });

        // When the input is removed from the DOM, the wrapper goes with it.
        wrap.appendChild(btn);
    }

    function scanAndWire(root) {
        const inputs = (root || document).querySelectorAll('input[type="password"]');
        inputs.forEach(wireInput);
    }

    // Wire what's already on the page
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => scanAndWire());
    } else {
        scanAndWire();
    }

    // Watch for inputs added by SPA page navigation
    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (node.nodeType !== 1) continue;
                if (node.matches && node.matches('input[type="password"]')) {
                    wireInput(node);
                } else if (node.querySelectorAll) {
                    scanAndWire(node);
                }
            }
        }
    });
    observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
    });

    // Expose for manual re-scans if ever needed (e.g. after dynamic form mounting)
    window.wirePasswordReveal = scanAndWire;
})();
