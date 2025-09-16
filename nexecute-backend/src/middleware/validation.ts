/**
 * Data Validation Middleware - Input validation and sanitization
 * Ensures webhook data integrity and security for the dashboard pipeline
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

// Validation error types
interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  sanitizedData?: any;
}

export class ValidationMiddleware {
  
  /**
   * Validate Slack webhook payload structure
   */
  static validateSlackWebhook() {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = this.validateSlackPayload(req.body);
        
        if (!result.isValid) {
          logger.warn('Invalid Slack webhook payload:', {
            errors: result.errors,
            payload: this.sanitizeForLogging(req.body)
          });
          
          return res.status(400).json({
            success: false,
            error: 'Invalid webhook payload',
            validation_errors: result.errors,
            code: 'VALIDATION_FAILED'
          });
        }

        // Use sanitized data
        if (result.sanitizedData) {
          req.body = result.sanitizedData;
        }

        next();
        
      } catch (error) {
        logger.error('Slack webhook validation error:', error);
        return res.status(500).json({
          success: false,
          error: 'Validation processing failed',
          code: 'VALIDATION_ERROR'
        });
      }
    };
  }

  /**
   * Validate ServiceNow webhook payload structure
   */
  static validateServiceNowWebhook() {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = this.validateServiceNowPayload(req.body);
        
        if (!result.isValid) {
          logger.warn('Invalid ServiceNow webhook payload:', {
            errors: result.errors,
            payload: this.sanitizeForLogging(req.body)
          });
          
          return res.status(400).json({
            success: false,
            error: 'Invalid ServiceNow webhook payload',
            validation_errors: result.errors,
            code: 'SERVICENOW_VALIDATION_FAILED'
          });
        }

        // Use sanitized data
        if (result.sanitizedData) {
          req.body = result.sanitizedData;
        }

        next();
        
      } catch (error) {
        logger.error('ServiceNow webhook validation error:', error);
        return res.status(500).json({
          success: false,
          error: 'ServiceNow validation processing failed',
          code: 'SERVICENOW_VALIDATION_ERROR'
        });
      }
    };
  }

  /**
   * Validate Slack slash command payload
   */
  static validateSlackSlashCommand() {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = this.validateSlashCommandPayload(req.body);
        
        if (!result.isValid) {
          logger.warn('Invalid Slack slash command payload:', {
            errors: result.errors,
            command: req.body.command
          });
          
          return res.json({
            response_type: 'ephemeral',
            text: '❌ Invalid command format. Please check your input and try again.',
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Validation Errors:*\n${result.errors.map(e => `• ${e.message}`).join('\n')}`
                }
              }
            ]
          });
        }

        // Use sanitized data
        if (result.sanitizedData) {
          req.body = result.sanitizedData;
        }

        next();
        
      } catch (error) {
        logger.error('Slack slash command validation error:', error);
        return res.json({
          response_type: 'ephemeral',
          text: '❌ Command validation failed. Please try again later.'
        });
      }
    };
  }

  /**
   * Validate Slack webhook payload
   */
  private static validateSlackPayload(payload: any): ValidationResult {
    const errors: ValidationError[] = [];
    
    // Basic structure validation
    if (!payload || typeof payload !== 'object') {
      errors.push({
        field: 'payload',
        message: 'Payload must be a valid object'
      });
      return { isValid: false, errors };
    }

    // URL verification challenge
    if (payload.type === 'url_verification') {
      if (!payload.challenge || typeof payload.challenge !== 'string') {
        errors.push({
          field: 'challenge',
          message: 'Missing or invalid challenge field for URL verification'
        });
      }
      return { isValid: errors.length === 0, errors };
    }

    // Event callback validation
    if (payload.type === 'event_callback') {
      if (!payload.team_id || typeof payload.team_id !== 'string') {
        errors.push({
          field: 'team_id',
          message: 'Missing or invalid team_id'
        });
      }

      if (!payload.event || typeof payload.event !== 'object') {
        errors.push({
          field: 'event',
          message: 'Missing or invalid event object'
        });
      } else {
        // Validate event structure
        if (!payload.event.type || typeof payload.event.type !== 'string') {
          errors.push({
            field: 'event.type',
            message: 'Missing or invalid event type'
          });
        }
      }
    }

    // Sanitize data
    const sanitizedData = this.sanitizeSlackPayload(payload);

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData
    };
  }

  /**
   * Validate ServiceNow webhook payload
   */
  private static validateServiceNowPayload(payload: any): ValidationResult {
    const errors: ValidationError[] = [];
    
    // Basic structure validation
    if (!payload || typeof payload !== 'object') {
      errors.push({
        field: 'payload',
        message: 'Payload must be a valid object'
      });
      return { isValid: false, errors };
    }

    // Check for incident data structure
    if (payload.incident) {
      const incident = payload.incident;

      // Required fields
      const requiredFields = ['sys_id', 'number'];
      for (const field of requiredFields) {
        if (!incident[field] || typeof incident[field] !== 'string') {
          errors.push({
            field: `incident.${field}`,
            message: `Missing or invalid ${field}`
          });
        }
      }

      // Validate sys_id format (ServiceNow format: 32-char hex string OR UUID format)
      if (incident.sys_id) {
        const isValidServiceNowId = /^[a-f0-9]{32}$/i.test(incident.sys_id); // 32-char hex string
        const isValidUUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(incident.sys_id); // UUID format
        
        if (!isValidServiceNowId && !isValidUUID) {
          errors.push({
            field: 'incident.sys_id',
            message: 'Invalid sys_id format (expected 32-character hex string or UUID format)'
          });
        }
      }

      // Validate incident number format
      if (incident.number && !/^INC\d{7}$/.test(incident.number)) {
        errors.push({
          field: 'incident.number',
          message: 'Invalid incident number format (expected INC followed by 7 digits)'
        });
      }

      // Validate state (should be numeric string)
      if (incident.state && !/^[1-8]$/.test(incident.state)) {
        errors.push({
          field: 'incident.state',
          message: 'Invalid state (must be 1-8)'
        });
      }

      // Validate priority (should be numeric string)
      if (incident.priority && !/^[1-5]$/.test(incident.priority)) {
        errors.push({
          field: 'incident.priority',
          message: 'Invalid priority (must be 1-5)'
        });
      }

      // Validate dates
      if (incident.sys_created_on && !this.isValidISODate(incident.sys_created_on)) {
        errors.push({
          field: 'incident.sys_created_on',
          message: 'Invalid created date format'
        });
      }

      if (incident.sys_updated_on && !this.isValidISODate(incident.sys_updated_on)) {
        errors.push({
          field: 'incident.sys_updated_on',
          message: 'Invalid updated date format'
        });
      }
    }

    // Validate event type
    if (payload.event_type) {
      const validEventTypes = ['created', 'updated', 'resolved', 'closed', 'deleted', 'delete'];
      if (!validEventTypes.includes(payload.event_type)) {
        errors.push({
          field: 'event_type',
          message: `Invalid event type. Must be one of: ${validEventTypes.join(', ')}`
        });
      }
    }

    // Sanitize data
    const sanitizedData = this.sanitizeServiceNowPayload(payload);

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData
    };
  }

  /**
   * Validate Slack slash command payload
   */
  private static validateSlashCommandPayload(payload: any): ValidationResult {
    const errors: ValidationError[] = [];
    
    // Basic structure validation
    if (!payload || typeof payload !== 'object') {
      errors.push({
        field: 'payload',
        message: 'Payload must be a valid object'
      });
      return { isValid: false, errors };
    }

    // Required fields for slash commands
    const requiredFields = ['command', 'user_id', 'team_id'];
    for (const field of requiredFields) {
      if (!payload[field] || typeof payload[field] !== 'string') {
        errors.push({
          field,
          message: `Missing or invalid ${field}`
        });
      }
    }

    // Validate command format
    if (payload.command && !payload.command.startsWith('/')) {
      errors.push({
        field: 'command',
        message: 'Command must start with /'
      });
    }

    // Validate IDs (Slack IDs are alphanumeric)
    const idFields = ['user_id', 'team_id', 'channel_id'];
    for (const field of idFields) {
      if (payload[field] && !/^[A-Z0-9]{9,11}$/i.test(payload[field])) {
        errors.push({
          field,
          message: `Invalid ${field} format`
        });
      }
    }

    // Validate text length (Slack has limits)
    if (payload.text && payload.text.length > 4000) {
      errors.push({
        field: 'text',
        message: 'Command text too long (max 4000 characters)'
      });
    }

    // Sanitize data
    const sanitizedData = this.sanitizeSlashCommandPayload(payload);

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData
    };
  }

  /**
   * Sanitize Slack webhook payload
   */
  private static sanitizeSlackPayload(payload: any): any {
    const sanitized = JSON.parse(JSON.stringify(payload)); // Deep copy
    
    // Remove potentially dangerous fields
    delete sanitized.token; // Don't log tokens
    
    // Sanitize text fields
    if (sanitized.event?.text) {
      sanitized.event.text = this.sanitizeText(sanitized.event.text);
    }

    return sanitized;
  }

  /**
   * Sanitize ServiceNow webhook payload
   */
  private static sanitizeServiceNowPayload(payload: any): any {
    const sanitized = JSON.parse(JSON.stringify(payload)); // Deep copy
    
    // Sanitize text fields
    if (sanitized.incident?.short_description) {
      sanitized.incident.short_description = this.sanitizeText(sanitized.incident.short_description);
    }

    if (sanitized.incident?.description) {
      sanitized.incident.description = this.sanitizeText(sanitized.incident.description);
    }

    // Ensure numeric fields are strings (ServiceNow format)
    if (sanitized.incident?.state) {
      sanitized.incident.state = String(sanitized.incident.state);
    }

    if (sanitized.incident?.priority) {
      sanitized.incident.priority = String(sanitized.incident.priority);
    }

    return sanitized;
  }

  /**
   * Sanitize slash command payload
   */
  private static sanitizeSlashCommandPayload(payload: any): any {
    const sanitized = JSON.parse(JSON.stringify(payload)); // Deep copy
    
    // Remove tokens
    delete sanitized.token;
    
    // Sanitize text
    if (sanitized.text) {
      sanitized.text = this.sanitizeText(sanitized.text);
    }

    return sanitized;
  }

  /**
   * Sanitize text content (remove potentially dangerous content)
   */
  private static sanitizeText(text: string): string {
    if (!text) return text;
    
    return text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: URLs
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim()
      .substring(0, 4000); // Limit length
  }

  /**
   * Check if a string is a valid ISO date
   */
  private static isValidISODate(dateString: string): boolean {
    try {
      const date = new Date(dateString);
      return date instanceof Date && !isNaN(date.getTime()) && date.toISOString() === dateString;
    } catch {
      return false;
    }
  }

  /**
   * Sanitize data for logging (remove sensitive information)
   */
  private static sanitizeForLogging(data: any): any {
    if (!data || typeof data !== 'object') return data;
    
    const sanitized = JSON.parse(JSON.stringify(data));
    
    // Remove sensitive fields
    const sensitiveFields = ['token', 'password', 'secret', 'key', 'authorization'];
    const removeSensitiveData = (obj: any) => {
      if (typeof obj !== 'object' || !obj) return;
      
      for (const key in obj) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          removeSensitiveData(obj[key]);
        }
      }
    };
    
    removeSensitiveData(sanitized);
    return sanitized;
  }

  /**
   * General API input validation
   */
  static validateApiInput(validationRules: any) {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        const errors: ValidationError[] = [];
        
        // Validate query parameters
        if (validationRules.query) {
          for (const [param, rule] of Object.entries(validationRules.query)) {
            const value = req.query[param];
            const validationError = this.validateField(param, value, rule);
            if (validationError) errors.push(validationError);
          }
        }

        // Validate body parameters
        if (validationRules.body) {
          for (const [param, rule] of Object.entries(validationRules.body)) {
            const value = req.body[param];
            const validationError = this.validateField(param, value, rule);
            if (validationError) errors.push(validationError);
          }
        }

        if (errors.length > 0) {
          return res.status(400).json({
            success: false,
            error: 'Validation failed',
            validation_errors: errors,
            code: 'INPUT_VALIDATION_FAILED'
          });
        }

        next();
        
      } catch (error) {
        logger.error('API input validation error:', error);
        return res.status(500).json({
          success: false,
          error: 'Validation processing failed',
          code: 'VALIDATION_PROCESSING_ERROR'
        });
      }
    };
  }

  /**
   * Validate individual field
   */
  private static validateField(fieldName: string, value: any, rule: any): ValidationError | null {
    if (rule.required && (value === undefined || value === null || value === '')) {
      return {
        field: fieldName,
        message: `${fieldName} is required`
      };
    }

    if (value !== undefined && value !== null && value !== '') {
      if (rule.type === 'number') {
        const num = Number(value);
        if (isNaN(num)) {
          return {
            field: fieldName,
            message: `${fieldName} must be a valid number`,
            value
          };
        }

        if (rule.min !== undefined && num < rule.min) {
          return {
            field: fieldName,
            message: `${fieldName} must be at least ${rule.min}`,
            value
          };
        }

        if (rule.max !== undefined && num > rule.max) {
          return {
            field: fieldName,
            message: `${fieldName} must be at most ${rule.max}`,
            value
          };
        }
      }

      if (rule.type === 'string') {
        if (typeof value !== 'string') {
          return {
            field: fieldName,
            message: `${fieldName} must be a string`,
            value
          };
        }

        if (rule.minLength && value.length < rule.minLength) {
          return {
            field: fieldName,
            message: `${fieldName} must be at least ${rule.minLength} characters long`,
            value
          };
        }

        if (rule.maxLength && value.length > rule.maxLength) {
          return {
            field: fieldName,
            message: `${fieldName} must be at most ${rule.maxLength} characters long`,
            value
          };
        }

        if (rule.pattern && !rule.pattern.test(value)) {
          return {
            field: fieldName,
            message: `${fieldName} format is invalid`,
            value
          };
        }
      }

      if (rule.enum && !rule.enum.includes(value)) {
        return {
          field: fieldName,
          message: `${fieldName} must be one of: ${rule.enum.join(', ')}`,
          value
        };
      }
    }

    return null;
  }
}