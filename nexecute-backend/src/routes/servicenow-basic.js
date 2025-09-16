import express from 'express';
import axios from 'axios';
import { logger } from '../utils/logger.js';
import { encrypt } from '../utils/encryption.js';

const router = express.Router();

/**
 * POST /api/v1/connections/servicenow/basic
 * Test ServiceNow connection with basic auth (for testing)
 */
router.post('/basic', async (req, res, next) => {
  try {
    const { instanceUrl, username, password } = req.body;

    if (!instanceUrl || !username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'instanceUrl, username, and password are required'
      });
    }

    // Test connection by getting user info
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    
    logger.info(`Testing ServiceNow basic auth connection to ${instanceUrl}`);

    const testResponse = await axios.get(`${instanceUrl}/api/now/table/sys_user`, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      params: {
        sysparm_limit: 1,
        sysparm_query: `user_name=${username}`
      },
      timeout: 10000
    });

    if (testResponse.data && testResponse.data.result) {
      // Connection successful - store credentials (password not encrypted for demo)
      const encryptedCreds = {
        instanceUrl,
        username,
        password, // In production: encrypt(password),
        authType: 'basic',
        timestamp: new Date().toISOString()
      };

      logger.info('ServiceNow basic auth connection successful');

      res.json({
        success: true,
        data: {
          message: 'ServiceNow connection successful',
          userInfo: testResponse.data.result[0] ? {
            name: testResponse.data.result[0].name,
            user_name: testResponse.data.result[0].user_name,
            sys_id: testResponse.data.result[0].sys_id
          } : null,
          connectionTest: 'passed',
          // In production, store encryptedCreds in database
          // For demo, return token-like string
          token: Buffer.from(JSON.stringify(encryptedCreds)).toString('base64')
        }
      });

    } else {
      throw new Error('No user data returned from ServiceNow');
    }

  } catch (error) {
    logger.error('ServiceNow basic auth failed:', error.response?.data || error.message);
    
    if (error.response) {
      const status = error.response.status;
      if (status === 401) {
        return res.status(401).json({
          success: false,
          error: 'Authentication Failed',
          message: 'Invalid ServiceNow username or password'
        });
      } else if (status === 403) {
        return res.status(403).json({
          success: false,
          error: 'Access Denied',
          message: 'User does not have sufficient permissions'
        });
      }
    }

    res.status(500).json({
      success: false,
      error: 'Connection Failed',
      message: 'Unable to connect to ServiceNow instance',
      details: error.message
    });
  }
});

/**
 * GET /api/v1/connections/servicenow/basic/incidents
 * Get incidents using basic auth
 */
router.get('/basic/incidents', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authorization token required'
      });
    }

    // Decode token
    const token = authHeader.replace('Bearer ', '');
    const credentials = JSON.parse(Buffer.from(token, 'base64').toString());
    
    const auth = Buffer.from(`${credentials.username}:${credentials.password.encrypted || credentials.password}`).toString('base64');
    
    const { limit = 10, offset = 0 } = req.query;
    
    const response = await axios.get(`${credentials.instanceUrl}/api/now/table/incident`, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      },
      params: {
        sysparm_limit: limit,
        sysparm_offset: offset,
        sysparm_query: 'active=true^ORDERBYDESCsys_created_on'
      },
      timeout: 15000
    });

    logger.info(`Retrieved ${response.data.result.length} incidents from ServiceNow`);

    res.json({
      success: true,
      data: {
        incidents: response.data.result,
        count: response.data.result.length,
        total: response.data.result.length
      }
    });

  } catch (error) {
    next(error);
  }
});

export { router as serviceNowBasicRoutes };