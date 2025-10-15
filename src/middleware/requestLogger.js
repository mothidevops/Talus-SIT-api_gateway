const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

function requestLogger(req, res, next) {
  const requestId = uuidv4();
  const start = Date.now();

  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);

  logger.info({
    type: 'request',
    requestId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user?.userId
  });

  const originalSend = res.send;
  res.send = function(data) {
    res.responseBody = data;
    originalSend.call(res, data);
  };

  res.on('finish', () => {
    const duration = Date.now() - start;
    
    logger.info({
      type: 'response',
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.userId
    });

    if (duration > 1000) {
      logger.warn({
        type: 'slow_request',
        requestId,
        url: req.originalUrl,
        duration: `${duration}ms`
      });
    }
  });

  next();
}

module.exports = requestLogger;
