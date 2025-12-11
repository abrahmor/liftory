# Liftory 

## Descripción

Liftory es una plataforma para la gestión de inventarios diseñada para pequeños negocios. Permite llevar el control total de productos, registrar ventas y gastos, y visualizar el rendimiento del negocio mediante gráficos y reportes en tiempo real.

## Características Principales

-   **Dashboard Inteligente**: Vista general del estado del negocio (ventas, stock bajo, balance).
-   **Gestión de Inventario**: CRUD completo de productos con imágenes, códigos y categorías.
-   **Control de Movimientos**: Registro de entradas (compras), salidas (ventas) y ajustes de stock.
-   **Finanzas**: Balance de ingresos vs. gastos, cálculo de ganancia neta.
-   **Reportes**: Exportación y visualización de datos clave.
-   **Escáner de Códigos**: Integración con cámara para escanear productos.
-   **Autenticación**: Login seguro con Correo/Contraseña y Google (Firebase Auth).

## Tecnologías

Este proyecto está construido con tecnologías web estándar para máxima compatibilidad y rendimiento:

-   **Frontend**: HTML5, CSS3 (Variables, Flexbox/Grid), JavaScript (ES6+ Modules).
-   **Backend / BaaS**: Firebase (Authentication, Firestore Database).
-   **Gráficos**: Chart.js.
-   **Scanner**: Barcode Detection API con fallback zxing-js.

## Estructura del Proyecto

```
liftory/
├── index.html          # Landing Page (Página de inicio)
├── app.html            # Aplicación Principal (Dashboard)
├── css/                # Estilos (Modularizados por vista)
├── js/
│   ├── services/       # Lógica de conexión a Firebase (Productos, Movimientos, etc.)
│   ├── views/          # Controladores de vistas (Dashboard, Finance, etc.)
│   ├── router.js       # Enrutador de la SPA
│   ├── auth.js         # Manejo de sesión
│   └── firebase-config.js
├── assets/             # Imágenes e iconos
└── vercel.json         # Configuración de despliegue
```

