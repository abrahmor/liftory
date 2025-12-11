// app-auth.js - Verificar autenticación y manejar logout
import { initFirebase } from '/js/firebase-config.js';
import { onAuthStateChanged, signOut, getCurrentUser, getUserData, updateUserDisplayName } from '/js/auth.js';

// Inicializar Firebase
initFirebase();

// Verificar autenticación al cargar
document.addEventListener('DOMContentLoaded', () => {
  onAuthStateChanged(async (user) => {
    if (!user) {
      // No está autenticado, redirigir al login
      window.location.href = '/index.html';
      return;
    }
    
    // Está autenticado, actualizar UI
    await updateUserUI(user);
    setupLogoutButton();
    setupEditNameButton();
  });
});

async function updateUserUI(user) {
  // Mostrar nombre inmediatamente desde Firebase Auth (más rápido)
  const quickName = user.displayName || user.email?.split('@')[0] || 'Usuario';
  
  // Actualizar nombre de usuario inmediatamente
  const userNameElements = document.querySelectorAll('.user-profile-name');
  userNameElements.forEach(el => {
    if (el) el.textContent = quickName;
  });

  // Actualizar email en el perfil
  const emailElement = document.querySelector('.profile-detail-card .profile-detail-value');
  if (emailElement && emailElement.textContent.includes('@')) {
    emailElement.textContent = user.email || '';
  }

  // Actualizar nombre de usuario en el card de edición
  const nameValueElement = document.querySelector('.profile-detail-card:nth-of-type(2) .profile-detail-value');
  if (nameValueElement) {
    nameValueElement.textContent = quickName;
    nameValueElement.dataset.originalName = quickName;
  }

  // Actualizar avatar si existe
  const avatarImg = document.querySelector('.user-avatar-img');
  if (avatarImg && user.photoURL) {
    avatarImg.src = user.photoURL;
  }

  // Actualizar dashboard inmediatamente
  updateDashboardName(quickName);

  // Luego obtener datos desde Firestore en segundo plano (puede tener nombre más actualizado)
  getUserData(user.uid).then(userData => {
    if (userData?.displayName && userData.displayName !== quickName) {
      const finalName = userData.displayName;
      
      // Actualizar con el nombre de Firestore si es diferente
      userNameElements.forEach(el => {
        if (el) el.textContent = finalName;
      });
      
      if (nameValueElement) {
        nameValueElement.textContent = finalName;
        nameValueElement.dataset.originalName = finalName;
      }
      
      updateDashboardName(finalName);
    }
  }).catch(err => {
    console.warn('No se pudo cargar nombre desde Firestore, usando nombre de Auth:', err);
  });
}

function updateDashboardName(name) {
  const dashboardTitle = document.querySelector('.dasboard-title');
  if (dashboardTitle) {
    dashboardTitle.textContent = `Bienvenido, ${name}`;
  }
}

function setupLogoutButton() {
  const logoutBtn = document.querySelector('.profile-logout-btn');
  if (logoutBtn) {
    // Remover listeners anteriores
    const newLogoutBtn = logoutBtn.cloneNode(true);
    logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
    
    newLogoutBtn.addEventListener('click', async () => {
      const result = await signOut();
      if (result.success) {
        window.location.href = '/index.html';
      }
    });
  }
}

function setupEditNameButton() {
  const editBtn = document.querySelector('.profile-edit-btn');
  const nameValueElement = document.querySelector('.profile-detail-card:nth-of-type(2) .profile-detail-value');
  
  if (!editBtn || !nameValueElement) return;

  // Remover listeners anteriores
  const newEditBtn = editBtn.cloneNode(true);
  editBtn.parentNode.replaceChild(newEditBtn, editBtn);

  newEditBtn.addEventListener('click', () => {
    const currentName = nameValueElement.textContent;
    const originalName = nameValueElement.dataset.originalName || currentName;

    // Crear input para editar
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.className = 'input';
    input.style.cssText = 'margin-top: 8px; width: 100%;';
    
    // Reemplazar el texto con el input
    nameValueElement.textContent = '';
    nameValueElement.appendChild(input);
    input.focus();
    input.select();

    // Cambiar botón a "Guardar" y "Cancelar"
    newEditBtn.textContent = 'Guardar';
    newEditBtn.style.marginRight = '8px';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancelar';
    cancelBtn.className = 'profile-edit-btn';
    cancelBtn.style.cssText = newEditBtn.style.cssText;
    newEditBtn.parentNode.appendChild(cancelBtn);

    // Guardar
    const saveHandler = async () => {
      const newName = input.value.trim();
      
      if (!newName) {
        showError('El nombre no puede estar vacío');
        return;
      }

      if (newName === originalName) {
        // No hay cambios, cancelar
        cancelHandler();
        return;
      }

      newEditBtn.disabled = true;
      newEditBtn.textContent = 'Guardando...';

      const result = await updateUserDisplayName(newName);
      
      newEditBtn.disabled = false;

      if (result.success) {
        // Actualizar UI
        nameValueElement.textContent = newName;
        nameValueElement.dataset.originalName = newName;
        nameValueElement.removeChild(input);
        newEditBtn.textContent = 'Editar';
        newEditBtn.removeEventListener('click', saveHandler);
        setupEditNameButton(); // Re-configurar el botón
        cancelBtn.remove();
        updateDashboardName(newName);
        
        // Actualizar nombre en avatar section
        document.querySelectorAll('.user-profile-name').forEach(el => {
          el.textContent = newName;
        });
      } else {
        showError(result.error || 'Error al actualizar el nombre');
      }
    };

    // Cancelar
    const cancelHandler = () => {
      nameValueElement.textContent = originalName;
      nameValueElement.dataset.originalName = originalName;
      newEditBtn.textContent = 'Editar';
      newEditBtn.removeEventListener('click', saveHandler);
      setupEditNameButton(); // Re-configurar el botón
      cancelBtn.remove();
    };

    newEditBtn.addEventListener('click', saveHandler);
    cancelBtn.addEventListener('click', cancelHandler);

    // Guardar con Enter, cancelar con Escape
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        saveHandler();
      } else if (e.key === 'Escape') {
        cancelHandler();
      }
    });
  });
}

function showError(message) {
  // Crear o actualizar elemento de error
  let errorElement = document.querySelector('.profile-error-message');
  
  if (!errorElement) {
    errorElement = document.createElement('div');
    errorElement.className = 'profile-error-message';
    errorElement.style.cssText = `
      background: rgba(255, 71, 87, 0.2);
      border: 1px solid rgba(255, 71, 87, 0.5);
      color: #ff4757;
      padding: 8px 12px;
      border-radius: 8px;
      margin-top: 8px;
      font-size: 0.85rem;
    `;
  }
  
  errorElement.textContent = message;
  
  const nameCard = document.querySelector('.profile-detail-card:nth-of-type(2)');
  if (nameCard && !nameCard.querySelector('.profile-error-message')) {
    nameCard.appendChild(errorElement);
  }
  
  setTimeout(() => {
    if (errorElement && errorElement.parentNode) {
      errorElement.remove();
    }
  }, 3000);
}
