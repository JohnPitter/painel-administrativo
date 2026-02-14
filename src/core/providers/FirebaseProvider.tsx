import { createContext, useContext, useEffect, type ReactNode } from 'react';
import type { FirebaseApp } from 'firebase/app';

import { app, ensureAnalytics } from '@core/config/firebase';

interface FirebaseContextValue {
  app: FirebaseApp;
}

const FirebaseContext = createContext<FirebaseContextValue>({
  app,
});

const FirebaseProvider = ({ children }: { children: ReactNode }) => {
  useEffect(() => {
    void ensureAnalytics();
  }, []);

  return (
    <FirebaseContext.Provider value={{ app }}>{children}</FirebaseContext.Provider>
  );
};

const useFirebase = () => useContext(FirebaseContext);

export { FirebaseContext, FirebaseProvider, useFirebase };
