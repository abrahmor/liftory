// dashboard.js - vista
import { getCurrentUser, getUserData, onAuthStateChanged } from '/js/auth.js';
import { getAllProducts } from '/js/services/products.service.js';
import { getAllMovements } from '/js/services/movements.service.js';

export async function init(){
  console.log('dashboard init');
  
  // Esperar a que el usuario esté autenticado antes de cargar datos
  const user = getCurrentUser();
  if (!user) {
    // Si no hay usuario, esperar a que se autentique
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged((authUser) => {
        if (authUser) {
          unsubscribe();
          initializeDashboard();
          resolve();
        }
      });
    });
  }
  
  // Si ya hay usuario, inicializar directamente
  await initializeDashboard();
}

async function initializeDashboard() {
  // Verificar nuevamente que el usuario esté autenticado
  const user = getCurrentUser();
  if (!user) {
    console.warn('Usuario no autenticado, esperando...');
    // Esperar un poco y reintentar
    setTimeout(async () => {
      const retryUser = getCurrentUser();
      if (retryUser) {
        await initializeDashboard();
      }
    }, 500);
    return;
  }
  
  // Esperar un momento para asegurar que Firebase está completamente inicializado
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Actualizar nombre del usuario en el dashboard
  updateDashboardUserName();
  
  // Cargar y mostrar estadísticas
  try {
    await loadAndDisplayStats();
  } catch (error) {
    console.error('Error al cargar estadísticas:', error);
  }
  
  // Cargar información de stock
  try {
    await loadStockInfo();
  } catch (error) {
    console.error('Error al cargar información de stock:', error);
  }
  
  // Cargar productos más vendidos
  try {
    await loadTopProducts();
  } catch (error) {
    console.error('Error al cargar productos más vendidos:', error);
  }
  
  // Cargar movimientos recientes
  try {
    await loadRecentMovements();
  } catch (error) {
    console.error('Error al cargar movimientos recientes:', error);
  }
}

function updateDashboardUserName() {
  const user = getCurrentUser();
  if (!user) return;

  // Mostrar nombre inmediatamente desde Firebase Auth
  const quickName = user.displayName || user.email?.split('@')[0] || 'Usuario';
  
  const dashboardTitle = document.querySelector('.dasboard-title');
  if (dashboardTitle) {
    dashboardTitle.textContent = `Bienvenido, ${quickName}`;
  }

  // Luego actualizar desde Firestore en segundo plano si hay un nombre diferente
  getUserData(user.uid).then(userData => {
    if (userData?.displayName && userData.displayName !== quickName) {
      if (dashboardTitle) {
        dashboardTitle.textContent = `Bienvenido, ${userData.displayName}`;
      }
    }
  }).catch(err => {
    console.warn('No se pudo cargar nombre desde Firestore:', err);
  });
}

async function loadAndDisplayStats() {
  try {
    const [products, movements] = await Promise.all([
      getAllProducts(),
      getAllMovements()
    ]);

    // Calcular estadísticas
    const stats = calculateStats(products, movements);
    
    // Actualizar las tarjetas de estadísticas
    updateStatCard('Ingresos totales', formatCurrency(stats.totalIncome));
    updateStatCard('Rentabilidad', `${stats.profitMargin.toFixed(1)}%`);
    updateStatCard('Unidades totales del inventario', formatNumber(stats.totalUnits));
    updateStatCard('Valor total del inventario', formatCurrency(stats.totalInventoryValue));
    
  } catch (error) {
    console.error('Error al cargar estadísticas:', error);
    // Mostrar valores por defecto en caso de error
    updateStatCard('Ingresos totales', 'S/0.00');
    updateStatCard('Rentabilidad', '0%');
    updateStatCard('Unidades totales del inventario', '0');
    updateStatCard('Valor total del inventario', 'S/0.00');
  }
}

function calculateStats(products, movements) {
  // Calcular ingresos totales (solo ventas)
  const sales = movements.filter(m => m.type === 'venta');
  const totalIncome = sales.reduce((sum, sale) => sum + (sale.total || 0), 0);
  
  // Calcular costos totales (compras)
  const purchases = movements.filter(m => m.type === 'compra');
  const totalCosts = purchases.reduce((sum, purchase) => sum + (purchase.total || 0), 0);
  
  // Calcular rentabilidad (margen de ganancia)
  const profit = totalIncome - totalCosts;
  const profitMargin = totalIncome > 0 ? (profit / totalIncome) * 100 : 0;
  
  // Calcular unidades totales del inventario
  const totalUnits = products.reduce((sum, product) => {
    const initialStock = Number(product.initialStock) || 0;
    const productMovements = movements.filter(m => m.productId === product.id);
    let currentStock = initialStock;
    
    productMovements.forEach(movement => {
      if (movement.type === 'venta') {
        currentStock -= Math.abs(movement.quantity || 0);
      } else if (movement.type === 'compra') {
        currentStock += Math.abs(movement.quantity || 0);
      } else if (movement.type === 'ajuste') {
        currentStock += movement.quantity || 0;
      }
    });
    
    return sum + Math.max(0, currentStock);
  }, 0);
  
  // Calcular valor total del inventario (stock actual * precio de compra)
  const totalInventoryValue = products.reduce((sum, product) => {
    const initialStock = Number(product.initialStock) || 0;
    const purchasePrice = Number(product.purchasePrice) || 0;
    const productMovements = movements.filter(m => m.productId === product.id);
    let currentStock = initialStock;
    
    productMovements.forEach(movement => {
      if (movement.type === 'venta') {
        currentStock -= Math.abs(movement.quantity || 0);
      } else if (movement.type === 'compra') {
        currentStock += Math.abs(movement.quantity || 0);
      } else if (movement.type === 'ajuste') {
        currentStock += movement.quantity || 0;
      }
    });
    
    return sum + (Math.max(0, currentStock) * purchasePrice);
  }, 0);
  
  return {
    totalIncome,
    totalCosts,
    profit,
    profitMargin,
    totalUnits,
    totalInventoryValue
  };
}

function updateStatCard(label, value) {
  const statCards = document.querySelectorAll('.stat-card');
  statCards.forEach(card => {
    const labelElement = card.querySelector('.stat-label');
    if (labelElement && labelElement.textContent.trim() === label) {
      const valueElement = card.querySelector('.stat-value');
      if (valueElement) {
        // Animación sutil al actualizar el valor
        valueElement.style.opacity = '0';
        valueElement.style.transform = 'scale(0.9)';
        setTimeout(() => {
          valueElement.textContent = value;
          valueElement.style.transition = 'all 0.3s ease';
          valueElement.style.opacity = '1';
          valueElement.style.transform = 'scale(1)';
        }, 50);
      }
    }
  });
}

async function loadStockInfo() {
  const stockLoader = document.getElementById('stock-loader');
  
  try {
    const [products, movements] = await Promise.all([
      getAllProducts(),
      getAllMovements()
    ]);
    
    // Calcular stock para cada producto
    const productsWithStock = products.map(product => {
      const initialStock = Number(product.initialStock) || 0;
      const minStock = Number(product.minStock) || 0;
      const productMovements = movements.filter(m => m.productId === product.id);
      
      let currentStock = initialStock;
      productMovements.forEach(movement => {
        if (movement.type === 'venta') {
          currentStock -= Math.abs(movement.quantity || 0);
        } else if (movement.type === 'compra') {
          currentStock += Math.abs(movement.quantity || 0);
        } else if (movement.type === 'ajuste') {
          currentStock += movement.quantity || 0;
        }
      });
      
      return {
        ...product,
        currentStock: Math.max(0, currentStock),
        minStock
      };
    });
    
    // Filtrar productos por nivel de stock
    const highStock = productsWithStock.filter(p => p.currentStock > p.minStock && p.currentStock > 0);
    const nearLowStock = productsWithStock.filter(p => p.currentStock > 0 && p.currentStock <= p.minStock && p.currentStock > p.minStock * 0.5);
    const lowStock = productsWithStock.filter(p => p.currentStock > 0 && p.currentStock <= p.minStock * 0.5);
    const outOfStock = productsWithStock.filter(p => p.currentStock === 0);
    
    // Combinar "near-low" y "low" para el diseño
    const combinedLowStock = [...nearLowStock, ...lowStock];
    
    // Renderizar información de stock
    const stockPanel = Array.from(document.querySelectorAll('.panel')).find(p => 
      p.querySelector('.panel-title')?.textContent.includes('Informacion de stock')
    );
    
    if (stockPanel) {
      const panelContent = stockPanel.querySelector('.panel-content');
      if (panelContent) {
        const totalProducts = products.length;
        
        // Calcular alturas de barras (proporcionales al máximo)
        // Solo considerar categorías con productos para el cálculo
        const counts = [highStock.length, combinedLowStock.length, outOfStock.length].filter(c => c > 0);
        const maxCount = counts.length > 0 ? Math.max(...counts) : 1;
        const highStockHeight = highStock.length > 0 ? (highStock.length / maxCount) * 100 : 0;
        const lowStockHeight = combinedLowStock.length > 0 ? (combinedLowStock.length / maxCount) * 100 : 0;
        const outOfStockHeight = outOfStock.length > 0 ? (outOfStock.length / maxCount) * 100 : 0;
        
        let html = `
          <div style="padding-top: 20px">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px;">
              <h3 style="color: rgba(255, 255, 255, 0.95); font-size: 1.1rem; font-weight: 600; margin: 0;">Productos activos</h3>
              <span style="color: rgba(255, 255, 255, 0.95); font-size: 1rem; font-weight: 700;">${totalProducts}</span>
            </div>
            
            <!-- Categories with bars -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; align-items: flex-end;">
              <!-- High Stock -->
              <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
                <div style="width: 100%; max-width: 60px; height: 200px; display: flex; align-items: flex-end; justify-content: center;">
                  ${highStock.length > 0 ? `<div style="width: 100%; height: ${highStockHeight}%; background: rgb(255, 255, 255); border-radius: 24px; transition: height 0.3s ease;"></div>` : '<div style="width: 100%; height: 0;"></div>'}
                </div>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                  <div style="color: rgba(255, 255, 255, 0.95); font-size: 1rem; font-weight: 700;">${highStock.length}</div>
                  <div style="color: rgba(255, 255, 255, 0.6); font-size: 0.85rem; font-weight: 500;">Stock alto</div>
                </div>
              </div>
              
              <!-- Near-Low Stock -->
              <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
                <div style="width: 100%; max-width: 60px; height: 200px; display: flex; align-items: flex-end; justify-content: center;">
                  ${combinedLowStock.length > 0 ? `<div style="width: 100%; height: ${lowStockHeight}%; background: rgb(255, 255, 255); border-radius: 24px; transition: height 0.3s ease;"></div>` : '<div style="width: 100%; height: 0;"></div>'}
                </div>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                  <div style="color: rgba(255, 255, 255, 0.95); font-size: 1rem; font-weight: 700;">${combinedLowStock.length}</div>
                  <div style="color: rgba(255, 255, 255, 0.6); font-size: 0.85rem; font-weight: 500;">Stock bajo</div>
                </div>
              </div>
              
              <!-- Out of Stock -->
              <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
                <div style="width: 100%; max-width: 60px; height: 200px; display: flex; align-items: flex-end; justify-content: center;">
                  ${outOfStock.length > 0 ? `<div style="width: 100%; height: ${outOfStockHeight}%; background: rgb(255, 255, 255); border-radius: 24px; transition: height 0.3s ease;"></div>` : '<div style="width: 100%; height: 0;"></div>'}
                </div>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                  <div style="color: rgba(255, 255, 255, 0.95); font-size: 1rem; font-weight: 700;">${outOfStock.length}</div>
                  <div style="color: rgba(255, 255, 255, 0.6); font-size: 0.85rem; font-weight: 500;">Sin stock</div>
                </div>
              </div>
            </div>
          </div>
        `;
        
        panelContent.innerHTML = html;
        
        // Animación sutil al mostrar el contenido
        const stockContent = panelContent.querySelector('div');
        if (stockContent) {
          stockContent.style.opacity = '0';
          stockContent.style.transform = 'translateY(10px)';
          setTimeout(() => {
            stockContent.style.transition = 'all 0.5s ease';
            stockContent.style.opacity = '1';
            stockContent.style.transform = 'translateY(0)';
          }, 100);
        }
      }
    }
    
    // Ocultar loader
    if (stockLoader) {
      stockLoader.style.opacity = '0';
      stockLoader.style.transition = 'opacity 0.3s ease';
      setTimeout(() => {
        stockLoader.remove();
      }, 300);
    }
  } catch (error) {
    console.error('Error al cargar información de stock:', error);
    if (stockLoader) {
      stockLoader.remove();
      const stockPanel = Array.from(document.querySelectorAll('.panel')).find(p => 
        p.querySelector('.panel-title')?.textContent.includes('Informacion de stock')
      );
      if (stockPanel) {
        const panelContent = stockPanel.querySelector('.panel-content');
        if (panelContent) {
          panelContent.innerHTML = '<p style="color: rgba(255, 255, 255, 0.5); text-align: center; padding: 20px;">Error al cargar información</p>';
        }
      }
    }
  }
}

async function loadTopProducts() {
  const productsLoader = document.getElementById('products-loader');
  
  try {
    const [products, movements] = await Promise.all([
      getAllProducts(),
      getAllMovements()
    ]);
    
    // Contar ventas por producto (agrupar por nombre para evitar duplicados)
    const salesByProduct = {};
    const sales = movements.filter(m => m.type === 'venta');
    
    sales.forEach(sale => {
      if (sale.productId && sale.productName) {
        // Usar el nombre del producto como clave para agrupar
        const productKey = sale.productName.toLowerCase().trim();
        
        if (!salesByProduct[productKey]) {
          // Buscar el producto completo para obtener imagen
          const fullProduct = products.find(p => 
            p.id === sale.productId || 
            p.name?.toLowerCase().trim() === productKey
          );
          salesByProduct[productKey] = {
            productId: sale.productId,
            productName: sale.productName || fullProduct?.name || 'Producto desconocido',
            image: sale.productImage || fullProduct?.image || '',
            quantity: 0,
            total: 0
          };
        }
        // Sumar cantidades y totales del mismo producto
        salesByProduct[productKey].quantity += Math.abs(sale.quantity || 0);
        salesByProduct[productKey].total += Math.abs(sale.total || 0);
      }
    });
    
    // Ordenar por cantidad vendida
    const topProducts = Object.values(salesByProduct)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
    
    // Renderizar productos más vendidos
    const topProductsPanel = Array.from(document.querySelectorAll('.panel')).find(p => 
      p.querySelector('.panel-title')?.textContent.includes('Productos mas vendidos')
    );
    
    if (topProductsPanel) {
      const panelContent = topProductsPanel.querySelector('.panel-content');
      if (panelContent) {
        if (topProducts.length === 0) {
          panelContent.innerHTML = `<p style="color: rgba(255, 255, 255, 0.5); text-align: center; padding: 20px;">No hay ventas registradas</p>`;
        } else {
          let html = '<div style="display: flex; flex-direction: column; gap: 12px; padding-top: 20px;">';
          topProducts.forEach((product) => {
            html += `<div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-radius: 22px; border: 1px solid rgba(255, 255, 255, 0.1); background: #1010128c;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 48px; height: 48px; border-radius: 8px; overflow: hidden; background: rgba(255, 255, 255, 0.1); flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                  ${product.image 
                    ? `<img src="${product.image}" alt="${product.productName}" style="width: 100%; height: 100%; object-fit: cover;">`
                    : `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255, 255, 255, 0.3)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                      </svg>`
                  }
                </div>
                <div>
                  <div style="color: rgba(255, 255, 255, 0.9); font-size: 0.9rem; font-weight: 500;">${product.productName}</div>
                  <div style="color: rgba(255, 255, 255, 0.5); font-size: 0.75rem;">${product.quantity} unidades</div>
                </div>
              </div>
              <span style="color: #2ed573; font-size: 0.9rem; font-weight: 600;">S/${product.total.toFixed(2)}</span>
            </div>`;
          });
          html += '</div>';
          panelContent.innerHTML = html;
          
          // Animación sutil al mostrar el contenido
          const productsContent = panelContent.querySelector('div');
          if (productsContent) {
            productsContent.style.opacity = '0';
            productsContent.style.transform = 'translateY(10px)';
            setTimeout(() => {
              productsContent.style.transition = 'all 0.5s ease';
              productsContent.style.opacity = '1';
              productsContent.style.transform = 'translateY(0)';
            }, 100);
          }
        }
      }
    }
    
    // Ocultar loader
    if (productsLoader) {
      productsLoader.style.opacity = '0';
      productsLoader.style.transition = 'opacity 0.3s ease';
      setTimeout(() => {
        productsLoader.remove();
      }, 300);
    }
  } catch (error) {
    console.error('Error al cargar productos más vendidos:', error);
    if (productsLoader) {
      productsLoader.remove();
      const topProductsPanel = Array.from(document.querySelectorAll('.panel')).find(p => 
        p.querySelector('.panel-title')?.textContent.includes('Productos mas vendidos')
      );
      if (topProductsPanel) {
        const panelContent = topProductsPanel.querySelector('.panel-content');
        if (panelContent) {
          panelContent.innerHTML = '<p style="color: rgba(255, 255, 255, 0.5); text-align: center; padding: 20px;">Error al cargar productos</p>';
        }
      }
    }
  }
}

async function loadRecentMovements() {
  const movementsLoader = document.getElementById('movements-loader');
  
  try {
    const movements = await getAllMovements();
    
    // Obtener los 5 movimientos más recientes
    const recentMovements = movements
      .sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date : (a.date?.toDate ? a.date.toDate() : new Date(a.date));
        const dateB = b.date instanceof Date ? b.date : (b.date?.toDate ? b.date.toDate() : new Date(b.date));
        return dateB - dateA;
      })
      .slice(0, 5);
    
    // Iconos y etiquetas de tipo (igual que en movements.js)
    const typeIcons = {
      'venta': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-package-export"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 21l-8 -4.5v-9l8 -4.5l8 4.5v4.5" /><path d="M12 12l8 -4.5" /><path d="M12 12v9" /><path d="M12 12l-8 -4.5" /><path d="M15 18h7" /><path d="M19 15l3 3l-3 3" /></svg>`,
      'compra': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-package-import"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 21l-8 -4.5v-9l8 -4.5l8 4.5v4.5" /><path d="M12 12l8 -4.5" /><path d="M12 12v9" /><path d="M12 12l-8 -4.5" /><path d="M22 18h-7" /><path d="M18 15l-3 3l3 3" /></svg>`,
      'ajuste': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-settings"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z" /><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /></svg>`
    };
    
    const typeLabels = {
      'venta': 'Venta',
      'compra': 'Compra',
      'ajuste': 'Ajuste'
    };
    
    // Renderizar movimientos recientes
    const movementsPanel = Array.from(document.querySelectorAll('.panel')).find(p => 
      p.querySelector('.panel-title')?.textContent.includes('Movimientos Recientes')
    );
    
    if (movementsPanel) {
      const panelContent = movementsPanel.querySelector('.panel-content');
      if (panelContent) {
        if (recentMovements.length === 0) {
          panelContent.innerHTML = `<p style="color: rgba(255, 255, 255, 0.5); text-align: center; padding: 20px;">No hay movimientos registrados</p>`;
        } else {
          let html = '<div style="display: flex; flex-direction: column; gap: 12px; padding-top: 20px;">';
          
          recentMovements.forEach(movement => {
            // Parsear fecha (igual que en movements.js)
            let movementDate;
            if (movement.date instanceof Date) {
              movementDate = movement.date;
            } else if (movement.date && movement.date.toDate) {
              movementDate = movement.date.toDate();
            } else if (typeof movement.date === 'string') {
              if (movement.date.includes('T')) {
                const dateTimeMatch = movement.date.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
                if (dateTimeMatch) {
                  const [, year, month, day, hour, minute, second] = dateTimeMatch.map(Number);
                  movementDate = new Date(year, month - 1, day, hour, minute, second);
                } else {
                  movementDate = new Date(movement.date);
                }
              } else {
                const [year, month, day] = movement.date.split('-').map(Number);
                movementDate = new Date(year, month - 1, day);
              }
            } else {
              movementDate = new Date();
            }
            
            const formattedDate = movementDate.toLocaleDateString('es-ES', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            });
            
            const formattedTime = movementDate.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            });
            
            html += `
              <div class="movement-item" style="display: flex; justify-content: space-between; align-items: center; padding: 16px; border: 1px solid rgba(255, 255, 255, 0.08); transition: all 0.2s ease;">
                <div class="movement-info" style="flex: 1;">
                  <div class="movement-details">
                    <div class="movement-product" style="color: rgba(255, 255, 255, 0.95); font-size: 0.95rem; font-weight: 600; margin-bottom: 8px;">${movement.productName || 'Producto desconocido'}</div>
                    
                    <div class="movement-meta" style="display: flex; flex-wrap: wrap; gap: 12px; color: rgba(255, 255, 255, 0.6); font-size: 0.8rem;">
                      <span class="movement-type ${movement.type}" style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; background: ${movement.type === 'venta' ? 'rgba(46, 213, 115, 0.15)' : movement.type === 'compra' ? 'rgba(55, 66, 250, 0.15)' : 'rgba(255, 165, 2, 0.15)'}; color: ${movement.type === 'venta' ? '#2ed573' : movement.type === 'compra' ? '#3742fa' : '#ffa502'};">
                        ${typeIcons[movement.type] || ''}
                        ${typeLabels[movement.type] || movement.type}
                      </span>
                      <span>Código: ${movement.productCode || 'N/A'}</span>
                      <span>Cantidad: ${movement.type === 'ajuste' ? (movement.quantity > 0 ? '+' : '') + movement.quantity : Math.abs(movement.quantity || 0)}</span>
                      <span>Precio: S/${(movement.price || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                <div class="movement-amount" style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px; margin-left: 16px;">
                  <div class="movement-total ${movement.type === 'ajuste' && movement.total < 0 ? 'negative' : ''}" font-size: 1.1rem; font-weight: 700;">
                    ${movement.type === 'ajuste' && movement.total < 0 ? '-' : ''}S/${Math.abs(movement.total || 0).toFixed(2)}
                  </div>
                  <div class="movement-date" font-size: 0.75rem;">${formattedDate}</div>
                  <div class="movement-time" >${formattedTime}</div>
                </div>
              </div>
            `;
          });
          
          html += '</div>';
          panelContent.innerHTML = html;
          
          // Animación sutil al mostrar los movimientos
          const movementItems = panelContent.querySelectorAll('.movement-item');
          movementItems.forEach((item, index) => {
            item.style.opacity = '0';
            item.style.transform = 'translateX(-10px)';
            setTimeout(() => {
              item.style.transition = 'all 0.4s ease';
              item.style.opacity = '1';
              item.style.transform = 'translateX(0)';
            }, index * 50 + 100);
          });
        }
      }
    }
    
    // Ocultar loader
    if (movementsLoader) {
      movementsLoader.style.opacity = '0';
      movementsLoader.style.transition = 'opacity 0.3s ease';
      setTimeout(() => {
        movementsLoader.remove();
      }, 300);
    }
  } catch (error) {
    console.error('Error al cargar movimientos recientes:', error);
    if (movementsLoader) {
      movementsLoader.remove();
      const movementsPanel = Array.from(document.querySelectorAll('.panel')).find(p => 
        p.querySelector('.panel-title')?.textContent.includes('Movimientos Recientes')
      );
      if (movementsPanel) {
        const panelContent = movementsPanel.querySelector('.panel-content');
        if (panelContent) {
          panelContent.innerHTML = '<p style="color: rgba(255, 255, 255, 0.5); text-align: center; padding: 20px;">Error al cargar movimientos</p>';
        }
      }
    }
  }
}

function formatCurrency(amount) {
  return `S/${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(number) {
  return number.toLocaleString('es-PE');
}
