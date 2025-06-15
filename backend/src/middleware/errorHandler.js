const logger = require('../utils/logger');

/**
 * Custom error classes for better error handling
 */
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400);
    this.details = details;
    this.type = 'VALIDATION_ERROR';
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
    this.type = 'NOT_FOUND_ERROR';
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429);
    this.type = 'RATE_LIMIT_ERROR';
  }
}

class ServiceUnavailableError extends AppError {
  constructor(service = 'Service') {
    super(`${service} is currently unavailable`, 503);
    this.type = 'SERVICE_UNAVAILABLE_ERROR';
  }
}

/**
 * Global error handler middleware
 * Must be the last middleware in the application
 */
const globalErrorHandler = (error, req, res, next) => {
  // Default error properties
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal Server Error';
  let type = error.type || 'UNKNOWN_ERROR';
  
  // Generate unique error ID for tracking
  const errorId = require('uuid').v4();
  
  // Log error details
  const errorLog = {
    errorId,
    type,
    message: error.message,
    statusCode,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
    body: req.body,
    query: req.query,
    params: req.params
  };
  
  // Log based on severity
  if (statusCode >= 500) {
    logger.error('Server Error', errorLog);
  } else if (statusCode >= 400) {
    logger.warn('Client Error', errorLog);
  } else {
    logger.info('Request Error', errorLog);
  }
  
  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    type = 'VALIDATION_ERROR';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid data format';
    type = 'CAST_ERROR';
  } else if (error.code === 'ECONNREFUSED') {
    statusCode = 503;
    message = 'Service temporarily unavailable';
    type = 'CONNECTION_ERROR';
  } else if (error.code === 'ETIMEDOUT') {
    statusCode = 504;
    message = 'Request timeout';
    type = 'TIMEOUT_ERROR';
  }
  
  // Prepare error response
  const errorResponse = {
    success: false,
    error: {
      type,
      message,
      errorId,
      timestamp: new Date().toISOString()
    }
  };
  
  // Add additional details for development environment
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.stack = error.stack;
    errorResponse.error.details = error.details || null;
  }
  
  // Add specific details for validation errors
  if (error instanceof ValidationError && error.details) {
    errorResponse.error.validationDetails = error.details;
  }
  
  // Add retry information for rate limiting
  if (error instanceof RateLimitError) {
    res.set('Retry-After', '60'); // Suggest retry after 60 seconds
    errorResponse.error.retryAfter = 60;
  }
  
  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * Async error wrapper for route handlers
 * Catches async errors and passes them to the global error handler
 */
const asyncErrorHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 handler for unmatched routes
 */
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.method} ${req.path}`);
  next(error);
};

/**
 * Graceful error handling for unhandled promise rejections
 */
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason.message || reason,
    stack: reason.stack,
    promise
  });
  
  // Graceful shutdown
  process.exit(1);
});

/**
 * Handle uncaught exceptions
 */
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    message: error.message,
    stack: error.stack
  });
  
  // Graceful shutdown
  process.exit(1);
});

module.exports = {
  globalErrorHandler,
  asyncErrorHandler,
  notFoundHandler,
  AppError,
  ValidationError,
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError
};