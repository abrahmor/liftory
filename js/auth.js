// auth.js - Autenticación simple con Firebase
import { initFirebase, getAuth } from '/js/firebase-config.js';

// Inicializar Firebase
initFirebase();

// Obtener auth
const auth = getAuth();

// Funciones de autenticación
export async function signInWithEmail(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function signUpWithEmail(email, password, displayName = '') {
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);

        // Si se proporciona un nombre, actualizarlo
        if (displayName) {
            await userCredential.user.updateProfile({ displayName });
        }

        // Crear documento en Firestore
        const db = getFirestore();
        if (db) {
            await db.collection('users').doc(userCredential.user.uid).set({
                email: email,
                displayName: displayName || email.split('@')[0],
                createdAt: firebase.firestore.Timestamp.now()
            }, { merge: true });
        }

        return { success: true, user: userCredential.user };
    } catch (error) {
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function signInWithGoogle() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const userCredential = await auth.signInWithPopup(provider);

        // Si es un nuevo usuario, crear documento en Firestore
        if (userCredential.additionalUserInfo?.isNewUser) {
            const db = getFirestore();
            if (db) {
                await db.collection('users').doc(userCredential.user.uid).set({
                    email: userCredential.user.email,
                    displayName: userCredential.user.displayName || userCredential.user.email.split('@')[0],
                    createdAt: firebase.firestore.Timestamp.now()
                }, { merge: true });
            }
        }

        return { success: true, user: userCredential.user };
    } catch (error) {
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function signOut() {
    try {
        await auth.signOut();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export function getCurrentUser() {
    return auth?.currentUser;
}

export function onAuthStateChanged(callback) {
    if (!auth) return;
    return auth.onAuthStateChanged(callback);
}

// Obtener nombre del usuario desde Firestore
export async function getUserDisplayName(userId) {
    try {
        const db = getFirestore();
        if (!db) return null;

        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
            return userDoc.data().displayName || null;
        }
        return null;
    } catch (error) {
        console.error('Error al obtener nombre del usuario:', error);
        return null;
    }
}

// Actualizar nombre del usuario en Firestore y Auth
export async function updateUserDisplayName(newName) {
    try {
        const user = auth.currentUser;
        if (!user) {
            return { success: false, error: 'No hay usuario autenticado' };
        }

        // Actualizar en Firebase Auth
        await user.updateProfile({ displayName: newName });

        // Actualizar en Firestore
        const db = getFirestore();
        if (db) {
            await db.collection('users').doc(user.uid).set({
                displayName: newName,
                email: user.email,
                updatedAt: firebase.firestore.Timestamp.now()
            }, { merge: true });
        }

        return { success: true };
    } catch (error) {
        console.error('Error al actualizar nombre:', error);
        return { success: false, error: error.message };
    }
}

// Obtener datos completos del usuario desde Firestore
export async function getUserData(userId) {
    try {
        const db = getFirestore();
        if (!db) return null;

        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
            return userDoc.data();
        }
        return null;
    } catch (error) {
        console.error('Error al obtener datos del usuario:', error);
        return null;
    }
}

function getFirestore() {
    if (typeof firebase === 'undefined' || firebase.apps.length === 0) return null;
    return firebase.firestore();
}

function getErrorMessage(error) {
    const errorMessages = {
        'auth/user-not-found': 'Usuario no encontrado',
        'auth/wrong-password': 'Contraseña incorrecta',
        'auth/email-already-in-use': 'Este correo ya está registrado',
        'auth/weak-password': 'La contraseña es muy débil',
        'auth/invalid-email': 'Correo electrónico inválido',
        'auth/network-request-failed': 'Error de conexión',
        'auth/popup-closed-by-user': 'La ventana fue cerrada',
        'auth/cancelled-popup-request': 'Solo se puede abrir una ventana a la vez'
    };
    return errorMessages[error.code] || error.message || 'Ocurrió un error';
}

