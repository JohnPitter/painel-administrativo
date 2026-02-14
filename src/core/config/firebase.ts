import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyCXFriNoiBhqQQhcWrAuNmx35XZ6T58SZ8',
  authDomain: 'painel-administrativo-br.firebaseapp.com',
  projectId: 'painel-administrativo-br',
  storageBucket: 'painel-administrativo-br.firebasestorage.app',
  messagingSenderId: '487573855149',
  appId: '1:487573855149:web:9d79568bcad973e5db9f24',
  measurementId: 'G-Z6N88D8E7P',
};

const app: FirebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

let analyticsInstance: Analytics | null = null;

const ensureAnalytics = async (): Promise<Analytics | null> => {
  if (analyticsInstance) {
    return analyticsInstance;
  }

  try {
    const supported = await isSupported();
    if (!supported) {
      return null;
    }

    analyticsInstance = getAnalytics(app);
    return analyticsInstance;
  } catch (error) {
    console.warn('Firebase analytics unavailable', error);
    return null;
  }
};

export { app, db, storage, ensureAnalytics };
