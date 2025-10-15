# SIT API Gateway

## Overview
Central API Gateway for the SIT POS microservices architecture.

## Features
- Request routing and proxying
- Authentication and authorization
- Rate limiting
- Circuit breaker pattern
- Service health monitoring
- Request/response logging
- CORS handling
- Request ID tracking

## Setup

### Prerequisites
- Node.js 18+
- Redis 7+

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Update `.env` with service URLs

4. Start the gateway:
```bash
npm run dev
```

## API Routes

All routes are prefixed with `/api/v1/`

### Service Routes
- `/auth/*` → Auth Service (port 3001)
- `/merchant/*` → Merchant Service (port 3002)
- `/catalog/*` → Catalog Service (port 3003)
- `/cart/*` → Cart Service (port 3004)
- `/payment/*` → Payment Service (port 3005)
- `/reports/*` → Reporting Service (port 3006)

### Gateway Routes
- `GET /health` - Gateway and services health
- `GET /api/v1/services` - Service discovery
- `GET /api/v1/status/circuit-breakers` - Circuit breaker status

## Docker

Build and run:
```bash
docker-compose up --build
```

## License
Proprietary
