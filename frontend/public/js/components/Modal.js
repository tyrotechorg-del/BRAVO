/**
 * Modal Component
 */

class Modal {
    static show(options) {
        const opts = options || {};
        const previouslyFocused = document.activeElement;

        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');

        // Build the static structure with safe interpolation.
        const titleId = `modal-title-${Date.now()}`;
        modal.setAttribute('aria-labelledby', titleId);

        const content = document.createElement('div');
        content.className = 'modal-content animate-scale-in';

        // Header
        const header = document.createElement('div');
        header.className = 'modal-header';
        const titleEl = document.createElement('h2');
        titleEl.id = titleId;
        titleEl.textContent = opts.title || 'Modal'; // <-- XSS-safe
        header.appendChild(titleEl);

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'modal-close';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.innerHTML = '&times;';
        header.appendChild(closeBtn);

        content.appendChild(header);

        // Body — `content` is intentionally HTML. Callers must
        // escape user-controlled values they put in it.
        const body = document.createElement('div');
        body.className = 'modal-body';
        body.innerHTML = opts.content || '';
        content.appendChild(body);

        // Footer (buttons)
        let buttonElements = [];
        if (Array.isArray(opts.buttons) && opts.buttons.length > 0) {
            const footer = document.createElement('div');
            footer.className = 'modal-footer';
            opts.buttons.forEach((btnSpec) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = btnSpec.class || 'btn-primary';
                btn.dataset.action = btnSpec.action || '';
                btn.textContent = btnSpec.text || 'OK'; // <-- XSS-safe
                btn.addEventListener('click', () => {
                    if (typeof btnSpec.onClick === 'function') {
                        try { btnSpec.onClick(); } catch (e) { console.error('Modal button onClick error:', e); }
                    }
                    cleanup();
                });
                footer.appendChild(btn);
                buttonElements.push(btn);
            });
            content.appendChild(footer);
        }

        modal.appendChild(content);
        document.body.appendChild(modal);

        // Cleanup function — used by every dismiss path
        const cleanup = () => {
            document.removeEventListener('keydown', onKeydown);
            modal.remove();
            // Restore focus to whatever had it before the modal opened,
            // unless it's no longer in the DOM (e.g., we navigated away).
            if (previouslyFocused && document.body.contains(previouslyFocused)) {
                try { previouslyFocused.focus(); } catch {}
            }
        };

        closeBtn.addEventListener('click', cleanup);

        // Backdrop dismiss — only when clicking the backdrop itself.
        modal.addEventListener('click', (e) => {
            if (e.target === modal) cleanup();
        });

        // Keyboard handlers — Escape + focus trap
        const focusableSelector = [
            'a[href]', 'button:not([disabled])', 'textarea:not([disabled])',
            'input:not([disabled])', 'select:not([disabled])',
            '[tabindex]:not([tabindex="-1"])'
        ].join(',');

        const onKeydown = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                cleanup();
                return;
            }
            if (e.key === 'Tab') {
                const focusables = modal.querySelectorAll(focusableSelector);
                if (focusables.length === 0) return;
                const first = focusables[0];
                const last = focusables[focusables.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };
        document.addEventListener('keydown', onKeydown);

        // Initial focus — first focusable element in the dialog
        // Use rAF so the focus call lands after layout.
        requestAnimationFrame(() => {
            const focusables = modal.querySelectorAll(focusableSelector);
            // Prefer focusable elements that AREN'T the close button —
            // a primary action button or input is more useful as initial focus.
            const target = Array.from(focusables).find(el => el !== closeBtn) || closeBtn;
            try { target.focus(); } catch {}
        });

        // Return both the modal element AND a cleanup hook so callers
        // can dismiss programmatically.
        return { element: modal, close: cleanup };
    }

    static confirm(message, onConfirm, onCancel = null) {
        const safeMessage = document.createElement('p');
        safeMessage.textContent = String(message); // <-- XSS-safe wrapping
        return this.show({
            title: 'Confirm',
            content: safeMessage.outerHTML,
            buttons: [
                { text: 'Cancel', class: 'btn-secondary', action: 'cancel', onClick: onCancel },
                { text: 'Confirm', class: 'btn-primary', action: 'confirm', onClick: onConfirm }
            ]
        });
    }

    static alert(message, title = 'Notification') {
        const safeMessage = document.createElement('p');
        safeMessage.textContent = String(message);
        return this.show({
            title,
            content: safeMessage.outerHTML,
            buttons: [{ text: 'OK', class: 'btn-primary', action: 'ok' }]
        });
    }
}

window.Modal = Modal;
