document.addEventListener('DOMContentLoaded', () => {
    // If none of the landing-specific elements exist, do not run this script.
    // This file is included globally in the shell, so guard against running on app.html.
    const isLanding = document.querySelector('.nav-links') || document.getElementById('login-modal') || document.querySelector('.hero-btn') || document.querySelector('.log-in-btn');
    if (!isLanding) return;
    
    // --- SCROLL ANIMATIONS ---
    const observerOptions = {
        threshold: 0.15,
        rootMargin: '0px 0px -100px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                requestAnimationFrame(() => {
                    entry.target.classList.add('visible');
                });
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    // Observar secciones para animaciones al hacer scroll
    const sections = document.querySelectorAll('.section-header, .features, .plans, .footer');
    sections.forEach(section => {
        observer.observe(section);
    });
    
    // --- HEADER SCROLL ---
    const header = document.querySelector('.header');
    if (header) {
        let lastScroll = 0;
        window.addEventListener('scroll', () => {
            const currentScroll = window.pageYOffset;
            if (currentScroll > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
            lastScroll = currentScroll;
        });
    }

    // --- NAV HOVER BG ---
    const navLinks = document.querySelector('.nav-links');
    if (navLinks) {
        const links = navLinks.querySelectorAll('a');
        const hoverBg = navLinks.querySelector('.hover-bg');
        function getOffsetRelativeTo(element, parent) {
            let x = 0, y = 0;
            while (element && element !== parent) {
                x += element.offsetLeft;
                y += element.offsetTop;
                element = element.offsetParent;
            }
            return { left: x, top: y };
        }
        function showHoverBg(element) {
            const { left, top } = getOffsetRelativeTo(element, navLinks);
            hoverBg.style.width = `${element.offsetWidth}px`;
            hoverBg.style.height = `${element.offsetHeight}px`;
            hoverBg.style.left = `${left}px`;
            hoverBg.style.top = `${top}px`;
            hoverBg.style.opacity = '1';
        }
        function hideHoverBg() {
            hoverBg.style.opacity = '0';
        }
        links.forEach(link => {
            link.addEventListener('mouseenter', () => showHoverBg(link));
            link.addEventListener('mouseleave', hideHoverBg);
        });
    }
});

async function toggleDialog(dialogId, evt) {
    const viewTransitionClass = "vt-element-animation";
    const viewTransitionClassClosing = "vt-element-animation-closing";
    const supportsViewTransition = typeof document.startViewTransition === 'function';

    if (!dialogId) {
        const openDialog = document.querySelector("dialog[open]");
        const originElement = document.querySelector("[origin-element]");

        if (openDialog) {
            if (originElement && supportsViewTransition) {
                openDialog.style.viewTransitionName = "vt-shared";
                openDialog.style.viewTransitionClass = viewTransitionClassClosing;

                const viewTransition = document.startViewTransition(() => {
                    originElement.style.viewTransitionName = "vt-shared";
                    originElement.style.viewTransitionClass = viewTransitionClassClosing;

                    openDialog.style.viewTransitionName = "";
                    openDialog.style.viewTransitionClass = "";

                    openDialog.close();
                });
                await viewTransition.finished;
                originElement.style.viewTransitionName = "";
                originElement.style.viewTransitionClass = "";
                originElement.removeAttribute("origin-element");
            } else {
                openDialog.close();
                originElement?.removeAttribute("origin-element");
            }
            // enable page scroll again
            document.body.style.overflow = "";
        }

        return false;
    }

    const dialog = document.getElementById(dialogId);
    const originElement = evt?.currentTarget || document.querySelector("[origin-element]");

    if (originElement && supportsViewTransition) {
        dialog.style.viewTransitionName = "vt-shared";
        dialog.style.viewTransitionClass = viewTransitionClass;

        originElement.style.viewTransitionName = "vt-shared";
        originElement.style.viewTransitionClass = viewTransitionClass;
        originElement.setAttribute("origin-element", "");

        const viewTransition = document.startViewTransition(() => {
            originElement.style.viewTransitionName = "";
            originElement.style.viewTransitionClass = "";
            dialog.showModal();
        });
        await viewTransition.finished;
        dialog.style.viewTransitionName = "";
        dialog.style.viewTransitionClass = "";
    } else {
        dialog.showModal();
        originElement?.setAttribute("origin-element", "");
    }

    // lock page scroll while dialog is open
    document.body.style.overflow = "hidden";
}

// Password visibility toggle for login dialog
document.querySelectorAll('.eye-icon').forEach(eyeIcon => {
    const inputGroup = eyeIcon.closest('.input-group');
    if (!inputGroup) return;
    const passwordInput = inputGroup.querySelector('input[type="password"], input[type="text"]');
    eyeIcon.addEventListener('click', () => {
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            eyeIcon.classList.remove('ti-eye-off');
            eyeIcon.classList.add('ti-eye');
        } else {
            passwordInput.type = 'password';
            eyeIcon.classList.remove('ti-eye');
            eyeIcon.classList.add('ti-eye-off');
        }
    });
});

// dialogs
const loginDialog = document.getElementById('login-dialog');
const signupDialog = document.getElementById('signup-dialog');

// Abrir el de login/registro desde botones superiores si los tienes:
// document.getElementById('openLogin')?.addEventListener('click', () => loginDialog.showModal());
// document.getElementById('openSignup')?.addEventListener('click', () => signupDialog.showModal());

// Cerrar con botón [data-close-dialog]
document.addEventListener('click', (e) => {
    const closeBtn = e.target.closest('[data-close-dialog]');
    if (!closeBtn) return;
    const dlg = closeBtn.closest('dialog');
    dlg?.close();
});

// Cambiar entre login <-> signup sin inline handlers
document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-switch-dialog]');
    if (!link) return;
    e.preventDefault();

    const targetSel = link.getAttribute('data-switch-dialog'); // "#signup-dialog" o "#login-dialog"
    const target = document.querySelector(targetSel);
    if (!target) return;

    // cierra el diálogo actual (si estás dentro de uno)
    const current = link.closest('dialog');
    current?.close();

    // abre el objetivo
    target.showModal();
});

