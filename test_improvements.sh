#!/bin/bash

echo "=== Testing Rate Limiting and HttpOnly Cookies ==="

# Test 1: Test rate limiting on signin (5 attempts per minute)
echo ""
echo "Test 1: Rate Limiting on Sign In (5/min)"
for i in {1..7}; do
  echo "Attempt $i:"
  curl -s -X POST http://localhost:8000/api/auth/signin \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrongpass"}' \
    -i | grep -E "HTTP/|X-RateLimit-|Set-Cookie:"
  sleep 0.1
done

# Test 2: Test HttpOnly cookie setting on successful signin
echo ""
echo "Test 2: HttpOnly Cookies on Successful Sign In"
echo "Creating test user first..."
curl -s -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"cookietest@example.com","password":"TestPass123!"}' > /dev/null

echo "Attempting signin..."
curl -s -X POST http://localhost:8000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"cookietest@example.com","password":"TestPass123!"}' \
  -i | grep -E "HTTP/|Set-Cookie:|X-RateLimit-" | head -20

# Test 3: Rate limiting on MFA verify
echo ""echo ""echo ""echo ""echo ""echo ""echo ""echo ""echo "" i in {1..12}; echo ""echo ""echo "":"
  curl -s -X POST http://localhost:8000/api/mfa/verify \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer test-token" \
    -d '{"code":"000000"}' \
    -i 2>/dev/null | grep -E "HTTP/|X-RateLimit-" | head -1
  sleep 0.05
done

echo ""
echo "✅ Rate limiting and cookie tests completed"
