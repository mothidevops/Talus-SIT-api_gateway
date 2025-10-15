// sit-api-gateway/server.js - MINIMAL WORKING VERSION
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

const app = express();
const PORT = 3000;

// Load Swagger documentation
const swaggerDocument = YAML.load(path.join(__dirname, 'swagger.yaml'));

// CORS Configuration - Allow all origins including ngrok and local IP addresses
// app.use(cors({
//   origin: function (origin, callback) {
//     // Allow requests with no origin (like mobile apps, Postman, curl)
//     if (!origin) return callback(null, true);

//     // Allow all ngrok URLs
//     if (origin.match(/https?:\/\/[a-zA-Z0-9-]+\.ngrok(-free)?\.app/) ||
//         origin.match(/https?:\/\/[a-zA-Z0-9-]+\.ngrok\.io/)) {
//       return callback(null, true);
//     }

//     // Allow all origins in development
//     return callback(null, true);
//   },
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization', 'X-Service-Token', 'X-Device-Id', 'X-Request-Id', 'ngrok-skip-browser-warning'],
//   exposedHeaders: ['Content-Length', 'X-Request-Id'],
//   credentials: true,
//   preflightContinue: false,
//   optionsSuccessStatus: 204
// }));

app.use(cors({origin:"*"}))

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  next();
});

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Health check - API Gateway
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'api-gateway',
    timestamp: new Date().toISOString()
  });
});

// Health check proxies for all services (no authentication required)
app.get('/health/auth', async (req, res) => {
  try {
    const response = await axios.get(process.env.AUTH_SERVICE_URL + '/health');
    res.json(response.data);
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', service: 'auth-service', error: error.message });
  }
});

app.get('/health/merchant', async (req, res) => {
  try {
    const response = await axios.get(process.env.MERCHANT_SERVICE_URL + '/health');
    res.json(response.data);
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', service: 'merchant-service', error: error.message });
  }
});

app.get('/health/catalog', async (req, res) => {
  try {
    const response = await axios.get(process.env.CATALOG_SERVICE_URL + '/health');
    res.json(response.data);
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', service: 'catalog-service', error: error.message });
  }
});

app.get('/health/cart', async (req, res) => {
  try {
    const response = await axios.get(process.env.CART_SERVICE_URL + '/health');
    res.json(response.data);
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', service: 'cart-service', error: error.message });
  }
});

// Health check for all services at once
app.get('/health/all', async (req, res) => {
  const services = [
    { name: 'gateway', url: `http://localhost:${PORT}/health`, port: PORT },
    { name: 'auth', url: process.env.AUTH_SERVICE_URL + '/health', port: 3001 },
    { name: 'merchant', url: process.env.MERCHANT_SERVICE_URL + '/health', port: 3002 },
    { name: 'catalog', url: process.env.CATALOG_SERVICE_URL + '/health', port: 3003 },
    { name: 'cart', url: process.env.CART_SERVICE_URL + '/health', port: 3004 },
    { name: 'payment', url: process.env.PAYMENT_SERVICE_URL + '/health', port: 3005 },
    { name: 'reporting', url: process.env.REPORTING_SERVICE_URL + '/health', port: 3006 }
  ];

  const results = await Promise.allSettled(
    services.map(async (service) => {
      if (service.name === 'gateway') {
        return {
          service: service.name,
          status: 'healthy',
          port: service.port
        };
      }
      try {
        const response = await axios.get(service.url, { timeout: 2000 });
        return {
          service: service.name,
          status: response.data.status,
          port: service.port,
          uptime: response.data.uptime
        };
      } catch (error) {
        return {
          service: service.name,
          status: 'unhealthy',
          port: service.port,
          error: error.message
        };
      }
    })
  );

  const healthData = results.map((result, index) => ({
    ...result.value,
    available: result.status === 'fulfilled' && result.value.status === 'healthy'
  }));

  const allHealthy = healthData.every(s => s.available);

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: healthData
  });
});

// Manual proxy for auth service
app.all('/api/v1/auth/*', async (req, res) => {
  try {
    const path = req.url.replace('/api/v1/auth', '/api/v1/auth');
    const targetUrl = `${process.env.AUTH_SERVICE_URL}${path}`;

    console.log(`Proxying to: ${targetUrl}`);

    // Filter out problematic headers
    const { host, connection, 'content-length': contentLength, ...forwardHeaders } = req.headers;

    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      headers: {
        ...forwardHeaders,
        'content-type': 'application/json'
      },
      validateStatus: () => true // Accept any status
    });

    console.log(`Response status: ${response.status}`);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(502).json({
      error: 'Bad Gateway',
      message: error.message
    });
  }
});

// Manual proxy for merchant service
app.all('/api/v1/merchant*', async (req, res) => {
  try {
    const path = req.url.replace('/api/v1/merchant', '/api/v1/merchant');
    const targetUrl = `${process.env.MERCHANT_SERVICE_URL}${path}`;

    console.log(`Proxying to: ${targetUrl}`);

    // Filter out problematic headers
    const { host, connection, 'content-length': contentLength, ...forwardHeaders } = req.headers;

    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      headers: {
        ...forwardHeaders,
        'content-type': 'application/json'
      },
      validateStatus: () => true
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(502).json({
      error: 'Bad Gateway',
      message: error.message
    });
  }
});

// Manual proxy for device service (merchant service)
app.all('/api/v1/device*', async (req, res) => {
  try {
    const path = req.url.replace('/api/v1/device', '/api/v1/device');
    const targetUrl = `${process.env.MERCHANT_SERVICE_URL}${path}`;

    console.log(`Proxying to: ${targetUrl}`);

    // Filter out problematic headers
    const { host, connection, 'content-length': contentLength, ...forwardHeaders } = req.headers;

    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      headers: {
        ...forwardHeaders,
        'content-type': 'application/json'
      },
      validateStatus: () => true
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(502).json({
      error: 'Bad Gateway',
      message: error.message
    });
  }
});

// Manual proxy for webhook service (merchant service)
app.all('/api/v1/webhook*', async (req, res) => {
  try {
    const path = req.url.replace('/api/v1/webhook', '/api/v1/webhook');
    const targetUrl = `${process.env.MERCHANT_SERVICE_URL}${path}`;

    console.log(`Proxying to: ${targetUrl}`);

    // Filter out problematic headers
    const { host, connection, 'content-length': contentLength, ...forwardHeaders } = req.headers;

    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      headers: {
        ...forwardHeaders,
        'content-type': 'application/json'
      },
      validateStatus: () => true
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(502).json({
      error: 'Bad Gateway',
      message: error.message
    });
  }
});

// Manual proxy for catalog service
app.all('/api/v1/catalog*', async (req, res) => {
  try {
    const path = req.url.replace('/api/v1/catalog', '/api/v1/catalog');
    const targetUrl = `${process.env.CATALOG_SERVICE_URL}${path}`;

    console.log(`Proxying to: ${targetUrl}`);

    // Filter out problematic headers
    const { host, connection, 'content-length': contentLength, ...forwardHeaders } = req.headers;

    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      headers: {
        ...forwardHeaders,
        'content-type': 'application/json'
      },
      validateStatus: () => true
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(502).json({
      error: 'Bad Gateway',
      message: error.message
    });
  }
});

// Manual proxy for cart service
app.all('/api/v1/cart*', async (req, res) => {
  try {
    const path = req.url.replace('/api/v1/cart', '/api/v1/cart');
    const targetUrl = `${process.env.CART_SERVICE_URL}${path}`;

    console.log(`Proxying to: ${targetUrl}`);

    // Filter out problematic headers
    const { host, connection, 'content-length': contentLength, ...forwardHeaders } = req.headers;

    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      headers: {
        ...forwardHeaders,
        'content-type': 'application/json'
      },
      validateStatus: () => true
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(502).json({
      error: 'Bad Gateway',
      message: error.message
    });
  }
});

// 404 handler
app.use((req, res) => {
  console.log(`404: ${req.url}`);
  res.status(404).json({
    error: 'Route not found',
    path: req.url
  });
});


// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ API Gateway started on port ${PORT}`);
  console.log('Waiting for requests...');
});

// Handle server errors
server.on('error', (error) => {
  console.error('Server error:', error);
});