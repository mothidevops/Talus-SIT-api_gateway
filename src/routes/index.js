// sit-api-gateway/src/routes/index.js - COMPLETE CLEAN VERSION
const express = require('express');
const httpProxy = require('http-proxy-middleware');
const config = require('../config');

const router = express.Router();

// Simple proxy setup for existing services only
const { createProxyMiddleware } = httpProxy;

// Auth Service Proxy
router.use('/auth', createProxyMiddleware({
  target: 'http://localhost:3001',
  changeOrigin: true,
  pathRewrite: {
    '^/auth': '/api/v1/auth'
  }
}));

// Merchant Service Proxy
router.use('/merchant', createProxyMiddleware({
  target: 'http://localhost:3002',
  changeOrigin: true,
  pathRewrite: {
    '^/merchant': '/api/v1/merchant'
  }
}));

// Device endpoints (through merchant service)
router.use('/device', createProxyMiddleware({
  target: 'http://localhost:3002',
  changeOrigin: true,
  pathRewrite: {
    '^/device': '/api/v1/device'
  }
}));

// Webhook endpoints (through merchant service)
router.use('/webhook', createProxyMiddleware({
  target: 'http://localhost:3002',
  changeOrigin: true,
  pathRewrite: {
    '^/webhook': '/api/v1/webhook'
  }
}));

module.exports = router;