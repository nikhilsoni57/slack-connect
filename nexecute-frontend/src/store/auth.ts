import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { AuthState, User, LoginCredentials } from '../types/auth';
import { authService } from '../services/auth';

interface AuthStore extends AuthState {
  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  register: (credentials: any) => Promise<void>;
  refreshToken: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
  clearError: () => void;
  setLoading: (isLoading: boolean) => void;
  checkAuth: () => void;
}

export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,

        // Actions
        login: async (credentials: LoginCredentials) => {
          set({ isLoading: true, error: null });
          
          try {
            const response = await authService.login(credentials);
            
            set({
              user: response.user,
              token: response.token,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } catch (error: any) {
            set({
              user: null,
              token: null,
              isAuthenticated: false,
              isLoading: false,
              error: error.message || 'Login failed',
            });
            throw error;
          }
        },

        logout: async () => {
          set({ isLoading: true });
          
          try {
            await authService.logout();
          } catch (error) {
            console.error('Logout error:', error);
          } finally {
            set({
              user: null,
              token: null,
              isAuthenticated: false,
              isLoading: false,
              error: null,
            });
          }
        },

        register: async (credentials: any) => {
          set({ isLoading: true, error: null });
          
          try {
            const response = await authService.register(credentials);
            
            set({
              user: response.user,
              token: response.token,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } catch (error: any) {
            set({
              user: null,
              token: null,
              isAuthenticated: false,
              isLoading: false,
              error: error.message || 'Registration failed',
            });
            throw error;
          }
        },

        refreshToken: async () => {
          try {
            const response = await authService.refreshToken();
            
            set({
              user: response.user,
              token: response.token,
              isAuthenticated: true,
              error: null,
            });
          } catch (error: any) {
            set({
              user: null,
              token: null,
              isAuthenticated: false,
              error: error.message || 'Token refresh failed',
            });
            throw error;
          }
        },

        updateUser: (updatedUser: Partial<User>) => {
          const currentUser = get().user;
          if (currentUser) {
            set({
              user: { ...currentUser, ...updatedUser },
            });
          }
        },

        clearError: () => {
          set({ error: null });
        },

        setLoading: (isLoading: boolean) => {
          set({ isLoading });
        },

        checkAuth: () => {
          const isAuthenticated = authService.isAuthenticated();
          const user = authService.getStoredUser();
          const token = authService.getToken();

          if (isAuthenticated && user && token) {
            set({
              user,
              token,
              isAuthenticated: true,
              error: null,
            });
          } else {
            set({
              user: null,
              token: null,
              isAuthenticated: false,
              error: null,
            });
          }
        },
      }),
      {
        name: 'nexecute-auth',
        partialize: (state) => ({
          user: state.user,
          token: state.token,
          isAuthenticated: state.isAuthenticated,
        }),
      }
    ),
    {
      name: 'auth-store',
    }
  )
);