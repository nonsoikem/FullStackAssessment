const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta, null, 2)}`;
    }
    
    return logMessage;
  })
);

// JSON format for structured logging
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let logMessage = `${timestamp} ${level}: ${message}`;
    
    // Add metadata in a more readable format for console
    if (Object.keys(meta).length > 0) {
      const metaString = Object.keys(meta)
        .map(key => `${key}=${JSON.stringify(meta[key])}`)
        .join(' ');
      logMessage += ` | ${metaString}`;
    }
    
    return logMessage;
  })
);

// Daily rotate file transport for all logs
const dailyRotateFileTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'application-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  format: logFormat,
  level: 'info'
});

// Daily rotate file transport for error logs
const errorRotateFileTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  format: logFormat,
  level: 'error'
});

// Analytics specific transport
const analyticsRotateFileTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'analytics-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '10m',
  maxFiles: '90d',
  format: jsonFormat
});

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: jsonFormat,
  defaultMeta: {
    service: 'peptide-suggestions-api',
    version: process.env.npm_package_version || '1.0.0'
  },
  transports: [
    dailyRotateFileTransport,
    errorRotateFileTransport
  ],
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      format: logFormat
    })
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      format: logFormat
    })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug'
  }));
}

// Analytics logger for separate analytics tracking
const analyticsLogger = winston.createLogger({
  level: 'info',
  format: jsonFormat,
  defaultMeta: {
    service: 'peptide-suggestions-analytics'
  },
  transports: [
    analyticsRotateFileTransport
  ]
});

// Performance logger for monitoring
const performanceLogger = winston.createLogger({
  level: 'info',
  format: jsonFormat,
  defaultMeta: {
    service: 'peptide-suggestions-performance'
  },
  transports: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'performance-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '10m',
      maxFiles: '30d',
      format: jsonFormat
    })
  ]
});

// Utility functions for structured logging
const loggers = {
  // Main application logger
  info: (message, meta = {}) => logger.info(message, meta),
  warn: (message, meta = {}) => logger.warn(message, meta),
  error: (message, meta = {}) => logger.error(message, meta),
  debug: (message, meta = {}) => logger.debug(message, meta),
  
  // Analytics specific logging
  analytics: (event, data = {}) => {
    analyticsLogger.info(event, {
      ...data,
      timestamp: new Date().toISOString(),
      eventType: 'analytics'
    });
  },
  
  // Performance monitoring
  performance: (operation, duration, meta = {}) => {
    performanceLogger.info('Performance Metric', {
      operation,
      duration,
      ...meta,
      timestamp: new Date().toISOString(),
      eventType: 'performance'
    });
  },
  
  // Request logging with timing
  request: (req, res, duration) => {
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      contentLength: res.get('content-length'),
      referrer: req.get('Referrer')
    };
    
    if (res.statusCode >= 400) {
      logger.warn('HTTP Request', logData);
    } else {
      logger.info('HTTP Request', logData);
    }
  },
  
  
};

// Export both individual loggers and the main logger
module.exports = {
  ...loggers,
  logger,
  analyticsLogger,
  performanceLogger
};