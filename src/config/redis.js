const Redis = require('ioredis');
const config = require('./index');
const logger = require('../utils/logger');

let redisClient = null;
let isConnecting = false;
let connectionPromise = null;

function createRedisClient() {
  const client = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    db: config.redis.db,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    lazyConnect: false
  });

  client.on('connect', () => {
    logger.info('Redis connected successfully');
  });

  client.on('error', (error) => {
    logger.error('Redis connection error:', error);
  });

  client.on('ready', () => {
    logger.info('Redis client ready');
  });

  return client;
}

function connectRedis() {
  if (connectionPromise) {
    return connectionPromise;
  }

  if (redisClient && redisClient.status === 'ready') {
    return Promise.resolve(redisClient);
  }

  isConnecting = true;
  connectionPromise = new Promise((resolve, reject) => {
    try {
      redisClient = createRedisClient();
      
      redisClient.once('ready', () => {
        isConnecting = false;
        resolve(redisClient);
      });

      redisClient.once('error', (error) => {
        isConnecting = false;
        connectionPromise = null;
        reject(error);
      });
    } catch (error) {
      isConnecting = false;
      connectionPromise = null;
      reject(error);
    }
  });

  return connectionPromise;
}

function getRedisClient() {
  if (!redisClient) {
    redisClient = createRedisClient();
  }
  return redisClient;
}

async function disconnectRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    connectionPromise = null;
    logger.info('Redis connection closed');
  }
}

module.exports = { 
  connectRedis, 
  getRedisClient,
  disconnectRedis 
};
