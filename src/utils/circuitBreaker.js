const config = require('../config');
const logger = require('./logger');

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.threshold = options.threshold || config.circuitBreaker.threshold;
    this.timeout = options.timeout || config.circuitBreaker.timeout;
    this.nextAttempt = Date.now();
  }

  async call(fn, ...args) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`Circuit breaker is OPEN for ${this.name}`);
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn(...args);
      return this.onSuccess(result);
    } catch (error) {
      return this.onFailure(error);
    }
  }

  onSuccess(result) {
    this.failureCount = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount > 2) {
        this.state = 'CLOSED';
        this.successCount = 0;
        logger.info(`Circuit breaker CLOSED for ${this.name}`);
      }
    }
    
    return result;
  }

  onFailure(error) {
    this.failureCount++;
    this.successCount = 0;

    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      logger.error(`Circuit breaker OPEN for ${this.name}`, {
        failures: this.failureCount,
        nextAttempt: new Date(this.nextAttempt)
      });
    }

    throw error;
  }

  getState() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failureCount,
      nextAttempt: this.state === 'OPEN' ? new Date(this.nextAttempt) : null
    };
  }

  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
  }
}

const breakers = {};

function getBreaker(serviceName) {
  if (!breakers[serviceName]) {
    breakers[serviceName] = new CircuitBreaker(serviceName);
  }
  return breakers[serviceName];
}

module.exports = { CircuitBreaker, getBreaker };
