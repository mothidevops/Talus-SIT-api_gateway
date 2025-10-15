require('dotenv').config();

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
  serviceName: 'sit-api-gateway',
  
  services: {
    auth: {
      url: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
      prefix: '/auth',
      timeout: 5000
    },
    merchant: {
      url: process.env.MERCHANT_SERVICE_URL || 'http://localhost:3002',
      prefix: '/merchant',
      timeout: 5000
    }
  },
  
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
  
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  }
};

module.exports = config;