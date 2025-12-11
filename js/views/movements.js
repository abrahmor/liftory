// movements.js - vista movements
import { DateRangePicker } from '/js/utils/dateRangePicker.js';
import { getAllMovements, createMovement, deleteAllMovements, subscribeToMovements } from '/js/services/movements.service.js';
import { getAllProducts } from '/js/services/products.service.js';
import { setButtonLoading } from '/js/utils/loader.js';

let selectedProduct = null;
let unsubscribeMovements = null;

export function init() {
    // Bind UI elements
    const openBtn = document.getElementById('btn-open-movement-modal');
    const modal = document.getElementById('movement-modal');
    const form = document.getElementById('movement-form');
    const movementsList = document.getElementById('movements-list');
    
    // Mostrar loader mientras se cargan los movimientos
    if (movementsList) {
      movementsList.innerHTML = `
        <div class="loader-container">
          <svg class="loader-svg" viewBox="25 25 50 50">
            <circle class="loader-circle" cx="50" cy="50" r="20"></circle>
          </svg>
        </div>
      `;
    }
    const productSearch = document.getElementById('product-search');
    const productSuggestions = document.getElementById('product-suggestions');
    const selectedProductField = document.getElementById('selected-product-field');
    const selectedProductDisplay = document.getElementById('selected-product-display');
    const typeFilter = document.getElementById('type-filter');
    const dateRangeFilter = document.getElementById('date-range-filter');
    const dateFromFilter = document.getElementById('date-from-filter');
    const dateToFilter = document.getElementById('date-to-filter');
    const clearFiltersBtn = document.getElementById('btn-clear-filters');
    const movementsPagination = document.getElementById('movements-pagination');
    const movementsPrevBtn = document.getElementById('movements-prev-btn');
    const movementsNextBtn = document.getElementById('movements-next-btn');
    const movementsPageInfo = document.getElementById('movements-page-info');
    
    // Pagination state
    let currentPage = 1;
    const itemsPerPage = 20;

    if (!openBtn || !modal || !form) {
        console.error('Required elements not found:', { openBtn, modal, form });
        return;
    }
    
    if (!productSearch || !productSuggestions) {
        console.error('Product search elements not found:', { productSearch, productSuggestions });
        return;
    }
    
    console.log('Movements init - all elements found');

    // Set today's date as default (in local timezone)
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    document.getElementById('movement-date').value = todayStr;

    // Scanner icon in movement modal
    const movementScanIcon = document.querySelector('#movement-modal .modal-scan-icon');
    
    if (movementScanIcon && productSearch) {
        movementScanIcon.addEventListener('click', () => {
            if (window.openScanner) {
                window.openScanner(productSearch);
            }
        });
    }

    // Open modal
    openBtn.addEventListener('click', (event) => {
        event.currentTarget.setAttribute('origin-element', '');
        window.toggleDialog?.('movement-modal', event);
        selectedProduct = null;
        selectedProductField.style.display = 'none';
        productSearch.value = '';
        productSuggestions.classList.remove('show');
        
        // Reset quantity field constraints
        const movementType = document.getElementById('movement-type').value;
        const movementQuantityInput = document.getElementById('movement-quantity');
        const quantityHint = document.getElementById('quantity-hint');
        
        if (movementType === 'ajuste') {
            movementQuantityInput.removeAttribute('min');
            movementQuantityInput.setAttribute('placeholder', 'Ej: 10 para aumentar, -5 para reducir');
            if (quantityHint) quantityHint.style.display = 'block';
        } else {
            movementQuantityInput.setAttribute('min', '1');
            movementQuantityInput.setAttribute('placeholder', '0');
            if (quantityHint) quantityHint.style.display = 'none';
        }
    });

    // Get products from Firestore
    async function getProducts() {
        try {
            const products = await getAllProducts();
            console.log('getProducts - loaded products:', products.length);
            return products;
        } catch (e) {
            console.error('Error getting products from Firestore:', e);
            return [];
        }
    }

    // Calculate current stock based on initial stock and movements
    async function calculateCurrentStock(productId) {
        const products = await getProducts();
        const product = products.find(p => p.id === productId);
        if (!product) return 0;

        let currentStock = product.initialStock || 0;
        const movements = await getAllMovements(); // Always get fresh movements

        // Calculate stock changes from movements
        movements.forEach(movement => {
            if (movement.productId === productId) {
                if (movement.type === 'venta') {
                    currentStock -= movement.quantity;
                } else if (movement.type === 'compra') {
                    currentStock += movement.quantity;
                } else if (movement.type === 'ajuste') {
                    // Ajuste: cantidad positiva aumenta, negativa reduce
                    currentStock += movement.quantity;
                }
            }
        });

        return Math.max(0, currentStock); // Ensure stock is never negative
    }

    // Note: We don't update product stock directly anymore
    // Stock is calculated dynamically from initialStock + movements

    // Product search with autocomplete
    productSearch.addEventListener('input', async (e) => {
        const query = e.target.value.toLowerCase().trim();
        console.log('Product search input:', query);
        
        if (query.length < 2) {
            productSuggestions.classList.remove('show');
            selectedProduct = null;
            selectedProductField.style.display = 'none';
            return;
        }

        const products = await getProducts();
        console.log('Products available for search:', products.length);
        
        if (products.length === 0) {
            console.warn('No products found in Firestore');
            productSuggestions.classList.remove('show');
            return;
        }

        const matches = products.filter(product => {
            const nameMatch = product.name && product.name.toLowerCase().includes(query);
            const codeMatch = product.code && product.code.toLowerCase().includes(query);
            return nameMatch || codeMatch;  
        }).slice(0, 5);

        console.log('Matches found:', matches.length);

        if (matches.length > 0) {
            const suggestionsHTML = await Promise.all(matches.map(async (product) => {
                const currentStock = await calculateCurrentStock(product.id);
                return `
                <div class="product-suggestion-item" data-product-id="${product.id}">
                    <div class="product-suggestion-thumb">
                        ${product.image ? `<img src="${product.image}" alt="${product.name}">` : ''}
                    </div>  
                    <div class="product-suggestion-info">
                        <div class="product-suggestion-name">${product.name || 'Sin nombre'}</div>
                        <div class="product-suggestion-code">Código: ${product.code || 'Sin código'}</div>
                        <div class="product-suggestion-stock">Stock: ${currentStock}</div>
                    </div>
                </div>
            `;
            }));
            
            productSuggestions.innerHTML = suggestionsHTML.join('');

            productSuggestions.classList.add('show');
            console.log('Suggestions shown');

            // Add click handlers
            productSuggestions.querySelectorAll('.product-suggestion-item').forEach(item => {
                item.addEventListener('click', async () => {
                    const productId = item.dataset.productId;
                    const product = products.find(p => p.id === productId);
                    if (product) {
                        await selectProduct(product);
                    }
                });
            });
        } else {
            console.log('No matches found');
            productSuggestions.classList.remove('show');
        }
    });

    // Select product
    async function selectProduct(product) {
        selectedProduct = product;
        productSearch.value = product.name;
        productSuggestions.classList.remove('show');

        // Calculate current stock
        const currentStock = await calculateCurrentStock(product.id);

        // Show selected product display
        selectedProductDisplay.innerHTML = `
            <div class="selected-product-thumb">
                ${product.image ? `<img src="${product.image}" alt="${product.name}">` : ''}
            </div>
            <div class="selected-product-info">
                <div class="selected-product-name">${product.name}</div>
                <div class="selected-product-code">Código: ${product.code}</div>
                <div class="selected-product-stock">Stock: ${currentStock}</div>
            </div>
        `;
        selectedProductField.style.display = 'block';

        // Set default price based on movement type
        const movementType = document.getElementById('movement-type').value;
        const priceInput = document.getElementById('movement-price');
        if (movementType === 'venta') {
            priceInput.value = product.salePrice || '';
        } else if (movementType === 'compra') {
            priceInput.value = product.purchasePrice || '';
        } else if (movementType === 'ajuste') {
            // For ajuste, use purchase price (costo) as default
            priceInput.value = product.purchasePrice || '';
        } else {
            // If no type selected yet, use sale price as default
            priceInput.value = product.salePrice || product.purchasePrice || '';
        }
    }

    // Update price and quantity field when type changes
    const movementTypeSelect = document.getElementById('movement-type');
    const movementQuantityInput = document.getElementById('movement-quantity');
    const quantityHint = document.getElementById('quantity-hint');
    
    movementTypeSelect.addEventListener('change', async (e) => {
        const movementType = e.target.value;
        
        if (selectedProduct) {
            const priceInput = document.getElementById('movement-price');
            if (movementType === 'venta') {
                priceInput.value = selectedProduct.salePrice || '';
            } else if (movementType === 'compra') {
                priceInput.value = selectedProduct.purchasePrice || '';
            } else if (movementType === 'ajuste') {
                // For ajuste, use purchase price (costo) as default
                priceInput.value = selectedProduct.purchasePrice || '';
            } else {
                // If no type selected yet, use sale price as default
                priceInput.value = selectedProduct.salePrice || selectedProduct.purchasePrice || '';
            }
            
            // Update stock display
            const currentStock = await calculateCurrentStock(selectedProduct.id);
            const stockElement = selectedProductDisplay.querySelector('.selected-product-stock');
            if (stockElement) {
                stockElement.textContent = `Stock: ${currentStock}`;
            }
        }
        
        // Update quantity field constraints for ajuste
        if (movementType === 'ajuste') {
            movementQuantityInput.removeAttribute('min');
            movementQuantityInput.setAttribute('placeholder', 'Ej: 10 para aumentar, -5 para reducir');
            if (quantityHint) quantityHint.style.display = 'block';
        } else {
            movementQuantityInput.setAttribute('min', '1');
            movementQuantityInput.setAttribute('placeholder', '0');
            if (quantityHint) quantityHint.style.display = 'none';
        }
    });

    // Close suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!productSearch.contains(e.target) && !productSuggestions.contains(e.target)) {
            productSuggestions.classList.remove('show');
        }
    });

    // Submit form
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = form.querySelector('button[type="submit"]');
        
        if (!selectedProduct) {
            alert('Por favor selecciona un producto');
            return;
        }

        const data = new FormData(form);
        const movementType = data.get('type');
        let quantity = Number(data.get('quantity') || 0);

        // Validate quantity
        if (movementType !== 'ajuste' && quantity <= 0) {
            alert('La cantidad debe ser mayor a 0');
            return;
        }

        if (movementType === 'ajuste' && quantity === 0) {
            alert('La cantidad de ajuste no puede ser 0');
            return;
        }

        // Validate stock for sales
        if (movementType === 'venta') {
            const currentStock = await calculateCurrentStock(selectedProduct.id);
            if (quantity > currentStock) {
                alert(`No hay stock suficiente. Stock disponible: ${currentStock}`);
                return;
            }
        }

        // For ajuste, validate that reducing stock doesn't go negative
        if (movementType === 'ajuste' && quantity < 0) {
            const currentStock = await calculateCurrentStock(selectedProduct.id);
            const absoluteQuantity = Math.abs(quantity);
            if (absoluteQuantity > currentStock) {
                alert(`No se puede reducir más stock del disponible. Stock disponible: ${currentStock}`);
                return;
            }
        }

        setButtonLoading(submitBtn, true);

        const dateInput = data.get('date');
        // Parse date in local timezone to avoid day shift issues
        const [year, month, day] = dateInput.split('-').map(Number);
        const now = new Date();
        const movementDate = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds());
        
        // Calculate total based on movement type
        const price = Number(data.get('price') || 0);
        let total;
        if (movementType === 'ajuste') {
            // For ajuste: positive quantity = positive total, negative quantity = negative total
            total = quantity * price;
        } else {
            // For venta and compra: always positive total
            total = Math.abs(quantity) * price;
        }
        
        const movement = {
            type: movementType,
            date: movementDate,
            productId: selectedProduct.id,
            productName: selectedProduct.name,
            productCode: selectedProduct.code,
            productImage: selectedProduct.image,
            quantity: quantity,
            price: price,
            total: total,
            notes: data.get('notes')?.toString().trim() || '',
        };

        try {
            await createMovement(movement);
            console.log('Movement saved to Firestore');
            setButtonLoading(submitBtn, false);

            // Dispatch custom event to notify other views (will clear their caches)
            window.dispatchEvent(new CustomEvent('movementsUpdated'));
        } catch (error) {
            console.error('Error saving movement:', error);
            setButtonLoading(submitBtn, false);
            alert('Error al guardar el movimiento. Por favor, intenta de nuevo.');
            return;
        }

        // Note: We don't update initialStock here because we calculate current stock
        // dynamically from initialStock + movements. This keeps the data consistent.
        // The initialStock should remain as the original stock when the product was created.
        
        renderMovements();
        form.reset();
        selectedProduct = null;
        selectedProductField.style.display = 'none';
        // Reset date to today in local timezone
        const todayDate = new Date();
        const todayStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;
        document.getElementById('movement-date').value = todayStr;
        
        // Close with transition
        const originElement = document.querySelector('[origin-element]');
        if (originElement) {
            const viewTransitionClassClosing = "vt-element-animation-closing";
            const dialog = document.querySelector('dialog[open]');
            
            if (dialog && originElement) {
                dialog.style.viewTransitionName = "vt-shared";
                dialog.style.viewTransitionClass = viewTransitionClassClosing;
                
                originElement.style.viewTransitionName = "vt-shared";
                originElement.style.viewTransitionClass = viewTransitionClassClosing;
                
                const viewTransition = document.startViewTransition(() => {
                    dialog.close();
                    originElement.style.viewTransitionName = "";
                    originElement.style.viewTransitionClass = "";
                    dialog.style.viewTransitionName = "";
                    dialog.style.viewTransitionClass = "";
                    document.body.style.overflow = "";
                });
                
                viewTransition.finished.then(() => {
                    originElement.removeAttribute('origin-element');
                });
            }
        } else {
            modal.close();
            document.body.style.overflow = "";
        }
    });

    // Initialize custom date range picker
    let dateRangePickerInstance = null;
    if (dateRangeFilter) {
        dateRangePickerInstance = new DateRangePicker(dateRangeFilter, {
            onRangeSelect: (startDate, endDate) => {
                // Normalize dates to YYYY-MM-DD format
                const formatDate = (date) => {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                };
                
                dateFromFilter.value = formatDate(startDate);
                dateToFilter.value = formatDate(endDate);
                renderMovements();
            },
            onClear: () => {
                dateFromFilter.value = '';
                dateToFilter.value = '';
                renderMovements();
            }
        });
    }

    // Filters
    typeFilter?.addEventListener('change', () => {
        renderMovements();
    });

    clearFiltersBtn?.addEventListener('click', () => {
        typeFilter.value = '';
        if (dateRangePickerInstance) {
            dateRangePickerInstance.clear();
        }
        dateFromFilter.value = '';
        dateToFilter.value = '';
        currentPage = 1; // Reset to first page
        renderMovements();
    });

    // Pagination controls
    movementsPrevBtn?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderMovements();
            // Scroll to top of movements list
            movementsList?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });

    movementsNextBtn?.addEventListener('click', () => {
        currentPage++;
        renderMovements();
        // Scroll to top of movements list
        movementsList?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // Global search state
    let globalSearchTerm = '';

    // Render movements
    async function renderMovements() {
        if (!movementsList) return;

        // Always get fresh movements from Firestore
        let movements = [];
        try {
            movements = await getAllMovements();
        } catch (error) {
            console.error('Error loading movements:', error);
        }

        const typeFilterValue = typeFilter?.value || '';
        const dateFromValue = dateFromFilter?.value || '';
        const dateToValue = dateToFilter?.value || '';

        let filteredMovements = movements.filter(movement => {
            const matchesType = !typeFilterValue || movement.type === typeFilterValue;
            
            let matchesDate = true;
            if (dateFromValue || dateToValue) {
                // Normalize movement date to YYYY-MM-DD format
                let movementDateObj;
                
                if (movement.date instanceof Date) {
                    movementDateObj = movement.date;
                } else if (movement.date && typeof movement.date.toDate === 'function') {
                    // Firestore Timestamp
                    movementDateObj = movement.date.toDate();
                } else if (typeof movement.date === 'string') {
                    movementDateObj = new Date(movement.date);
                } else {
                    movementDateObj = new Date();
                }
                
                // Format to YYYY-MM-DD for comparison
                const year = movementDateObj.getFullYear();
                const month = String(movementDateObj.getMonth() + 1).padStart(2, '0');
                const day = String(movementDateObj.getDate()).padStart(2, '0');
                const movementDateOnly = `${year}-${month}-${day}`;
                
                if (dateFromValue) {
                    matchesDate = matchesDate && movementDateOnly >= dateFromValue;
                }
                if (dateToValue) {
                    matchesDate = matchesDate && movementDateOnly <= dateToValue;
                }
            }

            // Global search filter
            let matchesSearch = true;
            if (globalSearchTerm) {
                const searchLower = globalSearchTerm.toLowerCase();
                matchesSearch = 
                    (movement.productName && movement.productName.toLowerCase().includes(searchLower)) ||
                    (movement.productCode && movement.productCode.toLowerCase().includes(searchLower)) ||
                    (movement.notes && movement.notes.toLowerCase().includes(searchLower));
            }

            return matchesType && matchesDate && matchesSearch;
        });

        // Sort by date - newest first
        filteredMovements.sort((a, b) => {
            let dateA, dateB;
            
            // Handle different date formats
            if (a.date instanceof Date) {
                dateA = a.date.getTime();
            } else if (a.date && a.date.toDate) {
                dateA = a.date.toDate().getTime();
            } else if (typeof a.date === 'string') {
                dateA = new Date(a.date).getTime();
            } else {
                dateA = 0;
            }
            
            if (b.date instanceof Date) {
                dateB = b.date.getTime();
            } else if (b.date && b.date.toDate) {
                dateB = b.date.toDate().getTime();
            } else if (typeof b.date === 'string') {
                dateB = new Date(b.date).getTime();
            } else {
                dateB = 0;
            }
            
            return dateB - dateA; // Descending order (newest first)
        });

        const totalItems = filteredMovements.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        
        // Reset to page 1 if current page is out of bounds
        if (currentPage > totalPages && totalPages > 0) {
            currentPage = 1;
        }

        if (filteredMovements.length === 0) {
            movementsList.innerHTML = `
                <div style="text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.5);">
                    <p>No hay movimientos registrados</p>
                </div>
            `;
            if (movementsPagination) movementsPagination.style.display = 'none';
            return;
        }

        // Pagination: get items for current page
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedMovements = filteredMovements.slice(startIndex, endIndex);

        // Update pagination controls
        if (movementsPagination && totalPages > 1) {
            movementsPagination.style.display = 'flex';
            movementsPagination.style.justifyContent = 'center';
            movementsPagination.style.alignItems = 'center';
            movementsPagination.style.gap = '10px';
            movementsPagination.style.marginTop = '20px';
            
            if (movementsPageInfo) {
                movementsPageInfo.textContent = `Página ${currentPage} de ${totalPages} (${totalItems} movimientos)`;
            }
            
            if (movementsPrevBtn) {
                movementsPrevBtn.disabled = currentPage === 1;
            }
            
            if (movementsNextBtn) {
                movementsNextBtn.disabled = currentPage === totalPages;
            }
        } else if (movementsPagination) {
            movementsPagination.style.display = 'none';
        }

        movementsList.innerHTML = paginatedMovements.map((movement, index) => {
            const typeLabels = {
                venta: 'Venta',
                compra: 'Compra',
                ajuste: 'Ajuste'
            };

            const typeIcons = {
                venta: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-package-export"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 21l-8 -4.5v-9l8 -4.5l8 4.5v4.5" /><path d="M12 12l8 -4.5" /><path d="M12 12v9" /><path d="M12 12l-8 -4.5" /><path d="M15 18h7" /><path d="M19 15l3 3l-3 3" /></svg>`,
                compra: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-package-import"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 21l-8 -4.5v-9l8 -4.5l8 4.5v4.5" /><path d="M12 12l8 -4.5" /><path d="M12 12v9" /><path d="M12 12l-8 -4.5" /><path d="M22 18h-7" /><path d="M18 15l-3 3l3 3" /></svg>`,
                ajuste: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-settings"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z" /><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /></svg>`
            };

            // Parse date safely to avoid timezone issues
            let movementDate;
            if (movement.date instanceof Date) {
                movementDate = movement.date;
            } else if (movement.date && movement.date.toDate) {
                // Firestore Timestamp
                movementDate = movement.date.toDate();
            } else if (typeof movement.date === 'string') {
                if (movement.date.includes('T')) {
                    // ISO format with time - parse manually to avoid UTC conversion
                    const dateTimeMatch = movement.date.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
                    if (dateTimeMatch) {
                        const [, year, month, day, hour, minute, second] = dateTimeMatch.map(Number);
                        movementDate = new Date(year, month - 1, day, hour, minute, second);
                    } else {
                        // Fallback to direct parsing
                        movementDate = new Date(movement.date);
                    }
                } else {
                    // Old format: just date (YYYY-MM-DD), parse in local timezone
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

            return `
                <div class="movement-item" style="animation-delay: ${index * 0.05}s;">
                    <div class="movement-info">
                        <div class="movement-details">
                            <div class="movement-product">${movement.productName}</div>
                            
                            <div class="movement-meta">
                                <span class="movement-type ${movement.type}">
                                    ${typeIcons[movement.type]}
                                    ${typeLabels[movement.type]}
                                </span>
                                <span>Código: ${movement.productCode}</span>
                                <span>Cantidad: ${movement.type === 'ajuste' ? (movement.quantity > 0 ? '+' : '') + movement.quantity : movement.quantity}</span>
                                <span>Precio: S/${movement.price.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                    <div class="movement-amount">
                        <div class="movement-total ${movement.type === 'ajuste' && movement.total < 0 ? 'negative' : ''}">
                            ${movement.type === 'ajuste' && movement.total < 0 ? '-' : ''}S/${Math.abs(movement.total).toFixed(2)}
                        </div>
                        <div class="movement-date">${formattedDate}</div>
                        <div class="movement-time">${formattedTime}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Subscribe to real-time updates
    unsubscribeMovements = subscribeToMovements((updatedMovements) => {
        renderMovements();
    });
    
    // Initial render
    renderMovements();

    // Global search functionality
    const globalSearchInput = document.getElementById('products-search');
    if (globalSearchInput) {
        // Debounce function for search
        function debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }

        // Check if we're in movements view
        const isMovementsView = () => {
            const path = window.location.pathname;
            const activeNav = document.querySelector('.nav-item.active, .mobile-nav-item.active');
            const activeView = activeNav?.getAttribute('data-view');
            
            return path === '/movements' || 
                   activeView === 'sales' || 
                   activeView === 'movements';
        };
        
        // Update placeholder based on current view
        const updateSearchPlaceholder = () => {
            if (isMovementsView()) {
                globalSearchInput.placeholder = 'Buscar';    
            }
        };
        
        // Update placeholder on init
        updateSearchPlaceholder();
        
        // Listen for route changes
        window.addEventListener('popstate', updateSearchPlaceholder);
        document.addEventListener('click', (e) => {
            const link = e.target.closest('[data-link]');
            if (link) {
                setTimeout(updateSearchPlaceholder, 100); // Small delay to let route change
            }
        });

        globalSearchInput.addEventListener('input', debounce((e) => {
            if (isMovementsView()) {
                globalSearchTerm = e.target.value.trim();
                currentPage = 1; // Reset to first page
                renderMovements();
            }
        }, 300));
    }

    // Listen for custom events (for same-tab updates)
    window.addEventListener('movementsUpdated', async () => {
        renderMovements();
        if (selectedProduct) {
            const currentStock = await calculateCurrentStock(selectedProduct.id);
            const stockElement = selectedProductDisplay.querySelector('.selected-product-stock');
            if (stockElement) {
                stockElement.textContent = `Stock: ${currentStock}`;
            }
        }
    });

    // TEMPORAL: Función para limpiar movimientos (solo para desarrollo/testing)
    // Usar desde la consola: clearAllMovements()
    window.clearAllMovements = async function() {
        if (confirm('¿Estás seguro de que quieres eliminar TODOS los movimientos? Esta acción no se puede deshacer.')) {
            try {
                await deleteAllMovements();
                renderMovements();
                console.log('✅ Todos los movimientos han sido eliminados');
                // Dispatch event to update other views
                window.dispatchEvent(new CustomEvent('movementsUpdated'));
            } catch (error) {
                console.error('Error deleting movements:', error);
                alert('Error al eliminar los movimientos');
            }
        }
    };
}
