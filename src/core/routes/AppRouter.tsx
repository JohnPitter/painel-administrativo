import { Suspense, lazy, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from './ProtectedRoute';
import { CalendarProvider } from '@modules/calendar/context/CalendarContext';

const HomePage = lazy(() =>
  import('@modules/landing/pages/HomePage').then(module => ({ default: module.HomePage }))
);
const SubscriptionPage = lazy(() =>
  import('@modules/landing/pages/SubscriptionPage').then(module => ({
    default: module.SubscriptionPage,
  }))
);
const SubscriptionFinalizePage = lazy(() =>
  import('@modules/landing/pages/SubscriptionFinalizePage').then(module => ({
    default: module.SubscriptionFinalizePage,
  }))
);
const SubscriptionRenewalPage = lazy(() =>
  import('@modules/landing/pages/SubscriptionRenewalPage').then(module => ({
    default: module.SubscriptionRenewalPage,
  }))
);
const LoginPage = lazy(() =>
  import('@modules/auth/pages/LoginPage').then(module => ({ default: module.LoginPage }))
);
const DashboardPage = lazy(() =>
  import('@modules/dashboard/pages/DashboardPage').then(module => ({ default: module.DashboardPage }))
);
const FinancePage = lazy(() =>
  import('@modules/finance/pages/FinancePage').then(module => ({ default: module.FinancePage }))
);
const TaskPage = lazy(() =>
  import('@modules/tasks/pages/TaskPage').then(module => ({ default: module.TaskPage }))
);
const NotesPage = lazy(() =>
  import('@modules/notes/pages/NotesPage').then(module => ({ default: module.NotesPage }))
);
const TimeclockPage = lazy(() =>
  import('@modules/timeclock/pages/TimeclockPage').then(module => ({ default: module.TimeclockPage }))
);
const CalendarPage = lazy(() =>
  import('@modules/calendar/pages/CalendarPage').then(module => ({ default: module.CalendarPage }))
);
const RelationshipPage = lazy(() =>
  import('@modules/relationships/pages/RelationshipPage').then(module => ({
    default: module.RelationshipPage,
  }))
);
const AutomationPage = lazy(() =>
  import('@modules/automations/pages/AutomationPage').then(module => ({
    default: module.AutomationPage,
  }))
);
const AssistantPage = lazy(() =>
  import('@modules/assistant/pages/AssistantPage').then(module => ({ default: module.AssistantPage }))
);
const MarketingPage = lazy(() =>
  import('@modules/landing/pages/MarketingPage').then(module => ({ default: module.MarketingPage }))
);

const SuspenseFallback = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-accent)',
          fontSize: '1.1rem',
        }}
      >
        Carregando...
      </div>
    }
  >
    {children}
  </Suspense>
);

const AppRouter = () => {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <SuspenseFallback>
            <HomePage />
          </SuspenseFallback>
        }
      />
      <Route
        path="/login"
        element={
          <SuspenseFallback>
            <LoginPage />
          </SuspenseFallback>
        }
      />
      <Route
        path="/marketing"
        element={
          <SuspenseFallback>
            <MarketingPage />
          </SuspenseFallback>
        }
      />
      <Route
        path="/assinatura"
        element={
          <SuspenseFallback>
            <SubscriptionPage />
          </SuspenseFallback>
        }
      />
      <Route
        path="/assinatura/finalizar"
        element={
          <SuspenseFallback>
            <SubscriptionFinalizePage />
          </SuspenseFallback>
        }
      />
      <Route
        path="/assinatura/renovar"
        element={
          <SuspenseFallback>
            <SubscriptionRenewalPage />
          </SuspenseFallback>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <CalendarProvider>
              <SuspenseFallback>
                <DashboardPage />
              </SuspenseFallback>
            </CalendarProvider>
          </ProtectedRoute>
        }
      />
      <Route
        path="/financas/*"
        element={
          <ProtectedRoute>
            <SuspenseFallback>
              <FinancePage />
            </SuspenseFallback>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tarefas/*"
        element={
          <ProtectedRoute>
            <SuspenseFallback>
              <TaskPage />
            </SuspenseFallback>
          </ProtectedRoute>
        }
      />
      <Route
        path="/notas/*"
        element={
          <ProtectedRoute>
            <SuspenseFallback>
              <NotesPage />
            </SuspenseFallback>
          </ProtectedRoute>
        }
      />
      <Route
        path="/ponto/*"
        element={
          <ProtectedRoute>
            <SuspenseFallback>
              <TimeclockPage />
            </SuspenseFallback>
          </ProtectedRoute>
        }
      />
      <Route
        path="/calendario/*"
        element={
          <ProtectedRoute>
            <CalendarProvider>
              <SuspenseFallback>
                <CalendarPage />
              </SuspenseFallback>
            </CalendarProvider>
          </ProtectedRoute>
        }
      />
      <Route
        path="/relacionamentos"
        element={
          <ProtectedRoute>
            <SuspenseFallback>
              <RelationshipPage />
            </SuspenseFallback>
          </ProtectedRoute>
        }
      />
      <Route
        path="/automacoes"
        element={
          <ProtectedRoute>
            <SuspenseFallback>
              <AutomationPage />
            </SuspenseFallback>
          </ProtectedRoute>
        }
      />
      <Route
        path="/consultor"
        element={
          <ProtectedRoute>
            <SuspenseFallback>
              <AssistantPage />
            </SuspenseFallback>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export { AppRouter };
