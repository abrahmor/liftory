
// products.js - vista productos
import { getAllProducts, createProduct, updateProduct, deleteProduct, subscribeToProducts } from '/js/services/products.service.js';
import { getAllMovements, createMovement } from '/js/services/movements.service.js';
import { setButtonLoading } from '/js/utils/loader.js';

let products = []; // Initialize empty array
let currentEditId = null;
let unsubscribeProducts = null;

// Load products from Firestore
async function loadProducts() {
    try {
        products = await getAllProducts();
        console.log('Products loaded from Firestore:', products.length);
    } catch (e) {
        console.error('Error loading products from Firestore:', e);
        products = [];
    }
}

export async function init() {
    // Load products from Firestore first
    await loadProducts();
    
    // Bind UI elements first (needed for updateCategoryFilter)
    const openBtn = document.getElementById('btn-open-product-modal');
    const modal = document.getElementById('product-modal');
    const form = document.getElementById('product-form');
    const editForm = document.getElementById('edit-product-form');
    const productsList = document.getElementById('products-list');
    const searchInput = document.getElementById('products-search');
    const categoryFilter = document.getElementById('category-filter');
    const stockFilter = document.getElementById('stock-filter');
    const productsPagination = document.getElementById('products-pagination');
    const productsPrevBtn = document.getElementById('products-prev-btn');
    const productsNextBtn = document.getElementById('products-next-btn');
    const productsPageInfo = document.getElementById('products-page-info');
    
    // Pagination state
    let currentProductsPage = 1;
    const productsPerPage = 24; // Good for grid layout (6x4 or 4x6)
    
    // Stock calculation cache
    const stockCache = new Map();
    let movementsCache = null;
    let movementsCacheTime = 0;
    const CACHE_DURATION = 1000; // 1 second cache

    // Function to update category filter with unique categories from products
    function updateCategoryFilter() {
        if (!categoryFilter) return;
        
        // Get unique categories from products
        const categories = new Set();
        products.forEach(product => {
            if (product.category && product.category.trim()) {
                categories.add(product.category.trim());
            }
        });
        
        // Sort categories alphabetically
        const sortedCategories = Array.from(categories).sort();
        
        // Get current selected value
        const currentValue = categoryFilter.value;
        
        // Clear existing options except the first one
        categoryFilter.innerHTML = '<option value="">Categorías</option>';
        
        // Add category options
        sortedCategories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categoryFilter.appendChild(option);
        });
        
        // Restore selected value if it still exists
        if (currentValue && sortedCategories.includes(currentValue)) {
            categoryFilter.value = currentValue;
        }
    }

    // Update category filter with existing categories (after categoryFilter is declared)
    updateCategoryFilter();
    
    // Subscribe to real-time updates
    unsubscribeProducts = subscribeToProducts((updatedProducts) => {
        products = updatedProducts;
        updateCategoryFilter(); // Update categories when products change
        renderProducts();
    });

    if (!openBtn) {
        console.error('Button btn-open-product-modal not found');
        return;
    }
    
    if (!modal) {
        console.error('Modal product-modal not found');
        return;
    }
    
    if (!form) {
        console.error('Form product-form not found');
        return;
    }

    // Open modal
    openBtn.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Set origin element for transition
        this.setAttribute('origin-element', '');
        
        // Try to use toggleDialog if available, otherwise open directly
        if (window.toggleDialog && typeof window.toggleDialog === 'function') {
            try {
                // Store the button as currentTarget in a way toggleDialog can access
                const button = this;
                const originalEvent = window.event;
                
                // Create a synthetic event object
                window.event = {
                    currentTarget: button
                };
                
                window.toggleDialog('product-modal');
                
                // Restore original event if it existed
                if (originalEvent) {
                    window.event = originalEvent;
                } else {
                    delete window.event;
                }
            } catch (error) {
                console.error('Error calling toggleDialog:', error);
                // Fallback: open modal directly
                modal.showModal();
                document.body.style.overflow = "hidden";
            }
        } else {
            // Open modal directly
            modal.showModal();
            document.body.style.overflow = "hidden";
        }
    });

    // Submit form - add new product
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('Form submitted');
        
        const submitBtn = form.querySelector('button[type="submit"]');
        setButtonLoading(submitBtn, true);
        
        const data = new FormData(form);
        const product = {
            name: data.get('name')?.toString().trim() || '',
            code: data.get('code')?.toString().trim() || '',
            category: data.get('category')?.toString().trim() || '',
            purchasePrice: Number(data.get('purchasePrice')) || 0,
            salePrice: Number(data.get('salePrice')) || 0,
            initialStock: Number(data.get('initialStock')) || 0,
            minStock: Number(data.get('minStock')) || 0,
            image: data.get('image')?.toString().trim() || '',
        };
        
        // Validate numeric values
        if (isNaN(product.purchasePrice)) product.purchasePrice = 0;
        if (isNaN(product.salePrice)) product.salePrice = 0;
        if (isNaN(product.initialStock)) product.initialStock = 0;
        if (isNaN(product.minStock)) product.minStock = 0;

        console.log('Product created:', product);
        
        try {
            await createProduct(product);
            console.log('Product saved to Firestore');
            form.reset();
            setButtonLoading(submitBtn, false);
            // Update category filter after creating product
            updateCategoryFilter();
        } catch (error) {
            console.error('Error saving product:', error);
            setButtonLoading(submitBtn, false);
            alert('Error al guardar el producto. Por favor, intenta de nuevo.');
            return;
        }
        
        // Close with transition
        const originElement = document.querySelector('[origin-element]');
        if (originElement && window.toggleDialog) {
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
            const dialog = document.querySelector('dialog[open]');
            if (dialog) {
                dialog.close();
                document.body.style.overflow = "";
            }
        }
    });

    // Edit form submit
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = editForm.querySelector('button[type="submit"]');
        setButtonLoading(submitBtn, true);
        
        const data = new FormData(editForm);
        const oldProduct = products.find(p => p.id === currentEditId);
        const newInitialStock = Number(data.get('initialStock') || 0);
        
        const updatedProduct = {
            name: data.get('name')?.toString().trim() || '',
            code: data.get('code')?.toString().trim() || '',
            category: data.get('category')?.toString().trim() || '',
            purchasePrice: Number(data.get('purchasePrice') || 0),
            salePrice: Number(data.get('salePrice') || 0),
            minStock: Number(data.get('minStock') || 0),
            image: data.get('image')?.toString().trim() || '',
        };

        if (oldProduct) {
            try {
                // Calculate current stock before the change
                let movements = [];
                try {
                    movements = await getAllMovements();
                } catch (e) {
                    console.error('Error loading movements:', e);
                }

                let currentStockBefore = Number(oldProduct.initialStock) || 0;
                movements.forEach(movement => {
                    if (movement.productId === oldProduct.id) {
                        if (movement.type === 'venta') {
                            currentStockBefore -= movement.quantity;
                        } else if (movement.type === 'compra') {
                            currentStockBefore += movement.quantity;
                        } else if (movement.type === 'ajuste') {
                            currentStockBefore += movement.quantity;
                        }
                    }
                });
                currentStockBefore = Math.max(0, currentStockBefore);

                // The user edited the stock, so we need to create an ajuste to make it match
                const difference = newInitialStock - currentStockBefore;
                if (difference !== 0) {
                    // Use purchase price (costo) for automatic ajuste
                    const ajustePrice = oldProduct.purchasePrice || 0;
                    const ajusteTotal = difference * ajustePrice; // Can be positive or negative
                    
                    const ajusteMovement = {
                        type: 'ajuste',
                        date: new Date(),
                        productId: oldProduct.id,
                        productName: oldProduct.name,
                        productCode: oldProduct.code,
                        productImage: oldProduct.image,
                        quantity: difference, // Positive to increase, negative to reduce
                        price: ajustePrice,
                        total: ajusteTotal,
                        notes: 'Ajuste automático por edición de stock',
                    };
                    await createMovement(ajusteMovement);
                    
                    // Clear caches
                    movementsCache = null;
                    stockCache.clear();
                    
                    // Dispatch custom event to notify movements view
                    window.dispatchEvent(new CustomEvent('movementsUpdated'));
                }

                // IMPORTANT: Keep the original initialStock, don't change it
                // The initialStock should remain as the original stock when product was created
                updatedProduct.initialStock = oldProduct.initialStock;
                await updateProduct(currentEditId, updatedProduct);
                console.log('Product updated in Firestore');
                // Update category filter after updating product
                updateCategoryFilter();
            } catch (error) {
                console.error('Error updating product:', error);
                alert('Error al actualizar el producto. Por favor, intenta de nuevo.');
            }
        }

        editForm.reset();
        currentEditId = null;

        // Close with transition - find the origin element
        const originElement = document.querySelector('[origin-element]');
        if (originElement) {
            // Create a fake event with the origin element for closing transition
            const fakeEvent = { currentTarget: originElement };

            // Temporarily override toggleDialog to use our origin element
            const originalToggleDialog = window.toggleDialog;
            window.toggleDialog = function (dialogId) {
                if (!dialogId) {
                    // Handle closing with our origin element
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
                    return originalToggleDialog.call(this, dialogId);
                }
            };

            window.toggleDialog();

            // Restore original function
            window.toggleDialog = originalToggleDialog;
        } else {
            // Fallback to direct close
            const editModal = document.getElementById('edit-product-modal');
            if (editModal && editModal.open) {
                editModal.close();
                document.body.style.overflow = "";
            }
        }
    });

    // Delete confirmation
    document.getElementById('btn-confirm-delete')?.addEventListener('click', async () => {
        if (currentEditId) {
            const deleteBtn = document.getElementById('btn-confirm-delete');
            setButtonLoading(deleteBtn, true);
            
            try {
                await deleteProduct(currentEditId);
                console.log('Product deleted from Firestore');
                currentEditId = null;
                setButtonLoading(deleteBtn, false);
                // Update category filter after deleting product
                updateCategoryFilter();
            } catch (error) {
                console.error('Error deleting product:', error);
                setButtonLoading(deleteBtn, false);
                alert('Error al eliminar el producto. Por favor, intenta de nuevo.');
            }
        }

        // Close with transition - find the origin element
        const originElement = document.querySelector('[origin-element]');
        if (originElement) {
            // Create a fake event with the origin element for closing transition
            const fakeEvent = { currentTarget: originElement };

            // Temporarily override toggleDialog to use our origin element
            const originalToggleDialog = window.toggleDialog;
            window.toggleDialog = function (dialogId) {
                if (!dialogId) {
                    // Handle closing with our origin element
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
                    return originalToggleDialog.call(this, dialogId);
                }
            };

            window.toggleDialog();

            // Restore original function
            window.toggleDialog = originalToggleDialog;
        } else {
            // Fallback to direct close
            const deleteModal = document.getElementById('delete-product-modal');
            if (deleteModal && deleteModal.open) {
                deleteModal.close();
                document.body.style.overflow = "";
            }
        }
    });

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

    // Search functionality with debouncing
    searchInput?.addEventListener('input', debounce(() => {
        currentProductsPage = 1; // Reset to first page
        renderProducts();
    }, 300));

    // Filter functionality
    categoryFilter?.addEventListener('change', () => {
        currentProductsPage = 1; // Reset to first page
        renderProducts();
    });

    stockFilter?.addEventListener('change', () => {
        currentProductsPage = 1; // Reset to first page
        renderProducts();
    });

    // Pagination controls
    productsPrevBtn?.addEventListener('click', () => {
        if (currentProductsPage > 1) {
            currentProductsPage--;
            renderProducts();
            // Scroll to top of products list
            productsList?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });

    productsNextBtn?.addEventListener('click', () => {
        currentProductsPage++;
        renderProducts();
        // Scroll to top of products list
        productsList?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // Delegate edit/delete clicks
    productsList?.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.action-btn.edit');
        const deleteBtn = e.target.closest('.action-btn.delete');

        if (editBtn) {
            e.preventDefault();
            e.stopPropagation();

            const card = editBtn.closest('.product-card');
            const productId = card.dataset.productId;
            const product = products.find(p => p.id === productId);

            if (product) {
                currentEditId = productId;
                await populateEditForm(product);

                // Set origin element and call toggleDialog directly
                editBtn.setAttribute('origin-element', '');

                // Temporarily store the original toggleDialog
                const originalToggleDialog = window.toggleDialog;

                // Override toggleDialog to use our button as origin
                window.toggleDialog = function (dialogId) {
                    if (!dialogId) {
                        // Handle closing - use original function
                        return originalToggleDialog.call(this);
                    }

                    const viewTransitionClass = "vt-element-animation";
                    const dialog = document.getElementById(dialogId);
                    const originElement = editBtn; // Use the edit button directly

                    dialog.style.viewTransitionName = "vt-shared";
                    dialog.style.viewTransitionClass = viewTransitionClass;

                    originElement.style.viewTransitionName = "vt-shared";
                    originElement.style.viewTransitionClass = viewTransitionClass;
                    originElement.setAttribute("origin-element", "");

                    const viewTransition = document.startViewTransition(() => {
                        originElement.style.viewTransitionName = "";
                        originElement.style.viewTransitionClass = "";
                        dialog.showModal();
                    });

                    viewTransition.finished.then(() => {
                        dialog.style.viewTransitionName = "";
                        dialog.style.viewTransitionClass = "";
                        document.body.style.overflow = "hidden";
                    });
                };

                window.toggleDialog('edit-product-modal');

                // Restore original toggleDialog
                window.toggleDialog = originalToggleDialog;
            }
        }

        if (deleteBtn) {
            e.preventDefault();
            e.stopPropagation();

            const card = deleteBtn.closest('.product-card');
            const productId = card.dataset.productId;
            const product = products.find(p => p.id === productId);

            if (product) {
                currentEditId = productId;
                populateDeletePreview(product);

                // Set origin element and call toggleDialog directly
                deleteBtn.setAttribute('origin-element', '');

                // Temporarily store the original toggleDialog
                const originalToggleDialog = window.toggleDialog;

                // Override toggleDialog to use our button as origin
                window.toggleDialog = function (dialogId) {
                    if (!dialogId) {
                        // Handle closing - use original function
                        return originalToggleDialog.call(this);
                    }

                    const viewTransitionClass = "vt-element-animation";
                    const dialog = document.getElementById(dialogId);
                    const originElement = deleteBtn; // Use the delete button directly

                    dialog.style.viewTransitionName = "vt-shared";
                    dialog.style.viewTransitionClass = viewTransitionClass;

                    originElement.style.viewTransitionName = "vt-shared";
                    originElement.style.viewTransitionClass = viewTransitionClass;
                    originElement.setAttribute("origin-element", "");

                    const viewTransition = document.startViewTransition(() => {
                        originElement.style.viewTransitionName = "";
                        originElement.style.viewTransitionClass = "";
                        dialog.showModal();
                    });

                    viewTransition.finished.then(() => {
                        dialog.style.viewTransitionName = "";
                        dialog.style.viewTransitionClass = "";
                        document.body.style.overflow = "hidden";
                    });
                };

                window.toggleDialog('delete-product-modal');

                // Restore original toggleDialog
                window.toggleDialog = originalToggleDialog;
            }
        }
    });

    async function populateEditForm(product) {
        document.getElementById('edit-name').value = product.name;
        document.getElementById('edit-code').value = product.code;
        document.getElementById('edit-category').value = product.category;
        document.getElementById('edit-purchasePrice').value = product.purchasePrice;
        document.getElementById('edit-salePrice').value = product.salePrice;
        // Get movements to calculate current stock to show in edit form
        let movements = [];
        try {
            movements = await getAllMovements();
        } catch (e) {
            console.error('Error loading movements:', e);
        }

        // Calculate current stock to show in edit form
        let currentStock = Number(product.initialStock) || 0;
        movements.forEach(movement => {
            if (movement.productId === product.id) {
                if (movement.type === 'venta') {
                    currentStock -= movement.quantity;
                } else if (movement.type === 'compra') {
                    currentStock += movement.quantity;
                } else if (movement.type === 'ajuste') {
                    currentStock += movement.quantity;
                }
            }
        });
        currentStock = Math.max(0, currentStock);

        document.getElementById('edit-initialStock').value = currentStock; // Show current stock, not initialStock
        document.getElementById('edit-minStock').value = product.minStock;
        document.getElementById('edit-image').value = product.image;
    }

    function populateDeletePreview(product) {
        const preview = document.getElementById('delete-product-preview');
        preview.innerHTML = `
      <div style="display: flex; gap: 12px; align-items: center;">
        <div style="width: 40px; height: 40px; border-radius: 8px; overflow: hidden; background: rgba(255,255,255,.06);">
          ${product.image ? `<img src="${product.image}" alt="${product.name}" style="width: 100%; height: 100%; object-fit: cover;">` : ''}
        </div>
        <div>
          <div style="color: #fff; font-weight: 600;">${product.name}</div>
          <div style="color: rgba(255,255,255,.65); font-size: .8rem;">${product.code} • ${product.category}</div>
        </div>
      </div>
    `;
    }

    async function renderProducts() {
        console.log('renderProducts called, products count:', products.length);
        
        if (!productsList) {
            console.error('productsList not found');
            return;
        }

        // Get movements with cache optimization
        const now = Date.now();
        if (!movementsCache || (now - movementsCacheTime) > CACHE_DURATION) {
            try {
                movementsCache = await getAllMovements();
                movementsCacheTime = now;
            } catch (e) {
                console.error('Error loading movements:', e);
                movementsCache = [];
            }
        }
        const movements = movementsCache || [];

        const searchTerm = searchInput?.value.toLowerCase() || '';
        const categoryFilterValue = categoryFilter?.value || '';
        const stockFilterValue = stockFilter?.value || '';

        // Helper function to calculate current stock with cache
        function getCurrentStock(product) {
            // Check cache first
            if (stockCache.has(product.id)) {
                return stockCache.get(product.id);
            }
            
            let currentStock = Number(product.initialStock) || 0;
            movements.forEach(movement => {
                if (movement.productId === product.id) {
                    if (movement.type === 'venta') {
                        currentStock -= movement.quantity;
                    } else if (movement.type === 'compra') {
                        currentStock += movement.quantity;
                    } else if (movement.type === 'ajuste') {
                        currentStock += movement.quantity;
                    }
                }
            });
            currentStock = Math.max(0, currentStock);
            
            // Cache the result
            stockCache.set(product.id, currentStock);
            return currentStock;
        }
        
        // Clear cache when movements might have changed
        stockCache.clear();

        let filteredProducts = products.filter(product => {
            const matchesSearch = product.name.toLowerCase().includes(searchTerm) ||
                product.code.toLowerCase().includes(searchTerm) ||
                product.category.toLowerCase().includes(searchTerm);

            const matchesCategory = !categoryFilterValue || product.category === categoryFilterValue;

            let matchesStock = true;
            if (stockFilterValue !== '') {
                const currentStock = getCurrentStock(product);
                if (stockFilterValue === 'low') {
                    matchesStock = currentStock <= product.minStock;
                } else if (stockFilterValue === 'out') {
                    matchesStock = currentStock === 0;
                } else if (stockFilterValue === 'normal') {
                    matchesStock = currentStock > product.minStock;
                }
            }

            return matchesSearch && matchesCategory && matchesStock;
        });

        // Sort by creation date (newest first)
        filteredProducts.sort((a, b) => {
            // Handle Firestore Timestamp objects
            const getTimestamp = (product) => {
                if (product.createdAt) {
                    // If it's a Firestore Timestamp, convert to Date
                    if (product.createdAt.toDate) {
                        return product.createdAt.toDate().getTime();
                    }
                    // If it's already a Date
                    if (product.createdAt instanceof Date) {
                        return product.createdAt.getTime();
                    }
                    // If it's a number (timestamp)
                    if (typeof product.createdAt === 'number') {
                        return product.createdAt;
                    }
                }
                // Fallback: use updatedAt if createdAt doesn't exist
                if (product.updatedAt) {
                    if (product.updatedAt.toDate) {
                        return product.updatedAt.toDate().getTime();
                    }
                    if (product.updatedAt instanceof Date) {
                        return product.updatedAt.getTime();
                    }
                    if (typeof product.updatedAt === 'number') {
                        return product.updatedAt;
                    }
                }
                // Last resort: use ID as timestamp (if it's a timestamp-based ID)
                return Number(product.id) || 0;
            };
            
            const timeA = getTimestamp(a);
            const timeB = getTimestamp(b);
            return timeB - timeA; // Descending order (newest first)
        });

        console.log('Filtered products count:', filteredProducts.length);
        
        const totalItems = filteredProducts.length;
        const totalPages = Math.ceil(totalItems / productsPerPage);
        
        // Reset to page 1 if current page is out of bounds
        if (currentProductsPage > totalPages && totalPages > 0) {
            currentProductsPage = 1;
        }
        
        if (filteredProducts.length === 0) {
            productsList.innerHTML = `
                <div style="text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.5);">
                    <p>No hay productos registrados</p>
                </div>
            `;
            if (productsPagination) productsPagination.style.display = 'none';
            return;
        }

        // Pagination: get items for current page
        const startIndex = (currentProductsPage - 1) * productsPerPage;
        const endIndex = startIndex + productsPerPage;
        const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

        // Update pagination controls
        if (productsPagination && totalPages > 1) {
            productsPagination.style.display = 'flex';
            productsPagination.style.justifyContent = 'center';
            productsPagination.style.alignItems = 'center';
            productsPagination.style.gap = '10px';
            productsPagination.style.marginTop = '20px';
            
            if (productsPageInfo) {
                productsPageInfo.textContent = `Página ${currentProductsPage} de ${totalPages} (${totalItems} productos)`;
            }
            
            if (productsPrevBtn) {
                productsPrevBtn.disabled = currentProductsPage === 1;
            }
            
            if (productsNextBtn) {
                productsNextBtn.disabled = currentProductsPage === totalPages;
            }
        } else if (productsPagination) {
            productsPagination.style.display = 'none';
        }

        productsList.innerHTML = paginatedProducts.map((product, index) => {
            // Ensure all numeric values have defaults
            const purchasePrice = Number(product.purchasePrice) || 0;
            const salePrice = Number(product.salePrice) || 0;
            const currentStock = getCurrentStock(product); // Uses optimized cache
            const minStock = Number(product.minStock) || 0;
            
            return `
      <div class="product-card" data-product-id="${product.id}" style="animation-delay: ${index * 0.05}s;">
        <div class="product-thumb">
          ${product.image ? `<img src="${product.image}" alt="${product.name}">` : ''}
        </div>
        <div class="product-info">
          <div class="product-title">${product.name || 'Sin nombre'}</div>
          <div class="product-meta">${product.code || 'Sin código'} • ${product.category || 'Sin categoría'}</div>
          <div class="product-meta">Compra: S/${purchasePrice.toFixed(2)} • Venta: S/${salePrice.toFixed(2)}</div>
          <div class="product-meta">Stock: ${currentStock} (min ${minStock})</div>
        </div>
        <div class="product-actions">
          <button class="action-btn edit"><i class="ti ti-edit"></i></button>
          <button class="action-btn delete"><i class="ti ti-trash"></i></button>
        </div>
      </div>
    `;
        }).join('');
    
    console.log('Products rendered successfully');
    }
    
    // Scanner icon in add product modal
    const addModalScanIcon = document.querySelector('#product-modal .modal-scan-icon');
    const addCodeInput = document.getElementById('code');
    
    if (addModalScanIcon && addCodeInput) {
        addModalScanIcon.addEventListener('click', () => {
            if (window.openScanner) {
                window.openScanner(addCodeInput);
            }
        });
    }
    
    // Scanner icon in edit product modal
    const editModalScanIcon = document.querySelector('#edit-product-modal .modal-scan-icon');
    const editCodeInput = document.getElementById('edit-code');
    
    if (editModalScanIcon && editCodeInput) {
        editModalScanIcon.addEventListener('click', () => {
            if (window.openScanner) {
                window.openScanner(editCodeInput);
            }
        });
    }
    
    // Listen for movements updates to clear cache
    window.addEventListener('movementsUpdated', () => {
        movementsCache = null;
        stockCache.clear();
        currentProductsPage = 1; // Reset to first page
        renderProducts();
    });

    // Initial render - call after all functions are defined
    renderProducts();
}
