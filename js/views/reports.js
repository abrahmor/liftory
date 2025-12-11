// reports.js - vista reportes
import { getCurrentUser, onAuthStateChanged } from '/js/auth.js';
import { getAllProducts } from '/js/services/products.service.js';
import { getAllMovements } from '/js/services/movements.service.js';
import { getAllExpenses } from '/js/services/expenses.service.js';

let reportsChartInstance = null;

export async function init() {
  console.log('Reports view initialized');

  const user = getCurrentUser();
  if (!user) {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged((authUser) => {
        if (authUser) {
          unsubscribe();
          initializeReports();
          resolve();
        }
      });
    });
  }

  await initializeReports();
}

async function initializeReports() {
  const user = getCurrentUser();
  if (!user) {
    setTimeout(initializeReports, 500);
    return;
  }

  await new Promise(resolve => setTimeout(resolve, 100));

  // Setup filters
  setupFilters();

  // Setup buttons
  setupButtons();

  // Load initial report
  await loadReport();
}

function setupFilters() {
  const reportType = document.getElementById('report-type');
  const reportPeriod = document.getElementById('report-period');
  const dateFrom = document.getElementById('report-date-from');
  const dateTo = document.getElementById('report-date-to');

  // Show/hide custom date inputs
  reportPeriod?.addEventListener('change', () => {
    const isCustom = reportPeriod.value === 'custom';
    if (dateFrom) dateFrom.style.display = isCustom ? 'block' : 'none';
    if (dateTo) dateTo.style.display = isCustom ? 'block' : 'none';

    if (!isCustom) {
      loadReport();
    }
  });

  // Reload report when type changes
  reportType?.addEventListener('change', () => {
    loadReport();
  });

  // Custom date changes
  dateFrom?.addEventListener('change', loadReport);
  dateTo?.addEventListener('change', loadReport);
}

function setupButtons() {
  const generateBtn = document.getElementById('btn-generate-report');
  const exportPdfBtn = document.getElementById('btn-export-pdf');

  generateBtn?.addEventListener('click', () => {
    loadReport();
  });

  exportPdfBtn?.addEventListener('click', () => {
    exportToPdf();
  });
}

function getDateRange() {
  const period = document.getElementById('report-period')?.value || 'month';
  const now = new Date();
  let startDate, endDate;

  endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  switch (period) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      break;
    case 'week':
      const dayOfWeek = now.getDay();
      const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      startDate = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      break;
    case 'quarter':
      const quarterStart = Math.floor(now.getMonth() / 3) * 3;
      startDate = new Date(now.getFullYear(), quarterStart, 1, 0, 0, 0);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
      break;
    case 'custom':
      const fromInput = document.getElementById('report-date-from')?.value;
      const toInput = document.getElementById('report-date-to')?.value;
      if (fromInput) {
        const [y, m, d] = fromInput.split('-').map(Number);
        startDate = new Date(y, m - 1, d, 0, 0, 0);
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      }
      if (toInput) {
        const [y, m, d] = toInput.split('-').map(Number);
        endDate = new Date(y, m - 1, d, 23, 59, 59);
      }
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
  }

  return { startDate, endDate };
}

function isDateInRange(date, startDate, endDate) {
  let d;
  if (date instanceof Date) {
    d = date;
  } else if (date && date.toDate) {
    d = date.toDate();
  } else if (typeof date === 'string') {
    d = new Date(date);
  } else {
    return false;
  }
  return d >= startDate && d <= endDate;
}

async function loadReport() {
  try {
    const [products, movements, expenses] = await Promise.all([
      getAllProducts(),
      getAllMovements(),
      getAllExpenses()
    ]);

    const { startDate, endDate } = getDateRange();

    // Filter data by date range
    const filteredMovements = movements.filter(m => isDateInRange(m.date, startDate, endDate));
    const filteredExpenses = expenses.filter(e => isDateInRange(e.date, startDate, endDate));

    // Get report type
    const reportType = document.getElementById('report-type')?.value || 'sales';

    // Load all report sections
    await Promise.all([
      loadStats(filteredMovements, filteredExpenses, products),
      loadChart(filteredMovements, filteredExpenses, reportType),
      loadTopProducts(filteredMovements, products),
      loadTable(filteredMovements, filteredExpenses)
    ]);

  } catch (error) {
    console.error('Error loading report:', error);
  }
}

async function loadStats(movements, expenses, products) {
  // Calculate stats
  const sales = movements.filter(m => m.type === 'venta');
  const purchases = movements.filter(m => m.type === 'compra');

  const totalSales = sales.reduce((sum, s) => sum + (s.total || 0), 0);
  const unitsSold = sales.reduce((sum, s) => sum + Math.abs(s.quantity || 0), 0);
  const totalPurchases = purchases.reduce((sum, p) => sum + (p.total || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalProfit = totalSales - totalPurchases - totalExpenses;
  const totalTransactions = movements.length + expenses.length;

  // Update UI
  // Update UI with animation
  updateStatValue('stat-total-sales', formatCurrency(totalSales));
  updateStatValue('stat-units-sold', formatNumber(unitsSold));
  updateStatValue('stat-total-profit', formatCurrency(totalProfit));
  updateStatValue('stat-total-transactions', formatNumber(totalTransactions));

  // Color for profit
  const profitEl = document.getElementById('stat-total-profit');
  if (profitEl) {
    profitEl.style.color = totalProfit >= 0 ? '#2ed573' : '#ff4757';
  }
}

function updateStatValue(elementId, value) {
  const element = document.getElementById(elementId);
  if (element) {
    element.style.opacity = '0';
    element.style.transform = 'scale(0.9)';
    setTimeout(() => {
      element.textContent = value;
      element.style.transition = 'all 0.3s ease';
      element.style.opacity = '1';
      element.style.transform = 'scale(1)';
    }, 50);
  }
}

async function loadChart(movements, expenses = [], reportType = 'sales') {
  const chartContainer = document.getElementById('report-chart');
  const chartLoader = document.getElementById('chart-loader');
  const chartTitle = document.querySelector('.chart-panel .panel-title');

  if (!chartContainer) return;

  const { startDate, endDate } = getDateRange();
  const period = document.getElementById('report-period')?.value || 'month';

  // Define chart configuration based on report type
  const chartConfig = {
    sales: {
      title: 'Tendencia de ventas',
      type: 'venta',
      label: 'Ventas',
      backgroundColor: 'rgba(46, 213, 115, 0.8)',
      borderColor: '#2ed573'
    },
    purchases: {
      title: 'Tendencia de compras',
      type: 'compra',
      label: 'Compras',
      backgroundColor: 'rgba(55, 66, 250, 0.8)',
      borderColor: '#3742fa'
    },
    expenses: {
      title: 'Tendencia de gastos',
      type: 'gasto',
      label: 'Gastos',
      backgroundColor: 'rgba(255, 71, 87, 0.8)',
      borderColor: '#ff4757'
    },
    inventory: {
      title: 'Movimientos de inventario',
      type: 'all',
      label: 'Movimientos',
      backgroundColor: 'rgba(255, 165, 2, 0.8)',
      borderColor: '#ffa502'
    },
    finance: {
      title: 'Tendencia financiera',
      type: 'all',
      label: 'Balance',
      backgroundColor: 'rgba(116, 185, 255, 0.8)',
      borderColor: '#74b9ff'
    },
    movements: {
      title: 'Tendencia de movimientos',
      type: 'all',
      label: 'Movimientos',
      backgroundColor: 'rgba(255, 165, 2, 0.8)',
      borderColor: '#ffa502'
    }
  };

  const config = chartConfig[reportType] || chartConfig.sales;

  // Update chart title
  if (chartTitle) {
    chartTitle.textContent = config.title;
  }

  // Generate labels and data based on period and report type
  const { labels, data } = generateChartData(movements, expenses, startDate, endDate, period, config.type, reportType);

  // Remove loader
  if (chartLoader) chartLoader.remove();

  if (data.length === 0 || data.every(v => v === 0)) {
    chartContainer.innerHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M3 3v18h18" />
          <path d="M7 16l4 -4l4 4l6 -6" />
        </svg>
        <p>No hay datos para mostrar en este período</p>
      </div>
    `;
    return;
  }

  // Destroy previous chart if exists
  if (reportsChartInstance) {
    reportsChartInstance.destroy();
  }

  // Create canvas for Chart.js
  chartContainer.innerHTML = '<canvas id="reports-chart-canvas"></canvas>';

  const ctx = document.getElementById('reports-chart-canvas').getContext('2d');

  // Chart.js configuration
  reportsChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: config.label,
        data: data,
        backgroundColor: config.backgroundColor,
        borderColor: config.borderColor,
        borderWidth: 0,
        borderRadius: 12,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(16, 16, 18, 0.95)',
          titleColor: 'rgba(255, 255, 255, 0.9)',
          bodyColor: 'rgba(255, 255, 255, 0.8)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 12,
          titleFont: {
            family: 'DM Sans, sans-serif',
            size: 13,
            weight: '600'
          },
          bodyFont: {
            family: 'DM Sans, sans-serif',
            size: 12
          },
          callbacks: {
            label: function (context) {
              return formatCurrency(context.parsed.y);
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.6)',
            font: {
              family: 'DM Sans, sans-serif',
              size: 11
            }
          },
          border: {
            display: false
          }
        },
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.08)',
            drawBorder: false,
            lineWidth: 1
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.6)',
            font: {
              family: 'DM Sans, sans-serif',
              size: 11
            },
            callback: function (value) {
              return formatShortCurrency(value);
            }
          },
          border: {
            display: false
          }
        }
      },
      animation: {
        duration: 1000,
        easing: 'easeOutQuart'
      }
    }
  });
}

function generateChartData(movements, expenses = [], startDate, endDate, period, movementType = 'venta', reportType = 'sales') {
  // Filter movements by type or use expenses
  let dataSource = [];

  if (movementType === 'venta') {
    dataSource = movements.filter(m => m.type === 'venta').map(m => ({
      date: m.date,
      amount: m.total || 0
    }));
  } else if (movementType === 'compra') {
    dataSource = movements.filter(m => m.type === 'compra').map(m => ({
      date: m.date,
      amount: m.total || 0
    }));
  } else if (movementType === 'gasto') {
    // Use expenses collection
    dataSource = expenses.map(e => ({
      date: e.date,
      amount: e.amount || 0
    }));
  } else {
    // 'all' type uses all movements
    dataSource = movements.map(m => ({
      date: m.date,
      amount: m.total || 0
    }));
  }

  const labels = [];
  const data = [];

  if (period === 'today') {
    // Hourly breakdown
    for (let i = 0; i < 24; i += 4) {
      labels.push(`${i}:00`);
      const hourData = dataSource.filter(item => {
        const d = item.date instanceof Date ? item.date : (item.date?.toDate ? item.date.toDate() : new Date(item.date));
        return d.getHours() >= i && d.getHours() < i + 4;
      });
      data.push(hourData.reduce((sum, item) => sum + (item.amount || 0), 0));
    }
  } else if (period === 'week') {
    // Daily breakdown - last 7 days
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const dayDate = new Date(now);
      dayDate.setDate(now.getDate() - i);
      labels.push(days[dayDate.getDay()]);

      const dayData = dataSource.filter(item => {
        const d = item.date instanceof Date ? item.date : (item.date?.toDate ? item.date.toDate() : new Date(item.date));
        return d.getDate() === dayDate.getDate() &&
          d.getMonth() === dayDate.getMonth() &&
          d.getFullYear() === dayDate.getFullYear();
      });
      data.push(dayData.reduce((sum, item) => sum + (item.amount || 0), 0));
    }
  } else if (period === 'month') {
    // Weekly breakdown - last 4 weeks
    const now = new Date();
    for (let i = 3; i >= 0; i--) {
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() - (i * 7));
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekEnd.getDate() - 7);

      labels.push(`Sem ${4 - i}`);

      const weekData = dataSource.filter(item => {
        const d = item.date instanceof Date ? item.date : (item.date?.toDate ? item.date.toDate() : new Date(item.date));
        return d >= weekStart && d < weekEnd;
      });
      data.push(weekData.reduce((sum, item) => sum + (item.amount || 0), 0));
    }
  } else if (period === 'year') {
    // Monthly breakdown - last 12 months
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      labels.push(months[monthDate.getMonth()]);

      const monthData = dataSource.filter(item => {
        const d = item.date instanceof Date ? item.date : (item.date?.toDate ? item.date.toDate() : new Date(item.date));
        return d >= monthDate && d <= monthEnd;
      });
      data.push(monthData.reduce((sum, item) => sum + (item.amount || 0), 0));
    }
  } else {
    // Default: Monthly breakdown for custom/quarter
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const startMonth = startDate.getMonth();
    const endMonth = endDate.getMonth();
    const monthDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + endMonth - startMonth + 1;

    for (let i = 0; i < Math.min(monthDiff, 12); i++) {
      const monthIndex = (startMonth + i) % 12;
      labels.push(months[monthIndex]);

      const monthData = dataSource.filter(item => {
        const d = item.date instanceof Date ? item.date : (item.date?.toDate ? item.date.toDate() : new Date(item.date));
        return d.getMonth() === monthIndex &&
          d.getFullYear() === startDate.getFullYear();
      });
      data.push(monthData.reduce((sum, item) => sum + (item.amount || 0), 0));
    }
  }

  return { labels, data };
}

async function loadTopProducts(movements, products) {
  const listContainer = document.getElementById('top-products-list');
  const listLoader = document.getElementById('products-loader');

  if (!listContainer) return;

  // Remove loader
  if (listLoader) listLoader.remove();

  // Contar ventas por producto (agrupar por nombre para evitar duplicados) - misma lógica del dashboard
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

  if (topProducts.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5" />
          <path d="M12 12l8 -4.5" />
          <path d="M12 12l0 9" />
          <path d="M12 12l-8 -4.5" />
        </svg>
        <p>No hay ventas en este período</p>
      </div>
    `;
    return;
  }

  // Mismo HTML que el dashboard
  let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';
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

  listContainer.innerHTML = html;

  // Animación sutil al mostrar productos
  const productItems = listContainer.querySelectorAll('div[style*="border-radius: 22px"]');
  productItems.forEach((item, index) => {
    item.style.opacity = '0';
    item.style.transform = 'translateY(10px)';
    setTimeout(() => {
      item.style.transition = 'all 0.5s ease';
      item.style.opacity = '1';
      item.style.transform = 'translateY(0)';
    }, index * 50 + 100);
  });
}

async function loadTable(movements, expenses) {
  const tableContainer = document.getElementById('report-table');
  const tableLoader = document.getElementById('table-loader');

  if (!tableContainer) return;

  // Remove loader
  if (tableLoader) tableLoader.remove();

  // Combine all transactions
  const transactions = [];

  movements.forEach(m => {
    transactions.push({
      date: m.date,
      type: m.type,
      description: m.productName || 'Movimiento',
      quantity: m.quantity,
      amount: m.total || 0
    });
  });

  expenses.forEach(e => {
    transactions.push({
      date: e.date,
      type: 'gasto',
      description: e.description || 'Gasto',
      quantity: 1,
      amount: e.amount || 0
    });
  });

  // Sort by date descending
  transactions.sort((a, b) => {
    const dateA = a.date instanceof Date ? a.date : (a.date?.toDate ? a.date.toDate() : new Date(a.date));
    const dateB = b.date instanceof Date ? b.date : (b.date?.toDate ? b.date.toDate() : new Date(b.date));
    return dateB - dateA;
  });

  if (transactions.length === 0) {
    tableContainer.innerHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2" />
          <path d="M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" />
        </svg>
        <p>No hay transacciones en este período</p>
      </div>
    `;
    return;
  }

  // Take only recent 20 for display
  const recentTransactions = transactions.slice(0, 20);

  const typeLabels = {
    venta: 'Venta',
    compra: 'Compra',
    ajuste: 'Ajuste',
    gasto: 'Gasto'
  };

  let html = `
    <table class="report-table">
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Tipo</th>
          <th>Descripción</th>
          <th>Cantidad</th>
          <th>Monto</th>
        </tr>
      </thead>
      <tbody>
  `;

  recentTransactions.forEach(t => {
    const date = t.date instanceof Date ? t.date : (t.date?.toDate ? t.date.toDate() : new Date(t.date));
    const formattedDate = date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    const isNegative = t.type === 'compra' || t.type === 'gasto' || (t.type === 'ajuste' && t.amount < 0);

    html += `
      <tr>
        <td>${formattedDate}</td>
        <td><span class="table-type-badge ${t.type}">${typeLabels[t.type] || t.type}</span></td>
        <td>${t.description}</td>
        <td>${t.type === 'ajuste' ? (t.quantity > 0 ? '+' : '') + t.quantity : Math.abs(t.quantity || 0)}</td>
        <td style="color: ${isNegative ? '#ff4757' : '#2ed573'}; font-weight: 600;">
          ${isNegative ? '-' : '+'}${formatCurrency(Math.abs(t.amount))}
        </td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
  `;

  if (transactions.length > 20) {
    html += `<p style="text-align: center; color: rgba(255,255,255,0.5); margin-top: 16px; font-size: 0.85rem;">Mostrando 20 de ${transactions.length} transacciones</p>`;
  }

  tableContainer.innerHTML = html;

  // Animación sutil al mostrar filas
  const rows = tableContainer.querySelectorAll('tbody tr');
  rows.forEach((row, index) => {
    row.style.opacity = '0';
    row.style.transform = 'translateX(-10px)';
    setTimeout(() => {
      row.style.transition = 'all 0.3s ease';
      row.style.opacity = '1';
      row.style.transform = 'translateX(0)';
    }, index * 30 + 100);
  });
}

async function exportToPdf() {
  const reportType = document.getElementById('report-type')?.value || 'sales';
  const period = document.getElementById('report-period')?.value || 'month';

  const typeNames = {
    sales: 'Ventas',
    purchases: 'Compras',
    expenses: 'Gastos',
    inventory: 'Inventario',
    finance: 'Finanzas',
    movements: 'Movimientos'
  };

  const periodNames = {
    today: 'Hoy',
    week: 'Esta semana',
    month: 'Este mes',
    quarter: 'Este trimestre',
    year: 'Este año',
    custom: 'Personalizado'
  };

  // Fetch data
  const [products, movements, expenses] = await Promise.all([
    getAllProducts(),
    getAllMovements(),
    getAllExpenses()
  ]);

  const { startDate, endDate } = getDateRange();
  const filteredMovements = movements.filter(m => isDateInRange(m.date, startDate, endDate));
  const filteredExpenses = expenses.filter(e => isDateInRange(e.date, startDate, endDate));

  // Generate specific content based on report type
  let reportContent = '';

  switch (reportType) {
    case 'sales':
      reportContent = generateSalesReport(filteredMovements, products);
      break;
    case 'purchases':
      reportContent = generatePurchasesReport(filteredMovements, products);
      break;
    case 'expenses':
      reportContent = generateExpensesReport(filteredExpenses);
      break;
    case 'inventory':
      reportContent = generateInventoryReport(products, movements);
      break;
    case 'finance':
      reportContent = generateFinanceReport(filteredMovements, filteredExpenses);
      break;
    case 'movements':
      reportContent = generateMovementsReport(filteredMovements);
      break;
    default:
      reportContent = generateSalesReport(filteredMovements, products);
  }

  const printWindow = window.open('', '_blank');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Reporte de ${typeNames[reportType]} - ${periodNames[period]}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
          padding: 30px;
          background: #fff;
          color: #333;
          font-size: 12px;
        }
        .report-header { 
          border-bottom: 2px solid #333; 
          padding-bottom: 15px; 
          margin-bottom: 20px; 
        }
        .report-title { font-size: 22px; font-weight: bold; margin-bottom: 5px; }
        .report-subtitle { color: #666; font-size: 12px; }
        .stats-grid { 
          display: grid; 
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); 
          gap: 15px; 
          margin-bottom: 25px; 
        }
        .stat-box { 
          padding: 15px; 
          border: 1px solid #ddd; 
          border-radius: 8px;
          text-align: center;
        }
        .stat-value { font-size: 20px; font-weight: bold; color: #333; }
        .stat-label { font-size: 11px; color: #666; margin-top: 4px; }
        .section-title { 
          font-size: 14px; 
          font-weight: 600; 
          margin: 20px 0 10px; 
          padding-bottom: 5px;
          border-bottom: 1px solid #eee;
        }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-bottom: 20px;
          font-size: 11px;
        }
        th, td { 
          padding: 10px 12px; 
          border: 1px solid #ddd; 
          text-align: left; 
        }
        th { 
          background: #f8f9fa; 
          font-weight: 600; 
          text-transform: uppercase;
          font-size: 10px;
          letter-spacing: 0.5px;
        }
        tr:nth-child(even) { background: #fafafa; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .text-green { color: #28a745; }
        .text-red { color: #dc3545; }
        .text-blue { color: #007bff; }
        .text-orange { color: #fd7e14; }
        .badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 500;
        }
        .badge-green { background: #d4edda; color: #155724; }
        .badge-blue { background: #cce5ff; color: #004085; }
        .badge-orange { background: #fff3cd; color: #856404; }
        .badge-red { background: #f8d7da; color: #721c24; }
        .product-img {
          width: 30px;
          height: 30px;
          object-fit: cover;
          border-radius: 4px;
          vertical-align: middle;
          margin-right: 8px;
        }
        .summary-row { 
          font-weight: bold; 
          background: #f0f0f0 !important; 
        }
        .footer {
          margin-top: 30px;
          padding-top: 15px;
          border-top: 1px solid #ddd;
          font-size: 10px;
          color: #666;
          text-align: center;
        }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="report-header">
        <div class="report-title">Reporte de ${typeNames[reportType]}</div>
        <div class="report-subtitle">Período: ${periodNames[period]} | Generado: ${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
      </div>
      ${reportContent}
      <div class="footer">
        Liftory - Sistema de Gestión de Inventario
      </div>
    </body>
    </html>
  `);

  printWindow.document.close();

  setTimeout(() => {
    printWindow.print();
  }, 500);
}

function generateSalesReport(movements, products) {
  const sales = movements.filter(m => m.type === 'venta');
  const totalSales = sales.reduce((sum, s) => sum + (s.total || 0), 0);
  const unitsSold = sales.reduce((sum, s) => sum + Math.abs(s.quantity || 0), 0);
  const avgTicket = sales.length > 0 ? totalSales / sales.length : 0;

  // Group by product
  const productSales = {};
  sales.forEach(sale => {
    const key = (sale.productName || 'Desconocido').toLowerCase();
    if (!productSales[key]) {
      productSales[key] = { name: sale.productName, quantity: 0, total: 0 };
    }
    productSales[key].quantity += Math.abs(sale.quantity || 0);
    productSales[key].total += sale.total || 0;
  });
  const topProducts = Object.values(productSales).sort((a, b) => b.total - a.total).slice(0, 10);

  let html = `
    <div class="stats-grid">
      <div class="stat-box">
        <div class="stat-value text-green">${formatCurrency(totalSales)}</div>
        <div class="stat-label">Total Ventas</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${sales.length}</div>
        <div class="stat-label">Transacciones</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${unitsSold}</div>
        <div class="stat-label">Unidades Vendidas</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${formatCurrency(avgTicket)}</div>
        <div class="stat-label">Ticket Promedio</div>
      </div>
    </div>
    
    <div class="section-title">Top 10 Productos Más Vendidos</div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Producto</th>
          <th class="text-center">Cantidad</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
  `;

  topProducts.forEach((p, i) => {
    html += `
      <tr>
        <td>${i + 1}</td>
        <td>${p.name}</td>
        <td class="text-center">${p.quantity}</td>
        <td class="text-right text-green">${formatCurrency(p.total)}</td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
    
    <div class="section-title">Detalle de Ventas</div>
    <table>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Producto</th>
          <th>Código</th>
          <th class="text-center">Cantidad</th>
          <th class="text-right">Precio</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
  `;

  sales.slice(0, 50).forEach(s => {
    const date = s.date instanceof Date ? s.date : (s.date?.toDate ? s.date.toDate() : new Date(s.date));
    html += `
      <tr>
        <td>${date.toLocaleDateString('es-ES')}</td>
        <td>${s.productName || '-'}</td>
        <td>${s.productCode || '-'}</td>
        <td class="text-center">${Math.abs(s.quantity || 0)}</td>
        <td class="text-right">${formatCurrency(s.price || 0)}</td>
        <td class="text-right text-green">${formatCurrency(s.total || 0)}</td>
      </tr>
    `;
  });

  html += `
        <tr class="summary-row">
          <td colspan="5">TOTAL</td>
          <td class="text-right text-green">${formatCurrency(totalSales)}</td>
        </tr>
      </tbody>
    </table>
  `;

  if (sales.length > 50) {
    html += `<p style="color: #666; font-size: 10px;">Mostrando 50 de ${sales.length} ventas</p>`;
  }

  return html;
}

function generateInventoryReport(products, movements) {
  // Calculate current stock for each product
  const productStock = products.map(product => {
    let currentStock = product.initialStock || 0;
    movements.forEach(m => {
      if (m.productId === product.id) {
        if (m.type === 'venta') currentStock -= Math.abs(m.quantity || 0);
        else if (m.type === 'compra') currentStock += Math.abs(m.quantity || 0);
        else if (m.type === 'ajuste') currentStock += (m.quantity || 0);
      }
    });
    return {
      ...product,
      currentStock: Math.max(0, currentStock),
      stockValue: Math.max(0, currentStock) * (product.purchasePrice || 0)
    };
  });

  const totalProducts = products.length;
  const totalUnits = productStock.reduce((sum, p) => sum + p.currentStock, 0);
  const totalValue = productStock.reduce((sum, p) => sum + p.stockValue, 0);
  const lowStock = productStock.filter(p => p.currentStock > 0 && p.currentStock <= (p.minStock || 5)).length;
  const outOfStock = productStock.filter(p => p.currentStock === 0).length;

  let html = `
    <div class="stats-grid">
      <div class="stat-box">
        <div class="stat-value">${totalProducts}</div>
        <div class="stat-label">Total Productos</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${totalUnits}</div>
        <div class="stat-label">Unidades en Stock</div>
      </div>
      <div class="stat-box">
        <div class="stat-value text-blue">${formatCurrency(totalValue)}</div>
        <div class="stat-label">Valor del Inventario</div>
      </div>
      <div class="stat-box">
        <div class="stat-value text-orange">${lowStock}</div>
        <div class="stat-label">Stock Bajo</div>
      </div>
    </div>
    
    <div class="section-title">Listado de Productos</div>
    <table>
      <thead>
        <tr>
          <th>Código</th>
          <th>Producto</th>
          <th>Categoría</th>
          <th class="text-center">Stock</th>
          <th class="text-right">P. Compra</th>
          <th class="text-right">P. Venta</th>
          <th class="text-right">Valor Stock</th>
          <th class="text-center">Estado</th>
        </tr>
      </thead>
      <tbody>
  `;

  productStock.sort((a, b) => a.currentStock - b.currentStock).forEach(p => {
    let statusBadge = '<span class="badge badge-green">OK</span>';
    if (p.currentStock === 0) {
      statusBadge = '<span class="badge badge-red">Sin Stock</span>';
    } else if (p.currentStock <= (p.minStock || 5)) {
      statusBadge = '<span class="badge badge-orange">Bajo</span>';
    }

    html += `
      <tr>
        <td>${p.code || '-'}</td>
        <td>${p.name || '-'}</td>
        <td>${p.category || '-'}</td>
        <td class="text-center">${p.currentStock}</td>
        <td class="text-right">${formatCurrency(p.purchasePrice || 0)}</td>
        <td class="text-right">${formatCurrency(p.salePrice || 0)}</td>
        <td class="text-right text-blue">${formatCurrency(p.stockValue)}</td>
        <td class="text-center">${statusBadge}</td>
      </tr>
    `;
  });

  html += `
        <tr class="summary-row">
          <td colspan="3">TOTALES</td>
          <td class="text-center">${totalUnits}</td>
          <td colspan="2"></td>
          <td class="text-right text-blue">${formatCurrency(totalValue)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  `;

  return html;
}

function generateFinanceReport(movements, expenses) {
  const sales = movements.filter(m => m.type === 'venta');
  const purchases = movements.filter(m => m.type === 'compra');

  const totalIncome = sales.reduce((sum, s) => sum + (s.total || 0), 0);
  const totalPurchases = purchases.reduce((sum, p) => sum + (p.total || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalCosts = totalPurchases + totalExpenses;
  const netProfit = totalIncome - totalCosts;
  const profitMargin = totalIncome > 0 ? (netProfit / totalIncome * 100) : 0;

  // Group expenses by category
  const expensesByCategory = {};
  expenses.forEach(e => {
    const cat = e.category || 'otros';
    expensesByCategory[cat] = (expensesByCategory[cat] || 0) + (e.amount || 0);
  });

  let html = `
    <div class="stats-grid">
      <div class="stat-box">
        <div class="stat-value text-green">${formatCurrency(totalIncome)}</div>
        <div class="stat-label">Ingresos</div>
      </div>
      <div class="stat-box">
        <div class="stat-value text-red">${formatCurrency(totalCosts)}</div>
        <div class="stat-label">Costos Totales</div>
      </div>
      <div class="stat-box">
        <div class="stat-value ${netProfit >= 0 ? 'text-green' : 'text-red'}">${formatCurrency(netProfit)}</div>
        <div class="stat-label">Ganancia Neta</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${profitMargin.toFixed(1)}%</div>
        <div class="stat-label">Margen</div>
      </div>
    </div>
    
    <div class="section-title">Resumen de Ingresos y Costos</div>
    <table>
      <thead>
        <tr>
          <th>Concepto</th>
          <th class="text-right">Monto</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Ventas</td>
          <td class="text-right text-green">+${formatCurrency(totalIncome)}</td>
        </tr>
        <tr>
          <td>Compras de Inventario</td>
          <td class="text-right text-red">-${formatCurrency(totalPurchases)}</td>
        </tr>
        <tr>
          <td>Gastos Operativos</td>
          <td class="text-right text-red">-${formatCurrency(totalExpenses)}</td>
        </tr>
        <tr class="summary-row">
          <td>GANANCIA NETA</td>
          <td class="text-right ${netProfit >= 0 ? 'text-green' : 'text-red'}">${formatCurrency(netProfit)}</td>
        </tr>
      </tbody>
    </table>
    
    <div class="section-title">Gastos por Categoría</div>
    <table>
      <thead>
        <tr>
          <th>Categoría</th>
          <th class="text-right">Monto</th>
          <th class="text-right">% del Total</th>
        </tr>
      </thead>
      <tbody>
  `;

  Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1]).forEach(([cat, amount]) => {
    const percentage = totalExpenses > 0 ? (amount / totalExpenses * 100) : 0;
    html += `
      <tr>
        <td>${cat.charAt(0).toUpperCase() + cat.slice(1)}</td>
        <td class="text-right text-red">${formatCurrency(amount)}</td>
        <td class="text-right">${percentage.toFixed(1)}%</td>
      </tr>
    `;
  });

  html += `
        <tr class="summary-row">
          <td>TOTAL GASTOS</td>
          <td class="text-right text-red">${formatCurrency(totalExpenses)}</td>
          <td class="text-right">100%</td>
        </tr>
      </tbody>
    </table>
    
    <div class="section-title">Detalle de Gastos</div>
    <table>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Descripción</th>
          <th>Categoría</th>
          <th class="text-right">Monto</th>
        </tr>
      </thead>
      <tbody>
  `;

  expenses.slice(0, 30).forEach(e => {
    const date = e.date instanceof Date ? e.date : (e.date?.toDate ? e.date.toDate() : new Date(e.date));
    html += `
      <tr>
        <td>${date.toLocaleDateString('es-ES')}</td>
        <td>${e.description || '-'}</td>
        <td>${(e.category || 'otros').charAt(0).toUpperCase() + (e.category || 'otros').slice(1)}</td>
        <td class="text-right text-red">${formatCurrency(e.amount || 0)}</td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
  `;

  return html;
}

function generateMovementsReport(movements) {
  const sales = movements.filter(m => m.type === 'venta');
  const purchases = movements.filter(m => m.type === 'compra');
  const adjustments = movements.filter(m => m.type === 'ajuste');

  const totalSales = sales.reduce((sum, s) => sum + (s.total || 0), 0);
  const totalPurchases = purchases.reduce((sum, p) => sum + (p.total || 0), 0);

  const typeLabels = { venta: 'Venta', compra: 'Compra', ajuste: 'Ajuste' };
  const typeBadges = { venta: 'badge-green', compra: 'badge-blue', ajuste: 'badge-orange' };

  let html = `
    <div class="stats-grid">
      <div class="stat-box">
        <div class="stat-value">${movements.length}</div>
        <div class="stat-label">Total Movimientos</div>
      </div>
      <div class="stat-box">
        <div class="stat-value text-green">${sales.length}</div>
        <div class="stat-label">Ventas</div>
      </div>
      <div class="stat-box">
        <div class="stat-value text-blue">${purchases.length}</div>
        <div class="stat-label">Compras</div>
      </div>
      <div class="stat-box">
        <div class="stat-value text-orange">${adjustments.length}</div>
        <div class="stat-label">Ajustes</div>
      </div>
    </div>
    
    <div class="section-title">Resumen por Tipo</div>
    <table>
      <thead>
        <tr>
          <th>Tipo</th>
          <th class="text-center">Cantidad</th>
          <th class="text-right">Monto Total</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><span class="badge badge-green">Ventas</span></td>
          <td class="text-center">${sales.length}</td>
          <td class="text-right text-green">${formatCurrency(totalSales)}</td>
        </tr>
        <tr>
          <td><span class="badge badge-blue">Compras</span></td>
          <td class="text-center">${purchases.length}</td>
          <td class="text-right text-blue">${formatCurrency(totalPurchases)}</td>
        </tr>
        <tr>
          <td><span class="badge badge-orange">Ajustes</span></td>
          <td class="text-center">${adjustments.length}</td>
          <td class="text-right">-</td>
        </tr>
      </tbody>
    </table>
    
    <div class="section-title">Detalle de Movimientos</div>
    <table>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Tipo</th>
          <th>Producto</th>
          <th>Código</th>
          <th class="text-center">Cantidad</th>
          <th class="text-right">Precio</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
  `;

  movements.slice(0, 50).forEach(m => {
    const date = m.date instanceof Date ? m.date : (m.date?.toDate ? m.date.toDate() : new Date(m.date));
    const qty = m.type === 'ajuste' ? (m.quantity > 0 ? '+' : '') + m.quantity : Math.abs(m.quantity || 0);
    const colorClass = m.type === 'venta' ? 'text-green' : m.type === 'compra' ? 'text-blue' : 'text-orange';

    html += `
      <tr>
        <td>${date.toLocaleDateString('es-ES')}</td>
        <td><span class="badge ${typeBadges[m.type]}">${typeLabels[m.type]}</span></td>
        <td>${m.productName || '-'}</td>
        <td>${m.productCode || '-'}</td>
        <td class="text-center">${qty}</td>
        <td class="text-right">${formatCurrency(m.price || 0)}</td>
        <td class="text-right ${colorClass}">${formatCurrency(Math.abs(m.total || 0))}</td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
  `;

  if (movements.length > 50) {
    html += `<p style="color: #666; font-size: 10px;">Mostrando 50 de ${movements.length} movimientos</p>`;
  }

  return html;
}

function generatePurchasesReport(movements, products) {
  const purchases = movements.filter(m => m.type === 'compra');
  const totalPurchases = purchases.reduce((sum, p) => sum + (p.total || 0), 0);
  const unitsBought = purchases.reduce((sum, p) => sum + Math.abs(p.quantity || 0), 0);
  const avgPurchase = purchases.length > 0 ? totalPurchases / purchases.length : 0;

  // Group by product
  const productPurchases = {};
  purchases.forEach(purchase => {
    const key = (purchase.productName || 'Desconocido').toLowerCase();
    if (!productPurchases[key]) {
      productPurchases[key] = { name: purchase.productName, quantity: 0, total: 0 };
    }
    productPurchases[key].quantity += Math.abs(purchase.quantity || 0);
    productPurchases[key].total += purchase.total || 0;
  });
  const topProducts = Object.values(productPurchases).sort((a, b) => b.total - a.total).slice(0, 10);

  // Group by supplier (if available)
  const supplierTotals = {};
  purchases.forEach(p => {
    const supplier = p.supplier || 'Sin proveedor';
    supplierTotals[supplier] = (supplierTotals[supplier] || 0) + (p.total || 0);
  });

  let html = `
    <div class="stats-grid">
      <div class="stat-box">
        <div class="stat-value text-blue">${formatCurrency(totalPurchases)}</div>
        <div class="stat-label">Total Compras</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${purchases.length}</div>
        <div class="stat-label">Transacciones</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${unitsBought}</div>
        <div class="stat-label">Unidades Compradas</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${formatCurrency(avgPurchase)}</div>
        <div class="stat-label">Compra Promedio</div>
      </div>
    </div>
    
    <div class="section-title">Top 10 Productos Más Comprados</div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Producto</th>
          <th class="text-center">Cantidad</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
  `;

  topProducts.forEach((p, i) => {
    html += `
      <tr>
        <td>${i + 1}</td>
        <td>${p.name}</td>
        <td class="text-center">${p.quantity}</td>
        <td class="text-right text-blue">${formatCurrency(p.total)}</td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
    
    <div class="section-title">Detalle de Compras</div>
    <table>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Producto</th>
          <th>Código</th>
          <th class="text-center">Cantidad</th>
          <th class="text-right">Precio Unit.</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
  `;

  purchases.slice(0, 50).forEach(p => {
    const date = p.date instanceof Date ? p.date : (p.date?.toDate ? p.date.toDate() : new Date(p.date));
    html += `
      <tr>
        <td>${date.toLocaleDateString('es-ES')}</td>
        <td>${p.productName || '-'}</td>
        <td>${p.productCode || '-'}</td>
        <td class="text-center">${Math.abs(p.quantity || 0)}</td>
        <td class="text-right">${formatCurrency(p.price || 0)}</td>
        <td class="text-right text-blue">${formatCurrency(p.total || 0)}</td>
      </tr>
    `;
  });

  html += `
        <tr class="summary-row">
          <td colspan="5">TOTAL</td>
          <td class="text-right text-blue">${formatCurrency(totalPurchases)}</td>
        </tr>
      </tbody>
    </table>
  `;

  if (purchases.length > 50) {
    html += `<p style="color: #666; font-size: 10px;">Mostrando 50 de ${purchases.length} compras</p>`;
  }

  return html;
}

function generateExpensesReport(expenses) {
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const avgExpense = expenses.length > 0 ? totalExpenses / expenses.length : 0;

  // Group by category
  const categoryTotals = {};
  const categoryCounts = {};
  expenses.forEach(e => {
    const cat = e.category || 'otros';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + (e.amount || 0);
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });

  // Group by recurring type
  const recurringTotals = { once: 0, monthly: 0, weekly: 0 };
  expenses.forEach(e => {
    const type = e.recurring || 'once';
    recurringTotals[type] = (recurringTotals[type] || 0) + (e.amount || 0);
  });

  const categoryNames = {
    'alquiler': 'Alquiler',
    'servicios': 'Servicios',
    'salarios': 'Salarios',
    'publicidad': 'Publicidad',
    'transporte': 'Transporte',
    'suministros': 'Suministros',
    'mantenimiento': 'Mantenimiento',
    'otros': 'Otros'
  };

  let html = `
    <div class="stats-grid">
      <div class="stat-box">
        <div class="stat-value text-red">${formatCurrency(totalExpenses)}</div>
        <div class="stat-label">Total Gastos</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${expenses.length}</div>
        <div class="stat-label">Registros</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${formatCurrency(avgExpense)}</div>
        <div class="stat-label">Gasto Promedio</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${Object.keys(categoryTotals).length}</div>
        <div class="stat-label">Categorías</div>
      </div>
    </div>
    
    <div class="section-title">Gastos por Categoría</div>
    <table>
      <thead>
        <tr>
          <th>Categoría</th>
          <th class="text-center">Cantidad</th>
          <th class="text-right">Monto Total</th>
          <th class="text-right">% del Total</th>
        </tr>
      </thead>
      <tbody>
  `;

  Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).forEach(([cat, amount]) => {
    const percentage = totalExpenses > 0 ? (amount / totalExpenses * 100) : 0;
    const count = categoryCounts[cat] || 0;
    html += `
      <tr>
        <td>${categoryNames[cat] || cat.charAt(0).toUpperCase() + cat.slice(1)}</td>
        <td class="text-center">${count}</td>
        <td class="text-right text-red">${formatCurrency(amount)}</td>
        <td class="text-right">${percentage.toFixed(1)}%</td>
      </tr>
    `;
  });

  html += `
        <tr class="summary-row">
          <td>TOTAL</td>
          <td class="text-center">${expenses.length}</td>
          <td class="text-right text-red">${formatCurrency(totalExpenses)}</td>
          <td class="text-right">100%</td>
        </tr>
      </tbody>
    </table>
    
    <div class="section-title">Gastos por Frecuencia</div>
    <table>
      <thead>
        <tr>
          <th>Tipo</th>
          <th class="text-right">Monto</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Gastos Únicos</td>
          <td class="text-right">${formatCurrency(recurringTotals.once)}</td>
        </tr>
        <tr>
          <td>Gastos Mensuales</td>
          <td class="text-right">${formatCurrency(recurringTotals.monthly)}</td>
        </tr>
        <tr>
          <td>Gastos Semanales</td>
          <td class="text-right">${formatCurrency(recurringTotals.weekly)}</td>
        </tr>
      </tbody>
    </table>
    
    <div class="section-title">Detalle de Gastos</div>
    <table>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Descripción</th>
          <th>Categoría</th>
          <th>Frecuencia</th>
          <th class="text-right">Monto</th>
        </tr>
      </thead>
      <tbody>
  `;

  const frequencyNames = { once: 'Único', monthly: 'Mensual', weekly: 'Semanal' };

  expenses.slice(0, 50).forEach(e => {
    const date = e.date instanceof Date ? e.date : (e.date?.toDate ? e.date.toDate() : new Date(e.date));
    const catName = categoryNames[e.category] || (e.category || 'otros').charAt(0).toUpperCase() + (e.category || 'otros').slice(1);
    const freqName = frequencyNames[e.recurring] || 'Único';

    html += `
      <tr>
        <td>${date.toLocaleDateString('es-ES')}</td>
        <td>${e.description || '-'}</td>
        <td>${catName}</td>
        <td>${freqName}</td>
        <td class="text-right text-red">${formatCurrency(e.amount || 0)}</td>
      </tr>
    `;
  });

  html += `
        <tr class="summary-row">
          <td colspan="4">TOTAL</td>
          <td class="text-right text-red">${formatCurrency(totalExpenses)}</td>
        </tr>
      </tbody>
    </table>
  `;

  if (expenses.length > 50) {
    html += `<p style="color: #666; font-size: 10px;">Mostrando 50 de ${expenses.length} gastos</p>`;
  }

  return html;
}

function formatCurrency(amount) {
  return `S/${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatShortCurrency(amount) {
  if (amount >= 1000000) {
    return `S/${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `S/${(amount / 1000).toFixed(1)}K`;
  }
  return `S/${amount.toFixed(0)}`;
}

function formatNumber(number) {
  return number.toLocaleString('es-PE');
}

// Cleanup on view change
window.addEventListener('beforeunload', () => {
  if (reportsChartInstance) {
    reportsChartInstance.destroy();
    reportsChartInstance = null;
  }
});

// Cleanup when navigating away
document.addEventListener('click', (e) => {
  const link = e.target.closest('[data-link]');
  if (link && reportsChartInstance) {
    reportsChartInstance.destroy();
    reportsChartInstance = null;
  }
});
