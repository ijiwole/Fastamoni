# Load Testing Guide

## Overview

This directory contains Artillery load test configurations to verify the API meets performance requirements:
- **100 requests per second (rps)** for **30 seconds**
- **p99 latency under 50ms**

## Files

- `load.yml` - Load test (100 rps for 30s) that exercises all endpoints (weighted)
- `smoke.yml` - One-pass smoke test that hits each endpoint once
- `processor.js` - Custom Artillery processor functions (if needed)

## Prerequisites

1. **Database & Redis running**: Ensure PostgreSQL and Redis are running
2. **Create a verified test user** (required for load tests):
   ```bash
   # 1. Register a user via API
   curl -X POST http://localhost:3000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "firstName": "Load",
       "lastName": "Tester",
       "email": "loadtest@example.com",
       "password": "TestPass123!"
     }'
   
   # 2. Login to get token (will fail until verified)
   # 3. Check email for verification code OR manually verify in database:
   #    UPDATE users SET "isEmailVerified" = true WHERE email = 'loadtest@example.com';
   # 4. Set PIN for the user
   curl -X POST http://localhost:3000/api/users/pin \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"pin": "123456"}'
   ```
3. **Environment variables** (set before running tests):
   ```bash
   export BENEFICIARY_ID="<uuid-of-existing-user>"
   export TEST_USER_EMAIL="loadtest@example.com"  # Must be verified
   export TEST_USER_PASSWORD="TestPass123!"
   export TEST_USER_PIN="123456"
   export TEST_ACCESS_TOKEN="<jwt-access-token-for-TEST_USER_EMAIL>" # Used by the load test
   export TEST_DONATION_ID="<uuid-of-existing-donation>"  # Optional
   ```

## Running Tests

### Load Test (Meets criterion: 100 rps for 30s, p99 < 50ms)
```bash
npm run test:load
```

### Smoke Test (Run each endpoint once)
```bash
npm run test:smoke
```
Hits the main endpoints once:
- ✅ POST /auth/register
- ✅ POST /auth/login
- ✅ GET /users/me
- ✅ POST /users/pin
- ✅ POST /transactions/fund-wallet
- ✅ GET /wallets/me
- ✅ POST /donations
- ✅ GET /donations/count
- ✅ GET /donations (with pagination)
- ✅ GET /donations/:id
- ✅ GET /donations/:id/transaction

## Expected Results

The test script will:
1. Build the application
2. Start the server in the background
3. Wait 5 seconds for server to be ready
4. Run Artillery load tests
5. Automatically kill the server process

## Success Criteria

✅ **p99 latency < 50ms** for all endpoints
✅ **No errors** (or minimal errors acceptable for load testing)
✅ **All endpoints respond** within acceptable time

## Troubleshooting

### Server not starting
- Check if port 3000 is already in use
- Verify database and Redis connections
- Check environment variables

### High latency
- Check database indexes
- Verify Redis is running
- Monitor server resources (CPU, memory)
- Check for connection pool limits

### Authentication errors
- Ensure test user exists
- Verify JWT_SECRET is set
- Check token expiration settings

## Notes

- The `src/loadtest/` directory is empty and can be removed (it's not used)
- Load tests use real database operations - ensure test data is acceptable
- Consider using a separate test database for load testing

