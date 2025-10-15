const express = require('express');
const helmet = require('helmet');
const app = express();
app.use(express.json());
const cors = require('cors');
const axios = require('axios');
const { createProxyMiddleware } = require('http-proxy-middleware');
const swaggerUi = require('swagger-ui-express');
const { generateUnifiedSpec } = require('./config/swagger');

// Middleware
app.use(helmet());

// Dynamic CORS configuration for ngrok and development
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [];

// const corsOptions = {
//   origin: (origin, callback) => {
//     if (!origin) return callback(null, true);

//     if (allowedOrigins.includes(origin) ||
//         origin.match(/https?:\/\/localhost(:\d+)?/) ||
//         origin.match(/https?:\/\/[a-zA-Z0-9-]+\.ngrok(-free)?\.app/)) {
//       return callback(null, true);
//     }
//     return callback(new Error('Not allowed by CORS'));
//   },
//   credentials: true,
//   methods: 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
//   allowedHeaders: ['Content-Type', 'Authorization', 'X-Service-Token', 'X-Device-Id', 'X-Request-Id'],
//   exposedHeaders: ['X-Total-Count', 'X-Page-Number'],
// };

// app.use(cors(corsOptions));
// app.options('*', cors(corsOptions)); // Preflight support

app.use(cors({origin:"*"}))



// Health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    service: 'sit-api-gateway',
    timestamp: new Date().toISOString(),
    services: {}
  };

  // Check auth service
  try {
    await axios.get('http://localhost:3001/health', { timeout: 1000 });
    health.services.auth = 'healthy';
  } catch (error) {
    health.services.auth = 'unhealthy';
    console.error('Auth service health check failed:', error.message);
  }

  // Check merchant service
  try {
    await axios.get('http://localhost:3002/health', { timeout: 1000 });
    health.services.merchant = 'healthy';
  } catch (error) {
    health.services.merchant = 'unhealthy';
    console.error('Merchant service health check failed:', error.message);
  }

  // Check catalog service
  try {
    await axios.get('http://localhost:3003/health', { timeout: 1000 });
    health.services.catalog = 'healthy';
  } catch (error) {
    health.services.catalog = 'unhealthy';
    console.error('Catalog service health check failed:', error.message);
  }

  // Check cart service
  try {
    await axios.get('http://localhost:3004/health', { timeout: 1000 });
    health.services.cart = 'healthy';
  } catch (error) {
    health.services.cart = 'unhealthy';
    console.error('Cart service health check failed:', error.message);
  }

  res.json(health);
});

// Unified Swagger Documentation
let cachedSwaggerSpec = null;
let lastSpecUpdate = null;
const SPEC_CACHE_DURATION = 60000; // Cache for 1 minute

// Serve Swagger UI
app.use('/api-docs', async (req, res, next) => {
  try {
    // Regenerate spec if cache is expired or doesn't exist
    const now = Date.now();
    if (!cachedSwaggerSpec || !lastSpecUpdate || (now - lastSpecUpdate > SPEC_CACHE_DURATION)) {
      console.log('🔄 Regenerating unified Swagger specification...');
      cachedSwaggerSpec = await generateUnifiedSpec();
      lastSpecUpdate = now;
    }

    // Serve Swagger UI
    swaggerUi.setup(cachedSwaggerSpec, {
      customSiteTitle: 'SIT POS API Documentation',
      customCss: '.swagger-ui .topbar { display: none }',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: true
      }
    })(req, res, next);
  } catch (error) {
    console.error('❌ Error setting up Swagger:', error);
    res.status(500).json({ error: 'Failed to load API documentation' });
  }
}, swaggerUi.serve);

// Endpoint to get raw OpenAPI spec JSON
app.get('/api-docs-json', async (req, res) => {
  try {
    const now = Date.now();
    if (!cachedSwaggerSpec || !lastSpecUpdate || (now - lastSpecUpdate > SPEC_CACHE_DURATION)) {
      cachedSwaggerSpec = await generateUnifiedSpec();
      lastSpecUpdate = now;
    }
    res.json(cachedSwaggerSpec);
  } catch (error) {
    console.error('❌ Error generating spec:', error);
    res.status(500).json({ error: 'Failed to generate API specification' });
  }
});

// Proxy to Auth Service
app.use('/api/v1/auth', createProxyMiddleware({
  target: 'http://localhost:3001',
  changeOrigin: true,
  pathRewrite: {
    '^/api/v1/auth': '/api/v1/auth'
  },
  onError: (err, req, res) => {
    console.error('Auth proxy error:', err);
    res.status(503).json({ 
      error: 'Auth service unavailable',
      details: err.message 
    });
  }
}));

// Proxy to Merchant Service
app.use('/api/v1/merchant', createProxyMiddleware({
  target: 'http://localhost:3002',
  changeOrigin: true,
  pathRewrite: {
    '^/api/v1/merchant': '/api/v1/merchant'
  },
  onError: (err, req, res) => {
    console.error('Merchant proxy error:', err);
    res.status(503).json({ 
      error: 'Merchant service unavailable',
      details: err.message 
    });
  }
}));

// Proxy device endpoints to Merchant Service
app.use('/api/v1/device', createProxyMiddleware({
  target: 'http://localhost:3002',
  changeOrigin: true,
  pathRewrite: {
    '^/api/v1/device': '/api/v1/device'
  }
}));

// Proxy webhook endpoints to Merchant Service
app.use('/api/v1/webhook', createProxyMiddleware({
  target: 'http://localhost:3002',
  changeOrigin: true,
  pathRewrite: {
    '^/api/v1/webhook': '/api/v1/webhook'
  }
}));

// Proxy to Catalog Service
app.use('/api/v1/catalog', createProxyMiddleware({
  target: 'http://localhost:3003',
  changeOrigin: true,
  pathRewrite: {
    '^/api/v1/catalog': '/api/v1/catalog'
  },
  onError: (err, req, res) => {
    console.error('Catalog proxy error:', err);
    res.status(503).json({
      error: 'Catalog service unavailable',
      details: err.message
    });
  }
}));

// Proxy to Cart Service
app.use('/api/v1/cart', createProxyMiddleware({
  target: 'http://localhost:3004',
  changeOrigin: true,
  pathRewrite: {
    '^/api/v1/cart': '/api/v1/cart'
  },
  onError: (err, req, res) => {
    console.error('Cart proxy error:', err);
    res.status(503).json({
      error: 'Cart service unavailable',
      details: err.message
    });
  }
}));

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ API Gateway running on port ${PORT}`);
});

module.exports = app;