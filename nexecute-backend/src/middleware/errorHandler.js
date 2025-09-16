import { logger } from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error(error);

  // ServiceNow OAuth errors
  if (err.response && err.response.status) {
    const status = err.response.status;
    const data = err.response.data;
    
    if (status === 400) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: data.error_description || 'Invalid request parameters',
        details: data
      });
    }
    
    if (status === 401) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: data.error_description || 'Invalid credentials or expired token',
        details: data
      });
    }
    
    if (status === 403) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: data.error_description || 'Insufficient permissions',
        details: data
      });
    }
    
    if (status === 429) {
      return res.status(429).json({
        success: false,
        error: 'Rate Limit Exceeded',
        message: 'Too many requests. Please try again later.',
        retryAfter: err.response.headers['retry-after']
      });
    }
    
    if (status >= 500) {
      return res.status(502).json({
        success: false,
        error: 'ServiceNow Service Error',
        message: 'ServiceNow API is temporarily unavailable'
      });
    }
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid Token',
      message: 'Please log in again'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token Expired',
      message: 'Your session has expired. Please log in again'
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message);
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: message[0] || 'Invalid input data'
    });
  }

  // Default error
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.name || 'Internal Server Error',
    message: err.message || 'Something went wrong on the server',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};