const axios = require('axios');

/**
 * Unified Swagger configuration for API Gateway
 * Aggregates OpenAPI specs from all microservices
 */

const SERVICES = [
  { name: 'Auth', url: 'http://localhost:3001', prefix: '/api/v1/auth' },
  { name: 'Merchant', url: 'http://localhost:3002', prefix: '/api/v1/merchant' },
  { name: 'Catalog', url: 'http://localhost:3003', prefix: '/api/v1/catalog' },
  { name: 'Cart', url: 'http://localhost:3004', prefix: '/api/v1/cart' }
];

/**
 * Base OpenAPI specification for the unified gateway
 */
const baseSpec = {
  openapi: '3.0.0',
  info: {
    title: 'SIT POS System - Unified API',
    version: '1.0.0',
    description: 'Complete API documentation for the SIT Point of Sale System. This gateway aggregates all microservices into a single API interface.',
    contact: {
      name: 'SIT POS Team',
      email: 'support@sitpos.com'
    },
    license: {
      name: 'Private',
      url: 'https://sitpos.com/license'
    }
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'API Gateway (Local Development)'
    },
    {
      url: '{protocol}://{host}',
      description: 'Dynamic server (ngrok, production, etc.)',
      variables: {
        protocol: {
          enum: ['http', 'https'],
          default: 'https'
        },
        host: {
          default: 'api.sitpos.com',
          description: 'API host (can be ngrok URL or production domain)'
        }
      }
    }
  ],
  tags: [
    { name: 'Authentication', description: 'User authentication and session management' },
    { name: 'Merchants', description: 'Merchant account management' },
    { name: 'Devices', description: 'POS device management' },
    { name: 'Webhooks', description: 'Webhook management and processing' },
    { name: 'Cart', description: 'Shopping cart operations' },
    { name: 'Catalog', description: 'Product catalog management' },
    { name: 'Categories', description: 'Product category management' },
    { name: 'Modifiers', description: 'Product modifier management' },
    { name: 'Discounts', description: 'Discount and promotion management' },
    { name: 'Options', description: 'Option group and variant management' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token for user authentication'
      },
      ServiceToken: {
        type: 'apiKey',
        in: 'header',
        name: 'X-Service-Token',
        description: 'Service-to-service authentication token'
      }
    },
    responses: {
      UnauthorizedError: {
        description: 'Authentication token is missing or invalid',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: { type: 'string', example: 'Unauthorized' }
              }
            }
          }
        }
      },
      NotFoundError: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: { type: 'string', example: 'Resource not found' }
              }
            }
          }
        }
      },
      ValidationError: {
        description: 'Validation error',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: { type: 'string', example: 'Validation failed' }
              }
            }
          }
        }
      }
    }
  },
  paths: {},
  'x-tagGroups': [
    {
      name: 'Authentication & Users',
      tags: ['Authentication']
    },
    {
      name: 'Merchant Management',
      tags: ['Merchants', 'Devices', 'Webhooks']
    },
    {
      name: 'Commerce',
      tags: ['Cart', 'Catalog', 'Categories', 'Modifiers', 'Discounts', 'Options']
    }
  ]
};

/**
 * Fetches OpenAPI spec from a microservice
 */
async function fetchServiceSpec(service) {
  try {
    const response = await axios.get(`${service.url}/api-docs-json`, {
      timeout: 5000
    });
    return response.data;
  } catch (error) {
    console.warn(`⚠️  Failed to fetch spec from ${service.name} service:`, error.message);
    return null;
  }
}

/**
 * Merges a service spec into the unified spec
 */
function mergeServiceSpec(unifiedSpec, serviceSpec, service) {
  if (!serviceSpec || !serviceSpec.paths) {
    return;
  }

  // Merge paths
  Object.keys(serviceSpec.paths).forEach(path => {
    // Ensure path starts with service prefix
    const fullPath = path.startsWith(service.prefix) ? path : `${service.prefix}${path}`;

    if (!unifiedSpec.paths[fullPath]) {
      unifiedSpec.paths[fullPath] = serviceSpec.paths[path];
    } else {
      // Merge methods if path exists
      unifiedSpec.paths[fullPath] = {
        ...unifiedSpec.paths[fullPath],
        ...serviceSpec.paths[path]
      };
    }
  });

  // Merge components (schemas, responses, etc.)
  if (serviceSpec.components) {
    if (serviceSpec.components.schemas) {
      unifiedSpec.components.schemas = {
        ...unifiedSpec.components.schemas,
        ...serviceSpec.components.schemas
      };
    }
  }
}

/**
 * Generates the unified OpenAPI specification
 */
async function generateUnifiedSpec() {
  const unifiedSpec = JSON.parse(JSON.stringify(baseSpec));

  console.log('📚 Aggregating Swagger documentation from microservices...');

  // Fetch and merge specs from all services
  for (const service of SERVICES) {
    const serviceSpec = await fetchServiceSpec(service);
    if (serviceSpec) {
      mergeServiceSpec(unifiedSpec, serviceSpec, service);
      console.log(`✅ Merged ${service.name} service documentation`);
    }
  }

  console.log(`✅ Unified Swagger documentation ready with ${Object.keys(unifiedSpec.paths).length} endpoints`);

  return unifiedSpec;
}

module.exports = { generateUnifiedSpec, baseSpec };
