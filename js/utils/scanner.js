// scanner.js - Scanner de códigos QR y códigos de barras
let html5QrCode = null;
let scannerActive = false;
let targetInput = null;
let flashlightEnabled = false;

// Initialize scanner
function initScanner() {
    const scannerModal = document.getElementById('scanner-modal');
    const scannerContainer = document.getElementById('scanner-container');
    const closeBtn = document.getElementById('scanner-close-btn');
    const flashlightBtn = document.getElementById('scanner-flashlight-btn');
    const fileInput = document.getElementById('scanner-file-input');

    if (!scannerModal || !scannerContainer) {
        console.error('Scanner elements not found');
        return;
    }

    // Close scanner
    closeBtn?.addEventListener('click', () => {
        stopScanner();
        scannerModal.close();
        document.body.style.overflow = "";
        targetInput = null;
    });

    // Close on backdrop click
    scannerModal.addEventListener('click', (e) => {
        if (e.target === scannerModal) {
            stopScanner();
            scannerModal.close();
            document.body.style.overflow = "";
            targetInput = null;
        }
    });
    
    // Close on escape key
    scannerModal.addEventListener('close', () => {
        stopScanner();
        document.body.style.overflow = "";
        targetInput = null;
    });

    // Flashlight toggle
    flashlightBtn?.addEventListener('click', async () => {
        if (!scannerActive || !html5QrCode) return;
        
        try {
            if (flashlightEnabled) {
                await html5QrCode.turnOffFlashlight();
                flashlightEnabled = false;
                flashlightBtn.classList.remove('active');
            } else {
                await html5QrCode.turnOnFlashlight();
                flashlightEnabled = true;
                flashlightBtn.classList.add('active');
            }
        } catch (error) {
            console.warn('Flashlight not available:', error);
            flashlightBtn.style.display = 'none';
        }
    });

    // File upload
    fileInput?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const result = await html5QrCode.scanFile(file, true);
            handleScanResult(result);
        } catch (error) {
            console.error('Error scanning file:', error);
            alert('No se pudo leer el código de la imagen');
        } finally {
            fileInput.value = '';
        }
    });
}

// Open scanner for specific input
window.openScanner = function(inputElement) {
    const scannerModal = document.getElementById('scanner-modal');
    if (!scannerModal) {
        console.error('Scanner modal not found');
        return;
    }

    if (!inputElement) {
        console.error('Input element not provided');
        return;
    }

    targetInput = inputElement;
    scannerModal.showModal();
    document.body.style.overflow = "hidden";
    
    // Clear container
    const scannerContainer = document.getElementById('scanner-container');
    if (scannerContainer) {
        scannerContainer.innerHTML = '';
    }
    
    // Start scanner after modal is shown
    setTimeout(() => {
        startScanner();
    }, 300);
};

// Start scanner
async function startScanner() {
    const scannerContainer = document.getElementById('scanner-container');
    if (!scannerContainer || scannerActive) return;

    try {
        html5QrCode = new Html5Qrcode("scanner-container");
        
        const config = {
            fps: 10,
            qrbox: function(viewfinderWidth, viewfinderHeight) {
                // Make qrbox responsive - 70% of smallest dimension
                const minEdgePercentage = 0.7;
                const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
                const qrboxSize = Math.floor(minEdgeSize * minEdgePercentage);
                return {
                    width: qrboxSize,
                    height: qrboxSize
                };
            },
            aspectRatio: 1.0,
            disableFlip: false,
            // Support both QR codes and barcodes
            formatsToSupport: [
                Html5QrcodeSupportedFormats.QR_CODE,
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39,
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E
            ]
        };

        // Try to get camera
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
            // Prefer back camera (environment) on mobile
            let cameraId = null;
            for (const device of devices) {
                if (device.label.toLowerCase().includes('back') || 
                    device.label.toLowerCase().includes('rear') ||
                    device.label.toLowerCase().includes('environment')) {
                    cameraId = device.id;
                    break;
                }
            }
            
            // If no back camera found, use first available
            if (!cameraId) {
                cameraId = devices[0].id;
            }
            
            await html5QrCode.start(
                cameraId || { facingMode: "environment" },
                config,
                (decodedText, decodedResult) => {
                    handleScanResult(decodedText);
                },
                (errorMessage) => {
                    // Ignore scanning errors
                }
            );
            scannerActive = true;
        } else {
            throw new Error('No camera found');
        }
    } catch (error) {
        console.error('Error starting scanner:', error);
        scannerContainer.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: rgba(255, 255, 255, 0.7); padding: 70px; text-align: center;">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 16px; opacity: 0.5;">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                </svg>
                <p style="margin-bottom: 16px;">No se pudo acceder a la cámara</p>
                <p style="font-size: 0.9rem; opacity: 0.7;">Por favor, permite el acceso a la cámara en la configuración de tu navegador</p>
            </div>
        `;
    }
}

// Stop scanner
async function stopScanner() {
    if (!scannerActive && !html5QrCode) return;

    try {
        if (html5QrCode) {
            await html5QrCode.stop().catch(err => {
                console.warn('Error stopping scanner:', err);
            });
            await html5QrCode.clear();
        }
        
        html5QrCode = null;
        scannerActive = false;
        flashlightEnabled = false;
        
        const flashlightBtn = document.getElementById('scanner-flashlight-btn');
        if (flashlightBtn) {
            flashlightBtn.classList.remove('active');
        }
        
        const scannerContainer = document.getElementById('scanner-container');
        if (scannerContainer) {
            scannerContainer.innerHTML = '';
        }
    } catch (error) {
        console.error('Error stopping scanner:', error);
        html5QrCode = null;
        scannerActive = false;
    }
}

// Handle scan result
function handleScanResult(result) {
    if (!targetInput) return;

    console.log('Scan result:', result);
    
    // Fill input with scanned code
    targetInput.value = result;
    
    // Trigger input event for autocomplete/search
    targetInput.dispatchEvent(new Event('input', { bubbles: true }));
    targetInput.dispatchEvent(new Event('change', { bubbles: true }));
    
    // Close scanner
    stopScanner();
    const scannerModal = document.getElementById('scanner-modal');
    if (scannerModal) {
        scannerModal.close();
        document.body.style.overflow = "";
    }
    
    targetInput = null;
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScanner);
} else {
    initScanner();
}

