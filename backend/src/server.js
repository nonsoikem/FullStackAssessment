const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('express-async-errors');
require('dotenv').config();

const logger = require('./utils/logger');
const analyticsService = require('./services/analyticsService');
const userService = require('./services/userService');
const database = require('./config/database');

// Import routes
const suggestionsRouter = require('./routes/suggestions');
const authRouter = require('./routes/auth');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database and services
async function initializeApp() {
  try {
    // Initialize database
    await database.initialize();
    logger.info('Database initialized successfully');

    // Initialize user service
    userService.initialize();
    logger.info('User service initialized successfully');

  } catch (error) {
    logger.error('Failed to initialize application:', error);
    process.exit(1);
  }
}

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.id || 'anonymous'
    });
  });
  
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    database: 'connected',
    services: {
      userService: 'ready',
      analytics: 'ready'
    }
  });
});

// API routes
app.use('/auth', authRouter);
app.use('/suggestions', suggestionsRouter);

// Analytics endpoint
app.get('/analytics', async (req, res) => {
  try {
    const analytics = await analyticsService.getDailyAnalytics();
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    logger.error('Analytics endpoint error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to retrieve analytics' 
    });
  }
});

// API documentation endpoint
app.get('/api-docs', (req, res) => {
  res.json({
    title: 'Peptide Suggestions API',
    version: '1.0.0',
    description: 'API for personalized peptide recommendations with user authentication',
    endpoints: {
      authentication: {
        'POST /auth/register': 'Register a new user account',
        'POST /auth/login': 'Login with email and password',
        'GET /auth/profile': 'Get user profile (requires authentication)',
        'PUT /auth/profile': 'Update user profile (requires authentication)',
        'POST /auth/change-password': 'Change user password (requires authentication)',
        'POST /auth/refresh': 'Refresh JWT token (requires authentication)',
        'GET /auth/suggestions': 'Get user suggestion history (requires authentication)',
        'DELETE /auth/account': 'Delete user account (requires authentication)',
        'GET /auth/verify': 'Verify token validity (requires authentication)'
      },
      suggestions: {
        'POST /suggestions': 'Get peptide suggestions (works with or without authentication)'
      },
      system: {
        'GET /health': 'Health check endpoint',
        'GET /analytics': 'Get analytics data',
        'GET /api-docs': 'This documentation'
      }
    },
    authentication: {
      type: 'Bearer Token',
      description: 'Include JWT token in Authorization header: "Bearer <token>"'
    },
    rateLimit: {
      general: '100 requests per 15 minutes',
      authentication: '5 requests per 15 minutes'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: `The requested endpoint ${req.method} ${req.path} does not exist`,
      code: 'ENDPOINT_NOT_FOUND'
    },
    availableEndpoints: '/api-docs'
  });
});

// Global error handler (must be last)
app.use((error, req, res, next) => {
  // Generate unique error ID for tracking
  const errorId = require('uuid').v4();
  
  // Default error properties
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal Server Error';
  
  // Log error details
  logger.error('Server Error', {
    errorId,
    message: error.message,
    statusCode,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id,
    timestamp: new Date().toISOString()
  });
  
  // Prepare error response
  const errorResponse = {
    success: false,
    error: {
      message,
      errorId,
      timestamp: new Date().toISOString()
    }
  };
  
  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.stack = error.stack;
  }
  
  res.status(statusCode).json(errorResponse);
});

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Received shutdown signal, closing server gracefully...');
  
  try {
    await database.close();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error('Error closing database:', error);
  }
  
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Initialize and start server
initializeApp().then(() => {
  app.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT}`, {
      environment: process.env.NODE_ENV || 'development',
      port: PORT
    });
    
    logger.info('🔗 Available endpoints:', {
      health: `http://localhost:${PORT}/health`,
      auth: `http://localhost:${PORT}/auth`,
      suggestions: `http://localhost:${PORT}/suggestions`,
      analytics: `http://localhost:${PORT}/analytics`,
      docs: `http://localhost:${PORT}/api-docs`
    });
  });
}).catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});

module.exports = app;