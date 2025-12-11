// products.service.js - Servicio de productos con Firestore
import { getFirestore, initFirebase } from '/js/firebase-config.js';
import { getCurrentUser } from '/js/auth.js';

// Asegurar que Firebase esté inicializado
initFirebase();

/**
 * Obtener la colección de productos del usuario actual
 */
function getProductsCollection() {
  const db = getFirestore();
  const user = getCurrentUser();
  
  if (!db || !user) {
    throw new Error('Firestore no está disponible o el usuario no está autenticado');
  }
  
  return db.collection('users').doc(user.uid).collection('products');
}

/**
 * Obtener todos los productos del usuario
 */
export async function getAllProducts() {
  try {
    const productsCollection = getProductsCollection();
    const snapshot = await productsCollection.get();
    
    const products = [];
    snapshot.forEach(doc => {
      products.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return products;
  } catch (error) {
    console.error('Error al obtener productos:', error);
    throw error;
  }
}

/**
 * Obtener un producto por ID
 */
export async function getProductById(productId) {
  try {
    const productsCollection = getProductsCollection();
    const doc = await productsCollection.doc(productId).get();
    
    if (!doc.exists) {
      return null;
    }
    
    return {
      id: doc.id,
      ...doc.data()
    };
  } catch (error) {
    console.error('Error al obtener producto:', error);
    throw error;
  }
}

/**
 * Crear un nuevo producto
 */
export async function createProduct(productData) {
  try {
    const productsCollection = getProductsCollection();
    
    // Agregar timestamp
    const productWithTimestamp = {
      ...productData,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await productsCollection.add(productWithTimestamp);
    
    return {
      id: docRef.id,
      ...productData
    };
  } catch (error) {
    console.error('Error al crear producto:', error);
    throw error;
  }
}

/**
 * Actualizar un producto existente
 */
export async function updateProduct(productId, productData) {
  try {
    const productsCollection = getProductsCollection();
    
    // Agregar timestamp de actualización
    const updateData = {
      ...productData,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    await productsCollection.doc(productId).update(updateData);
    
    return {
      id: productId,
      ...productData
    };
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    throw error;
  }
}

/**
 * Eliminar un producto
 */
export async function deleteProduct(productId) {
  try {
    const productsCollection = getProductsCollection();
    await productsCollection.doc(productId).delete();
    return true;
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    throw error;
  }
}

/**
 * Suscribirse a cambios en tiempo real de productos
 */
export function subscribeToProducts(callback) {
  try {
    const productsCollection = getProductsCollection();
    
    return productsCollection.onSnapshot((snapshot) => {
      const products = [];
      snapshot.forEach(doc => {
        products.push({
          id: doc.id,
          ...doc.data()
        });
      });
      callback(products);
    }, (error) => {
      console.error('Error en suscripción de productos:', error);
      callback([]);
    });
  } catch (error) {
    console.error('Error al suscribirse a productos:', error);
    callback([]);
  }
}
