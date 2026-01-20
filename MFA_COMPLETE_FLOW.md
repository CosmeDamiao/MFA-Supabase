# Complete MFA User Flow Guide

## Quick Start

The MFA Auth application now includes a complete, working user interface for:
1. ✅ **Sign Up** - Create a new account with email and password
2. ✅ **MFA Enrollment** - Set up two-factor authentication with QR code scanning
3. ✅ **Secure Login** - Sign in with MFA verification
4. ✅ **Dashboard** - View authenticated user information

## Application Architecture

### Pages
- **`/` (Home)** - Landing page with navigation to sign up and login
- **`/signup`** - New user registration form
- **`/login`** - Sign-in with automatic MFA detection
- **`/mfa/enroll`** - Two-factor authentication setup page
- **`/dashboard`** - Authenticated user dashboard

### API Endpoints
- `POST /api/auth/signup` - Register new user (handled by main.ts)
- `POST /api/auth/signin` - Sign in with email/password (handled by main.ts)
- `POST /api/auth/list-factors` - Check if user has MFA factors
- `POST /api/mfa/enroll` - Start MFA enrollment, get QR code
- `POST /api/mfa/verify` - Verify 6-digit TOTP code

## User Flow

### 1. Sign Up (New User)
1. Visit `http://localhost:8000/signup`
2. Enter email, password, confirm password
3. Click "Sign Up"
4. Upon success, redirected to `/login` after 2 seconds

### 2. First Login (No MFA Setup)
1. Visit `http://localhost:8000/login`
2. Enter email and password
3. On success, app detects user has no MFA factors
4. Shows "Welcome" screen asking to set up MFA
5. User can either:
   - **Set Up MFA** - Redirects to `/mfa/enroll`
   - **Skip** - Goes directly to `/dashboard`

### 3. MFA Enrollment
1. On `/mfa/enroll`, app fetches QR code from Supabase
2. User scans QR code with authenticator app (Google Authenticator, Authy, Microsoft Authenticator, etc.)
3. Click "I've Scanned the Code" to proceed to verification
4. Enter 6-digit code from authenticator app
5. Upon successful verification, redirected to `/dashboard`

### 4. Subsequent Logins (With MFA)
1. Visit `http://localhost:8000/login`
2. Enter email and password
3. On success, app detects user has MFA factors
4. Shows MFA verification screen
5. Enter 6-digit code from authenticator app
6. Upon successful verification, redirected to `/dashboard`

### 5. Dashboard
- Shows logged-in user's email
- Displays authentication status
- Shows MFA is active
- Provides logout button

## Testing with Test Credentials

### Using Existing Test User
If you have a confirmed test user with MFA already enrolled:
```
Email: testuser5@test.com
Password: testuser5@test.com
TOTP Secret: VEAQFLSCYRAEMUBNIYDQMGYPKU2PPSIC
```

**Steps:**
1. Go to login page
2. Enter credentials
3. When asked for 6-digit code, use `totp-cli` or your authenticator:
   ```bash
   # Using totp-cli
   echo "VEAQFLSCYRAEMUBNIYDQMGYPKU2PPSIC" | totp-cli
   ```
4. Enter the 6-digit code
5. Redirected to dashboard

### Creating a New Test User
1. Go to `/signup`
2. Create account with new email and password
3. On first login, you'll be asked to set up MFA
4. Choose "Set Up MFA"
5. Scan QR code with authenticator app
6. Enter the 6-digit code to complete setup
7. Redirected to dashboard

## Session Management

The application uses `localStorage` to manage user sessions:
- **`access_token`** - JWT token for authenticated API requests
- **`user_email`** - Current user's email for display

### Session Persistence
- Tokens are stored in browser `localStorage`
- Dashboard page checks for valid token on load
- Unauthenticated users are redirected to login
- Logout removes all tokens from localStorage

## Key Features

✅ **Form Validation**
- Email format validation
- Password minimum length (6 characters)
- Password confirmation matching
- 6-digit code input validation

✅ **Error Handling**
- User-friendly error messages
- Form resubmission on error
- Clear error states

✅ **Security**
- Secure password transmission (HTTPS in production)
- Bearer token authentication for MFA operations
- TOTP-based MFA (time-based one-time password)
- Session tokens stored client-side

✅ **User Experience**
- Responsive design with gradient backgrounds
- Clear visual feedback (loading states, success messages)
- Emoji icons for visual clarity
- Two-step MFA enrollment (scan → verify)
- Automatic redirects on success

## Architecture Overview

```
┌─────────────────────────────────────┐
│   Fresh Framework (Client)          │
│  ├─ /signup (SignUp page)           │
│  ├─ /login (Login page)             │
│  ├─ /mfa/enroll (MFA enrollment)    │
│  └─ /dashboard (Authenticated)      │
└─────────────────────────────────────┘
           ↓ (HTTP Requests)
┌─────────────────────────────────────┐
│   Deno HTTP Server (main.ts)        │
│  ├─ /api/auth/signup                │
│  ├─ /api/auth/signin                │
│  ├─ /api/auth/list-factors          │
│  ├─ /api/mfa/enroll                 │
│  └─ /api/mfa/verify                 │
└─────────────────────────────────────┘
           ↓ (Supabase JS Client)
┌─────────────────────────────────────┐
│   Supabase Backend                  │
│  ├─ Auth Service                    │
│  ├─ MFA/TOTP Service                │
│  └─ Database                        │
└─────────────────────────────────────┘
```

## Implementation Details

### Login Flow (Smart MFA Detection)
```typescript
// 1. User signs in with email/password
POST /api/auth/signin
↓
// 2. App gets valid session token
localStorage.setItem("access_token", token)
↓
// 3. App checks if user has MFA factors
POST /api/auth/list-factors (with Bearer token)
↓
// 4a. If factors exist → Show MFA verification
// 4b. If no factors → Ask to set up MFA
```

### MFA Verification
```typescript
// 1. User enters 6-digit code
// 2. App calls verification endpoint
POST /api/mfa/verify
  Authorization: Bearer {access_token}
  body: { code: "123456" }
↓
// 3. Supabase validates TOTP code
// 4. Returns new session with MFA verified
// 5. App updates token and redirects to dashboard
```

## Environment Variables Required

```
SUPABASE_URL=https://[project].supabase.co
SUPABASE_KEY=[anon public key]
PORT=8000
```

## Development Commands

```bash
# Start dev server
deno task dev

# Run interactive MFA test
./test_mfa_interactive.sh

# Access the application
# Home: http://localhost:8000
# Login: http://localhost:8000/login
# Signup: http://localhost:8000/signup
```

## Troubleshooting

### "Not authenticated" error on MFA enrollment
- Ensure you're logged in first
- Check that `access_token` is stored in browser localStorage
- Verify you came from the login flow

### "Code must be 6 digits" error
- Ensure authenticator app is showing 6-digit code
- Code is time-based and expires after ~30 seconds
- If code expired, wait for new one

### "No TOTP factor found" error
- User hasn't completed MFA enrollment
- Go to `/mfa/enroll` to set up MFA
- Must verify code during enrollment

### Can't scan QR code
- Use manual entry option with the secret key shown
- Enter secret key in authenticator app
- Select "Time-based (TOTP)" as the type

## Next Steps / Future Enhancements

- [ ] Add SMS-based MFA
- [ ] Add email-based recovery codes
- [ ] Add backup codes functionality
- [ ] User settings page
- [ ] Change password functionality
- [ ] Account deletion option
- [ ] Session management (view active sessions)
- [ ] MFA method switching
- [ ] Rate limiting on verification attempts

## Support

For issues or questions:
1. Check that Supabase is properly configured
2. Verify environment variables are set
3. Check browser console for error messages
4. Ensure email addresses are confirmed in Supabase
5. Verify TOTP secret is correctly stored with user factor

---

**Status**: ✅ Complete and tested

**Latest Test**: Sign up → MFA enrollment → Login with MFA → Dashboard navigation
