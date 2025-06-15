const express = require('express');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const analyticsService = require('../services/analyticsService');
const userService = require('../services/userService');
const AuthMiddleware = require('../middleware/auth');

const router = express.Router();

// Validation schema
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
      'number.max': 'Age must be 120 or less',
      'any.required': 'Age is required'
    }),
  healthGoal: Joi.string()
    .valid('energy', 'sleep', 'focus', 'recovery', 'weight_management', 'immune_support')
    .required()
    .messages({
      'any.only': 'Health goal must be one of: energy, sleep, focus, recovery, weight_management, immune_support',
      'any.required': 'Health goal is required'
    })
});

// Mock suggestion generator (enhanced based on age and authentication status)
function generateSuggestions(age, goal, isAuthenticated = false, userHistory = []) {
  const baseTitle = isAuthenticated ? 'Personalized Peptide Recommendations' : 'General Peptide Recommendations';
  
  const suggestions = {
    energy: [
      {
        name: "Peptide Alpha-E",
        description: `Supports natural energy production. ${age < 30 ? 'Great for young adults building stamina.' : age < 50 ? 'Ideal for maintaining energy levels.' : 'Helps combat age-related energy decline.'}`
      },
      {
        name: "Mitochondrial Boost Complex",
        description: "Enhances cellular energy metabolism and reduces fatigue."
      },
      {
        name: "Vitality Peptide",
        description: isAuthenticated ? "Based on your profile, this may help with sustained energy throughout the day." : "May help with sustained energy throughout the day."
      }
    ],
    sleep: [
      {
        name: "Deep Rest Peptide",
        description: `Promotes restful sleep and recovery. ${age > 40 ? 'Particularly beneficial for age-related sleep improvements.' : 'Supports healthy sleep cycles.'}`
      },
      {
        name: "Circadian Balance Formula",
        description: "Helps regulate natural sleep-wake cycles and improves sleep quality."
      },
      {
        name: "Recovery Sleep Support",
        description: isAuthenticated ? "Customized for your sleep optimization needs." : "Supports optimal sleep recovery."
      }
    ],
    focus: [
      {
        name: "Cognitive Enhancement Peptide",
        description: `Supports mental clarity and focus. ${age < 35 ? 'Perfect for cognitive performance optimization.' : 'Helps maintain sharp mental function.'}`
      },
      {
        name: "Brain Boost Complex",
        description: "Enhances concentration and cognitive processing speed."
      },
      {
        name: "Mental Clarity Support",
        description: isAuthenticated ? "Tailored to your cognitive enhancement goals." : "Supports mental clarity and alertness."
      }
    ],
    recovery: [
      {
        name: "Rapid Recovery Peptide",
        description: `Accelerates muscle recovery and repair. ${age > 35 ? 'Essential for maintaining recovery speed with age.' : 'Optimizes post-workout recovery.'}`
      },
      {
        name: "Tissue Repair Formula",
        description: "Supports faster healing and reduces recovery time."
      },
      {
        name: "Athletic Recovery Support",
        description: isAuthenticated ? "Designed for your specific recovery needs." : "Supports comprehensive recovery processes."
      }
    ],
    weight_management: [
      {
        name: "Metabolic Support Peptide",
        description: `Supports healthy metabolism. ${age > 30 ? 'Helps counter age-related metabolic changes.' : 'Optimizes metabolic function.'}`
      },
      {
        name: "Fat Metabolism Enhancer",
        description: "Promotes efficient fat burning and metabolic health."
      },
      {
        name: "Body Composition Support",
        description: isAuthenticated ? "Personalized for your weight management journey." : "Supports healthy body composition."
      }
    ],
    immune_support: [
      {
        name: "Immune Defense Peptide",
        description: `Strengthens immune system function. ${age > 50 ? 'Critical for age-related immune support.' : 'Supports robust immune response.'}`
      },
      {
        name: "Immunity Boost Complex",
        description: "Enhances natural immune defenses and resistance."
      },
      {
        name: "Wellness Protection Formula",
        description: isAuthenticated ? "Customized immune support based on your profile." : "Supports overall immune wellness."
      }
    ]
  };

  return suggestions[goal] || suggestions.energy;
}

// Validation middleware
const validateSuggestionsRequest = async (req, res, next) => {
  try {
    const { error, value } = suggestionsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          message: error.details[0].message,
          field: error.details[0].path[0],
          code: 'VALIDATION_ERROR'
        }
      });
    }
    req.body = value;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: 'Validation error',
        code: 'VALIDATION_SYSTEM_ERROR'
      }
    });
  }
};

// POST /suggestions - Get peptide suggestions (works with and without auth)
router.post('/', AuthMiddleware.optionalAuth, validateSuggestionsRequest, async (req, res) => {
  const requestId = uuidv4();
  
  try {
    const { age, healthGoal } = req.body;
    const isAuthenticated = !!req.user;
    let userHistory = [];

    logger.info('Processing suggestions request', {
      requestId,
      age,
      goal: healthGoal,
      userId: req.user?.id || 'anonymous',
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Get user history if authenticated
    if (isAuthenticated) {
      try {
        userHistory = await userService.getUserSuggestions(req.user.id, 5);
      } catch (error) {
        logger.warn('Failed to fetch user history:', {
          requestId,
          userId: req.user.id,
          error: error.message
        });
        // Continue without history
      }
    }

    // Log analytics
    try {
      await analyticsService.logSuccessfulRequest(req.body.healthGoal, req.body.age);
      await analyticsService.logGoalSelection(healthGoal, age, req.user?.id);
      
    } catch (error) {
      logger.error('Analytics logging failed:', {
        requestId,
        error: error.message
      });
      // Continue without analytics
    }

    // Generate suggestions
    const suggestions = generateSuggestions(age, healthGoal, isAuthenticated, userHistory);

    // Save to user history if authenticated
    if (isAuthenticated) {
      try {
        await userService.saveSuggestion(req.user.id, age, healthGoal, suggestions);
        logger.info('Suggestion saved to user history:', {
          requestId,
          userId: req.user.id
        });
      } catch (error) {
        logger.error('Failed to save suggestion to history:', {
          requestId,
          userId: req.user.id,
          error: error.message
        });
        // Continue without saving
      }
    }


    logger.info('Successfully generated suggestions', {
      requestId,
      suggestionsCount: suggestions.length,
      userId: req.user?.id || 'anonymous'
    });

    res.json({
      success: true,
      requestId,
      suggestions,
      meta: {
        generatedAt: new Date().toISOString(),
        goalCategory: healthGoal,
        authenticated: isAuthenticated,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error generating suggestions', {
      requestId,
      error: error.message,
      stack: error.stack,
      age: req.body.age,
      goal: req.body.healthGoal
    });

    // Log failed request
    try {
      await analyticsService.logFailedRequest(req.body.healthGoal, req.body.age, error.message);
    } catch (analyticsError) {
      logger.error('Failed to log analytics for failed request:', analyticsError);
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to generate suggestions. Please try again.',
        code: 'GENERATION_ERROR',
        requestId
      }
    });
  }
});

// GET /suggestions/goals - Get available health goals
router.get('/goals', (req, res) => {
  const goals = [
    { value: 'energy', label: 'Energy & Vitality' },
    { value: 'sleep', label: 'Better Sleep' },
    { value: 'focus', label: 'Mental Focus' },
    { value: 'recovery', label: 'Recovery & Repair' },
    { value: 'weight_management', label: 'Weight Management' },
    { value: 'immune_support', label: 'Immune Support' }
  ];

  res.json({
    success: true,
    goals
  });
});


module.exports = router;