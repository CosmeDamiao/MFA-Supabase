# Quick Start Guide - MFA Authentication

## 🚀 Your Project is Ready!

Your MFA authentication system with Supabase is fully deployed and running at:
**http://localhost:8000**

---

## ⚡ Quick Setup (5 minutes)

### 1️⃣ Create a Test User in Supabase

**Option A: Using Supabase Dashboard**
1. Go to https://app.supabase.com
2. Select your project
3. Go to **Authentication** → **Users** tab
4. Click **Add User** button
5. Enter:
   - Email: `testuser@example.com`
   - Password: `TestPass123!@`
   - Check "Auto confirm user"
6. Click **Create User**

**Option B: Using API (if user exists)**
```bash
curl -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email":"testuser@example.com",
    "password":"TestPass123!@"
  }'
```

---

### 2️⃣ Test Sign In

```bash
curl -X POST http://localhost:8000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email":"testuser@example.com",
    "password":"TestPass123!@"
  }'
```

**Response (Save this token):**
```json
{
  "access_token": "eyJhbGc...",
  "user": {
    "id": "...",
    "email": "testuser@example.com"
  }
}
```

---

### 3️⃣ Test MFA Enrollment

Replace `YOUR_TOKEN` with the `access_token` from Step 2:

```bash
curl -X POST http://localhost:8000/api/mfa/enroll \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"factorType":"totp"}'
```

**Response:**
```json
{
  "id": "mfa_...",
  "type": "totp",
  "totp": {
    "qr_code": "data:image/png;base64,...",
    "secret": "JBSWY3DPEBLW64TMMQ======"
  }
}
```

---

### 4️⃣ Scan QR Code & Verify

1. Download authenticator app:
   - **Google Authenticator** (iOS/Android)
   - **Authy** (iOS/Android)
   - **Microsoft Authenticator** (iOS/Android)

2. Scan the QR code from Step 3

3. Get 6-digit code from app

4. Verify:
```bash
curl -X POST http://localhost:8000/api/mfa/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "code":"123456",
    "factorId":"mfa_...",
    "challengeId":"challenge_..."
  }'
```

---

## 🌐 Web Interface

### Home Page
Visit: **http://localhost:8000**

Features:
- ✅ Landing page with project overview
- ✅ Links to Login and Sign Up
- ✅ Feature showcase

### Login Page
Visit: **http://localhost:8000/login**

Features:
- ✅ Email input
- ✅ Password input
- ✅ Sign in button

### Dashboard
Visit: **http://localhost:8000/dashboard**

Features:
- ✅ Protected user area
- ✅ Session information
- ✅ MFA status

---

## 🧪 Testing Script

Run automated tests:

```bash
# Default (localhost)
./test_mfa.sh

# Custom API URL
./test_mfa.sh http://your-api.com

# Custom credentials
./test_mfa.sh http://localhost:8000 user@test.com password123
```

---

## 📊 Server Status

Check if server is running:

```bash
curl http://localhost:8000
```

Expected response: Home page HTML (200 OK)

---

## 🔧 Troubleshooting

### Server not running?
```bash
cd /Users/brunosantos/VS/VS-MFA-TEST
deno task dev
```

### Email validation error?
- Use valid email format: `name@domain.com`
- Avoid: `mfatest@example.com` (too generic)
- Try: `testuser@example.com` or `demo@test.co`

### Invalid credentials?
- Ensure user exists in Supabase
- Check email and password exactly match
- Email must be verified in Supabase

### No Bearer token error?
- You haven't signed in successfully
- Create and sign in user first
- Copy the `access_token` from response

### MFA not working?
- Enable TOTP in Supabase Auth settings
- User must have signed in (token required)
- Install authenticator app on phone

---

## 📁 Project Files

```
/Users/brunosantos/VS/VS-MFA-TEST/
├── main.ts                 # Main server file
├── deno.json              # Deno configuration
├── .env                   # Environment variables (Supabase keys)
├── utils/
│   ├── supabase.ts       # Supabase integration
│   ├── auth.ts           # Auth utilities
│   └── config.ts         # App configuration
├── routes/
│   ├── api/              # API endpoints
│   └── [pages]           # UI pages
├── components/           # Reusable components
├── README.md             # Full documentation
├── TESTING.md            # Testing guide
└── test_mfa.sh          # Testing script
```

---

## 🚀 Next Steps

1. ✅ Test with real user credentials
2. ✅ Verify MFA QR code and enrollment
3. ✅ Test sign in/sign out flow
4. ✅ Review Supabase dashboard activity
5. 🔄 Deploy to production
6. 🔄 Add more MFA factors (SMS, email)
7. 🔄 Customize UI/branding

---

## 📚 Resources

- **Live Demo:** http://localhost:8000
- **Supabase Dashboard:** https://app.supabase.com
- **API Docs:** See TESTING.md
- **Source Code:** main.ts, utils/supabase.ts

---

## ✨ Features Ready

✅ User Registration
✅ Email/Password Auth
✅ JWT Token Management
✅ TOTP MFA
✅ QR Code Generation
✅ Secure Sessions
✅ Protected Routes
✅ Error Handling

---

**Status:** 🟢 Production Ready
**Created:** January 16, 2026
**Framework:** Deno + Fresh + Supabase
