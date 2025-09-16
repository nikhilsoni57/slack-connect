import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface AppState {
  // UI State
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark' | 'system';
  
  // Loading states
  globalLoading: boolean;
  loadingMessage: string;
  
  // Notifications
  notifications: Notification[];
  
  // Breadcrumbs
  breadcrumbs: Breadcrumb[];
  
  // Page title
  pageTitle: string;
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface Breadcrumb {
  label: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface AppStore extends AppState {
  // Sidebar actions
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
  
  // Theme actions
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  
  // Loading actions
  setGlobalLoading: (loading: boolean, message?: string) => void;
  
  // Notification actions
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  
  // Breadcrumb actions
  setBreadcrumbs: (breadcrumbs: Breadcrumb[]) => void;
  
  // Page title actions
  setPageTitle: (title: string) => void;
}

export const useAppStore = create<AppStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      sidebarOpen: true,
      sidebarCollapsed: false,
      theme: 'light',
      globalLoading: false,
      loadingMessage: '',
      notifications: [],
      breadcrumbs: [],
      pageTitle: 'Nexecute Connect',

      // Sidebar actions
      setSidebarOpen: (open: boolean) => {
        set({ sidebarOpen: open });
      },

      toggleSidebar: () => {
        set((state) => ({ sidebarOpen: !state.sidebarOpen }));
      },

      setSidebarCollapsed: (collapsed: boolean) => {
        set({ sidebarCollapsed: collapsed });
      },

      toggleSidebarCollapsed: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
      },

      // Theme actions
      setTheme: (theme: 'light' | 'dark' | 'system') => {
        set({ theme });
        
        // Apply theme to document
        const root = document.documentElement;
        if (theme === 'dark') {
          root.classList.add('dark');
        } else if (theme === 'light') {
          root.classList.remove('dark');
        } else {
          // System theme
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          if (prefersDark) {
            root.classList.add('dark');
          } else {
            root.classList.remove('dark');
          }
        }
      },

      // Loading actions
      setGlobalLoading: (loading: boolean, message?: string) => {
        set({
          globalLoading: loading,
          loadingMessage: message || '',
        });
      },

      // Notification actions
      addNotification: (notification: Omit<Notification, 'id'>) => {
        const id = Math.random().toString(36).substr(2, 9);
        const newNotification: Notification = {
          id,
          duration: 5000, // Default 5 seconds
          ...notification,
        };

        set((state) => ({
          notifications: [...state.notifications, newNotification],
        }));

        // Auto remove after duration
        if (newNotification.duration && newNotification.duration > 0) {
          setTimeout(() => {
            get().removeNotification(id);
          }, newNotification.duration);
        }
      },

      removeNotification: (id: string) => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      },

      clearNotifications: () => {
        set({ notifications: [] });
      },

      // Breadcrumb actions
      setBreadcrumbs: (breadcrumbs: Breadcrumb[]) => {
        set({ breadcrumbs });
      },

      // Page title actions
      setPageTitle: (title: string) => {
        set({ pageTitle: title });
        document.title = `${title} - Nexecute Connect`;
      },
    }),
    {
      name: 'app-store',
    }
  )
);