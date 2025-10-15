const axios = require('axios');
const { services, healthEndpoints } = require('../config/services');
const logger = require('../utils/logger');

class HealthMonitor {
  constructor() {
    this.serviceStatus = {};
    this.checkInterval = 30000;
  }

  async checkService(name, config) {
    try {
      const response = await axios.get(
        `${config.url}/api/v1${healthEndpoints[name] || '/health'}`,
        { timeout: 3000 }
      );

      return {
        name,
        status: 'healthy',
        responseTime: response.headers['x-response-time'],
        lastCheck: new Date()
      };
    } catch (error) {
      logger.error(`Health check failed for ${name}:`, error.message);

      return {
        name,
        status: 'unhealthy',
        error: error.message,
        lastCheck: new Date()
      };
    }
  }

  async checkAllServices() {
    const checks = Object.entries(services).map(([name, config]) =>
      this.checkService(name, config)
    );

    const results = await Promise.allSettled(checks);
    
    results.forEach((result, index) => {
      const serviceName = Object.keys(services)[index];
      if (result.status === 'fulfilled') {
        this.serviceStatus[serviceName] = result.value;
      } else {
        this.serviceStatus[serviceName] = {
          name: serviceName,
          status: 'error',
          error: result.reason,
          lastCheck: new Date()
        };
      }
    });

    return this.serviceStatus;
  }

  startMonitoring() {
    this.checkAllServices();

    this.intervalId = setInterval(() => {
      this.checkAllServices();
    }, this.checkInterval);

    logger.info('Health monitoring started');
  }

  stopMonitoring() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      logger.info('Health monitoring stopped');
    }
  }

  getStatus() {
    const overall = Object.values(this.serviceStatus).every(
      service => service.status === 'healthy'
    ) ? 'healthy' : 'degraded';

    return {
      status: overall,
      services: this.serviceStatus,
      timestamp: new Date()
    };
  }
}

module.exports = new HealthMonitor();
