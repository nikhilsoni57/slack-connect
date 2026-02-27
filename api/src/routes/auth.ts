import { Router, Request, Response } from 'express';
import { config } from '../config/environment.js';
import { serviceNowClient } from '../services/servicenow.js';
import { ApiResponse, ServiceNowStoredToken } from '../types/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * POST /auth/servicenow
 * Start ServiceNow OAuth 2.0 authorization flow
 */
router.post('/servicenow', (req: Request, res: Response) => {
  try {
    const { redirect_uri } = req.body;
    
    // Use provided redirect URI or default to backend callback endpoint
    const redirectUri = redirect_uri || `http://localhost:${config.PORT}/auth/servicenow/callback`;
    
    logger.info('Starting ServiceNow OAuth flow', { redirectUri });
    
    // Generate OAuth authorization URL with state parameter
    const { url, state } = serviceNowClient.getOAuthUrl(redirectUri);
    
    logger.info('OAuth URL generated', { state, redirectUri });
    
    const response: ApiResponse<{url: string; state: string}> = {
      success: true,
      data: { url, state },
      message: 'OAuth authorization URL generated'
    };
    
    res.json(response);
    
  } catch (error: any) {
    logger.error('Failed to start ServiceNow OAuth flow:', error);
    return res.status(500).json({
      success: false,
      error: 'OAuth initiation failed',
      message: error.message || 'Unable to start ServiceNow authorization'
    });
  }
});

/**
 * GET /auth/servicenow/callback
 * Handle ServiceNow OAuth 2.0 callback
 */
router.get('/servicenow/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error, error_description } = req.query;
    
    // Handle OAuth errors
    if (error) {
      logger.error('ServiceNow OAuth error:', { error, error_description });
      return res.status(400).json({
        success: false,
        error: error as string,
        message: error_description as string || 'OAuth authorization failed'
      });
    }
    
    // Validate required parameters
    if (!code || !state) {
      return res.status(400).json({
        success: false,
        error: 'Missing parameters',
        message: 'Authorization code and state are required'
      });
    }
    
    // Decode the state parameter that was double-encoded to avoid ServiceNow corruption
    const decodedState = decodeURIComponent(state as string);
    
    logger.info('OAuth callback received');
    logger.info(`  Raw state from query: "${state}"`);
    logger.info(`  Decoded state: "${decodedState}"`);
    logger.info(`  State length: ${decodedState.length}`);
    logger.info(`  Code present: ${code ? 'yes' : 'no'}`);
    
    // Exchange code for tokens
    const redirectUri = `${req.protocol}://${req.get('host')}/auth/servicenow/callback`;
    const tokenResult = await serviceNowClient.exchangeCodeForToken(
      code as string, 
      decodedState, 
      redirectUri
    );
    
    if (!tokenResult.success) {
      logger.error('Token exchange failed:', tokenResult.error);
      return res.status(400).json(tokenResult);
    }
    
    // Store token information in session (without sensitive data)
    if (req.session) {
      req.session.servicenow_authenticated = true;
      req.session.servicenow_expires_at = tokenResult.data!.expiresAt;
    }
    
    logger.info('ServiceNow OAuth flow completed successfully');
    
    // For web applications, redirect to frontend with success (temporarily disabled for testing)
    // if (req.headers.accept?.includes('text/html')) {
    //   const frontendUrl = `${config.FRONTEND_URL}/auth/success?service=servicenow`;
    //   return res.redirect(frontendUrl);
    // }
    
    // For API clients, return JSON response
    res.json({
      success: true,
      data: {
        authenticated: true,
        expiresAt: tokenResult.data!.expiresAt,
        instanceUrl: config.SERVICENOW_INSTANCE_URL
      },
      message: 'ServiceNow authentication successful'
    });
    
  } catch (error: any) {
    logger.error('ServiceNow OAuth callback error:', error);
    return res.status(500).json({
      success: false,
      error: 'OAuth callback failed',
      message: error.message || 'Authentication callback processing failed'
    });
  }
});

/**
 * POST /auth/servicenow/refresh
 * Refresh ServiceNow access token
 */
router.post('/servicenow/refresh', async (req: Request, res: Response) => {
  try {
    if (!req.session?.servicenow_authenticated) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
        message: 'ServiceNow authentication required'
      });
    }
    
    const refreshResult = await serviceNowClient.refreshAccessToken();
    
    if (!refreshResult.success) {
      // Clear session if refresh failed
      if (req.session) {
        delete req.session.servicenow_authenticated;
        delete req.session.servicenow_expires_at;
      }
      
      return res.status(401).json(refreshResult);
    }
    
    // Update session expiration
    if (req.session) {
      req.session.servicenow_expires_at = refreshResult.data!.expiresAt;
    }
    
    logger.info('ServiceNow token refreshed successfully');
    
    res.json({
      success: true,
      data: {
        refreshed: true,
        expiresAt: refreshResult.data!.expiresAt
      },
      message: 'Token refreshed successfully'
    });
    
  } catch (error: any) {
    logger.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'Token refresh failed',
      message: error.message || 'Unable to refresh authentication token'
    });
  }
});

/**
 * GET /auth/servicenow/status
 * Check ServiceNow authentication status
 */
router.get('/servicenow/status', async (req: Request, res: Response) => {
  try {
    const connectionStatus = await serviceNowClient.getConnectionStatus();
    
    const sessionAuthenticated = req.session?.servicenow_authenticated || false;
    const sessionExpiresAt = req.session?.servicenow_expires_at;
    
    res.json({
      success: true,
      data: {
        ...connectionStatus.data,
        sessionAuthenticated,
        sessionExpiresAt: sessionExpiresAt ? new Date(sessionExpiresAt).toISOString() : null
      },
      message: connectionStatus.message
    });
    
  } catch (error: any) {
    logger.error('Authentication status check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Status check failed',
      message: error.message || 'Unable to check authentication status'
    });
  }
});

/**
 * DELETE /auth/servicenow
 * Logout from ServiceNow (clear tokens and session)
 */
router.delete('/servicenow', (req: Request, res: Response) => {
  try {
    // Clear stored tokens
    serviceNowClient.clearStoredToken();
    
    // Clear session data
    if (req.session) {
      delete req.session.servicenow_authenticated;
      delete req.session.servicenow_expires_at;
    }
    
    logger.info('ServiceNow authentication cleared');
    
    res.json({
      success: true,
      message: 'ServiceNow authentication cleared'
    });
    
  } catch (error: any) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed',
      message: error.message || 'Unable to clear authentication'
    });
  }
});

/**
 * GET /auth/servicenow/test
 * Test ServiceNow API connection
 */
router.get('/servicenow/test', async (req: Request, res: Response) => {
  try {
    if (!req.session?.servicenow_authenticated) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
        message: 'ServiceNow authentication required for API testing'
      });
    }
    
    const testResult = await serviceNowClient.testConnection();
    const statusCode = testResult.success ? 200 : 503;
    
    res.status(statusCode).json(testResult);
    
  } catch (error: any) {
    logger.error('ServiceNow API test failed:', error);
    return res.status(500).json({
      success: false,
      error: 'API test failed',
      message: error.message || 'Unable to test ServiceNow API connection'
    });
  }
});

export { router as authRoutes };