// loader.js - Utilidad para mostrar/ocultar loader

/**
 * Crear elemento del loader
 */
function createLoaderElement() {
  const loaderContainer = document.createElement('div');
  loaderContainer.className = 'loader-container';
  loaderContainer.innerHTML = `
    <svg viewBox="25 25 50 50" class="loader-svg">
      <circle cx="50" cy="50" r="20" class="loader-circle"></circle>
    </svg>
  `;
  return loaderContainer;
}

/**
 * Mostrar loader en un contenedor
 */
export function showLoader(container) {
  if (!container) return null;
  
  // Remover loader existente si hay
  hideLoader(container);
  
  const loader = createLoaderElement();
  container.appendChild(loader);
  return loader;
}

/**
 * Ocultar loader de un contenedor
 */
export function hideLoader(container) {
  if (!container) return;
  
  const existingLoader = container.querySelector('.loader-container');
  if (existingLoader) {
    existingLoader.remove();
  }
}

/**
 * Mostrar loader en el contenedor principal (app-content)
 */
export function showMainLoader() {
  const main = document.getElementById('app-content');
  if (main) {
    return showLoader(main);
  }
  return null;
}

/**
 * Ocultar loader del contenedor principal
 */
export function hideMainLoader() {
  const main = document.getElementById('app-content');
  if (main) {
    hideLoader(main);
  }
}

/**
 * Mostrar loader centrado en un contenedor específico
 */
export function showLoaderInContainer(container) {
  if (!container) return null;
  
  // Crear wrapper para centrar el loader
  const wrapper = document.createElement('div');
  wrapper.className = 'loader-wrapper';
  wrapper.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 200px;
    width: 100%;
  `;
  
  const loader = createLoaderElement();
  wrapper.appendChild(loader);
  container.appendChild(wrapper);
  
  return wrapper;
}

/**
 * Agregar estado de loading a un botón con loader dentro
 */
export function setButtonLoading(button, isLoading) {
  if (!button) return;
  
  if (isLoading) {
    button.classList.add('btn-loading');
    button.disabled = true;
    button.dataset.originalText = button.innerHTML;
    
    // Crear loader pequeño dentro del botón
    const loaderSvg = `
      <svg viewBox="25 25 50 50" class="btn-loader-svg" style="width: 1.2em; height: 1.2em; margin-right: 8px; vertical-align: middle;">
        <circle cx="50" cy="50" r="20" class="btn-loader-circle"></circle>
      </svg>
    `;
    button.innerHTML = loaderSvg + '<span>Cargando...</span>';
  } else {
    button.classList.remove('btn-loading');
    button.disabled = false;
    if (button.dataset.originalText) {
      button.innerHTML = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  }
}

