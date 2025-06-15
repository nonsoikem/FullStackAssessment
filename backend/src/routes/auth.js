const express = require('express');
const Joi = require('joi');
const rateLimit = require('express-rate-limit');
const userService = require('../services/userService');
const AuthMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs for auth endpoints
  message: {
    success: false,
    error: {
      message: 'Too many authentication attempts, please try again later.',
      code: 'TOO_MANY_ATTEMPTS'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      'any.required': 'Password is required'
    }),
  firstName: Joi.string()
    .trim()
    .min(1)
    .max(50)
    .optional()
    .messages({
      'string.min': 'First name cannot be empty',
      'string.max': 'First name cannot exceed 50 characters'
    }),
  lastName: Joi.string()
    .trim()
    .min(1)
    .max(50)
    .optional()
    .messages({
      'string.min': 'Last name cannot be empty',
      'string.max': 'Last name cannot exceed 50 characters'
    })
});

const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required'
    })
});



// POST /auth/register - Register new user
router.post('/register', authLimiter, async (req, res) => {
  const requestId = uuidv4();
  
  try {
    // Validate input
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          message: error.details[0].message,
          code: 'VALIDATION_ERROR'
        }
      });
    }

    const { email, password, firstName, lastName } = value;

    logger.info('User registration attempt:', {
      requestId,
      email,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Create user
    const user = await userService.createUser({
      email,
      password,
      firstName: firstName || '',
      lastName: lastName || ''
    });

    // Generate JWT token
    const token = AuthMiddleware.generateToken(user);

    logger.info('User registered successfully:', {
      requestId,
      userId: user.id,
      email: user.email
    });

    res.status(201).json({
      success: true,
      data: {
        message: 'User registered successfully',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName
        },
        token
      }
    });

  } catch (error) {
    logger.error('Registration error:', {
      requestId,
      error: error.message,
      email: req.body.email
    });

    if (error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: {
          message: 'An account with this email already exists',
          code: 'EMAIL_EXISTS'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to register user. Please try again.',
        code: 'REGISTRATION_ERROR'
      }
    });
  }
});

// POST /auth/login - Login user
router.post('/login', authLimiter, async (req, res) => {
  const requestId = uuidv4();
  
  try {
    // Validate input
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          message: error.details[0].message,
          code: 'VALIDATION_ERROR'
        }
      });
    }

    const { email, password } = value;

    logger.info('User login attempt:', {
      requestId,
      email,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Authenticate user
    const user = await userService.authenticateUser(email, password);

    // Generate JWT token
    const token = AuthMiddleware.generateToken(user);

    logger.info('User logged in successfully:', {
      requestId,
      userId: user.id,
      email: user.email
    });

    res.json({
      success: true,
      data: {
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName
        },
        token
      }
    });

  } catch (error) {
    logger.error('Login error:', {
      requestId,
      error: error.message,
      email: req.body.email
    });

    if (error.message.includes('Invalid email or password')) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Login failed. Please try again.',
        code: 'LOGIN_ERROR'
      }
    });
  }
});

// GET /auth/profile - Get user profile (protected)
router.get('/profile', AuthMiddleware.verifyToken, async (req, res) => {
  try {
    const user = await userService.getUserById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        }
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      }
    });

  } catch (error) {
    logger.error('Profile fetch error:', {
      userId: req.user.id,
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch profile',
        code: 'PROFILE_FETCH_ERROR'
      }
    });
  }
});


// GET /auth/suggestions - Get user's suggestion history (protected)
router.get('/suggestions', AuthMiddleware.verifyToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const suggestions = await userService.getUserSuggestions(req.user.id, limit);

    res.json({
      success: true,
      data: {
        suggestions,
        total: suggestions.length
      }
    });

  } catch (error) {
    logger.error('Fetch suggestions error:', {
      userId: req.user.id,
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch suggestion history',
        code: 'SUGGESTIONS_FETCH_ERROR'
      }
    });
  }
});


// GET /auth/verify - Verify token validity (protected)
router.get('/verify', AuthMiddleware.verifyToken, (req, res) => {
  res.json({
    success: true,
    data: {
      valid: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName
      }
    }
  });
});

module.exports = router;