# Production Deployment Guide

## Pre-Deployment Checklist

### 1. Environment Configuration

```bash
# Create production environment file
cp .env.production.example .env.production

# Fill in production values
nano .env.production
```

Required environment variables:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Public anon key for client-side auth
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (keep secret!)
- `DENO_ENV=production` - Enables production mode
- `PORT=8000` - Server port (optional, defaults to 8000)

### 2. Security Configuration

**Supabase Setup:**
1. Go to Supabase Dashboard → Authentication → Settings
2. Enable Email authentication
3. Enable TOTP MFA
4. Configure Site URL to your production domain
5. Add redirect URLs for auth callbacks

**Database Setup:**
```sql
-- Run this migration if not already done
-- See supabase_migration.sql for the full schema

-- Enable Row Level Security
ALTER TABLE user_mfa_status ENABLE ROW LEVEL SECURITY;

-- Create policy for user_mfa_status
CREATE POLICY "Users can read own MFA status"
  ON user_mfa_status FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own MFA status"
  ON user_mfa_status FOR UPDATE
  USING (auth.uid() = user_id);
```

### 3. Code Optimization

**Remove Debug Logs:**
The app uses a conditional logger that only logs in development. Ensure `DENO_ENV=production` is set.

**Update Cookie Settings:**
In production, cookies should have the `Secure` flag. This is automatically handled if you're serving over HTTPS.

### 4. Build and Test

```bash
# Install dependencies
deno cache --reload deno.json

# Run tests (if available)
deno test

# Build (if using Fresh with islands)
deno task build

# Test production mode locally
DENO_ENV=production deno task dev
```

## Deployment Options

### Option 1: Deno Deploy (Recommended)

```bash
# Install Deno Deploy CLI
deno install --allow-all --unstable https://deno.land/x/deploy/deployctl.ts

# Deploy
deployctl deploy --project=your-project-name main.ts
```

Set environment variables in Deno Deploy dashboard.

### Option 2: Docker

Create `Dockerfile`:
```dockerfile
FROM denoland/deno:latest

WORKDIR /app

# Copy dependency files
COPY deno.json deno.lock ./

# Cache dependencies
RUN deno cache --lock=deno.lock deno.json

# Copy source code
COPY . .

# Set production environment
ENV DENO_ENV=production
ENV PORT=8000

# Expose port
EXPOSE 8000

# Run the app
CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read", "main.ts"]
```

Build and run:
```bash
docker build -t mfa-auth .
docker run -p 8000:8000 --env-file .env.production mfa-auth
```

### Option 3: VPS/Cloud Server

```bash
# SSH into your server
ssh user@your-server.com

# Install Deno
curl -fsSL https://deno.land/x/install/install.sh | sh

# Clone your repository
git clone https://github.com/yourusername/your-repo.git
cd your-repo

# Set up environment
cp .env.production.example .env
nano .env  # Fill in production values

# Install PM2 or systemd service
# PM2 example:
npm install -g pm2
pm2 start "deno run --allow-net --allow-env --allow-read main.ts" --name mfa-auth
pm2 save
pm2 startup
```

### Option 4: Cloud Platforms

**Render.com:**
1. Connect your repository
2. Set build command: `deno cache --reload deno.json`
3. Set start command: `deno run --allow-net --allow-env --allow-read main.ts`
4. Add environment variables

**Railway.app:**
1. Connect repository
2. Add environment variables
3. Deploy (auto-detects Deno)

## Post-Deployment

### 1. SSL/TLS Certificate
Ensure your domain has a valid SSL certificate. Most platforms (Deno Deploy, Vercel, Railway) provide this automatically.

### 2. DNS Configuration
Point your domain to the deployed application:
```
A     @       your-server-ip
AAAA  @       your-server-ipv6
```

### 3. Monitoring Setup

**Uptime Monitoring:**
- UptimeRobot
- Pingdom
- Better Uptime

**Error Tracking:**
```typescript
// Add to your code
import * as Sentry from "https://deno.land/x/sentry/index.ts";

Sentry.init({
  dsn: Deno.env.get("SENTRY_DSN"),
  environment: "production",
});
```

**Performance Monitoring:**
- Deno Deploy Analytics (built-in)
- New Relic
- Datadog

### 4. Backup Strategy

**Database Backups:**
Supabase provides automatic daily backups. For additional safety:
1. Enable point-in-time recovery
2. Export weekly backups manually
3. Store backups in separate location (S3, etc.)

**Code Backups:**
- Use Git with remote repository (GitHub, GitLab)
- Tag releases: `git tag -a v1.0.0 -m "Production release"`

### 5. Security Audit

Run security checks:
```bash
# Check for outdated dependencies
deno info

# Scan for known vulnerabilities (manual review)
# Review all Deno.env.get() calls
# Ensure no secrets in code
grep -r "password\|secret\|key" --include="*.ts" --include="*.tsx"
```

### 6. Load Testing

Test your application under load:
```bash
# Install k6
brew install k6  # macOS
# or download from k6.io

# Run load test
k6 run load-test.js
```

Example `load-test.js`:
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
};

export default function () {
  const res = http.get('https://your-domain.com');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
```

## Rollback Procedure

If something goes wrong:

```bash
# With Git tags
git checkout v1.0.0  # Last known good version
git push --force     # Or redeploy

# With Docker
docker run previous-image-tag

# With PM2
pm2 reload mfa-auth
```

## Maintenance

### Regular Tasks

**Weekly:**
- Review error logs
- Check uptime reports
- Monitor failed login attempts

**Monthly:**
- Update dependencies: `deno cache --reload`
- Review security advisories
- Rotate API keys (if policy requires)
- Database optimization/vacuum

**Quarterly:**
- Security audit
- Performance review
- Backup restoration test
- Disaster recovery drill

## Troubleshooting

### Common Issues

**Port already in use:**
```bash
lsof -i :8000
kill -9 <PID>
```

**Environment variables not loading:**
```bash
# Check if .env file exists and is readable
cat .env

# Check Deno permissions
deno run --allow-env --allow-read test-env.ts
```

**Database connection fails:**
- Verify SUPABASE_URL and keys
- Check network/firewall rules
- Confirm Supabase project is active

**High memory usage:**
- Rate limiter stores data in memory - consider Redis
- Check for memory leaks with `deno --v8-flags=--expose-gc`

## Support

For issues or questions:
1. Check application logs
2. Review Supabase dashboard for auth errors
3. Consult Deno and Fresh documentation
4. Create issue in repository

## Success Metrics

Monitor these KPIs:
- Uptime (target: 99.9%)
- Response time (target: <500ms p95)
- Failed login rate (alert if >5%)
- MFA adoption rate
- Error rate (target: <0.1%)
