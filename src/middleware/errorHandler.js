const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error({
    type: 'error',
    requestId: req.id,
    error: {
      message: err.message,
      stack: err.stack,
      code: err.code
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userId: req.user?.userId
    }
  });

  if (err.code === 'ECONNREFUSED') {
    return res.status(503).json({
      success: false,
      error: 'Service temporarily unavailable',
      requestId: req.id
    });
  }

  if (err.code === 'ETIMEDOUT') {
    return res.status(504).json({
      success: false,
      error: 'Service request timeout',
      requestId: req.id
    });
  }

  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'An error occurred'
    : err.message;

  res.status(statusCode).json({
    success: false,
    error: message,
    requestId: req.id,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
}

module.exports = errorHandler;
