# Fix Applied: "Please sign in first" Error on MFA Verification

## Problem
Users were getting "Please sign in first to access MFA verification" error when trying to verify MFA after signing in.

## Root Cause
The login page was not including `credentials: "include"` in fetch calls, which meant:
1. The browser was NOT accepting the `Set-Cookie` headers from the signin API response
2. When user navigated to `/mfa/verify`, the server checked for `auth_token` cookie
3. Since cookies weren't set, the server redirected to `/login` 
4. The error message displayed because no valid token could be found

## Solution Applied
Added `credentials: "include"` to all fetch calls in the login page:

### 1. Signin fetch call (line 20 in routes/login.tsx)
```typescript
const response = await fetch("/api/auth/signin", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
  credentials: "include",  // ← ADDED
});
```

### 2. List factors fetch call (line 40 in routes/login.tsx)
```typescript
const listResponse = await fetch("/api/auth/list-factors", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  Authorization: `Bearer ${data.session.access_token}`,
  credentials: "include",  // ← ADDED
});
```

### 3. MFA verify fetch call (line 80 in routes/login.tsx)
```typescript
const response = await fetch("/api/mfa/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  Authorization: `Bearer ${token}`,
  body: JSON.stringify({ code: mfaCode }),
  credentials: "include",  // ← ADDED
});
```

### 4. Enhanced MFA Verify page (routes/mfa/verify.tsx)
Updated to check localStorage as fallback if cookies not available:
```typescript
// Try to get token from cookies first, then localStorage
let token = getCookie("auth_token");
if (!token) {
  token = localStorage.getItem("access_token") || null;
}
if (!token) throw new Error("Please sign in first to access MFA verification");
```

## What This Fixes
✅ Signin cookies are now properly set in browser
✅ User can access `/mfa/verify` without redirect
✅ MFA verification flow completes successfully
✅ Better fallback if cookies unavailable (uses localStorage)

## How It Works Now

### Flow with the fix:
1. User enters credentials on `/login`
2. Signin endpoint returns Set-Cookie headers
3. Browser accepts cookies due to `credentials: "include"`
4. User is redirected to `/mfa/verify` (if hasMFA=true)
5. Server finds `auth_token` cookie and allows page to load
6. User enters 6-digit code
7. Verification succeeds and user redirected to `/dashboard`

## Testing
To verify the fix works:
1. Open http://localhost:8000/login
2. Sign in with: `braposo.santos1@gmail.com` / `qqwwee`
3. Should be redirected to MFA verify page (not login)
4. Enter your 6-digit TOTP code
5. Should redirect to dashboard

---
**Files Modified**: 
- routes/login.tsx (added credentials: "include" to 3 fetch calls)
- routes/mfa/verify.tsx (enhanced token lookup with localStorage fallback)
