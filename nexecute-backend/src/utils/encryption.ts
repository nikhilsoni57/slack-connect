import crypto from 'crypto';
import { config } from '../config/environment.js';
import { EncryptedData } from '../types/index.js';
import { logger } from './logger.js';

/**
 * Secure token encryption using AES-256-GCM
 * Provides authenticated encryption with additional data protection
 */

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // For CBC, this is 16 bytes
const KEY_LENGTH = 32; // 256 bits = 32 bytes

/**
 * Encrypt sensitive data using AES-256-CBC with proper IV handling
 */
export function encryptData(plaintext: string): EncryptedData {
  try {
    // Generate a random initialization vector
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Get encryption key from environment (should be 32 bytes)
    const key = Buffer.from(config.ENCRYPTION_KEY, 'hex');
    
    // Create cipher with IV
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Encrypt the data
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Create HMAC for integrity verification
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(iv);
    hmac.update(Buffer.from(encrypted, 'hex'));
    const authTag = hmac.digest('hex');
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag
    };
    
  } catch (error) {
    logger.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt sensitive data using AES-256-CBC with proper IV handling
 */
export function decryptData(encryptedData: EncryptedData): string {
  try {
    // Get encryption key from environment
    const key = Buffer.from(config.ENCRYPTION_KEY, 'hex');
    
    // Convert hex strings back to buffers
    const iv = Buffer.from(encryptedData.iv, 'hex');
    
    // Verify integrity using HMAC
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(iv);
    hmac.update(Buffer.from(encryptedData.encrypted, 'hex'));
    const expectedAuthTag = hmac.digest('hex');
    
    if (expectedAuthTag !== encryptedData.authTag) {
      throw new Error('Authentication tag verification failed - data may be tampered with');
    }
    
    // Create decipher with IV
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    // Decrypt the data
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
    
  } catch (error) {
    logger.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data - token may be corrupted or tampered with');
  }
}

/**
 * Encrypt ServiceNow token for secure storage
 */
export function encryptToken(token: string): EncryptedData {
  if (!token || typeof token !== 'string') {
    throw new Error('Token must be a non-empty string');
  }
  
  return encryptData(token);
}

/**
 * Decrypt ServiceNow token from storage
 */
export function decryptToken(encryptedToken: EncryptedData): string {
  if (!encryptedToken || !encryptedToken.encrypted || !encryptedToken.iv || !encryptedToken.authTag) {
    throw new Error('Invalid encrypted token format');
  }
  
  return decryptData(encryptedToken);
}

/**
 * Generate a secure random state for OAuth flow
 */
export function generateOAuthState(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Verify OAuth state to prevent CSRF attacks
 */
export function verifyOAuthState(providedState: string, expectedState: string): boolean {
  if (!providedState || !expectedState) {
    return false;
  }
  
  // Use timing-safe comparison
  if (providedState.length !== expectedState.length) {
    return false;
  }
  
  let isValid = true;
  for (let i = 0; i < providedState.length; i++) {
    if (providedState[i] !== expectedState[i]) {
      isValid = false;
    }
  }
  
  return isValid;
}

/**
 * Test encryption functionality
 */
export function testEncryption(): boolean {
  try {
    const testData = 'test-token-12345';
    const encrypted = encryptData(testData);
    const decrypted = decryptData(encrypted);
    
    const isValid = decrypted === testData;
    
    if (isValid) {
      logger.debug('Encryption test passed');
    } else {
      logger.error('Encryption test failed: data mismatch');
    }
    
    return isValid;
    
  } catch (error) {
    logger.error('Encryption test failed:', error);
    return false;
  }
}