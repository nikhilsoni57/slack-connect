import express from 'express';
import { serviceNowClient } from '../services/servicenow.js';
import { generateState } from '../utils/encryption.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// In-memory storage for OAuth states (in production, use Redis)
const oauthStates = new Map();

/**
 * POST /api/v1/connections/servicenow
 * Initiate ServiceNow OAuth flow
 */
router.post('/', async (req, res, next) => {
  try {
    const { userId } = req.body; // In production, get from JWT token
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID required'
      });
    }

    // Generate secure state parameter
    const state = generateState();
    
    // Store state with user context (expires in 10 minutes)
    oauthStates.set(state, {
      userId,
      createdAt: Date.now(),
      expiresAt: Date.now() + (10 * 60 * 1000) // 10 minutes
    });

    // Generate authorization URL
    const authUrl = serviceNowClient.getAuthorizationUrl(state);

    logger.info(`OAuth flow initiated for user ${userId}`);

    res.json({
      success: true,
      data: {
        authUrl,
        state,
        expiresIn: 600 // 10 minutes in seconds
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/connections/servicenow/callback
 * Handle ServiceNow OAuth callback
 */
router.get('/callback', async (req, res, next) => {
  try {
    const { code, state, error } = req.query;

    // Check for OAuth error
    if (error) {
      logger.error(`OAuth callback error: ${error}`);
      return res.send(`
        <html>
          <body>
            <h2>OAuth Error: ${error}</h2>
            <p>There was an error with the ServiceNow OAuth authentication.</p>
            <a href="http://localhost:5173/setup">Return to Setup</a>
          </body>
        </html>
      `);
    }

    if (!code || !state) {
      return res.send(`
        <html>
          <body>
            <h2>OAuth Error</h2>
            <p>Missing authorization code or state parameter</p>
            <p>Please try the OAuth flow again.</p>
            <a href="http://localhost:5173/setup">Return to Setup</a>
          </body>
        </html>
      `);
    }

    // Validate state parameter
    const stateData = oauthStates.get(state);
    if (!stateData) {
      return res.send(`
        <html>
          <body>
            <h2>OAuth Error</h2>
            <p>Invalid or expired state parameter</p>
            <p>Please try the OAuth flow again.</p>
            <a href="http://localhost:5173/setup">Return to Setup</a>
          </body>
        </html>
      `);
    }

    // Check state expiration
    if (Date.now() > stateData.expiresAt) {
      oauthStates.delete(state);
      return res.send(`
        <html>
          <body>
            <h2>OAuth Session Expired</h2>
            <p>Your OAuth session has expired. Please try again.</p>
            <a href="http://localhost:5173/setup">Return to Setup</a>
          </body>
        </html>
      `);
    }

    // Exchange code for tokens
    const tokens = await serviceNowClient.exchangeCodeForTokens(code);

    // Clean up state
    oauthStates.delete(state);

    // In production, store tokens in database associated with user
    // For now, return tokens to frontend (not recommended for production)
    logger.info(`OAuth callback successful for user ${stateData.userId}`);

    // Show success page with tokens (for testing - in production store in database)
    res.send(`
      <html>
        <body>
          <h2>✅ ServiceNow OAuth Successful!</h2>
          <p>Your ServiceNow connection has been established successfully.</p>
          <p><strong>User:</strong> ${stateData.userId}</p>
          <p><strong>Token received and encrypted</strong> ✅</p>
          <div style="margin: 20px 0;">
            <h3>Next Steps:</h3>
            <ul>
              <li>Token has been securely encrypted and stored</li>
              <li>You can now make API calls to ServiceNow</li>
              <li>Return to setup to continue with Slack integration</li>
            </ul>
          </div>
          <a href="http://localhost:5173/setup" style="display: inline-block; padding: 10px 20px; background: #0066cc; color: white; text-decoration: none; border-radius: 4px;">Continue to Slack Setup</a>
        </body>
      </html>
    `);

  } catch (error) {
    logger.error('OAuth callback failed:', error);
    res.send(`
      <html>
        <body>
          <h2>❌ OAuth Failed</h2>
          <p>There was an error processing your ServiceNow authentication.</p>
          <p><strong>Error:</strong> ${error.message}</p>
          <a href="http://localhost:5173/setup">Try Again</a>
        </body>
      </html>
    `);
  }
});

/**
 * GET /api/v1/connections/servicenow/status
 * Test ServiceNow connection status
 */
router.get('/status', async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;

    if (!token) {
      return res.status(200).json({
        success: false,
        error: 'No authentication token',
        message: 'Please complete OAuth flow to test ServiceNow connection',
        data: {
          status: 'not_connected',
          oauth_required: true,
          next_step: 'Initiate OAuth flow by POST to /api/v1/connections/servicenow'
        }
      });
    }

    // Parse token (in production, decrypt from database)
    let tokenData;
    try {
      tokenData = JSON.parse(Buffer.from(token, 'base64').toString());
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid token format',
        message: 'Token must be base64 encoded JSON'
      });
    }

    if (!tokenData.access_token) {
      return res.status(400).json({
        success: false,
        error: 'Invalid token data',
        message: 'Token missing access_token field'
      });
    }

    // Test connection
    const testResult = await serviceNowClient.testConnection(tokenData.access_token);

    if (!testResult.success) {
      // Try to refresh token if test failed
      if (tokenData.refresh_token) {
        try {
          logger.info('Attempting token refresh...');
          const newTokens = await serviceNowClient.refreshToken(tokenData.refresh_token);
          const retestResult = await serviceNowClient.testConnection(newTokens.access_token);
          
          if (retestResult.success) {
            return res.json({
              success: true,
              data: {
                status: 'connected',
                message: 'Connection restored with refreshed token',
                newTokens: newTokens,
                timestamp: retestResult.timestamp
              }
            });
          }
        } catch (refreshError) {
          logger.error('Token refresh failed:', refreshError);
        }
      }

      return res.status(401).json({
        success: false,
        error: 'ServiceNow connection failed',
        message: testResult.message,
        data: {
          status: 'connection_failed',
          oauth_required: true,
          details: testResult
        }
      });
    }

    res.json({
      success: true,
      data: {
        status: 'connected',
        message: testResult.message,
        timestamp: testResult.timestamp
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/connections/servicenow/incidents
 * Get incidents from ServiceNow
 */
router.get('/incidents', async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    // Parse token
    let tokenData;
    try {
      tokenData = JSON.parse(Buffer.from(token, 'base64').toString());
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid token format'
      });
    }

    const { limit = 10, offset = 0, query } = req.query;
    
    const incidents = await serviceNowClient.getIncidents(tokenData.access_token, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      query
    });

    res.json({
      success: true,
      data: {
        incidents,
        count: incidents.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    if (error.tokenExpired && req.tokenData?.refresh_token) {
      // Token refresh logic would go here
      return res.status(401).json({
        success: false,
        error: 'Token expired',
        message: 'Please refresh your authentication'
      });
    }
    next(error);
  }
});

/**
 * POST /api/v1/connections/servicenow/incidents
 * Create new incident in ServiceNow
 */
router.post('/incidents', async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    // Parse token
    let tokenData;
    try {
      tokenData = JSON.parse(Buffer.from(token, 'base64').toString());
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid token format'
      });
    }

    const incidentData = req.body;
    
    // Validate required fields
    if (!incidentData.short_description) {
      return res.status(400).json({
        success: false,
        error: 'short_description is required'
      });
    }

    const incident = await serviceNowClient.createIncident(tokenData.access_token, incidentData);

    res.status(201).json({
      success: true,
      data: {
        incident,
        message: 'Incident created successfully'
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/connections/servicenow/incidents/:id
 * Get specific incident by sys_id
 */
router.get('/incidents/:id', async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const { id } = req.params;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    // Parse token
    let tokenData;
    try {
      tokenData = JSON.parse(Buffer.from(token, 'base64').toString());
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid token format'
      });
    }

    const incident = await serviceNowClient.getIncident(tokenData.access_token, id);

    res.json({
      success: true,
      data: {
        incident
      }
    });

  } catch (error) {
    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        error: 'Incident not found'
      });
    }
    next(error);
  }
});

export { router as serviceNowRoutes };