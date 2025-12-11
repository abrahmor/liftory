// expenses.service.js - Servicio de gastos con Firestore
import { getFirestore, initFirebase } from '/js/firebase-config.js';
import { getCurrentUser } from '/js/auth.js';

// Asegurar que Firebase esté inicializado
initFirebase();

/**
 * Obtener la colección de gastos del usuario actual
 */
function getExpensesCollection() {
  const db = getFirestore();
  const user = getCurrentUser();

  if (!db || !user) {
    throw new Error('Firestore no está disponible o el usuario no está autenticado');
  }

  return db.collection('users').doc(user.uid).collection('expenses');
}

/**
 * Obtener todos los gastos del usuario
 */
export async function getAllExpenses() {
  try {
    const expensesCollection = getExpensesCollection();
    const snapshot = await expensesCollection.orderBy('date', 'desc').get();

    const expenses = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      expenses.push({
        id: doc.id,
        ...data,
        date: data.date?.toDate ? data.date.toDate() : data.date
      });
    });

    return expenses;
  } catch (error) {
    console.error('Error al obtener gastos:', error);
    throw error;
  }
}

/**
 * Crear un nuevo gasto
 */
export async function createExpense(expenseData) {
  try {
    const expensesCollection = getExpensesCollection();

    let dateTimestamp;
    if (expenseData.date instanceof Date) {
      dateTimestamp = firebase.firestore.Timestamp.fromDate(expenseData.date);
    } else if (typeof expenseData.date === 'string') {
      dateTimestamp = firebase.firestore.Timestamp.fromDate(new Date(expenseData.date));
    } else {
      dateTimestamp = expenseData.date;
    }

    const expenseWithTimestamp = {
      ...expenseData,
      date: dateTimestamp,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await expensesCollection.add(expenseWithTimestamp);

    return {
      id: docRef.id,
      ...expenseData
    };
  } catch (error) {
    console.error('Error al crear gasto:', error);
    throw error;
  }
}

/**
 * Actualizar un gasto existente
 */
export async function updateExpense(expenseId, expenseData) {
  try {
    const expensesCollection = getExpensesCollection();

    const updateData = { ...expenseData };
    if (updateData.date) {
      if (updateData.date instanceof Date) {
        updateData.date = firebase.firestore.Timestamp.fromDate(updateData.date);
      } else if (typeof updateData.date === 'string') {
        updateData.date = firebase.firestore.Timestamp.fromDate(new Date(updateData.date));
      }
    }

    updateData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

    await expensesCollection.doc(expenseId).update(updateData);

    return {
      id: expenseId,
      ...expenseData
    };
  } catch (error) {
    console.error('Error al actualizar gasto:', error);
    throw error;
  }
}

/**
 * Eliminar un gasto
 */
export async function deleteExpense(expenseId) {
  try {
    const expensesCollection = getExpensesCollection();
    await expensesCollection.doc(expenseId).delete();
    return true;
  } catch (error) {
    console.error('Error al eliminar gasto:', error);
    throw error;
  }
}

/**
 * Suscribirse a cambios en tiempo real de gastos
 */
export function subscribeToExpenses(callback) {
  try {
    const expensesCollection = getExpensesCollection();

    return expensesCollection.orderBy('date', 'desc').onSnapshot((snapshot) => {
      const expenses = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        expenses.push({
          id: doc.id,
          ...data,
          date: data.date?.toDate ? data.date.toDate() : data.date
        });
      });
      callback(expenses);
    }, (error) => {
      console.error('Error en suscripción de gastos:', error);
      callback([]);
    });
  } catch (error) {
    console.error('Error al suscribirse a gastos:', error);
    callback([]);
  }
}

