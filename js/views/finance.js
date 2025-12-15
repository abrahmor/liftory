// finance.js - vista finanzas
import { getCurrentUser, onAuthStateChanged } from '/js/auth.js';
import { getAllMovements } from '/js/services/movements.service.js';
import { getAllExpenses, createExpense, subscribeToExpenses } from '/js/services/expenses.service.js';

let unsubscribeExpenses = null;
let financeChartInstance = null;

export async function init() {
  console.log('Finance view initialized');

  const user = getCurrentUser();
  if (!user) {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged((authUser) => {
        if (authUser) {
          unsubscribe();
          initializeFinance();
          resolve();
        }
      });
    });
  }

  await initializeFinance();
}

async function initializeFinance() {
  const user = getCurrentUser();
  if (!user) {
    setTimeout(initializeFinance, 500);
    return;
  }

  await new Promise(resolve => setTimeout(resolve, 100));

  // Setup modal
  setupExpenseModal();

  // Setup filters
  setupFilters();

  // Load data
  try {
    await Promise.all([
      loadFinanceStats(),
      loadChart(),
      loadCategories(),
      loadTransactions()
    ]);
  } catch (error) {
    console.error('Error loading finance data:', error);
  }

  // Subscribe to real-time updates
  unsubscribeExpenses = subscribeToExpenses(() => {
    loadFinanceStats();
    loadChart();
    loadCategories();
    loadTransactions();
  });
}

function setupExpenseModal() {
  const openBtn = document.getElementById('btn-open-expense-modal');
  const modal = document.getElementById('expense-modal');
  const form = document.getElementById('expense-form');

  if (!openBtn || !modal || !form) {
    console.error('Finance modal elements not found:', { openBtn, modal, form });
    return;
  }

  console.log('Finance modal setup - all elements found');

  // Set today's date
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const dateInput = document.getElementById('expense-date');
  if (dateInput) dateInput.value = todayStr;

  // Open modal with view transition
  openBtn.addEventListener('click', (event) => {
    event.currentTarget.setAttribute('origin-element', '');
    if (window.toggleDialog) {
      window.toggleDialog('expense-modal');
    } else {
      modal.showModal();
    }
  });

  // Form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    console.log('Expense form submitted');

    const submitBtn = document.getElementById('btn-save-expense');
    if (!submitBtn) {
      console.error('Submit button not found');
      return;
    }

    const data = new FormData(form);

    const dateValue = data.get('date');
    if (!dateValue) {
      alert('Por favor selecciona una fecha');
      return;
    }

    const [year, month, day] = dateValue.split('-').map(Number);
    const expenseDate = new Date(year, month - 1, day);

    const expense = {
      category: data.get('category'),
      date: expenseDate,
      amount: Number(data.get('amount') || 0),
      recurring: data.get('recurring') || 'once',
      description: data.get('description') || '',
      notes: data.get('notes')?.toString().trim() || ''
    };

    console.log('Expense data:', expense);

    // Disable button and show loading
    submitBtn.disabled = true;
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = 'Guardando...';

    try {
      await createExpense(expense);
      console.log('Expense saved successfully');

      // Restore button
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;

      // Reload data
      await Promise.all([
        loadFinanceStats(),
        loadCategories(),
        loadTransactions()
      ]);

      // Reset form
      form.reset();
      if (dateInput) dateInput.value = todayStr;

      // Close modal
      closeModalWithTransition(modal);

    } catch (error) {
      console.error('Error saving expense:', error);
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
      alert('Error al guardar el gasto: ' + error.message);
    }
  });
}

function closeModalWithTransition(modal) {
  const originElement = document.querySelector('[origin-element]');
  if (originElement && document.startViewTransition) {
    const viewTransitionClassClosing = "vt-element-animation-closing";

    modal.style.viewTransitionName = "vt-shared";
    modal.style.viewTransitionClass = viewTransitionClassClosing;

    originElement.style.viewTransitionName = "vt-shared";
    originElement.style.viewTransitionClass = viewTransitionClassClosing;

    const viewTransition = document.startViewTransition(() => {
      modal.close();
      originElement.style.viewTransitionName = "";
      originElement.style.viewTransitionClass = "";
      modal.style.viewTransitionName = "";
      modal.style.viewTransitionClass = "";
      document.body.style.overflow = "";
    });

    viewTransition.finished.then(() => {
      originElement.removeAttribute('origin-element');
    });
  } else {
    modal.close();
    document.body.style.overflow = "";
  }
}

function setupFilters() {
  const chartPeriodFilter = document.getElementById('chart-period-filter');
  const transactionTypeFilter = document.getElementById('transaction-type-filter');

  chartPeriodFilter?.addEventListener('change', () => {
    loadChart();
  });

  transactionTypeFilter?.addEventListener('change', () => {
    loadTransactions();
  });
}

async function loadFinanceStats() {
  try {
    const [movements, expenses] = await Promise.all([
      getAllMovements(),
      getAllExpenses()
    ]);

    // Calculate income from sales
    const sales = movements.filter(m => m.type === 'venta');
    const totalIncome = sales.reduce((sum, s) => sum + (s.total || 0), 0);

    // Calculate costs from purchases
    const purchases = movements.filter(m => m.type === 'compra');
    const purchaseCosts = purchases.reduce((sum, p) => sum + (p.total || 0), 0);

    // Calculate expenses
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    // Total costs = purchases + expenses
    const totalCosts = purchaseCosts + totalExpenses;

    // Balance = income - costs
    const balance = totalIncome - totalCosts;

    // Profit margin
    const profitMargin = totalIncome > 0 ? ((balance / totalIncome) * 100) : 0;

    // Update UI
    // Use animated update
    updateStatCard('Ingresos totales', formatCurrency(totalIncome));
    updateStatCard('Gastos totales', formatCurrency(totalCosts));
    updateStatCard('Ganancia neta', formatCurrency(balance)); // Changed ID check logic slightly
    updateStatCard('Margen de ganancia', `${profitMargin.toFixed(1)}%`);

    // Add color to balance based on positive/negative
    const balanceEl = document.getElementById('total-balance');
    if (balanceEl) {
      if (balance >= 0) {
        balanceEl.style.color = '#2ed573';
      } else {
        balanceEl.style.color = '#ff4757';
      }
    }

  } catch (error) {
    console.error('Error loading finance stats:', error);
    updateStatCard('Ingresos totales', 'S/0.00');
    updateStatCard('Gastos totales', 'S/0.00');
    updateStatCard('Ganancia neta', 'S/0.00');
    updateStatCard('Margen de ganancia', '0%');
  }
}

function updateStatCard(label, value) {
  const statCards = document.querySelectorAll('.finance-stat-card');
  statCards.forEach(card => {
    const labelElement = card.querySelector('.finance-stat-label');
    if (labelElement && labelElement.textContent.trim() === label) {
      const valueElement = card.querySelector('.finance-stat-value');
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

async function loadChart() {
  const chartContainer = document.getElementById('finance-chart');
  const chartLoader = document.getElementById('chart-loader');
  const periodFilter = document.getElementById('chart-period-filter');

  if (!chartContainer) return;

  try {
    const [movements, expenses] = await Promise.all([
      getAllMovements(),
      getAllExpenses()
    ]);

    const period = periodFilter?.value || 'month';
    const { labels, incomeData, expenseData } = processChartData(movements, expenses, period);

    // Remove loader
    if (chartLoader) chartLoader.remove();

    // Destroy previous chart if exists
    if (financeChartInstance) {
      financeChartInstance.destroy();
    }

    // Create canvas for Chart.js
    chartContainer.innerHTML = '<canvas id="finance-chart-canvas" style="display: block;box-sizing: border-box;height: 260px;width: 285px;"></canvas>';

    const ctx = document.getElementById('finance-chart-canvas').getContext('2d');

    // Chart.js configuration for grouped bar chart
    financeChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Ingresos',
            data: incomeData,
            backgroundColor: 'rgba(46, 213, 115, 0.8)',
            borderColor: '#2ed573',
            borderWidth: 0,
            borderRadius: 12,
            borderSkipped: false,
          },
          {
            label: 'Gastos',
            data: expenseData,
            backgroundColor: 'rgba(255, 71, 87, 0.8)',
            borderColor: '#ff4757',
            borderWidth: 0,
            borderRadius: 12,
            borderSkipped: false,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              color: 'rgba(255, 255, 255, 0.8)',
              font: {
                family: 'DM Sans, sans-serif',
                size: 12,
                weight: '500'
              },
              padding: 15,
              usePointStyle: true,
              pointStyle: 'circle',
              boxWidth: 12,
              boxHeight: 12
            }
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
                return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
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

  } catch (error) {
    console.error('Error loading chart:', error);
    if (chartLoader) chartLoader.remove();
    chartContainer.innerHTML = '<div class="empty-state"><p>Error al cargar el gráfico</p></div>';
  }
}

function processChartData(movements, expenses, period) {
  const now = new Date();
  let labels = [];
  let incomeData = [];
  let expenseData = [];

  if (period === 'week') {
    // Last 7 days
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      labels.push(days[date.getDay()]);

      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

      const dayIncome = movements
        .filter(m => m.type === 'venta' && isDateInRange(m.date, dayStart, dayEnd))
        .reduce((sum, m) => sum + (m.total || 0), 0);

      const dayExpenses = movements
        .filter(m => m.type === 'compra' && isDateInRange(m.date, dayStart, dayEnd))
        .reduce((sum, m) => sum + (m.total || 0), 0) +
        expenses
          .filter(e => isDateInRange(e.date, dayStart, dayEnd))
          .reduce((sum, e) => sum + (e.amount || 0), 0);

      incomeData.push(dayIncome);
      expenseData.push(dayExpenses);
    }
  } else if (period === 'month') {
    // Last 4 weeks
    for (let i = 3; i >= 0; i--) {
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - (i * 7));
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 7);

      labels.push(`Sem ${4 - i}`);

      const weekIncome = movements
        .filter(m => m.type === 'venta' && isDateInRange(m.date, weekStart, weekEnd))
        .reduce((sum, m) => sum + (m.total || 0), 0);

      const weekExpenses = movements
        .filter(m => m.type === 'compra' && isDateInRange(m.date, weekStart, weekEnd))
        .reduce((sum, m) => sum + (m.total || 0), 0) +
        expenses
          .filter(e => isDateInRange(e.date, weekStart, weekEnd))
          .reduce((sum, e) => sum + (e.amount || 0), 0);

      incomeData.push(weekIncome);
      expenseData.push(weekExpenses);
    }
  } else {
    // Last 12 months
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      labels.push(months[monthDate.getMonth()]);

      const monthIncome = movements
        .filter(m => m.type === 'venta' && isDateInRange(m.date, monthDate, monthEnd))
        .reduce((sum, m) => sum + (m.total || 0), 0);

      const monthExpenses = movements
        .filter(m => m.type === 'compra' && isDateInRange(m.date, monthDate, monthEnd))
        .reduce((sum, m) => sum + (m.total || 0), 0) +
        expenses
          .filter(e => isDateInRange(e.date, monthDate, monthEnd))
          .reduce((sum, e) => sum + (e.amount || 0), 0);

      incomeData.push(monthIncome);
      expenseData.push(monthExpenses);
    }
  }

  return { labels, incomeData, expenseData };
}

function isDateInRange(date, start, end) {
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
  return d >= start && d < end;
}

async function loadCategories() {
  const categoriesContainer = document.getElementById('expense-categories');
  const categoriesLoader = document.getElementById('categories-loader');

  if (!categoriesContainer) return;

  try {
    const expenses = await getAllExpenses();

    // Remove loader
    if (categoriesLoader) categoriesLoader.remove();

    // Group by category
    const categoryTotals = {};
    const categoryIcons = {
      'alquiler': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-building-store"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 21l18 0" /><path d="M3 7v1a3 3 0 0 0 6 0v-1m0 1a3 3 0 0 0 6 0v-1m0 1a3 3 0 0 0 6 0v-1h-18l2 -4h14l2 4" /><path d="M5 21l0 -10.15" /><path d="M19 21l0 -10.15" /><path d="M9 21v-4a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v4" /></svg>',
      'servicios': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-bulb"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 12h1m8 -9v1m8 8h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7" /><path d="M9 16a5 5 0 1 1 6 0a3.5 3.5 0 0 0 -1 3a2 2 0 0 1 -4 0a3.5 3.5 0 0 0 -1 -3" /><path d="M9.7 17l4.6 0" /></svg>',
      'salarios': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-cash"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 15h-3a1 1 0 0 1 -1 -1v-8a1 1 0 0 1 1 -1h12a1 1 0 0 1 1 1v3" /><path d="M7 9m0 1a1 1 0 0 1 1 -1h12a1 1 0 0 1 1 1v8a1 1 0 0 1 -1 1h-12a1 1 0 0 1 -1 -1z" /><path d="M12 14a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /></svg>',
      'seguridad': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-user-shield"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 21v-2a4 4 0 0 1 4 -4h2" /><path d="M22 16c0 4 -2.5 6 -3.5 6s-3.5 -2 -3.5 -6c1 0 2.5 -.5 3.5 -1.5c1 1 2.5 1.5 3.5 1.5z" /><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /></svg>',
      'transporte': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-car"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M17 17h-11a2 2 0 0 0 -2 2v6a2 2 0 0 0 2 2h6a2 2 0 0 0 2 -2v-6a2 2 0 0 0 -2 -2z" /><path d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /></svg>',
      'suministros': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-box"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /></svg>',
      'mantenimiento': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-wrench"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /></svg>',
      'otros': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-list"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /></svg>'
    };

    expenses.forEach(expense => {
      const cat = expense.category || 'otros';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + (expense.amount || 0);
    });

    const sortedCategories = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1]);

    if (sortedCategories.length === 0) {
      categoriesContainer.innerHTML = `
        <div class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2" />
            <path d="M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" />
            <path d="M9 12l.01 0" /><path d="M13 12l2 0" />
            <path d="M9 16l.01 0" /><path d="M13 16l2 0" />
          </svg>
          <p>No hay gastos registrados</p>
        </div>
      `;
      return;
    }

    const maxAmount = sortedCategories[0][1];

    let html = '';
    sortedCategories.forEach(([category, amount]) => {
      const percentage = (amount / maxAmount) * 100;
      const icon = categoryIcons[category] || '📋';
      const displayName = category.charAt(0).toUpperCase() + category.slice(1);

      html += `
        <div class="category-item">
          <div class="category-header">
            <span class="category-name">
              <span class="category-icon">${icon}</span>
              ${displayName}
            </span>
            <span class="category-amount">${formatCurrency(amount)}</span>
          </div>
          <div class="category-bar">
            <div class="category-bar-fill ${category}" style="width: ${percentage}%;"></div>
          </div>
        </div>
      `;
    });

    categoriesContainer.innerHTML = html;

    // Animación sutil al mostrar las categorías
    const categoryItems = categoriesContainer.querySelectorAll('.category-item');
    categoryItems.forEach((item, index) => {
      item.style.opacity = '0';
      item.style.transform = 'translateY(10px)';
      setTimeout(() => {
        item.style.transition = 'all 0.5s ease';
        item.style.opacity = '1';
        item.style.transform = 'translateY(0)';
      }, index * 50 + 100);
    });

  } catch (error) {
    console.error('Error loading categories:', error);
    if (categoriesLoader) categoriesLoader.remove();
    categoriesContainer.innerHTML = '<div class="empty-state"><p>Error al cargar categorías</p></div>';
  }
}

async function loadTransactions() {
  const transactionsList = document.getElementById('transactions-list');
  const transactionsLoader = document.getElementById('transactions-loader');
  const typeFilter = document.getElementById('transaction-type-filter');

  if (!transactionsList) return;

  try {
    const [movements, expenses] = await Promise.all([
      getAllMovements(),
      getAllExpenses()
    ]);

    // Remove loader
    if (transactionsLoader) transactionsLoader.remove();

    // Combine and format transactions
    const transactions = [];

    // Add sales as income
    movements.filter(m => m.type === 'venta').forEach(m => {
      transactions.push({
        type: 'income',
        description: m.productName || 'Venta',
        category: 'Venta',
        amount: m.total || 0,
        date: m.date
      });
    });

    // Add purchases as expenses
    movements.filter(m => m.type === 'compra').forEach(m => {
      transactions.push({
        type: 'expense',
        description: m.productName || 'Compra',
        category: 'Compra',
        amount: m.total || 0,
        date: m.date
      });
    });

    // Add expenses
    expenses.forEach(e => {
      transactions.push({
        type: 'expense',
        description: e.description || 'Gasto',
        category: e.category || 'otros',
        amount: e.amount || 0,
        date: e.date
      });
    });

    // Sort by date (newest first)
    transactions.sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date : (a.date?.toDate ? a.date.toDate() : new Date(a.date));
      const dateB = b.date instanceof Date ? b.date : (b.date?.toDate ? b.date.toDate() : new Date(b.date));
      return dateB - dateA;
    });

    // Filter by type
    const filterValue = typeFilter?.value || '';
    const filteredTransactions = filterValue
      ? transactions.filter(t => t.type === filterValue)
      : transactions;

    // Take only recent 20
    const recentTransactions = filteredTransactions.slice(0, 20);

    if (recentTransactions.length === 0) {
      transactionsList.innerHTML = `
        <div class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
            <path d="M14.8 9a2 2 0 0 0 -1.8 -1h-2a2 2 0 1 0 0 4h2a2 2 0 1 1 0 4h-2a2 2 0 0 1 -1.8 -1" />
            <path d="M12 7v10" />
          </svg>
          <p>No hay transacciones registradas</p>
        </div>
      `;
      return;
    }

    const typeIcons = {
      income: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M17 8v-3a1 1 0 0 0 -1 -1h-10a2 2 0 0 0 0 4h12a1 1 0 0 1 1 1v3m0 4v3a1 1 0 0 1 -1 1h-12a2 2 0 0 1 -2 -2v-12" /><path d="M20 12v4h-4a2 2 0 0 1 0 -4h4" /></svg>`,
      expense: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M18 15l-6 -6l-6 6h12" transform="rotate(180 12 12)" /><path d="M3 20h18" /></svg>`
    };

    let html = '';
    recentTransactions.forEach((transaction, index) => {
      const date = transaction.date instanceof Date
        ? transaction.date
        : (transaction.date?.toDate ? transaction.date.toDate() : new Date(transaction.date));

      const formattedDate = date.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short'
      });

      const categoryDisplay = transaction.category.charAt(0).toUpperCase() + transaction.category.slice(1);

      html += `
        <div class="transaction-item" style="animation-delay: ${index * 0.05}s;">
          <div class="transaction-info">
            <div class="transaction-icon ${transaction.type}">
              ${typeIcons[transaction.type]}
            </div>
            <div class="transaction-details">
              <span class="transaction-description">${transaction.description}</span>
              <div class="transaction-meta">
                <span class="transaction-category">${categoryDisplay}</span>
              </div>
            </div>
          </div>
          <div class="transaction-amount-wrapper">
            <span class="transaction-amount ${transaction.type}">
              ${transaction.type === 'income' ? '+' : '-'}${formatCurrency(transaction.amount)}
            </span>
            <span class="transaction-date">${formattedDate}</span>
          </div>
        </div>
      `;
    });

    transactionsList.innerHTML = html;

    // Animación sutil al mostrar transacciones
    const transactionItems = transactionsList.querySelectorAll('.transaction-item');
    transactionItems.forEach((item, index) => {
      // Resetear para animación personalizada si es necesario, 
      // aunque ya tienen animation-delay en el HTML generado
      item.style.opacity = '0';
      item.style.transform = 'translateX(-10px)';
      setTimeout(() => {
        item.style.transition = 'all 0.4s ease';
        item.style.opacity = '1';
        item.style.transform = 'translateX(0)';
      }, index * 50 + 100);
    });

  } catch (error) {
    console.error('Error loading transactions:', error);
    if (transactionsLoader) transactionsLoader.remove();
    transactionsList.innerHTML = '<div class="empty-state"><p>Error al cargar transacciones</p></div>';
  }
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

// Cleanup on view change
window.addEventListener('beforeunload', () => {
  if (unsubscribeExpenses) {
    unsubscribeExpenses();
  }
  if (financeChartInstance) {
    financeChartInstance.destroy();
    financeChartInstance = null;
  }
});

// Cleanup when navigating away
document.addEventListener('click', (e) => {
  const link = e.target.closest('[data-link]');
  if (link && financeChartInstance) {
    financeChartInstance.destroy();
    financeChartInstance = null;
  }
});
