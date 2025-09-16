import crypto from 'crypto';
import { Request } from 'express';
import { config } from '../config/environment.js';
import { WebhookValidationResult } from '../types/index.js';
import { logger } from './logger.js';

/**
 * Verify Slack request signature using HMAC-SHA256
 * 
 * Slack sends a signature in the X-Slack-Signature header
 * Format: v0=<signature>
 * 
 * The signature is created by:
 * 1. Concatenate version, timestamp, and request body: "v0:timestamp:body"
 * 2. Compute HMAC-SHA256 with signing secret
 * 3. Prepend with "v0="
 */
export function verifySlackSignature(
  body: string, 
  signature: string, 
  timestamp: string
): WebhookValidationResult {
  try {
    // Check if timestamp is provided
    if (!timestamp) {
      return {
        isValid: false,
        error: 'Missing X-Slack-Request-Timestamp header'
      };
    }

    // Check if signature is provided
    if (!signature) {
      return {
        isValid: false,
        error: 'Missing X-Slack-Signature header'
      };
    }

    // Validate timestamp format (should be Unix timestamp)
    const requestTimestamp = parseInt(timestamp, 10);
    if (isNaN(requestTimestamp)) {
      return {
        isValid: false,
        error: 'Invalid timestamp format'
      };
    }

    // Check timestamp freshness (prevent replay attacks)
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDifference = Math.abs(currentTime - requestTimestamp);
    
    // Slack recommends 5 minutes (300 seconds) tolerance
    if (timeDifference > 300) {
      logger.warn(`Slack webhook timestamp too old: ${timeDifference}s difference`);
      return {
        isValid: false,
        error: 'Request timestamp too old (possible replay attack)'
      };
    }

    // Validate signature format (should start with 'v0=')
    if (!signature.startsWith('v0=')) {
      return {
        isValid: false,
        error: 'Invalid signature format (must start with v0=)'
      };
    }

    // Create the signature base string
    const version = 'v0';
    const baseString = `${version}:${timestamp}:${body}`;

    // Compute expected signature
    const expectedSignature = crypto
      .createHmac('sha256', config.SLACK_SIGNING_SECRET)
      .update(baseString, 'utf8')
      .digest('hex');
    
    const expectedSignatureWithPrefix = `v0=${expectedSignature}`;

    // Use timing-safe comparison to prevent timing attacks
    const providedSignature = signature;
    
    if (providedSignature.length !== expectedSignatureWithPrefix.length) {
      return {
        isValid: false,
        error: 'Signature length mismatch'
      };
    }

    // Timing-safe comparison
    let isValid = true;
    for (let i = 0; i < providedSignature.length; i++) {
      if (providedSignature[i] !== expectedSignatureWithPrefix[i]) {
        isValid = false;
      }
    }

    if (!isValid) {
      logger.warn('Slack signature verification failed', {
        provided: providedSignature,
        expected: expectedSignatureWithPrefix,
        timestamp,
        bodyLength: body.length
      });
      
      return {
        isValid: false,
        error: 'Signature verification failed'
      };
    }

    logger.debug('Slack signature verification successful', {
      timestamp: requestTimestamp,
      bodyLength: body.length
    });

    return {
      isValid: true,
      timestamp: requestTimestamp
    };

  } catch (error) {
    logger.error('Error verifying Slack signature:', error);
    return {
      isValid: false,
      error: `Signature verification error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Express middleware to verify Slack webhook signatures
 */
export function verifySlackWebhook(req: Request, res: any, next: any): void {
  try {
    const signature = req.headers['x-slack-signature'] as string;
    const timestamp = req.headers['x-slack-request-timestamp'] as string;
    
    // Get raw body (should be set by raw body parser)
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    const validation = verifySlackSignature(rawBody, signature, timestamp);

    if (!validation.isValid) {
      logger.warn('Slack webhook signature validation failed:', validation.error);
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid Slack signature'
      });
    }

    // Add timestamp to request for further use
    (req as any).slackTimestamp = validation.timestamp;
    next();

  } catch (error) {
    logger.error('Slack webhook middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Webhook validation error'
    });
  }
}

/**
 * Verify Slack verification token (legacy method, less secure)
 * Used as fallback for older Slack integrations
 */
export function verifySlackToken(providedToken: string): boolean {
  if (!providedToken) {
    return false;
  }

  // Use timing-safe comparison
  const expectedToken = config.SLACK_VERIFICATION_TOKEN;
  
  if (providedToken.length !== expectedToken.length) {
    return false;
  }

  let isValid = true;
  for (let i = 0; i < providedToken.length; i++) {
    if (providedToken[i] !== expectedToken[i]) {
      isValid = false;
    }
  }

  return isValid;
}

/**
 * Test function to validate signature verification implementation
 */
export function testSlackSignatureVerification(): boolean {
  try {
    // Test data based on Slack documentation
    const testBody = 'token=xyzz0WbapA4vBCDEFasx0q6G&team_id=T1DC2JH3J&team_domain=testteamnow&channel_id=G8PSS9T3V&channel_name=foobar&user_id=U2147483697&user_name=Steve&command=%2Fweather&text=94070&response_url=https%3A%2F%2Fhooks.slack.com%2Fcommands%2F1234%2F5678&trigger_id=137.135.5555.1648204889.89';
    const testTimestamp = '1531420618';
    const testSignature = 'v0=a2114d57b48eac39b9ad189dd8316235a7b4a8d21a10bd27519666489c69b503';

    // Temporarily override signing secret for test
    const originalSecret = config.SLACK_SIGNING_SECRET;
    (config as any).SLACK_SIGNING_SECRET = '8f742231b10e8888abcd99yyyzzz85a5';

    const result = verifySlackSignature(testBody, testSignature, testTimestamp);

    // Restore original secret
    (config as any).SLACK_SIGNING_SECRET = originalSecret;

    return result.isValid;

  } catch (error) {
    logger.error('Slack signature verification test failed:', error);
    return false;
  }
}