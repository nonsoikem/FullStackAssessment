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

  // Add personalization note for authenticated users
  const baseResponse = {
    title: baseTitle,
    suggestions: suggestions[goal] || suggestions.energy,
    disclaimer: "These suggestions are for informational purposes only. Consult with a healthcare professional before starting any new supplement regimen.",
    generatedAt: new Date().toISOString()
  };

  if (isAuthenticated) {
    baseResponse.personalization = {
      note: "These recommendations are personalized based on your profile and previous interactions.",
      historyCount: userHistory.length,
      lastGoal: userHistory.length > 0 ? userHistory[0].healthGoal : null
    };
  }

  return baseResponse;
}

// POST /suggestions - Get peptide suggestions (works with and without auth)
router.post('/', AuthMiddleware.optionalAuth, async (req, res) => {
  const requestId = uuidv4();
  
  try {
    // Validate request body
    const { error, value } = suggestionsSchema.validate(req.body);
    if (error) {
      logger.warn('Validation error in suggestions:', {
        requestId,
        error: error.details[0].message,
        body: req.body,
        ip: req.ip
      });

      return res.status(400).json({
        success: false,
        error: {
          message: error.details[0].message,
          field: error.details[0].path[0],
          code: 'VALIDATION_ERROR'
        }
      });
    }

    const { age, healthGoal } = value;
    const isAuthenticated = !!req.user;
    let userHistory = [];

    logger.info('Generating suggestions:', {
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
        await userService.saveSuggestion(req.user.id, age, healthGoal, suggestions.suggestions);
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

    logger.info('Suggestions generated successfully:', {
      requestId,
      suggestionsCount: suggestions.suggestions.length,
      userId: req.user?.id || 'anonymous'
    });

    res.json({
      success: true,
      data: suggestions,
      meta: {
        requestId,
        authenticated: isAuthenticated,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error generating suggestions:', {
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

// error handling middleware
router.use((error, req, res, next) => {
  const errorId = uuidv4();
  
  logger.error('Suggestions route error:', {
    errorId,
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    userId: req.user?.id,
    ip: req.ip
  });

  res.status(500).json({
    success: false,
    error: {
      message: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
      errorId
    }
  });
});

module.exports = router;