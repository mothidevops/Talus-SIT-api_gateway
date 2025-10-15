const { createProxyMiddleware } = require('http-proxy-middleware');
const { services } = require('../config/services');
const { getBreaker } = require('../utils/circuitBreaker');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');

function createServiceProxy(serviceName, serviceConfig) {
  const breaker = getBreaker(serviceName);

  return createProxyMiddleware({
    target: serviceConfig.url,
    changeOrigin: true,
    timeout: serviceConfig.timeout,
    
    pathRewrite: (path) => {
      return path.replace(`/api/v1${serviceConfig.prefix}`, '/api/v1');
    },

    onProxyReq: (proxyReq, req, res) => {
      if (req.headers['x-user-id']) {
        proxyReq.setHeader('X-User-Id', req.headers['x-user-id']);
      }
      if (req.headers['x-user-role']) {
        proxyReq.setHeader('X-User-Role', req.headers['x-user-role']);
      }
      if (req.headers['x-merchant-id']) {
        proxyReq.setHeader('X-Merchant-Id', req.headers['x-merchant-id']);
      }
      
      if (req.id) {
        proxyReq.setHeader('X-Request-Id', req.id);
      }

      proxyReq.setHeader('X-Service-Token', generateServiceToken());

      logger.debug({
        type: 'proxy_request',
        requestId: req.id,
        service: serviceName,
        target: serviceConfig.url + req.path
      });
    },

    onProxyRes: (proxyRes, req, res) => {
      if (proxyRes.statusCode < 500) {
        breaker.onSuccess();
      }

      logger.debug({
        type: 'proxy_response',
        requestId: req.id,
        service: serviceName,
        statusCode: proxyRes.statusCode
      });
    },

    onError: async (err, req, res) => {
      logger.error({
        type: 'proxy_error',
        requestId: req.id,
        service: serviceName,
        error: err.message
      });

      try {
        await breaker.onFailure(err);
      } catch (breakerError) {
        return res.status(503).json({
          success: false,
          error: 'Service temporarily unavailable',
          service: serviceName,
          requestId: req.id
        });
      }

      if (err.code === 'ECONNREFUSED') {
        res.status(503).json({
          success: false,
          error: 'Service unavailable',
          service: serviceName,
          requestId: req.id
        });
      } else if (err.code === 'ETIMEDOUT') {
        res.status(504).json({
          success: false,
          error: 'Service request timeout',
          service: serviceName,
          requestId: req.id
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Service error',
          service: serviceName,
          requestId: req.id
        });
      }
    }
  });
}

function generateServiceToken() {
  return jwt.sign(
    {
      service: 'api-gateway',
      type: 'service-to-service'
    },
    process.env.SERVICE_SECRET || 'service-secret',
    { expiresIn: '5m' }
  );
}

module.exports = { createServiceProxy };
