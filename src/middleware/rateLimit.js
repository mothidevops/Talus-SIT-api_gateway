const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const { getRedisClient } = require('../config/redis');
const config = require('../config');
const logger = require('../utils/logger');

function createRateLimiter(options = {}) {
  try {
    const redis = getRedisClient();
    
    return rateLimit({
      store: new RedisStore({
        client: redis,
        prefix: 'rl:',
        sendCommand: (...args) => redis.call(...args)
      }),
      windowMs: options.windowMs || config.rateLimit.windowMs,
      max: options.max || config.rateLimit.maxRequests,
      message: {
        success: false,
        error: 'Too many requests, please try again later'
      },
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        return req.path === '/health' || req.path === '/metrics';
      },
      keyGenerator: (req) => {
        return req.user?.userId || req.ip;
      }
    });
  } catch (error) {
    logger.warn('Redis not available for rate limiting, using memory store');
    
    return rateLimit({
      windowMs: options.windowMs || config.rateLimit.windowMs,
      max: options.max || config.rateLimit.maxRequests,
      message: {
        success: false,
        error: 'Too many requests, please try again later'
      },
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        return req.path === '/health' || req.path === '/metrics';
      },
      keyGenerator: (req) => {
        return req.user?.userId || req.ip;
      }
    });
  }
}

let defaultLimiter = null;
let strictLimiter = null;
let authLimiter = null;
let paymentLimiter = null;

module.exports = {
  get defaultLimiter() {
    if (!defaultLimiter) {
      defaultLimiter = createRateLimiter();
    }
    return defaultLimiter;
  },
  
  get strictLimiter() {
    if (!strictLimiter) {
      strictLimiter = createRateLimiter({
        windowMs: 60000,
        max: 10
      });
    }
    return strictLimiter;
  },
  
  get authLimiter() {
    if (!authLimiter) {
      authLimiter = createRateLimiter({
        windowMs: 300000,
        max: 20
      });
    }
    return authLimiter;
  },
  
  get paymentLimiter() {
    if (!paymentLimiter) {
      paymentLimiter = createRateLimiter({
        windowMs: 60000,
        max: 5
      });
    }
    return paymentLimiter;
  }
};
