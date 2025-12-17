/**
 * Reusable Toast Notification System
 * Usage: showToast('Message', 'error' | 'success' | 'info')
 */

export function showToast(message, type = 'error', duration = 4000) {
    let container = document.getElementById('global-toast-container');
    const supportsPopover = HTMLElement.prototype.hasOwnProperty('popover');

    // Strategy 1: Popover API (Top Layer) - Modern & Best
    // Strategy 1: Popover API (Top Layer) - Modern & Best
    if (supportsPopover) {
        if (!container) {
            container = document.createElement('div');
            container.id = 'global-toast-container';
            container.className = 'toast-container';
            container.popover = 'manual';
            document.body.appendChild(container);
        }
        // Always call showPopover to ensure it's on top of any new dialogs
        container.showPopover();
    }
    // Strategy 2: Fallback Logic
    else {
        // Check if there is an open dialog
        const openDialog = document.querySelector('dialog[open]');

        // Smart decision:
        // If type is 'success', we assume the modal might close, so we prefer the body.
        // If type is 'error', the modal likely stays open, so we MUST place it in the dialog to be visible.
        const useDialog = openDialog && type !== 'success';

        if (useDialog) {
            container = openDialog.querySelector('.toast-container');
            if (!container) {
                container = document.createElement('div');
                container.className = 'toast-container';
                openDialog.appendChild(container);
            }
        } else {
            // Use global body container
            if (!container) {
                container = document.createElement('div');
                container.id = 'global-toast-container';
                container.className = 'toast-container';
                document.body.appendChild(container);
            }
        }
    }

    // Clear existing toasts (prevent stacking) if needed, or allow stacking?
    // Current design: single notification at a time, clears previous
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    // Choose icon
    let iconSvg = '';
    if (type === 'error') {
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    } else if (type === 'success') {
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-circle-check"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M9 12l2 2l4 -4" /></svg>`;
    } else {
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    toast.innerHTML = `
        <div class="toast-icon">${iconSvg}</div>
        <span class="toast-message">${message}</span>
    `;

    // Append to container
    container.appendChild(toast);

    // Remove after duration
    setTimeout(() => {
        toast.classList.add('exiting');
        toast.addEventListener('animationend', () => {
            if (toast.parentElement) {
                toast.remove();

                // Always cleanup container if empty to ensure z-index stacking is fresh for next toast
                if (container.children.length === 0) {
                    container.remove();
                }
            }
        });
    }, duration);
}

// Make it available globally if needed (for inline onclicks or simple usages)
window.showToast = showToast;
