// landing-auth.js - Manejo de login en la landing page
import { signInWithEmail, signUpWithEmail, signInWithGoogle, onAuthStateChanged } from '/js/auth.js';
import { showLoader, hideLoader, setButtonLoading } from '/js/utils/loader.js';
import { showToast } from '/js/utils/toast.js';

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
      showToast('Por favor completa todos los campos', 'error');
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
      showToast(result.error || 'Error al iniciar sesión', 'error');
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
    const termsCheckbox = signupForm.querySelector('input[type="checkbox"]');

    if (!email || !password || !confirmPassword) {
      showToast('Por favor completa todos los campos', 'error');
      return;
    }

    if (!termsCheckbox || !termsCheckbox.checked) {
      showToast('Debes aceptar los Términos y Condiciones', 'error');
      return;
    }

    if (password !== confirmPassword) {
      showToast('Las contraseñas no coinciden', 'error');
      return;
    }

    if (password.length < 6) {
      showToast('La contraseña debe tener al menos 6 caracteres', 'error');
      return;
    }

    const submitBtn = signupForm.querySelector('button[type="submit"]');

    // Mostrar loader dentro del botón
    setButtonLoading(submitBtn, true);

    const result = await signUpWithEmail(email, password);

    // Ocultar loader
    setButtonLoading(submitBtn, false);

    if (result.success) {
      // showToast('Cuenta creada exitosamente', 'success'); // Comentado a petición
      document.getElementById('signup-dialog')?.close();
      window.location.href = '/app.html#/dashboard';
    } else {
      showToast(result.error || 'Error al crear la cuenta', 'error');
    }
  });
}

function setupGoogleLogin() {
  const googleLoginBtn = document.getElementById('google-login');
  const googleRegisterBtn = document.getElementById('google-register');

  const handleGoogleLogin = async (e) => {
    e.preventDefault();
    const btn = e.currentTarget;

    try {
      // Mostrar loader dentro del botón
      setButtonLoading(btn, true);

      const result = await signInWithGoogle();

      // Ocultar loader
      setButtonLoading(btn, false);

      if (result.success) {
        // showToast('Inicio de sesión con Google exitoso', 'success'); // Comentado a petición
        document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
        window.location.href = '/app.html#/dashboard';
      } else {
        showToast(result.error || 'Error al iniciar sesión con Google', 'error');
      }
    } catch (error) {
      // Ocultar loader en caso de error
      setButtonLoading(btn, false);
      showToast('Ocurrió un error inesperado', 'error');
    }
  };

  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', handleGoogleLogin);
  }

  if (googleRegisterBtn) {
    googleRegisterBtn.addEventListener('click', handleGoogleLogin);
  }
}
// Removed showError function entirely as it is replaced by showToast
