import crypto from 'crypto';
import { logger } from './logger.js';

const ALGORITHM = 'aes-256-gcm';

// Get encryption key from environment variable
const getEncryptionKey = () => {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }
  
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  
  return key;
};

const ENCRYPTION_KEY = getEncryptionKey();

/**
 * Encrypt sensitive data using AES-256-GCM
 * @param {string} text - The text to encrypt
 * @returns {object} - Encrypted data with iv and authTag
 */
export const encrypt = (text) => {
  try {
    if (!text || typeof text !== 'string') {
      throw new Error('Text to encrypt must be a non-empty string');
    }

    const iv = crypto.randomBytes(16); // 128-bit IV for GCM
    const cipher = crypto.createCipherGCM(ALGORITHM, ENCRYPTION_KEY, iv);
    cipher.setAAD(Buffer.from('nexecute-connect', 'utf8')); // Additional authenticated data
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  } catch (error) {
    logger.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
};

/**
 * Decrypt sensitive data using AES-256-GCM
 * @param {object} encryptedData - Object containing encrypted data, iv, and authTag
 * @returns {string} - Decrypted text
 */
export const decrypt = (encryptedData) => {
  try {
    if (!encryptedData || !encryptedData.encrypted || !encryptedData.iv || !encryptedData.authTag) {
      throw new Error('Invalid encrypted data format');
    }

    const { encrypted, iv, authTag } = encryptedData;
    const decipher = crypto.createDecipherGCM(ALGORITHM, ENCRYPTION_KEY, Buffer.from(iv, 'hex'));
    
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    decipher.setAAD(Buffer.from('nexecute-connect', 'utf8')); // Same AAD as encryption
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
};

/**
 * Generate a secure random state parameter for OAuth
 * @returns {string} - Random state string
 */
export const generateState = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Hash sensitive data for comparison (one-way)
 * @param {string} data - Data to hash
 * @returns {string} - SHA-256 hash
 */
export const hashData = (data) => {
  return crypto.createHash('sha256').update(data).digest('hex');
};