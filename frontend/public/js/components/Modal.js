/**
 * Modal Component
 */

class Modal {
    static show(options) {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content animate-scale-in">
                <div class="modal-header">
                    <h2>${options.title || 'Modal'}</h2>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    ${options.content || ''}
                </div>
                ${options.buttons ? `
                    <div class="modal-footer">
                        ${options.buttons.map(btn => `
                            <button class="${btn.class}" data-action="${btn.action}">${btn.text}</button>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const closeBtn = modal.querySelector('.modal-close');
        closeBtn.addEventListener('click', () => modal.remove());
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
        
        if (options.buttons) {
            options.buttons.forEach(btn => {
                const btnElement = modal.querySelector(`[data-action="${btn.action}"]`);
                if (btnElement && btn.onClick) {
                    btnElement.addEventListener('click', () => {
                        btn.onClick();
                        modal.remove();
                    });
                }
            });
        }
        
        return modal;
    }
    
    static confirm(message, onConfirm, onCancel = null) {
        return this.show({
            title: 'Confirm',
            content: `<p>${message}</p>`,
            buttons: [
                { text: 'Cancel', class: 'btn-secondary', action: 'cancel', onClick: onCancel },
                { text: 'Confirm', class: 'btn-primary', action: 'confirm', onClick: onConfirm }
            ]
        });
    }
    
    static alert(message, title = 'Notification') {
        return this.show({
            title: title,
            content: `<p>${message}</p>`,
            buttons: [
                { text: 'OK', class: 'btn-primary', action: 'ok' }
            ]
        });
    }
}

window.Modal = Modal;