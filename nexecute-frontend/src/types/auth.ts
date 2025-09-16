export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  organizationId: string;
  organizationName: string;
  avatarUrl?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  expiresIn: number;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  name: string;
  organizationName: string;
}