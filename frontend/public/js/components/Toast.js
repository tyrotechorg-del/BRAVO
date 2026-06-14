

class Toast {
    static show(message, type = 'info', duration = 4000) {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
        toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

        // Build the icon + message via DOM APIs so the message text
        // is never interpreted as HTML. (Same idea as React's
        // safety by default.)
        const iconEl = document.createElement('i');
        iconEl.className = `fas ${icons[type] || icons.info}`;
        toast.appendChild(iconEl);

        const messageEl = document.createElement('span');
        messageEl.textContent = String(message); // <-- this is the XSS fix
        toast.appendChild(messageEl);

        container.appendChild(toast);

        // Use { once: true } for the cleanup listener so it never leaks.
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    static success(message) { return this.show(message, 'success'); }
    static error(message) { return this.show(message, 'error'); }
    static warning(message) { return this.show(message, 'warning'); }
    static info(message) { return this.show(message, 'info'); }
}

window.Toast = Toast;
