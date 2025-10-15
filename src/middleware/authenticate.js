const jwt = require('jsonwebtoken');
const axios = require('axios');
const config = require('../config');
const { publicRoutes } = require('../config/services');
const logger = require('../utils/logger');

async function authenticateToken(req, res, next) {
  try {
    const isPublicRoute = publicRoutes.some(route => {
      const pattern = route.replace(/:[^/]+/g, '[^/]+');
      const regex = new RegExp(`^/api/v1${pattern}$`);
      return regex.test(req.path);
    });

    if (isPublicRoute) {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const token = authHeader.substring(7);

    let cachedUser = null;
    try {
      const { getRedisClient } = require('../config/redis');
      const redis = getRedisClient();
      if (redis && redis.status === 'ready') {
        cachedUser = await redis.get(`token:${token}`);
      }
    } catch (error) {
      logger.debug('Redis not available for token cache');
    }
    
    if (cachedUser) {
      req.user = JSON.parse(cachedUser);
      req.headers['x-user-id'] = req.user.userId;
      req.headers['x-user-role'] = req.user.role;
      req.headers['x-merchant-id'] = req.user.merchantId || '';
      return next();
    }

    const response = await axios.post(
      `${config.services.auth.url}/api/v1/auth/verify`,
      { token },
      { timeout: 2000 }
    );

    if (!response.data.valid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    req.user = response.data.user;
    try {
      const { getRedisClient } = require('../config/redis');
      const redis = getRedisClient();
      if (redis && redis.status === 'ready') {
        await redis.setex(
          `token:${token}`,
          300,
          JSON.stringify(req.user)
        );
      }
    } catch (error) {
      logger.debug('Could not cache token');
    }

    req.headers['x-user-id'] = req.user.userId;
    req.headers['x-user-role'] = req.user.role;
    req.headers['x-merchant-id'] = req.user.merchantId || '';

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    
    res.status(401).json({
      success: false,
      error: 'Authentication failed'
    });
  }
}

module.exports = authenticateToken;
