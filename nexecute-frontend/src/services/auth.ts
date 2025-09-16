import { apiService } from './api';
import type { LoginCredentials, LoginResponse, RegisterCredentials, User } from '../types/auth';

class AuthService {
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'user_data';
  private readonly ORG_ID_KEY = 'organization_id';

  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await apiService.post<LoginResponse>('/auth/login', credentials);
    
    // Store auth data
    this.storeAuthData(response);
    
    return response;
  }

  async register(credentials: RegisterCredentials): Promise<LoginResponse> {
    const response = await apiService.post<LoginResponse>('/auth/register', credentials);
    
    // Store auth data
    this.storeAuthData(response);
    
    return response;
  }

  async logout(): Promise<void> {
    try {
      await apiService.post('/auth/logout');
    } catch (error) {
      // Continue with logout even if API call fails
      console.warn('Logout API call failed, continuing with local logout');
    } finally {
      this.clearAuthData();
    }
  }

  async refreshToken(): Promise<LoginResponse> {
    const response = await apiService.post<LoginResponse>('/auth/refresh');
    this.storeAuthData(response);
    return response;
  }

  async getCurrentUser(): Promise<User> {
    return apiService.get<User>('/auth/me');
  }

  async updateProfile(data: Partial<User>): Promise<User> {
    const response = await apiService.put<User>('/auth/profile', data);
    
    // Update stored user data
    const storedUser = this.getStoredUser();
    if (storedUser) {
      const updatedUser = { ...storedUser, ...response };
      localStorage.setItem(this.USER_KEY, JSON.stringify(updatedUser));
    }
    
    return response;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await apiService.post('/auth/change-password', {
      currentPassword,
      newPassword,
    });
  }

  async requestPasswordReset(email: string): Promise<void> {
    await apiService.post('/auth/password-reset/request', { email });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await apiService.post('/auth/password-reset/confirm', {
      token,
      newPassword,
    });
  }

  // Token management
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;
    
    // Check if token is expired
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp > currentTime;
    } catch (error) {
      console.error('Error parsing token:', error);
      return false;
    }
  }

  getStoredUser(): User | null {
    const userData = localStorage.getItem(this.USER_KEY);
    if (!userData) return null;
    
    try {
      return JSON.parse(userData);
    } catch (error) {
      console.error('Error parsing stored user data:', error);
      this.clearAuthData();
      return null;
    }
  }

  getOrganizationId(): string | null {
    return localStorage.getItem(this.ORG_ID_KEY);
  }

  private storeAuthData(response: LoginResponse): void {
    localStorage.setItem(this.TOKEN_KEY, response.token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(response.user));
    localStorage.setItem(this.ORG_ID_KEY, response.user.organizationId);
  }

  private clearAuthData(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.ORG_ID_KEY);
  }

  // Utility methods for checking permissions
  isAdmin(): boolean {
    const user = this.getStoredUser();
    return user?.role === 'admin';
  }

  hasPermission(_permission: string): boolean {
    // Implement permission checking logic based on your needs
    const user = this.getStoredUser();
    if (!user) return false;
    
    // Admin has all permissions
    if (user.role === 'admin') return true;
    
    // Add specific permission logic here
    return false;
  }

  // Auto-refresh token if it's about to expire
  async checkAndRefreshToken(): Promise<void> {
    const token = this.getToken();
    if (!token) return;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      
      // Refresh if token expires in less than 5 minutes
      if (payload.exp - currentTime < 300) {
        await this.refreshToken();
      }
    } catch (error) {
      console.error('Error checking token expiration:', error);
      this.clearAuthData();
    }
  }
}

export const authService = new AuthService();