# MFA Authentication with Supabase, Deno, Fresh, and Vite

A complete full-stack Multi-Factor Authentication (MFA) implementation using modern web technologies.

## 🚀 Tech Stack

- **Runtime:** Deno - Modern JavaScript/TypeScript runtime
- **Framework:** Fresh - Full-stack Deno framework (similar to Next.js)
- **Build Tool:** Vite - Fast build tool and dev server
- **Backend:** Supabase - Open-source Firebase alternative with built-in auth
- **Styling:** Twind - Tailwind CSS in JS

## 📋 Features

- ✅ User registration and login
- ✅ Multi-Factor Authentication (TOTP - Time-based One-Time Password)
- ✅ Secure session management
- ✅ QR code generation for authenticator apps
- ✅ Modern UI with Preact components
- ✅ Type-safe development with TypeScript

## 📦 Project Structure

```
.
├── routes/              # Fresh routes and API endpoints
│   ├── api/            # API routes for authentication
│   │   ├── auth/       # Login/signup endpoints
│   │   └── mfa/        # MFA verification and enrollment
│   ├── mfa/            # MFA pages
│   ├── index.tsx       # Home page
│   ├── login.tsx       # Login page
│   └── dashboard.tsx   # Protected dashboard
├── components/         # Reusable Preact components
│   ├── LoginForm.tsx   # Login form component
│   ├── MFAVerify.tsx   # MFA verification component
│   └── MFAEnroll.tsx   # MFA enrollment component
├── utils/             # Utility functions
│   ├── supabase.ts    # Supabase client and helpers
│   └── auth.ts        # Authentication functions
├── middleware/        # Express-like middleware
├── public/            # Static assets
├── deno.json         # Deno configuration
├── fresh.config.ts   # Fresh framework configuration
├── vite.config.ts    # Vite build configuration
├── twind.config.ts   # Twind CSS configuration
└── main.ts           # Application entry point
```

## ⚡ Quick Start

**Want to get started immediately?** See [QUICKSTART.md](QUICKSTART.md) for a 5-minute setup guide!

## 🔧 Setup Instructions

### Prerequisites

- Deno (>= 1.40.0)
- Node.js (for Vite, optional)
- A Supabase account and project

### 1. Environment Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Fill in your Supabase credentials:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_KEY`: Your Supabase anon public key
- `SUPABASE_SERVICE_KEY`: Your service role key (for admin operations)
- `JWT_SECRET`: Your JWT secret key

### 2. Supabase Setup

1. Create a new Supabase project
2. Enable Auth in your Supabase project settings
3. Configure TOTP (Time-based One-Time Password) MFA:
   - Go to Authentication > Providers
   - Enable the necessary auth factors

### 3. Install Dependencies

```bash
deno cache --reload deno.json
```

### 4. Run Development Server

```bash
deno task dev
```

The application will start at `http://localhost:8000`

## 📚 API Endpoints

### Authentication

- `POST /api/auth/signup` - Register a new user
- `POST /api/auth/signin` - Sign in with email and password

### Multi-Factor Authentication

- `POST /api/mfa/enroll` - Enroll a new MFA factor (TOTP)
- `POST /api/mfa/verify` - Verify MFA code during login

## 🔐 Authentication Flow

1. **User Login**
   - User enters email and password
   - System validates credentials via Supabase
   
2. **MFA Check**
   - If MFA is enabled on the account, a challenge is created
   - User is redirected to MFA verification page
   
3. **MFA Verification**
   - User enters 6-digit code from authenticator app
   - Code is verified against the challenge
   
4. **Session Creation**
   - Upon successful verification, session token is created
   - User is redirected to dashboard

## 🎨 UI Components

### LoginForm
- Email and password input fields
- Form validation
- Error message display
- Loading state indication

### MFAVerify
- 6-digit code input with pattern validation
- Challenge ID handling
- Real-time verification feedback

### MFAEnroll
- Factor type selection
- TOTP setup instructions
- QR code display for authenticator apps

## 🚀 Deployment

### Using Deno Deploy

1. Push your code to GitHub
2. Link your Deno Deploy project
3. Set environment variables in Deno Deploy dashboard
4. Deploy automatically on git push

### Using Docker

```dockerfile
FROM denoland/deno:latest

WORKDIR /app
COPY . .

RUN deno cache deno.json

EXPOSE 8000

CMD ["deno", "run", "-A", "main.ts"]
```

## 📖 Available Commands

- `deno task dev` - Start development server with hot reload
- `deno task build` - Build for production
- `deno task build:vite` - Build with Vite
- `deno task test` - Run tests
- `deno task start` - Start production server

## 🔗 Useful Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Fresh Documentation](https://fresh.deno.dev/)
- [Deno Manual](https://deno.land/manual)
- [Vite Documentation](https://vitejs.dev/)

## 📝 Security Considerations

- All passwords are hashed using bcrypt (handled by Supabase)
- MFA codes are time-based (TOTP) and expire after 30 seconds
- Session tokens are JWT-based and include expiration
- HTTPS is recommended for production
- Environment variables should never be committed to version control

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

## 📄 License

MIT License - feel free to use this in your projects.

---

Built with ❤️ using Deno, Fresh, and Supabase
