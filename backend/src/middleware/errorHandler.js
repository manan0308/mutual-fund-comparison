const logger = require('../utils/logger');

// Custom error classes
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

class ExternalApiError extends AppError {
  constructor(message, service = 'external') {
    super(message, 502, 'EXTERNAL_API_ERROR');
    this.service = service;
  }
}

class DatabaseError extends AppError {
  constructor(message) {
    super(message, 503, 'DATABASE_ERROR');
  }
}

// Main error handling middleware
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error details
  const errorDetails = {
    message: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.body,
    query: req.query,
    params: req.params,
    timestamp: new Date().toISOString()
  };

  // PostgreSQL errors
  if (err.code === '23505') {
    error = new ValidationError('Duplicate entry found');
  }
  
  if (err.code === '23503') {
    error = new ValidationError('Referenced record not found');
  }
  
  if (err.code?.startsWith('23')) {
    error = new ValidationError('Database constraint violation');
  }

  // Axios/HTTP errors
  if (err.response && err.response.status) {
    const status = err.response.status;
    if (status >= 400 && status < 500) {
      error = new ValidationError(`External API error: ${err.message}`);
    } else {
      error = new ExternalApiError(`External service unavailable: ${err.message}`, 'mf-api');
    }
  }

  // Network errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    error = new ExternalApiError('External service unavailable', 'network');
  }

  // Timeout errors
  if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
    error = new ExternalApiError('Request timeout', 'timeout');
  }

  // JSON parsing errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    error = new ValidationError('Invalid JSON format');
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new ValidationError('Invalid token');
  }
  
  if (err.name === 'TokenExpiredError') {
    error = new ValidationError('Token expired');
  }

  // Default error
  if (!error.isOperational) {
    error = new AppError('Something went wrong', 500, 'INTERNAL_ERROR');
  }

  // Log based on severity
  if (error.statusCode >= 500) {
    logger.error('Server Error', errorDetails);
  } else if (error.statusCode >= 400) {
    logger.warn('Client Error', errorDetails);
  }

  // Send error response
  const response = {
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message,
      timestamp: new Date().toISOString()
    }
  };

  // Add additional details in development
  if (process.env.NODE_ENV === 'development') {
    response.error.stack = error.stack;
    response.error.details = errorDetails;
  }

  // Send response
  res.status(error.statusCode || 500).json(response);
};

// 404 handler for unmatched routes
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};

// Async error wrapper
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Global error handlers for uncaught exceptions
const handleUncaughtException = () => {
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception - Shutting down...', {
      error: err.message,
      stack: err.stack
    });
    process.exit(1);
  });
};

const handleUnhandledRejection = () => {
  process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Rejection - Shutting down...', {
      error: err.message,
      stack: err.stack
    });
    process.exit(1);
  });
};

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  ExternalApiError,
  DatabaseError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  handleUncaughtException,
  handleUnhandledRejection
};