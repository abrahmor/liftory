// landing-auth.js - Manejo de login en la landing page
import { signInWithEmail, signUpWithEmail, signInWithGoogle, onAuthStateChanged } from '/js/auth.js';
import { showLoader, hideLoader, setButtonLoading } from '/js/utils/loader.js';

// Verificar si ya está autenticado
onAuthStateChanged((user) => {
  if (user) {
    window.location.href = '/app.html#/dashboard';
  }
});

// Esperar a que el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  setupLoginForm();
  setupSignupForm();
  setupGoogleLogin();
});

function setupLoginForm() {
  const loginForm = document.querySelector('#login-dialog .auth-form');
  if (!loginForm) return;

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('login-email')?.value;
    const password = document.getElementById('login-password')?.value;
    
    if (!email || !password) {
      showError('Por favor completa todos los campos', loginForm);
      return;
    }

    const submitBtn = loginForm.querySelector('button[type="submit"]');
    
    // Mostrar loader dentro del botón
    setButtonLoading(submitBtn, true);

    const result = await signInWithEmail(email, password);
    
    // Ocultar loader
    setButtonLoading(submitBtn, false);

    if (result.success) {
      document.getElementById('login-dialog')?.close();
      window.location.href = '/app.html#/dashboard';
    } else {
      showError(result.error || 'Error al iniciar sesión', loginForm);
    }
  });
}

function setupSignupForm() {
  const signupForm = document.getElementById('register-form');
  if (!signupForm) return;

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('signup-email')?.value;
    const password = document.getElementById('signup-password')?.value;
    const confirmPassword = document.getElementById('signup-password-confirm')?.value;
    
    if (!email || !password || !confirmPassword) {
      showError('Por favor completa todos los campos', signupForm);
      return;
    }

    if (password !== confirmPassword) {
      showError('Las contraseñas no coinciden', signupForm);
      return;
    }

    if (password.length < 6) {
      showError('La contraseña debe tener al menos 6 caracteres', signupForm);
      return;
    }

    const submitBtn = signupForm.querySelector('button[type="submit"]');
    
    // Mostrar loader dentro del botón
    setButtonLoading(submitBtn, true);

    const result = await signUpWithEmail(email, password);
    
    // Ocultar loader
    setButtonLoading(submitBtn, false);

    if (result.success) {
      document.getElementById('signup-dialog')?.close();
      window.location.href = '/app.html#/dashboard';
    } else {
      showError(result.error || 'Error al crear la cuenta', signupForm);
    }
  });
}

function setupGoogleLogin() {
  const googleLoginBtn = document.getElementById('google-login');
  const googleRegisterBtn = document.getElementById('google-register');
  
  const handleGoogleLogin = async (e) => {
    e.preventDefault();
    const btn = e.currentTarget;
    const dialog = btn.closest('dialog');
    const form = dialog ? dialog.querySelector('.auth-form') : null;
    
    try {
      // Mostrar loader dentro del botón
      setButtonLoading(btn, true);

      const result = await signInWithGoogle();
      
      // Ocultar loader
      setButtonLoading(btn, false);

      if (result.success) {
        document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
        window.location.href = '/app.html#/dashboard';
      } else {
        // Determinar qué formulario usar basado en el botón
        const dialog = btn.closest('dialog');
        const form = dialog ? dialog.querySelector('.auth-form') : null;
        showError(result.error || 'Error al iniciar sesión con Google', form);
      }
    } catch (error) {
      // Ocultar loader en caso de error
      setButtonLoading(btn, false);
      showError('Ocurrió un error inesperado', form);
    }
  };
  
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', handleGoogleLogin);
  }
  
  if (googleRegisterBtn) {
    googleRegisterBtn.addEventListener('click', handleGoogleLogin);
  }
}

function showError(message, targetForm = null) {
  // Si no se especifica un formulario, buscar el diálogo abierto
  let form = targetForm;
  
  if (!form) {
    // Buscar el diálogo abierto
    const openDialog = document.querySelector('dialog[open]');
    if (openDialog) {
      form = openDialog.querySelector('.auth-form');
    }
    
    // Si aún no hay formulario, buscar cualquier formulario de auth
    if (!form) {
      form = document.querySelector('.auth-form');
    }
  }
  
  if (!form) {
    console.error('No se encontró un formulario para mostrar el error');
    return;
  }
  
  // Buscar si ya existe un mensaje de error en este formulario
  let errorElement = form.querySelector('.auth-error-message');
  
  if (!errorElement) {
    errorElement = document.createElement('div');
    errorElement.className = 'auth-error-message';
    errorElement.style.cssText = `
      background: rgba(255, 71, 87, 0.2);
      border: 1px solid rgba(255, 71, 87, 0.5);
      color: #ff4757;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 0.9rem;
    `;
    
    // Insertar al inicio del formulario
    form.insertBefore(errorElement, form.firstChild);
  }
  
  errorElement.textContent = message;
  errorElement.style.display = 'block';
  
  // Limpiar después de 5 segundos
  setTimeout(() => {
    if (errorElement && errorElement.parentNode) {
      errorElement.style.display = 'none';
    }
  }, 5000);
}

