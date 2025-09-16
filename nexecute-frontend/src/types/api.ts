export interface ApiResponse<T = any> {
  data: T;
  message: string;
  success: boolean;
  timestamp: string;
}

export interface ApiError {
  message: string;
  code: string;
  status: number;
  details?: Record<string, any>;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface Organization {
  id: string;
  name: string;
  domain: string;
  isActive: boolean;
  settings: OrganizationSettings;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationSettings {
  slackWorkspaceId?: string;
  serviceNowInstanceUrl?: string;
  serviceNowCredentials?: {
    username: string;
    // password is not included in response for security
  };
  integrationSettings: {
    autoCreateIncidents: boolean;
    notificationChannels: string[];
    priorityMapping: Record<string, string>;
    statusMapping: Record<string, string>;
  };
}