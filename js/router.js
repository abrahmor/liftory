// router.js - simple router basado en History API
const routes = {
  '/dashboard': '/views/dashboard.html',
  '/products': '/views/products.html',
  '/movements': '/views/movements.html',
  '/reports': '/views/reports.html',
  '/finance': '/views/finance.html'
};

// Normalizar ruta
function normalizePath(path) {
  if (!path || path === '/' || path === '') {
    return '/dashboard';
  }
  // Asegurar que la ruta empiece con /
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  return path;
}

function updateActiveNav(path) {
  // Remover active de todos los elementos de navegación
  const allNavItems = document.querySelectorAll('.nav-item, .mobile-nav-item');
  allNavItems.forEach(item => item.classList.remove('active'));
  
  // Agregar active al elemento correspondiente a la ruta actual
  const normalizedPath = normalizePath(path);
  const activeNavItems = document.querySelectorAll(`[href="${normalizedPath}"]`);
  activeNavItems.forEach(item => item.classList.add('active'));
}

async function loadRoute(path){
  const main = document.getElementById('app-content');
  if (!main) {
    console.error('No se encontró el elemento app-content');
    return;
  }

  // Normalizar la ruta
  const normalizedPath = normalizePath(path);
  const url = routes[normalizedPath] || routes['/dashboard'];
  
  try {
    const res = await fetch(url);
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const html = await res.text();
    
    if (!html || html.trim().length === 0) {
      throw new Error('El archivo está vacío');
    }
    
    main.innerHTML = html;
    
    // Mostrar loader general mientras se carga la vista
    const loaderHTML = `
      <div class="loader-wrapper" id="view-loader" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1000; pointer-events: none;">
        <svg class="loader-svg" viewBox="25 25 50 50">
          <circle class="loader-circle" cx="50" cy="50" r="20"></circle>
        </svg>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', loaderHTML);
    
    // Actualizar estado activo de la navegación
    updateActiveNav(normalizedPath);
    
    // Actualizar la URL en el historial si es necesario
    if (path !== normalizedPath) {
      history.replaceState({}, '', normalizedPath);
    }
    
    // intenta inicializar el script de la vista
    const scriptMap = {
      '/views/dashboard.html':'/js/views/dashboard.js',
      '/views/products.html':'/js/views/products.js',
      '/views/movements.html':'/js/views/movements.js',
      '/views/reports.html':'/js/views/reports.js',
      '/views/finance.html':'/js/views/finance.js'
    };
    const s = scriptMap[url];
    if(s){
      try {
        const module = await import(s);
        await module.init?.();
        // Ocultar loader general después de que la vista se inicialice
        const viewLoader = document.getElementById('view-loader');
        if (viewLoader) {
          viewLoader.remove();
        }
      } catch (error) {
        console.error(`Error al cargar el módulo ${s}:`, error);
        const viewLoader = document.getElementById('view-loader');
        if (viewLoader) {
          viewLoader.remove();
        }
      }
    } else {
      // Si no hay script, ocultar loader inmediatamente
      const viewLoader = document.getElementById('view-loader');
      if (viewLoader) {
        viewLoader.remove();
      }
    }
  } catch (error) {
    console.error(`Error al cargar la ruta ${normalizedPath}:`, error);
    
    // Mostrar mensaje de error amigable
    main.innerHTML = `
      <div style="padding: 40px; text-align: center; color: #fff;">
        <h2>Error al cargar la página</h2>
        <p>No se pudo cargar: ${normalizedPath}</p>
        <p style="color: rgba(255,255,255,0.6); font-size: 0.9rem; margin-top: 16px;">
          ${error.message}
        </p>
        <button onclick="window.location.href='/app.html#/dashboard'" style="
          margin-top: 24px;
          padding: 12px 24px;
          background: #fff;
          color: #000;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          font-weight: 600;
        ">Volver al Dashboard</button>
      </div>
    `;
    
    // Intentar redirigir al dashboard si hay un error
    if (normalizedPath !== '/dashboard') {
      setTimeout(() => {
        history.replaceState({}, '', '/dashboard');
        loadRoute('/dashboard');
      }, 2000);
    }
  }
}

window.addEventListener('popstate', () => {
  loadRoute(location.pathname);
});

document.addEventListener('click', e => {
  const a = e.target.closest('[data-link]');
  if(a){
    e.preventDefault();
    const href = a.getAttribute('href');
    history.pushState({}, '', href);
    loadRoute(href);
  } 
});

// Verificar si estamos en app.html antes de cargar rutas
function isAppPage() {
  // Verificar si existe el elemento app-content (solo existe en app.html)
  return document.getElementById('app-content') !== null;
}

// Carga inicial - esperar a que el DOM esté listo
function initializeRouter() {
  // Si no estamos en app.html, redirigir
  if (!isAppPage()) {
    // Si estamos en una ruta de la app pero no en app.html, redirigir
    const currentPath = location.pathname;
    if (routes[currentPath] || currentPath.startsWith('/dashboard') || 
        currentPath.startsWith('/products') || currentPath.startsWith('/movements') ||
        currentPath.startsWith('/reports') || currentPath.startsWith('/finance')) {
      // Redirigir a app.html con la ruta como hash
      window.location.href = `/app.html${currentPath}`;
      return;
    }
    return;
  }

  // Estamos en app.html, cargar la ruta
  // Primero verificar si hay un hash en la URL
  let path = location.hash ? location.hash.substring(1) : location.pathname;
  
  // Si no hay ruta válida, usar dashboard por defecto
  if (!path || path === '/' || path === '') {
    path = '/dashboard';
  }
  
  // Si la ruta no está en las rutas definidas, usar dashboard
  if (!routes[path]) {
    path = '/dashboard';
  }
  
  loadRoute(path);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeRouter);
} else {
  // DOM ya está listo
  initializeRouter();
}
