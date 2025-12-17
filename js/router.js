// router.js - simple router basado en History API
const routes = {
  '/dashboard': '/views/dashboard.html',
  '/products': '/views/products.html',
  '/movements': '/views/movements.html',
  '/reports': '/views/reports.html',
  '/finance': '/views/finance.html'
};

// Normalizar ruta (ahora manejando hash)
function normalizePath(path) {
  // Si la ruta viene vacía o es raíz
  if (!path || path === '/' || path === '' || path === '#/') {
    return '/dashboard';
  }

  // Si empieza con #, quitarlo
  if (path.startsWith('#')) {
    path = path.substring(1);
  }

  // Asegurar que empiece con /
  if (!path.startsWith('/')) {
    path = '/' + path;
  }

  return path;
}

function updateActiveNav(path) {
  // Normalizar para comparación
  const normalizedPath = normalizePath(path);

  const allNavItems = document.querySelectorAll('.nav-item, .mobile-nav-item');
  allNavItems.forEach(item => {
    item.classList.remove('active');

    // Comparar href. Ahora href podría ser "#/dashboard" o "/dashboard"
    const href = item.getAttribute('href');
    if (href) {
      // Normalizar href del elemento para comparar
      const itemPath = normalizePath(href);
      if (itemPath === normalizedPath) {
        item.classList.add('active');
      }
    }
  });
}

// ... loadRoute function stays mostly same, but we don't need replaceState for hash
// except maybe to fix malformed hashes.

async function loadRoute(path) {
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

    // Mostrar loader general solo si NO es una de las rutas excluidas
    const noLoaderRoutes = ['/dashboard', '/reports', '/finance'];
    if (!noLoaderRoutes.includes(normalizedPath)) {
      const loaderHTML = `
        <div class="loader-wrapper" id="view-loader" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1000; pointer-events: none;">
            <svg class="loader-svg" viewBox="25 25 50 50">
            <circle class="loader-circle" cx="50" cy="50" r="20"></circle>
            </svg>
        </div>
        `;
      document.body.insertAdjacentHTML('beforeend', loaderHTML);
    }

    // Actualizar estado activo de la navegación
    updateActiveNav(normalizedPath);

    // No necesitamos history.replaceState manual con hash routing, 
    // el navegador lo maneja, pero si normalizamos algo podemos ajustarlo.

    // intenta inicializar el script de la vista
    const scriptMap = {
      '/views/dashboard.html': '/js/views/dashboard.js',
      '/views/products.html': '/js/views/products.js',
      '/views/movements.html': '/js/views/movements.js',
      '/views/reports.html': '/js/views/reports.js',
      '/views/finance.html': '/js/views/finance.js'
    };
    const s = scriptMap[url];
    if (s) {
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
        <button onclick="window.location.hash='#/dashboard'" style="
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
  }
}

// Escuchar cambios en el hash
window.addEventListener('hashchange', () => {
  loadRoute(location.hash);
});

// Manejar clicks en enlaces para usabilidad, aunque el hash lo hace nativo
document.addEventListener('click', e => {
  const a = e.target.closest('[data-link]');
  if (a) {
    e.preventDefault();
    const href = a.getAttribute('href');
    // href podría ser ya "/dashboard" o "#/dashboard"
    // Lo convertimos a hash si no lo tiene

    let targetHash = href;
    if (!href.startsWith('#')) {
      targetHash = '#' + href;
    }

    // If clicking the same link, force re-render (soft reload)
    // This updates the body content without a full page refresh
    if (window.location.hash === targetHash) {
      loadRoute(targetHash);
      return;
    }

    window.location.hash = targetHash;
    // loadRoute se dispara por hashchange
  }
});

// Verificar si estamos en app.html antes de cargar rutas
function isAppPage() {
  return document.getElementById('app-content') !== null;
}

// Carga inicial
function initializeRouter() {
  if (!isAppPage()) return;

  // Cargar ruta basada en el hash actual
  let path = location.hash;

  if (!path || path === '#/' || path === '') {
    // Si no hay hash, ir a dashboard por defecto
    path = '#/dashboard';
    // Esto disparará hashchange? No si solo ponemos el hash sin evento o replace.
    // Mejor llamamos loadRoute directamente si no cambiamos el hash
    history.replaceState(null, null, '#/dashboard');
  }

  loadRoute(path);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeRouter);
} else {
  initializeRouter();
}
