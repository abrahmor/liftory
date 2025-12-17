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
  const avatarImgs = document.querySelectorAll('.user-avatar-img');
  if (user.photoURL) {
    avatarImgs.forEach(img => {
      if (img) img.src = user.photoURL;
    });
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
    dashboardTitle.textContent = `Hola, ${name}`;
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
  const editBtn = document.querySelector('.user-profile-name-section .profile-edit-btn');
  const nameElement = document.querySelector('.user-profile-name-section .user-profile-name');

  if (!editBtn || !nameElement) return;

  // Use onclick property to avoid duplicate listeners without needing to clone/replace the node
  editBtn.onclick = () => {
    // 1. Get current state
    const currentName = nameElement.textContent;
    const originalName = nameElement.dataset.originalName || currentName;

    // 2. Hide static elements (Edit button and Name text)
    editBtn.style.display = 'none';
    nameElement.style.display = 'none';

    // 3. Create interactive elements container
    const editContainer = document.createElement('div');
    editContainer.className = 'edit-ui-container';
    editContainer.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    // Input
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.className = 'input-edit-profile-name';
    input.style.cssText = `
        background: #1010128c; 
        border: 1px solid rgba(255, 255, 255, 0.2); 
        color: #fff; 
        border-radius: 6px; 
        padding: 4px 8px; 
        font-size: 1.1rem; 
        font-weight: 500;
        width: 200px;
        outline: none;
        text-align: center;
    `;

    // Save Button
    const saveBtn = document.createElement('button');
    saveBtn.innerHTML = `<i class="ti ti-check"></i>`;
    saveBtn.className = 'profile-edit-btn icon-btn-success';
    saveBtn.title = 'Guardar';

    // Cancel Button
    const cancelBtn = document.createElement('button');
    cancelBtn.innerHTML = `<i class="ti ti-x"></i>`;
    cancelBtn.className = 'profile-edit-btn icon-btn-danger';
    cancelBtn.title = 'Cancelar';

    // Assemble container
    editContainer.appendChild(input);
    editContainer.appendChild(saveBtn);
    editContainer.appendChild(cancelBtn);

    // Insert into DOM (replacing name/button visually)
    // We insert it before the nameElement to keep position
    nameElement.parentNode.insertBefore(editContainer, nameElement);

    input.focus();
    input.select();

    // 4. Define Cleanup/Finish Logic
    const cleanup = () => {
      if (editContainer.parentNode) editContainer.remove();
      nameElement.style.display = ''; // Show Text
      editBtn.style.display = '';     // Show Edit Button
    };

    // 5. Handlers
    const handleCancel = () => {
      cleanup();
    };

    const handleSave = async () => {
      const newName = input.value.trim();

      if (!newName) {
        showError('El nombre no puede estar vacío');
        return;
      }

      if (newName === originalName) {
        handleCancel();
        return;
      }

      // Loading State
      saveBtn.innerHTML = `<div class="spinner-border"></div>`;
      saveBtn.disabled = true;
      cancelBtn.disabled = true;
      input.disabled = true;

      const result = await updateUserDisplayName(newName);

      if (result.success) {
        // Update UI across the app
        document.querySelectorAll('.user-profile-name').forEach(el => {
          el.textContent = newName;
          el.dataset.originalName = newName;
        });

        updateDashboardName(newName);

        // Sync the detail card value as well
        const detailCardValue = document.querySelector('.profile-detail-card:nth-of-type(2) .profile-detail-value');
        if (detailCardValue) {
          detailCardValue.textContent = newName;
        }

        // Wait a tiny bit for the user to see the process finished? No, instant feedback is better.
        cleanup();
        showToast('Nombre actualizado correctamente', 'success');
      } else {
        // Reset to Save State on error
        saveBtn.innerHTML = `<i class="ti ti-check"></i>`;
        saveBtn.disabled = false;
        cancelBtn.disabled = false;
        input.disabled = false;
        showError(result.error || 'Error al actualizar');
      }
    };

    // Attach listeners
    saveBtn.onclick = handleSave;
    cancelBtn.onclick = handleCancel;

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSave();
      if (e.key === 'Escape') handleCancel();
    });
  };
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
