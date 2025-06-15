const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

class AuthMiddleware {
  // Generate JWT token
  static generateToken(user) {
    const payload = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName
    };

    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'peptide-suggestions-app'
    });
  }

  // Middleware to verify JWT token
  static verifyToken(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'Access token is required',
            code: 'TOKEN_MISSING'
          }
        });
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
          logger.warn('Invalid token attempt:', { 
            error: err.message,
            ip: req.ip,
            userAgent: req.get('User-Agent')
          });

          let errorMessage = 'Invalid token';
          let errorCode = 'TOKEN_INVALID';

          if (err.name === 'TokenExpiredError') {
            errorMessage = 'Token has expired';
            errorCode = 'TOKEN_EXPIRED';
          } else if (err.name === 'JsonWebTokenError') {
            errorMessage = 'Malformed token';
            errorCode = 'TOKEN_MALFORMED';
          }

          return res.status(401).json({
            success: false,
            error: {
              message: errorMessage,
              code: errorCode
            }
          });
        }

        // Add user info to request object
        req.user = decoded;
        next();
      });

    } catch (error) {
      logger.error('Auth middleware error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Authentication system error',
          code: 'AUTH_SYSTEM_ERROR'
        }
      });
    }
  }

  // Optional middleware for routes that can work with or without authentication
  static optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without user info
      req.user = null;
      return next();
    }

    const token = authHeader.substring(7);

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        // Invalid token, but continue without user info
        req.user = null;
      } else {
        req.user = decoded;
      }
      next();
    });
  }

  // Verify token without middleware (for direct use)
  static verifyTokenDirect(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return null;
    }
  }

  // Refresh token (generate new token from valid token)
  static refreshToken(req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'User not authenticated',
            code: 'USER_NOT_AUTHENTICATED'
          }
        });
      }

      const newToken = AuthMiddleware.generateToken(req.user);
      
      res.json({
        success: true,
        data: {
          token: newToken,
          user: {
            id: req.user.id,
            email: req.user.email,
            firstName: req.user.firstName,
            lastName: req.user.lastName
          }
        }
      });
    } catch (error) {
      logger.error('Token refresh error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to refresh token',
          code: 'TOKEN_REFRESH_ERROR'
        }
      });
    }
  }
}

module.exports = AuthMiddleware;