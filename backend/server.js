const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const cron = require('node-cron');
require('dotenv').config();

// Import custom modules
const logger = require('./src/utils/logger');
const database = require('./src/database');
const mfApiService = require('./src/services/mfApiService');
const calculationService = require('./src/services/calculationService');
const { errorHandler, notFoundHandler, handleUncaughtException, handleUnhandledRejection, asyncHandler } = require('./src/middleware/errorHandler');
const { validateSearchFunds, validateSchemeCode, validateDateRange, validateComparePortfolios, sanitizeRequest } = require('./src/middleware/validation');
const fundsRoutes = require('./src/routes/funds');
const portfolioRoutes = require('./src/routes/portfolio');

// Handle uncaught exceptions and rejections
handleUncaughtException();
handleUnhandledRejection();

const app = express();

// Trust proxy for correct IP addresses
app.set('trust proxy', 1);

// Global middleware
app.use(compression()); // Compress responses
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request sanitization
app.use(sanitizeRequest);

// Request logging
app.use(logger.requestLogger);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Graceful shutdown handler
let isShuttingDown = false;
let server;

// Health check endpoint
app.get('/health', asyncHandler(async (req, res) => {
  if (isShuttingDown) {
    return res.status(503).json({
      status: 'shutting_down',
      timestamp: new Date().toISOString()
    });
  }

  const services = {};
  const databaseEnabled = process.env.ENABLE_DATABASE === 'true';
  
  // Only check database if enabled
  if (databaseEnabled) {
    try {
      services.database = await database.healthCheck();
    } catch (error) {
      services.database = { status: 'unhealthy', error: error.message };
    }
  } else {
    services.database = { status: 'disabled', message: 'Database not enabled' };
  }
  
  services.mfApi = await mfApiService.getHealthStatus();
  
  // Consider healthy if MF API is healthy (database is optional)
  const overallStatus = services.mfApi.status === 'healthy' ? 'healthy' : 'degraded';
  const statusCode = overallStatus === 'healthy' ? 200 : 503;
  
  res.status(statusCode).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    services,
    database_enabled: databaseEnabled,
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.floor(process.uptime())
  });
}));

// Readiness check for Kubernetes
app.get('/ready', asyncHandler(async (req, res) => {
  if (isShuttingDown) {
    return res.status(503).json({ status: 'not_ready' });
  }
  
  const databaseEnabled = process.env.ENABLE_DATABASE === 'true';
  
  try {
    // Only test database if enabled
    if (databaseEnabled) {
      await database.query('SELECT 1');
    }
    res.json({ 
      status: 'ready', 
      timestamp: new Date().toISOString(),
      database_enabled: databaseEnabled
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'not_ready', 
      error: error.message,
      database_enabled: databaseEnabled
    });
  }
}));

// API Routes
app.use('/api', fundsRoutes);
app.use('/api/portfolio', portfolioRoutes);



// Setup scheduled tasks
cron.schedule('0 2 * * *', async () => {
  const databaseEnabled = process.env.ENABLE_DATABASE === 'true';
  if (!databaseEnabled) {
    logger.info('Skipping cache cleanup - database disabled');
    return;
  }
  
  logger.info('Running scheduled cache cleanup');
  try {
    const deletedCount = await database.clearExpiredCache();
    logger.info(`Cache cleanup completed, deleted ${deletedCount} entries`);
  } catch (error) {
    logger.error('Cache cleanup failed', error);
  }
});

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  isShuttingDown = true;
  
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed.');
      
      try {
        const databaseEnabled = process.env.ENABLE_DATABASE === 'true';
        if (databaseEnabled) {
          await database.close();
          logger.info('Database connections closed.');
        } else {
          logger.info('Database was disabled - no connections to close.');
        }
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', error);
        process.exit(1);
      }
    });
  }
  
  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

const PORT = process.env.PORT || 3001;

// Start server
server = app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📊 Health check: http://localhost:${PORT}/health`);
  logger.info(`🔍 API documentation: http://localhost:${PORT}/api`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Handle server errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`Port ${PORT} is already in use`);
  } else {
    logger.error('Server error', error);
  }
  process.exit(1);
});

module.exports = app;