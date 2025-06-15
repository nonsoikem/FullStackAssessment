const Joi = require('joi');
const logger = require('../utils/logger');

/**
 * Validation schema for suggestions request
 */
const suggestionsSchema = Joi.object({
  age: Joi.number()
    .integer()
    .min(18)
    .max(120)
    .required()
    .messages({
      'number.base': 'Age must be a number',
      'number.integer': 'Age must be a whole number',
      'number.min': 'Age must be at least 18',
      'number.max': 'Age cannot exceed 120',
      'any.required': 'Age is required'
    }),
  
  goal: Joi.string()
    .valid('energy', 'sleep', 'focus', 'recovery', 'longevity')
    .required()
    .messages({
      'string.base': 'Goal must be a text value',
      'any.only': 'Goal must be one of: energy, sleep, focus, recovery, longevity',
      'any.required': 'Health goal is required'
    })
});

/**
 * Validation schema for PDF export request
 */
const pdfExportSchema = Joi.object({
  age: Joi.number()
    .integer()
    .min(18)
    .max(120)
    .required(),
  
  goal: Joi.string()
    .valid('energy', 'sleep', 'focus', 'recovery', 'longevity')
    .required(),
    
  suggestions: Joi.array()
    .items(Joi.object({
      name: Joi.string().required(),
      description: Joi.string().required(),
      dosage: Joi.string().optional(),
      timing: Joi.string().optional()
    }))
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one suggestion is required for PDF export'
    })
});

/**
 * Generic validation middleware factory
 * @param {Joi.ObjectSchema} schema - Joi validation schema
 * @param {string} source - Where to find data ('body', 'query', 'params')
 * @returns {Function} Express middleware function
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = req[source];
    
    const { error, value } = schema.validate(data, {
      abortEarly: false, // Return all validation errors
      stripUnknown: true, // Remove unknown fields
      convert: true // Convert strings to numbers where appropriate
    });
    
    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));
      
      logger.warn('Validation error', {
        endpoint: req.path,
        method: req.method,
        errors: validationErrors,
        receivedData: data
      });
      
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Please check your input and try again',
        details: validationErrors,
        timestamp: new Date().toISOString()
      });
    }
    
    // Replace request data with validated and sanitized data
    req[source] = value;
    next();
  };
};

/**
 * Specific middleware for suggestions endpoint validation
 */
const validateSuggestionsRequest = validate(suggestionsSchema, 'body');

/**
 * Specific middleware for PDF export validation
 */
const validatePdfExportRequest = validate(pdfExportSchema, 'body');

/**
 * Custom validation for production edge cases
 */
const validateProductionConstraints = (req, res, next) => {
  const { age, goal } = req.body;
  
  // Additional business logic validation that might not fit in Joi
  const warnings = [];
  
  // Age-specific warnings
  if (age < 21) {
    warnings.push('Peptide therapy for individuals under 21 requires additional medical supervision');
  }
  
  if (age > 70) {
    warnings.push('Enhanced medical monitoring recommended for individuals over 70');
  }
  
  // Goal-specific validation
  if (goal === 'recovery' && age < 25) {
    warnings.push('Young individuals typically have excellent natural recovery - consider lifestyle modifications first');
  }
  
  if (goal === 'longevity' && age < 30) {
    warnings.push('Longevity peptides are typically most beneficial after age 30');
  }
  
  // Add warnings to request for use in response
  req.validationWarnings = warnings;
  
  next();
};

/**
 * Rate limiting validation for specific endpoints
 */
const validateRateLimit = (maxRequests = 10, timeWindow = 60000) => {
  const requestCounts = new Map();
  
  return (req, res, next) => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    
    // Clean up old entries
    for (const [ip, data] of requestCounts.entries()) {
      if (now - data.firstRequest > timeWindow) {
        requestCounts.delete(ip);
      }
    }
    
    // Check current client
    const clientData = requestCounts.get(clientId);
    
    if (!clientData) {
      requestCounts.set(clientId, {
        count: 1,
        firstRequest: now
      });
      return next();
    }
    
    if (now - clientData.firstRequest > timeWindow) {
      // Reset window
      requestCounts.set(clientId, {
        count: 1,
        firstRequest: now
      });
      return next();
    }
    
    if (clientData.count >= maxRequets) {
      logger.warn('Rate limit exceeded', {
        ip: clientId,
        endpoint: req.path,
        count: clientData.count
      });
      
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Too many requests. Maximum ${maxRequests} requests per ${timeWindow / 1000} seconds.`,
        retryAfter: Math.ceil((timeWindow - (now - clientData.firstRequest)) / 1000)
      });
    }
    
    clientData.count++;
    next();
  };
};

module.exports = {
  validate,
  validateSuggestionsRequest,
  validatePdfExportRequest,
  validateProductionConstraints,
  validateRateLimit,
  schemas: {
    suggestions: suggestionsSchema,
    pdfExport: pdfExportSchema
  }
};