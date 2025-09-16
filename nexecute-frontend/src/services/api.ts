import axios from 'axios';
import type { ApiError } from '../types/api';

class ApiService {
  private api: any;
  
  constructor() {
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.api.interceptors.request.use(
      (config: any) => {
        const token = this.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add organization ID if available
        const orgId = this.getOrganizationId();
        if (orgId) {
          config.headers['X-Organization-ID'] = orgId;
        }

        // Log request in development
        if (import.meta.env.DEV) {
          console.log(`🔄 API Request: ${config.method?.toUpperCase()} ${config.url}`, {
            data: config.data,
            params: config.params,
          });
        }

        return config;
      },
      (error: any) => {
        console.error('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.api.interceptors.response.use(
      (response: any) => {
        // Log response in development
        if (import.meta.env.DEV) {
          console.log(`✅ API Response: ${response.config.method?.toUpperCase()} ${response.config.url}`, {
            data: response.data,
            status: response.status,
          });
        }

        return response;
      },
      (error: any) => {
        // Log error in development
        if (import.meta.env.DEV) {
          console.error(`❌ API Error: ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
            status: error.response?.status,
            data: error.response?.data,
          });
        }

        // Handle authentication errors
        if (error.response?.status === 401) {
          this.handleAuthError();
        }

        // Transform error to ApiError format
        const apiError: ApiError = {
          message: error.response?.data?.message || error.message || 'An unexpected error occurred',
          code: error.response?.data?.code || error.code || 'UNKNOWN_ERROR',
          status: error.response?.status || 0,
          details: error.response?.data?.details,
        };

        return Promise.reject(apiError);
      }
    );
  }

  private getAuthToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  private getOrganizationId(): string | null {
    return localStorage.getItem('organization_id');
  }

  private handleAuthError() {
    // Clear auth data
    localStorage.removeItem('auth_token');
    localStorage.removeItem('organization_id');
    localStorage.removeItem('user_data');

    // Redirect to login
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }

  // Generic API methods
  async get<T = any>(url: string, config?: any): Promise<T> {
    const response = await this.api.get(url, config);
    return response.data.data;
  }

  async post<T = any>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.api.post(url, data, config);
    return response.data.data;
  }

  async put<T = any>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.api.put(url, data, config);
    return response.data.data;
  }

  async patch<T = any>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.api.patch(url, data, config);
    return response.data.data;
  }

  async delete<T = any>(url: string, config?: any): Promise<T> {
    const response = await this.api.delete(url, config);
    return response.data.data;
  }

  // Raw API methods (for cases where you need the full response)
  async getRaw(url: string, config?: any): Promise<any> {
    return this.api.get(url, config);
  }

  async postRaw(url: string, data?: any, config?: any): Promise<any> {
    return this.api.post(url, data, config);
  }

  // File upload method
  async uploadFile<T = any>(url: string, file: File, onUploadProgress?: (progressEvent: any) => void): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.api.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
    });

    return response.data.data;
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.get('/health');
  }

  // Get API instance for custom usage
  getInstance(): any {
    return this.api;
  }
}

// Create and export a singleton instance
export const apiService = new ApiService();

// Export the class for testing or custom instances
export { ApiService };