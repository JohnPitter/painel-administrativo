import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import App from './App';

import '@shared/styles/global.css';
import { FirebaseProvider } from '@core/providers/FirebaseProvider';
import { AuthProvider } from '@modules/auth/services/AuthContext';
import { AccountProvider } from '@modules/auth/services/AccountContext';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <FirebaseProvider>
      <AuthProvider>
        <AccountProvider>
          <BrowserRouter future={{ v7_startTransition: true }}>
            <App />
          </BrowserRouter>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              },
            }}
          />
        </AccountProvider>
      </AuthProvider>
    </FirebaseProvider>
  </React.StrictMode>
);
