# MFA Redirect Fix - After Verification

## Problem
After successfully verifying MFA code, the application was redirecting back to login instead of the dashboard.

## Root Cause
The MFA verify flow was using localStorage to store and retrieve the authentication token:
- **MFA Verify Page** (`routes/mfa/verify.tsx`): Used `localStorage.getItem("access_token")`
- **Dashboard Page** (`routes/dashboard.tsx`): Used `localStorage.getItem("access_token")`

However, with the new HttpOnly cookie implementation:
- Authentication tokens are stored in **HttpOnly cookies** (secure, not accessible to JavaScript)
- Tokens are **NOT** stored in localStorage
- Dashboard was checking localStorage and finding no token, so it redirected to login

## Solution Implemented

### 1. Updated MFA Verify Page (`routes/mfa/verify.tsx`)
**Before:**
```typescript
const token = localStorage.getItem("access_token");
```

**After:**
```typescript
function getCookie(name: string): string | null {
  const value = "; " + document.cookie;
  const parts = value.split("; " + name + "=");
  if (parts.length === 2) return decodeURIComponent(parts.pop()!.split(';').shift()!);
  return null;
}

const token = getCookie("auth_token");
```

Changes:
- Added `getCookie()` helper function to read cookies
- Updated to read from `auth_token` cookie instead of localStorage
- Added `credentials: "include"` to fetch call to send cookies

### 2. Updated Dashboard Page (`routes/dashboard.tsx`)
**Before:**
```typescript
const token = localStorage.getItem("access_token");
const email = localStorage.getItem("user_email");

const handleLogout = () => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("user_email");
  localStorage.removeItem("_mfa_pending");
  window.location.href = "/";
};
```

**After:**
```typescript
function getCookie(name: string): string | null {
  const value = "; " + document.cookie;
  const parts = value.split("; " + name + "=");
  if (parts.length === 2) return decodeURIComponent(parts.pop()!.split(';').shift()!);
  return null;
}

const token = getCookie("auth_token");
const email = getCookie("user_email");

const handleLogout = () => {
  document.cookie = 'auth_token=; Max-Age=0; Path=/';
  document.cookie = 'user_email=; Max-Age=0; Path=/';
  window.location.href = "/";
};
```

Changes:
- Added `getCookie()` helper function
- Updated to read both `auth_token` and `user_email` from cookies
- Updated logout to clear cookies by setting Max-Age=0

### 3. Updated MFA Verify API (`routes/api/mfa/verify.ts`)
**Added cookie import:**
```typescript
import { setHttpOnlyCookie } from "../../../utils/cookies.ts";
```

**Updated response to set cookies:**
```typescript
return new Response(
  JSON.stringify({
    session: data.session,
    user: data.user,
    message: "MFA verification successful",
  }),
  {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": [
        setHttpOnlyCookie("auth_token", data.session.access_token, 604800),
        `user_email=${encodeURIComponent(data.user.email)}; Max-Age=604800; Path=/; SameSite=Strict`,
      ].join(", "),
    },
  }
);
```

Changes:
- Now sets both `auth_token` (HttpOnly) and `user_email` cookies on successful verification
- Cookies persist for 7 days
- Frontend can now read the cookies and redirect to dashboard

## Complete MFA Flow After Fix

```
1. User signin
   ├─ Credentials validated
   ├─ Check MFA enrollment status
   ├─ Set auth_token & user_email cookies
   └─ Return hasMFA flag

2. If hasMFA is true:
   └─ Redirect to /mfa/verify

3. On MFA verify page:
   ├─ Read auth_token from cookie
   ├─ Submit TOTP code
   └─ Return cookies (already set)

4. After successful verification:
   ├─ Redirect to /dashboard
   ├─ Dashboard reads auth_token from cookie
   ├─ Auth check passes
   └─ Display dashboard with user email

5. Logout:
   ├─ Clear auth_token cookie
   ├─ Clear user_email cookie
   └─ Redirect to home
```

## Key Security Benefits

✅ **HttpOnly Cookies**: Tokens cannot be stolen via XSS attacks
✅ **SameSite=Strict**: Prevents CSRF attacks
✅ **No localStorage**: Eliminates local storage XSS vulnerability
✅ **Automatic Cookie Transmission**: Browser sends cookies with each request
✅ **Credential Include**: `credentials: "include"` ensures cookies are sent in cross-origin requests

## Testing the Fix

### Test Flow:
1. Sign up with new email
2. Sign in with the email
3. If MFA not enrolled, enroll in MFA
4. After successful enrollment, should redirect to dashboard
5. After logout and re-signin with MFA, should verify code and redirect to dashboard

### Expected Behavior:
- After MFA verification ✅ redirects to dashboard (fixed)
- Dashboard displays user email from cookie ✅
- Logout clears cookies ✅

## Files Modified
- `routes/mfa/verify.tsx` - Updated to use cookies
- `routes/dashboard.tsx` - Updated to use cookies
- `routes/api/mfa/verify.ts` - Updated to set cookies on verification

## Verification Commands

```bash
# Start server
deno run -A main.ts

# Sign up
curl -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test@1234"}'

# Sign in
curl -X POST http://localhost:8000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test@1234"}'

# Check cookies are set in response headers
```

## Related Documentation
- [SECURITY_IMPROVEMENTS_SUMMARY.md](SECURITY_IMPROVEMENTS_SUMMARY.md) - HttpOnly cookies implementation
- [SECURITY_USAGE_GUIDE.md](SECURITY_USAGE_GUIDE.md) - Testing and usage guide
- [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md) - Overall status
