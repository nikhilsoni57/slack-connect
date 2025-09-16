import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DashboardLayout } from './layouts/DashboardLayout';

// Page components (placeholder implementations)
import { DashboardPage } from './pages/Dashboard';
import { IntegrationsPage } from './pages/Integrations';
import { IncidentsPage } from './pages/Incidents';
import { AnalyticsPage } from './pages/Analytics';
import { UserMappingsPage } from './pages/UserMappings';
import { SyncLogsPage } from './pages/SyncLogs';
import { SettingsPage } from './pages/Settings';
import { ApiKeysPage } from './pages/ApiKeys';
import { SupportPage } from './pages/Support';
import { WebhooksPage } from './pages/tools/Webhooks';
import { FieldMappingsPage } from './pages/tools/FieldMappings';
import { LoginPage } from './pages/Login';
import { SetupPage } from './pages/Setup';
import { NotFoundPage } from './pages/NotFound';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
      retryDelay: 1000,
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Router>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/setup" element={<SetupPage />} />
              
              {/* Protected routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                {/* Dashboard routes */}
                <Route index element={<DashboardPage />} />
                <Route path="integrations" element={<IntegrationsPage />} />
                <Route path="incidents" element={<IncidentsPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="user-mappings" element={<UserMappingsPage />} />
                <Route path="sync-logs" element={<SyncLogsPage />} />
                <Route path="support" element={<SupportPage />} />
                
                {/* Admin-only routes */}
                <Route
                  path="settings"
                  element={
                    <ProtectedRoute requiredRole="admin">
                      <SettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="api-keys"
                  element={
                    <ProtectedRoute requiredRole="admin">
                      <ApiKeysPage />
                    </ProtectedRoute>
                  }
                />
                
                {/* Tools routes */}
                <Route path="tools/webhooks" element={<WebhooksPage />} />
                <Route path="tools/field-mappings" element={<FieldMappingsPage />} />
              </Route>
              
              {/* Catch-all route */}
              <Route path="/404" element={<NotFoundPage />} />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Routes>
          </Router>
        </AuthProvider>
        
        {/* React Query DevTools (only in development) */}
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
