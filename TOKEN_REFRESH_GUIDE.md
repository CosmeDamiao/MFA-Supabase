# Complete Token Refresh & MFA Fix Guide

## Overview

This guide documents all token expiration fixes that have been implemented to resolve "token is expired" errors during MFA enrollment and verification.

## Problem Summary

Users were receiving "invalid JWT: unable to parse or verify signature, token has invalid claims: token is expired" errors when:
1. Enrolling in MFA (creating new TOTP factor)
2. Verifying MFA codes (using 6-digit code from authenticator)

This happened even when:
- Token was freshly obtained from signin/signup
- User provided correct 6-digit codes
- MFA was already properly enrolled in Supabase

## Root Causes Identified & Fixed

### 1. ✅ JavaScript HttpOnly Cookie Reading (FIXED)
**Problem**: JavaScript code attempted to read HttpOnly cookies using `getCookie()` and set Authorization headers manually
**Impact**: Authorization headers were undefined or null, tokens weren't sent to server
**Solution**: Removed broken Authorization header logic, rely on browser's automatic cookie handling with `credentials: 'include'`
**Location**: Frontend JavaScript (Enroll page)

### 2. ✅ JWT Token Parsing Bug (FIXED - CRITICAL)
**Problem**: Cookie parsing used `split('=')` which only captured text before the first equals sign
**Example**: Token `auth_token=eyJhbGc.eyJpc3M.M62NDBp==` was parsed as value `eyJhbGc` (missing padding!)
**Solution**: Changed to `indexOf('=')` + `substring()` to properly extract full token:
```typescript
const eqIndex = cookie.indexOf('=');
const value = cookie.substring(eqIndex + 1); // Gets EVERYTHING after first =
```
**Locations**: 
- `handleMFAVerify()` line ~245-255
- `handleMFAEnroll()` line ~434-444

### 3. ✅ Missing Token Refresh Mechanism (FIXED)
**Problem**: Tokens expire after ~1 hour. Any delay between signin and MFA completion caused expiration
**Solution**: Implemented comprehensive token refresh system:
1. Refresh tokens stored in separate HttpOnly cookie during signin/signup
2. Proactive refresh before any Supabase API call
3. Reactive retry: if any call fails with "token is expired", automatically refresh + retry

**Locations**:
- `refreshAccessToken()` function (lines 19-63)
- `handleSignIn()` stores refresh_token (line 128)
- `handleSignUp()` stores refresh_token (line 205)
- `handleMFAVerify()` proactive refresh (line 268-272)
- `handleMFAVerify()` reactive retry for listFactors() (lines 281-297)
- `handleMFAVerify()` reactive retry for challenge() (lines 323-339)
- `handleMFAVerify()` reactive retry for verify() (lines 372-391)
- `handleMFAEnroll()` proactive refresh (line 475-479)
- `handleMFAEnroll()` reactive retry (lines 490-508)

## How Token Refresh Works

### Proactive Refresh (Before API Calls)
```typescript
if (refreshToken) {
  const refreshed = await refreshAccessToken(refreshToken);
  if (refreshed) {
    token = refreshed.access_token;
    refreshToken = refreshed.refresh_token;
    userClient = createUserClient(token);
    console.log('✓ Token proactively refreshed');
  }
}
```

### Reactive Retry (During Failed API Calls)
```typescript
let result = await userClient.auth.mfa.listFactors();
if (result.error?.message?.includes('token is expired') && refreshToken) {
  console.log('Token expired during operation, attempting refresh...');
  const refreshed = await refreshAccessToken(refreshToken);
  if (refreshed) {
    token = refreshed.access_token;
    userClient = createUserClient(token);
    result = await userClient.auth.mfa.listFactors(); // RETRY
  }
}
```

### Token Refresh Endpoint
- **URL**: `{SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`
- **Method**: POST
- **Headers**: 
  - `Content-Type: application/json`
  - `apikey: {SUPABASE_ANON_KEY}`
- **Body**: `{ "refresh_token": "<refresh_token_value>" }`
- **Response**: `{ "access_token": "...", "refresh_token": "...", ... }`

## Testing Instructions

### Test 1: Basic Sign In with Logging
1. Open http://localhost:8000/login
2. Sign in with credentials
3. Check server logs for:
   ```
   ✓ Sign in successful with refresh token for: user@email.com
   ```

### Test 2: MFA Enrollment
1. Sign in (should succeed)
2. Navigate to MFA enrollment
3. Check logs for:
   ```
   Attempting token refresh from: https://xxx.supabase.co/auth/v1/token?grant_type=refresh_token
   ✓ Token refreshed successfully
   ```
4. Should see QR code without "token is expired" error

### Test 3: MFA Verification (Immediate)
1. Enroll in MFA
2. Immediately scan QR code with authenticator
3. Enter 6-digit code
4. Should see "Invalid TOTP code" (not "token is expired")
5. Get correct code and verify
6. Should see "MFA verification successful"

### Test 4: MFA Verification (After Delay)
1. Enroll in MFA
2. Wait 30+ minutes (or until you're confident token expired)
3. Try to verify with correct 6-digit code
4. Check logs for:
   ```
   Token expired during MFA verify, attempting refresh and retry...
   ✓ Token refreshed successfully
   Token refreshed, retrying MFA verify...
   ```
5. Should complete successfully without "token is expired" error

### Test 5: Check Refresh Token Storage
In browser DevTools (Application tab):
1. Go to Cookies > http://localhost:8000
2. Should see THREE cookies:
   - `auth_token`: Your JWT access token (long string)
   - `refresh_token`: Refresh token (long string)
   - `user_email`: Your email address
3. All should be HttpOnly (indicated by checkmark in HttpOnly column)

### Test 6: Watch Real-Time Logging
While testing:
```bash
tail -f /tmp/deno.log
```

Expected log sequence for MFA verify flow:
```
Attempting token refresh from: https://xxx.supabase.co/auth/v1/token?grant_type=refresh_token
✓ Token refreshed successfully
listFactors result: success (factor count: 1)
Creating challenge...
Challenge created: <challenge_id>
Verifying code with challenge...
✓ Token refreshed successfully
```

## Error Messages & What They Mean

| Error | Cause | Solution |
|-------|-------|----------|
| "Unauthorized" | No auth_token cookie | Sign in again |
| "token is expired" | Refresh failed or no refresh_token | Sign in again, check logs |
| "Invalid TOTP code" | Wrong 6-digit code | Get correct code from authenticator |
| "Factor not found" | Wrong factor ID | Enroll in MFA first |
| "Session expired" | Token too old to refresh | Sign in again |

## Log Monitoring Checklist

When debugging token issues, look for these patterns in logs:

✅ **Good Signs**:
- "Sign in successful with refresh token"
- "Token refreshed successfully"  
- "Token proactively refreshed"
- "Token expired during X, attempting refresh and retry"
- "MFA verification successful"

❌ **Bad Signs**:
- "token is expired" in final error response
- "No refresh token" 
- "Token refresh failed: 4xx" (Supabase error)
- No refresh logs at all during MFA operations

## Configuration Files

### Cookies Configuration
- **auth_token**: HttpOnly, SameSite=Strict, Max-Age=604800 (7 days)
- **refresh_token**: HttpOnly, SameSite=Strict, Max-Age=604800 (7 days)
- **user_email**: Regular cookie, Max-Age=604800

### Rate Limiting
- **Sign In**: 5 attempts / minute per IP
- **Sign Up**: 3 attempts / hour per IP
- **MFA Verify**: 10 attempts / minute per IP
- **MFA Enroll**: No explicit rate limit (uses general rate limiting)

## Troubleshooting

### If Still Getting "Token is Expired"

**Step 1: Check Refresh Token Storage**
- Open DevTools → Application → Cookies
- Verify `refresh_token` cookie exists and has value
- If missing: Supabase not returning refresh_token during signin

**Step 2: Check Server Logs**
```bash
tail -100 /tmp/deno.log | grep -i "refresh"
```
Look for:
- "Attempting token refresh" → refresh is being called
- "Token refresh failed" → Supabase rejected refresh
- "Token refreshed successfully" → refresh succeeded

**Step 3: Verify Supabase Account**
- Check that refresh_token grant is enabled in Supabase Auth settings
- Confirm project has MFA (TOTP) enabled
- Check JWT secret is correct in environment

**Step 4: Check Time Sync**
- Server time must be close to Supabase server time
- Token expiration is checked server-side in Supabase
- Large time differences can cause immediate expiration

**Step 5: Manual Token Refresh Test**
```bash
# Get refresh_token from browser DevTools
REFRESH_TOKEN="<paste_from_cookies>"
SUPABASE_URL="https://xxx.supabase.co"
ANON_KEY="<your_anon_key>"

curl -X POST "$SUPABASE_URL/auth/v1/token?grant_type=refresh_token" \
  -H "Content-Type: application/json" \
  -H "apikey: $ANON_KEY" \
  -d "{\"refresh_token\": \"$REFRESH_TOKEN\"}"
```

If this fails, the issue is with Supabase configuration, not this application.

## Recent Changes Summary

### Files Modified
- [main.ts](main.ts): Added token refresh infrastructure, reactive retry logic, enhanced logging

### Key Functions Added
- `refreshAccessToken(refreshToken)`: Refresh JWT using refresh_token

### Key Locations Updated
- `handleSignIn()`: Store refresh_token in HttpOnly cookie
- `handleSignUp()`: Store refresh_token in HttpOnly cookie
- `handleMFAVerify()`: Proactive + reactive token refresh with retry
- `handleMFAEnroll()`: Proactive + reactive token refresh with retry
- Frontend JavaScript: Removed broken Authorization header code

## Next Steps if Still Not Working

1. **Enable Debug Mode**: Add `DEBUG=true` environment variable
2. **Increase Logging**: Add `console.log()` statements in specific functions
3. **Monitor Supabase Logs**: Check Supabase admin dashboard for auth errors
4. **Test Refresh Endpoint Directly**: Use cURL to test token refresh works
5. **Check Network Tab**: Browser DevTools → Network tab, watch API calls and cookie headers

## Contact/Support

If issues persist after these fixes:
1. Check [/tmp/deno.log](file:///tmp/deno.log) for error patterns
2. Verify Supabase project configuration
3. Test manual token refresh with cURL (command in troubleshooting section)
4. Review this guide's error messages and log monitoring checklist
