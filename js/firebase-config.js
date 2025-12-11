// firebase-config.js - Configuración de Firebase
export const firebaseConfig = {
  apiKey: "AIzaSyCVsqNDurLW6N5N86AAexVinV5rfDRh-Vg",
  authDomain: "liftory-app.firebaseapp.com",
  projectId: "liftory-app",
  storageBucket: "liftory-app.firebasestorage.app",
  messagingSenderId: "753039264564",
  appId: "1:753039264564:web:10bf5c67bf49176d1b3361"
};

export const initFirebase = () => {
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDK no está cargado');
    return null;
  }
  
  try {
    // Verificar si ya está inicializado
    if (firebase.apps.length === 0) {
      firebase.initializeApp(firebaseConfig);
      console.log('Firebase inicializado correctamente');
    }
    return firebase.app();
  } catch (error) {
    console.error('Error al inicializar Firebase:', error);
    return null;
  }
};

// Obtener instancias
export const getAuth = () => {
  if (typeof firebase === 'undefined' || firebase.apps.length === 0) return null;
  return firebase.auth();
};

export const getFirestore = () => {
  if (typeof firebase === 'undefined' || firebase.apps.length === 0) return null;
  return firebase.firestore();
};
