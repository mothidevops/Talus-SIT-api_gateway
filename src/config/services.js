const config = require('./index');

const publicRoutes = [
  '/auth/fallback/otp/send',
  '/auth/fallback/otp/verify',
  '/auth/bootstrap/device',
  '/auth/refresh',
  '/auth/verify',
  '/webhook/talus/onboarding',
  '/health',
  '/metrics'
];

const specialRoutes = {
  fileUploads: [
    '/catalog/products/import',
    '/catalog/products/:productId/image'
  ],
  
  longRunning: [
    '/reports/generate',
    '/reports/export'
  ],
  
  sensitive: [
    '/payment/process',
    '/payment/refund',
    '/auth/pin/verify'
  ]
};

const healthEndpoints = {
  auth: '/health',
  merchant: '/health',
  catalog: '/health',
  cart: '/health',
  payment: '/health',
  reporting: '/health'
};

// sit-api-gateway/src/config/services.js
module.exports = {
  services: {
    auth: {
      url: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
      prefix: '/auth',
      timeout: 5000,
      healthCheck: true
    },
    merchant: {
      url: process.env.MERCHANT_SERVICE_URL || 'http://localhost:3002',
      prefix: '/merchant',
      timeout: 5000,
      healthCheck: true
    },
    
    catalog: {
      url: process.env.CATALOG_SERVICE_URL || 'http://localhost:3003',
      prefix: '/catalog',
      timeout: 5000,
      healthCheck: false
    },
    cart: {
      url: process.env.CART_SERVICE_URL || 'http://localhost:3004',
      prefix: '/cart',
      timeout: 5000,
      healthCheck: false
    },
    payment: {
      url: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3005',
      prefix: '/payment',
      timeout: 5000,
      healthCheck: false
    },
    reporting: {
      url: process.env.REPORTING_SERVICE_URL || 'http://localhost:3006',
      prefix: '/reports',
      timeout: 10000,
      healthCheck: false
    }
  }
};
