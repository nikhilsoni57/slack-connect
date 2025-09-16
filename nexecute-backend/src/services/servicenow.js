import axios from 'axios';
import { logger } from '../utils/logger.js';
import { encrypt, decrypt } from '../utils/encryption.js';

class ServiceNowClient {
  constructor() {
    this.instanceUrl = process.env.SERVICENOW_INSTANCE_URL;
    this.clientId = process.env.SERVICENOW_CLIENT_ID;
    this.clientSecret = process.env.SERVICENOW_CLIENT_SECRET;
    this.redirectUri = `${process.env.NODE_ENV === 'production' ? 'https://api.nexecute-connect.com' : 'http://localhost:3001'}/auth/servicenow/callback`;
  }

  /**
   * Generate ServiceNow OAuth authorization URL
   * @param {string} state - OAuth state parameter for security
   * @returns {string} - Authorization URL
   */
  getAuthorizationUrl(state) {
    const baseUrl = `${this.instanceUrl}/oauth_authorize.do`;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      state: state,
      scope: 'useraccount'
    });

    const authUrl = `${baseUrl}?${params.toString()}`;
    logger.info(`Generated ServiceNow auth URL for state: ${state}`);
    return authUrl;
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code from ServiceNow
   * @returns {object} - Token response with access_token, refresh_token, etc.
   */
  async exchangeCodeForTokens(code) {
    try {
      const tokenUrl = `${this.instanceUrl}/oauth_token.do`;
      
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: code,
        redirect_uri: this.redirectUri
      });

      logger.info('Exchanging authorization code for tokens');
      
      const response = await axios.post(tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      const tokenData = response.data;
      
      if (!tokenData.access_token) {
        throw new Error('No access token received from ServiceNow');
      }

      logger.info('Successfully exchanged code for tokens');
      
      // Encrypt sensitive token data
      const encryptedTokens = {
        access_token: encrypt(tokenData.access_token),
        refresh_token: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
        token_type: tokenData.token_type,
        expires_in: tokenData.expires_in,
        scope: tokenData.scope,
        created_at: Date.now()
      };

      return encryptedTokens;

    } catch (error) {
      logger.error('Token exchange failed:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Refresh expired access token
   * @param {string} encryptedRefreshToken - Encrypted refresh token
   * @returns {object} - New token response
   */
  async refreshToken(encryptedRefreshToken) {
    try {
      const refreshToken = decrypt(encryptedRefreshToken);
      const tokenUrl = `${this.instanceUrl}/oauth_token.do`;
      
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken
      });

      logger.info('Refreshing ServiceNow access token');
      
      const response = await axios.post(tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      const tokenData = response.data;
      
      // Encrypt new tokens
      const encryptedTokens = {
        access_token: encrypt(tokenData.access_token),
        refresh_token: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : encryptedRefreshToken,
        token_type: tokenData.token_type,
        expires_in: tokenData.expires_in,
        scope: tokenData.scope,
        created_at: Date.now()
      };

      logger.info('Successfully refreshed tokens');
      return encryptedTokens;

    } catch (error) {
      logger.error('Token refresh failed:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Make authenticated API request to ServiceNow
   * @param {string} encryptedAccessToken - Encrypted access token
   * @param {string} endpoint - API endpoint (e.g., '/api/now/table/incident')
   * @param {string} method - HTTP method
   * @param {object} data - Request data for POST/PUT requests
   * @returns {object} - API response data
   */
  async makeApiRequest(encryptedAccessToken, endpoint, method = 'GET', data = null) {
    try {
      const accessToken = decrypt(encryptedAccessToken);
      const url = `${this.instanceUrl}${endpoint}`;

      const config = {
        method: method,
        url: url,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 15000
      };

      if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        config.data = data;
      }

      logger.info(`Making ${method} request to ${endpoint}`);
      
      const response = await axios(config);
      return response.data;

    } catch (error) {
      logger.error(`API request failed for ${endpoint}:`, error.response?.data || error.message);
      
      // Check if token expired (401 error)
      if (error.response?.status === 401) {
        error.tokenExpired = true;
      }
      
      throw error;
    }
  }

  /**
   * Get incidents from ServiceNow
   * @param {string} encryptedAccessToken - Encrypted access token
   * @param {object} options - Query options (limit, offset, filters)
   * @returns {array} - Array of incidents
   */
  async getIncidents(encryptedAccessToken, options = {}) {
    const params = new URLSearchParams();
    
    if (options.limit) params.append('sysparm_limit', options.limit);
    if (options.offset) params.append('sysparm_offset', options.offset);
    if (options.query) params.append('sysparm_query', options.query);
    
    // Default to active incidents ordered by created date
    if (!options.query) {
      params.append('sysparm_query', 'active=true^ORDERBYDESCsys_created_on');
    }

    const endpoint = `/api/now/table/incident?${params.toString()}`;
    const response = await this.makeApiRequest(encryptedAccessToken, endpoint, 'GET');
    
    logger.info(`Retrieved ${response.result.length} incidents`);
    return response.result;
  }

  /**
   * Create a new incident in ServiceNow
   * @param {string} encryptedAccessToken - Encrypted access token
   * @param {object} incidentData - Incident data
   * @returns {object} - Created incident
   */
  async createIncident(encryptedAccessToken, incidentData) {
    const endpoint = '/api/now/table/incident';
    const response = await this.makeApiRequest(encryptedAccessToken, endpoint, 'POST', incidentData);
    
    logger.info(`Created incident with sys_id: ${response.result.sys_id}`);
    return response.result;
  }

  /**
   * Get specific incident by sys_id
   * @param {string} encryptedAccessToken - Encrypted access token
   * @param {string} sysId - ServiceNow sys_id
   * @returns {object} - Incident data
   */
  async getIncident(encryptedAccessToken, sysId) {
    const endpoint = `/api/now/table/incident/${sysId}`;
    const response = await this.makeApiRequest(encryptedAccessToken, endpoint, 'GET');
    
    return response.result;
  }

  /**
   * Update an existing incident
   * @param {string} encryptedAccessToken - Encrypted access token
   * @param {string} sysId - ServiceNow sys_id
   * @param {object} updateData - Data to update
   * @returns {object} - Updated incident
   */
  async updateIncident(encryptedAccessToken, sysId, updateData) {
    const endpoint = `/api/now/table/incident/${sysId}`;
    const response = await this.makeApiRequest(encryptedAccessToken, endpoint, 'PUT', updateData);
    
    logger.info(`Updated incident ${sysId}`);
    return response.result;
  }

  /**
   * Test connection to ServiceNow with current token
   * @param {string} encryptedAccessToken - Encrypted access token
   * @returns {object} - Connection test result
   */
  async testConnection(encryptedAccessToken) {
    try {
      // Try to get user info as connection test
      const response = await this.makeApiRequest(
        encryptedAccessToken,
        '/api/now/table/sys_user?sysparm_limit=1',
        'GET'
      );
      
      return {
        success: true,
        message: 'ServiceNow connection successful',
        userCount: response.result.length,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        success: false,
        message: 'ServiceNow connection failed',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

export const serviceNowClient = new ServiceNowClient();