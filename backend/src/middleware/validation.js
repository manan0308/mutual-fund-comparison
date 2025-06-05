const Joi = require('joi');
const logger = require('../utils/logger');

// Validation schemas
const schemas = {
  searchFunds: Joi.object({
    search: Joi.string().min(0).max(100).optional(),
    limit: Joi.number().integer().min(1).max(100).optional()
  }),

  getNavData: Joi.object({
    schemeCode: Joi.string().pattern(/^\d{6}$/).required(),
    from: Joi.date().iso().optional(),
    to: Joi.date().iso().optional()
  }),

  comparePortfolios: Joi.object({
    currentFundCode: Joi.string().pattern(/^\d{6}$/).required(),
    comparisonFundCode: Joi.string().pattern(/^\d{6}$/).required(),
    investmentType: Joi.string().valid('sip', 'lump').required(),
    amount: Joi.number().positive().max(10000000).required(),
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).optional()
  }),

  portfolioCreate: Joi.object({
    name: Joi.string().min(3).max(100).required(),
    funds: Joi.array().items(
      Joi.object({
        schemeCode: Joi.string().pattern(/^\d{6}$/).required(),
        name: Joi.string().optional(),
        category: Joi.string().optional(),
        investmentType: Joi.string().valid('sip', 'lumpsum').required(),
        amount: Joi.number().positive().required(),
        startDate: Joi.date().iso().required(),
        sipDuration: Joi.number().integer().min(12).max(600).optional(),
        allocation: Joi.number().min(0.01).max(100).optional()
      })
    ).min(1).max(20).required(),
    benchmarkIndex: Joi.string().valid('nifty50', 'sensex', 'nifty500', 'niftymidcap', 'niftysmallcap', 'niftybank', 'niftyit').optional(),
    userId: Joi.string().optional()
  }),

  multiSipCalculation: Joi.object({
    funds: Joi.array().items(
      Joi.object({
        schemeCode: Joi.string().pattern(/^\d{6}$/).required(),
        allocation: Joi.number().min(0.01).max(100).required()
      })
    ).min(2).max(10).required(),
    monthlyAmount: Joi.number().positive().max(1000000).required(),
    duration: Joi.number().integer().min(12).max(600).required(), // 1-50 years
    startDate: Joi.date().iso().required()
  })
};

// Generic validation middleware factory
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const dataToValidate = source === 'params' ? req.params : 
                          source === 'query' ? req.query : req.body;
    
    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      logger.warn('Validation error', {
        endpoint: req.originalUrl,
        method: req.method,
        source,
        errors: errorDetails
      });

      return res.status(400).json({
        error: 'Validation failed',
        details: errorDetails,
        timestamp: new Date().toISOString()
      });
    }

    // Replace original data with validated and sanitized data
    if (source === 'params') {
      req.params = value;
    } else if (source === 'query') {
      req.query = value;
    } else {
      req.body = value;
    }

    next();
  };
}

// Specific validation middlewares
const validateSearchFunds = validate(schemas.searchFunds, 'query');
const validateGetNavData = validate(schemas.getNavData, 'params');
const validateComparePortfolios = validate(schemas.comparePortfolios, 'body');

// Custom validation for scheme code in URL params
const validateSchemeCode = (req, res, next) => {
  const { schemeCode } = req.params;
  
  if (!schemeCode || !/^\d{6}$/.test(schemeCode)) {
    logger.warn('Invalid scheme code', { schemeCode, endpoint: req.originalUrl });
    return res.status(400).json({
      error: 'Invalid scheme code',
      message: 'Scheme code must be a 6-digit number',
      timestamp: new Date().toISOString()
    });
  }
  
  next();
};

// Rate limiting validation
const validateDateRange = (req, res, next) => {
  const { from, to } = req.query;
  
  if (from && to) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const maxRange = 5 * 365 * 24 * 60 * 60 * 1000; // 5 years in milliseconds
    
    if (toDate - fromDate > maxRange) {
      logger.warn('Date range too large', { from, to, endpoint: req.originalUrl });
      return res.status(400).json({
        error: 'Date range too large',
        message: 'Maximum date range allowed is 5 years',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  next();
};

// Request sanitization middleware
const sanitizeRequest = (req, res, next) => {
  // Remove potentially dangerous fields
  const dangerousFields = ['__proto__', 'constructor', 'prototype'];
  
  function sanitizeObject(obj) {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    for (const field of dangerousFields) {
      delete obj[field];
    }
    
    for (const key in obj) {
      if (typeof obj[key] === 'object') {
        sanitizeObject(obj[key]);
      } else if (typeof obj[key] === 'string') {
        // Basic XSS prevention
        obj[key] = obj[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      }
    }
    
    return obj;
  }
  
  req.body = sanitizeObject(req.body);
  req.query = sanitizeObject(req.query);
  req.params = sanitizeObject(req.params);
  
  next();
};

// New validation middlewares for portfolio features
const validatePortfolioCreate = validate(schemas.portfolioCreate, 'body');
const validateMultiSipCalculation = validate(schemas.multiSipCalculation, 'body');

module.exports = {
  validate,
  validateSearchFunds,
  validateGetNavData,
  validateComparePortfolios,
  validatePortfolioCreate,
  validateMultiSipCalculation,
  validateSchemeCode,
  validateDateRange,
  sanitizeRequest,
  schemas
};