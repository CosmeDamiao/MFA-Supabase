# Security Features - Usage Guide

## Overview
This guide explains how the security improvements work and how to test them.

---

## 1. Rate Limiting

### How It Works
- Tracks authentication attempts per IP address
- Different limits for different endpoints
- Returns 429 (Too Many Requests) when limit exceeded
- Limit window resets automatically after timeout

### Rate Limits
```
Sign In:      5 attempts per 1 minute
Sign Up:      3 attempts per 1 hour  
MFA Verify:   10 attempts per 1 minute
```

### Testing Rate Limiting

#### Test Sign In Rate Limit
```bash
# Attempts 1-4: Return 401 "Invalid credentials"
# Attempt 5+: Return 429 "Too many login attempts"
for i in {1..7}; do
  curl -X POST http://localhost:8000/api/auth/signin \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
done
```

#### Response Headers
```
X-RateLimit-Limit: 5                    # Max attempts
X-RateLimit-Remaining: 3                # Attempts left
X-RateLimit-Reset: 60                   # Seconds until reset
```

#### Rate Limited Response
```json
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 30

{
  "error": "Too many login attempts. Try again later."
}
```

---

## 2. HttpOnly Cookies

### How It Works
- Tokens stored in secure HTTP cookies instead of localStorage
- Inaccessible to JavaScript (prevents XSS attacks)
- Automatically sent with requests (browser handles it)
- SameSite=Strict prevents cross-site cookie sending

### Cookie Details
```
Name: auth_token
├─ Value: JWT access token from Supabase
├─ HttpOnly: true (not accessible to JavaScript)
├─ SameSite: Strict (not sent to cross-origin requests)
├─ Path: / (available to all routes)
└─ Max-Age: 604800 (7 days)

Name: user_email
├─ Value: User's email (e.g., user@example.com)
├─ HttpOnly: false (readable by JavaScript for display)
├─ SameSite: Strict
├─ Path: /
└─ Max-Age: 604800 (7 days)
```

### Testing Cookie Setting

#### Successful Sign In
```bash
curl -X POST http://localhost:8000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"correct"}' \
  -i
```

Expected Response:
```
HTTP/1.1 200 OK
Set-Cookie: auth_token=eyJ0eXAi...; Max-Age=604800; Path=/; HttpOnly; SameSite=Strict
Set-Cookie: user_email=user@example.com; Max-Age=604800; Path=/; SameSite=Strict
Content-Type: application/json

{
  "user": {"id": "...", "email": "user@example.com"},
  "hasMFA": false,
  "message": "Sign in successful"
}
```

#### Automatic Cookie Transmission
```bash
# Include cookies with request using credentials: 'include'
curl -X GET http://localhost:8000/dashboard \
  -H "Cookie: auth_token=...; user_email=..." \
  --credentials include
```

### Frontend Usage

#### Login Form
```javascript
// Automatically include cookies
fetch('/api/auth/signin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
  credentials: 'include'  // <- Sends cookies
})
```

#### Read Email from Cookie
```javascript
function getCookie(name) {
  const value = "; " + document.cookie;
  const parts = value.split("; " + name + "=");
  if (parts.length === 2) 
    return decodeURIComponent(parts.pop().split(';').shift());
  return null;
}

const userEmail = getCookie('user_email');
console.log('User:', userEmail);  // "user@example.com"
```

#### Logout (Clear Cookies)
```javascript
// Set Max-Age=0 to expire cookies
document.cookie = 'auth_token=; Max-Age=0; Path=/';
document.cookie = 'user_email=; Max-Age=0; Path=/';
window.location.href = '/login';
```

---

## 3. Generic Error Messages

### How It Works
- Same error message for "user not found" and "wrong password"
- Prevents attackers from enumerating valid email addresses
- Reduces information leakage

### Error Response
```json
{
  "error": "Invalid credentials"
}
```

Returns for both:
- Email doesn't exist in system
- Email exists but password is wrong

### Testing Email Enumeration Prevention
```bash
# Non-existent email
curl -X POST http://localhost:8000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@example.com","password":"test"}'

# Response: {"error": "Invalid credentials"}

# Existing email, wrong password
curl -X POST http://localhost:8000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"wrong"}'

# Response: {"error": "Invalid credentials"}
# ^ Same error! Attacker can't tell which is which
```

---

## 4. Authorization Headers

### How It Works
- MFA endpoints require Authorization header
- Validates Bearer token from authentication
- Prevents unauthorized MFA operations

### Usage

#### Verify MFA Code
```bash
curl -X POST http://localhost:8000/api/mfa/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{"code":"123456"}'
```

#### Enroll in MFA
```bash
curl -X POST http://localhost:8000/api/mfa/enroll \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>"
```

#### Missing Authorization
```
HTTP/1.1 400 Bad Request

{
  "error": "Authorization header required"
}
```

---

## 5. Complete Auth Flow Example

### Step 1: Sign Up
```bash
curl -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "SecurePass123!"
  }'
```

Response:
```json
{
  "user": {"id": "abc123", "email": "newuser@example.com"},
  "message": "User created successfully"
}
```

Cookies Set:
- `auth_token` (HttpOnly)
- `user_email` = "newuser@example.com"

### Step 2: Enroll in MFA
```bash
curl -X POST http://localhost:8000/api/mfa/enroll \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -H "Cookie: auth_token=...; user_email=..."
```

Response:
```json
{
  "id": "mfa123",
  "type": "totp",
  "factorId": "factor123"
}
```

### Step 3: Verify MFA Code
```bash
curl -X POST http://localhost:8000/api/mfa/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -H "Cookie: auth_token=...; user_email=..." \
  -d '{
    "code": "123456",
    "factorId": "factor123"
  }'
```

Response:
```json
{
  "verified": true,
  "message": "MFA enrollment successful"
}
```

### Step 4: Access Dashboard
```bash
curl -X GET http://localhost:8000/dashboard \
  -H "Cookie: auth_token=...; user_email=..."
```

Response: Dashboard HTML with user email displayed

---

## Monitoring & Debugging

### Enable Logging
```typescript
// In main.ts
const DEBUG = true;

if (DEBUG) {
  console.log(`[Rate Limit] ${clientIp}: ${rateLimit.remaining} attempts remaining`);
  console.log(`[Auth] Sign in for ${email} - ${hasMFA ? 'MFA required' : 'No MFA'}`);
}
```

### Check Rate Limit Status
```bash
# Check remaining attempts header
curl -s -X POST http://localhost:8000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrong"}' \
  -i | grep X-RateLimit-
```

### Verify Cookies
```bash
# In browser console
console.log(document.cookie);
```

### Check MFA Enrollment Status
```sql
-- In Supabase SQL editor
SELECT * FROM user_mfa_status WHERE user_id = 'abc123';
```

---

## Security Best Practices

### For Users
1. ✅ Use strong, unique passwords
2. ✅ Enable MFA for additional security
3. ✅ Keep your authenticator app backed up
4. ✅ Don't share your browser/cookies with others

### For Developers
1. ✅ Always use HTTPS in production (adds Secure flag to cookies)
2. ✅ Implement Redis for rate limiting in distributed systems
3. ✅ Monitor failed login attempts
4. ✅ Regular security audits
5. ✅ Keep dependencies updated

### For DevOps
1. ✅ Use WAF rules to detect brute force patterns
2. ✅ Monitor X-RateLimit-Reset headers for attack detection
3. ✅ Set up alerts for 429 response spikes
4. ✅ Use distributed rate limiting for multi-server deployments
5. ✅ Regular backup of user database

---

## Troubleshooting

### Issue: Cookies Not Being Set
**Solution**: Check that response includes Set-Cookie headers
```bash
curl -i -X POST http://localhost:8000/api/auth/signin ...
# Look for: Set-Cookie: auth_token=...
```

### Issue: Rate Limit Too Strict
**Solution**: Adjust limits in [main.ts](main.ts)
```typescript
// Change line 19 from 5 to 10
const rateLimit = checkRateLimit(rateLimitKey, 10, 60000); // 10/min
```

### Issue: Can't Access Dashboard
**Solution**: Ensure cookies are being sent
```bash
# Check cookie header
curl -i -b "auth_token=...; user_email=..." \
  http://localhost:8000/dashboard
```

### Issue: Rate Limit Reset Too Slow
**Solution**: Adjust window in [utils/rateLimit.ts](utils/rateLimit.ts)
```typescript
// Change from 60000 (1 min) to 30000 (30 sec)
const rateLimit = checkRateLimit(rateLimitKey, 5, 30000);
```

---

## References

- [OWASP Session Management](https://owasp.org/www-community/attacks/csrf)
- [HTTPOnly Cookies](https://owasp.org/www-community/HttpOnly)
- [Rate Limiting Best Practices](https://owasp.org/www-community/attacks/Brute_force_attack)
- [SameSite Cookie Attribute](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
