// movements.service.js - Servicio de movimientos con Firestore
import { getFirestore, initFirebase } from '/js/firebase-config.js';
import { getCurrentUser } from '/js/auth.js';

// Asegurar que Firebase esté inicializado
initFirebase();

/**
 * Obtener la colección de movimientos del usuario actual
 */
function getMovementsCollection() {
  const db = getFirestore();
  const user = getCurrentUser();
  
  if (!db || !user) {
    throw new Error('Firestore no está disponible o el usuario no está autenticado');
  }
  
  return db.collection('users').doc(user.uid).collection('movements');
}

/**
 * Obtener todos los movimientos del usuario
 */
export async function getAllMovements() {
  try {
    const movementsCollection = getMovementsCollection();
    const snapshot = await movementsCollection.orderBy('date', 'desc').get();
    
    const movements = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      movements.push({
        id: doc.id,
        ...data,
        // Convertir Timestamp de Firestore a Date si es necesario
        date: data.date?.toDate ? data.date.toDate() : data.date
      });
    });
    
    return movements;
  } catch (error) {
    console.error('Error al obtener movimientos:', error);
    throw error;
  }
}

/**
 * Obtener un movimiento por ID
 */
export async function getMovementById(movementId) {
  try {
    const movementsCollection = getMovementsCollection();
    const doc = await movementsCollection.doc(movementId).get();
    
    if (!doc.exists) {
      return null;
    }
    
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      date: data.date?.toDate ? data.date.toDate() : data.date
    };
  } catch (error) {
    console.error('Error al obtener movimiento:', error);
    throw error;
  }
}

/**
 * Crear un nuevo movimiento
 */
export async function createMovement(movementData) {
  try {
    const movementsCollection = getMovementsCollection();
    
    // Convertir fecha a Timestamp de Firestore si es un string o Date
    let dateTimestamp;
    if (movementData.date instanceof Date) {
      dateTimestamp = firebase.firestore.Timestamp.fromDate(movementData.date);
    } else if (typeof movementData.date === 'string') {
      dateTimestamp = firebase.firestore.Timestamp.fromDate(new Date(movementData.date));
    } else {
      dateTimestamp = movementData.date;
    }
    
    const movementWithTimestamp = {
      ...movementData,
      date: dateTimestamp,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await movementsCollection.add(movementWithTimestamp);
    
    return {
      id: docRef.id,
      ...movementData
    };
  } catch (error) {
    console.error('Error al crear movimiento:', error);
    throw error;
  }
}

/**
 * Actualizar un movimiento existente
 */
export async function updateMovement(movementId, movementData) {
  try {
    const movementsCollection = getMovementsCollection();
    
    // Convertir fecha a Timestamp si es necesario
    const updateData = { ...movementData };
    if (updateData.date) {
      if (updateData.date instanceof Date) {
        updateData.date = firebase.firestore.Timestamp.fromDate(updateData.date);
      } else if (typeof updateData.date === 'string') {
        updateData.date = firebase.firestore.Timestamp.fromDate(new Date(updateData.date));
      }
    }
    
    updateData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    
    await movementsCollection.doc(movementId).update(updateData);
    
    return {
      id: movementId,
      ...movementData
    };
  } catch (error) {
    console.error('Error al actualizar movimiento:', error);
    throw error;
  }
}

/**
 * Eliminar un movimiento
 */
export async function deleteMovement(movementId) {
  try {
    const movementsCollection = getMovementsCollection();
    await movementsCollection.doc(movementId).delete();
    return true;
  } catch (error) {
    console.error('Error al eliminar movimiento:', error);
    throw error;
  }
}

/**
 * Eliminar todos los movimientos del usuario
 */
export async function deleteAllMovements() {
  try {
    const movementsCollection = getMovementsCollection();
    const snapshot = await movementsCollection.get();
    
    const batch = getFirestore().batch();
    snapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    return true;
  } catch (error) {
    console.error('Error al eliminar todos los movimientos:', error);
    throw error;
  }
}

/**
 * Suscribirse a cambios en tiempo real de movimientos
 */
export function subscribeToMovements(callback) {
  try {
    const movementsCollection = getMovementsCollection();
    
    return movementsCollection.orderBy('date', 'desc').onSnapshot((snapshot) => {
      const movements = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        movements.push({
          id: doc.id,
          ...data,
          date: data.date?.toDate ? data.date.toDate() : data.date
        });
      });
      callback(movements);
    }, (error) => {
      console.error('Error en suscripción de movimientos:', error);
      callback([]);
    });
  } catch (error) {
    console.error('Error al suscribirse a movimientos:', error);
    callback([]);
  }
}

/**
 * Obtener movimientos filtrados por producto
 */
export async function getMovementsByProduct(productId) {
  try {
    const movementsCollection = getMovementsCollection();
    const snapshot = await movementsCollection
      .where('productId', '==', productId)
      .orderBy('date', 'desc')
      .get();
    
    const movements = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      movements.push({
        id: doc.id,
        ...data,
        date: data.date?.toDate ? data.date.toDate() : data.date
      });
    });
    
    return movements;
  } catch (error) {
    console.error('Error al obtener movimientos por producto:', error);
    throw error;
  }
}

