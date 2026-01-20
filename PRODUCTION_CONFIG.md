# Production Configuration Guide

## Environment Variables

### Required Variables
```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...  # Public anonymous key
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Secret service role key

# Application
DENO_ENV=production
PORT=8000
```

### Optional Variables
```bash
# Monitoring & Logging
SENTRY_DSN=https://...@sentry.io/...
LOG_LEVEL=info  # debug, info, warn, error

# Security (if implementing custom features)
JWT_SECRET=your-secret-key-min-32-chars
SESSION_SECRET=another-secret-key

# CORS (if needed)
CORS_ORIGIN=https://yourdomain.com

# Rate Limiting (Redis URL for production scale)
REDIS_URL=redis://localhost:6379
```

## Cookie Configuration

Cookies are automatically configured based on `DENO_ENV`:

### Development (DENO_ENV !== "production")
```javascript
HttpOnly: true
SameSite: Strict
Secure: false  // Allow HTTP in dev
```

### Production (DENO_ENV === "production")
```javascript
HttpOnly: true
SameSite: Strict
Secure: true  // Requires HTTPS
```

## Supabase Configuration

### Authentication Settings
1. Go to Supabase Dashboard → Authentication → Settings
2. Enable Email authentication
3. Enable TOTP MFA
4. Configure Site URL: `https://yourdomain.com`
5. Add Redirect URLs:
   - `https://yourdomain.com/dashboard`
   - `https://yourdomain.com/mfa/verify`
   - `https://yourdomain.com/mfa/enroll`

### Database Setup
```sql
-- Enable Row Level Security
ALTER TABLE user_mfa_status ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can read own MFA status"
  ON user_mfa_status FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own MFA status"
  ON user_mfa_status FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access"
  ON user_mfa_status FOR ALL
  USING (true);

-- Indexes for performance
CREATE INDEX idx_user_mfa_status_user_id ON user_mfa_status(user_id);
```

## Rate Limiting Configuration

Current limits (adjust based on your needs):

| Endpoint | Limit | Window | Notes |
|----------|-------|---------|-------|
| /api/auth/signin | 5 | 60s | Per IP |
| /api/auth/signup | 3 | 1 hour | Per IP |
| /api/mfa/verify | 10 | 60s | Per IP |
| /api/mfa/enroll | 5 | 300s | Per token |
| /api/mfa/challenge | 20 | 60s | Per token |

### Upgrading to Redis

For production with multiple instances, replace in-memory rate limiting:

```typescript
// utils/rateLimit.ts
import { connect } from "redis";

const redis = await connect({
  hostname: Deno.env.get("REDIS_HOST") || "localhost",
  port: parseInt(Deno.env.get("REDIS_PORT") || "6379"),
});

export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const now = Date.now();
  const redisKey = `ratelimit:${key}`;
  
  const count = await redis.incr(redisKey);
  
  if (count === 1) {
    await redis.pexpire(redisKey, windowMs);
  }
  
  const ttl = await redis.pttl(redisKey);
  const resetTime = now + ttl;
  
  return {
    allowed: count <= maxAttempts,
    remaining: Math.max(0, maxAttempts - count),
    resetTime,
  };
}
```

## Logging Configuration

The app uses `utils/logger.ts` which automatically:
- Logs everything in development
- Logs only errors in production
- Can be extended to send to external services

### Integration with Sentry

```typescript
// Add to main.ts
import * as Sentry from "https://deno.land/x/sentry/index.ts";

if (Deno.env.get("DENO_ENV") === "production" && Deno.env.get("SENTRY_DSN")) {
  Sentry.init({
    dsn: Deno.env.get("SENTRY_DSN"),
    environment: "production",
    tracesSampleRate: 0.1,
  });
}

// In logger.ts error method:
export const logger = {
  error: (...args: unknown[]) => {
    console.error(...args);
    if (Deno.env.get("DENO_ENV") === "production") {
      Sentry.captureException(new Error(String(args[0])));
    }
  },
};
```

## Security Headers

Apply security headers to all responses in production:

```typescript
// In main.ts, before returning responses
import { addSecurityHeaders } from "./utils/security.ts";

const handler = async (req: Request): Promise<Response> => {
  // ... your route handling
  let response = new Response(/* ... */);
  
  // Add security headers in production
  if (Deno.env.get("DENO_ENV") === "production") {
    response = addSecurityHeaders(response);
  }
  
  return response;
};
```

## HTTPS Configuration

### Development
Use HTTP (`http://localhost:8000`)

### Production
Ensure HTTPS is configured:

**Option 1: Platform (Recommended)**
- Deno Deploy: Automatic HTTPS
- Vercel/Netlify: Automatic HTTPS
- Railway: Automatic HTTPS

**Option 2: Reverse Proxy**
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Performance Tuning

### Deno Runtime Flags
```bash
# Production
deno run \
  --allow-net \
  --allow-env \
  --allow-read \
  --cached-only \  # Use cached dependencies
  --no-check \     # Skip type checking (already done in build)
  main.ts

# With V8 optimizations
deno run \
  --allow-net \
  --allow-env \
  --allow-read \
  --v8-flags=--max-old-space-size=4096 \
  main.ts
```

### Caching Strategy
```bash
# Lock dependencies for reproducible builds
deno cache --lock=deno.lock --lock-write deno.json

# In production, use locked cache
deno cache --lock=deno.lock --cached-only deno.json
```

## Monitoring

### Health Check Endpoint
Add to `main.ts`:

```typescript
if (pathname === "/health") {
  return new Response(JSON.stringify({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(performance.now() / 1000),
  }), {
    headers: { "Content-Type": "application/json" },
  });
}
```

### Metrics to Track
- Request rate (requests/second)
- Response time (p50, p95, p99)
- Error rate (percentage)
- Auth success/failure rates
- MFA enrollment rate
- Token refresh success rate
- Rate limit hits

## Backup Strategy

### Database (Supabase)
- Automatic daily backups (enabled by default)
- Point-in-time recovery (optional, paid feature)
- Weekly manual exports:
  ```bash
  supabase db dump > backup-$(date +%Y%m%d).sql
  ```

### Code
- Git repository (GitHub/GitLab)
- Tagged releases for each deployment
- Automated backups to S3/cloud storage

### Configuration
- Store `.env.production` securely
- Use secrets manager (AWS Secrets Manager, Azure Key Vault, etc.)
- Document all environment variables

## Disaster Recovery

### Recovery Time Objective (RTO)
Target: < 1 hour

### Recovery Point Objective (RPO)
Target: < 1 day (Supabase daily backups)

### Recovery Procedure
1. Redeploy from last known good Git tag
2. Restore database from latest backup
3. Verify environment variables
4. Run smoke tests
5. Monitor error rates

## Scaling Considerations

### Horizontal Scaling
- Multiple instances behind load balancer
- Requires Redis for rate limiting
- Session state in cookies (stateless)

### Vertical Scaling
- Increase memory/CPU per instance
- Monitor with: `deno run --v8-flags=--expose-gc`

### Database Scaling
- Supabase auto-scales connections
- Add read replicas if needed
- Implement connection pooling

## Cost Optimization

### Supabase
- Free tier: 50MB database, 50K monthly active users
- Pro tier: $25/month for 8GB database, 100K MAU

### Hosting
- Deno Deploy: Free tier available
- Railway: $5/month
- VPS: $5-20/month

### Monitoring
- Free tiers available for most services
- Sentry: 5K events/month free
- UptimeRobot: 50 monitors free

## Support & Maintenance

### Regular Tasks
- Weekly: Review error logs
- Monthly: Update dependencies, security review
- Quarterly: Load testing, disaster recovery drill

### Emergency Contacts
- Supabase Support: https://supabase.com/support
- Deno Discord: https://discord.gg/deno
- GitHub Issues: [your-repo]/issues

## Compliance

### GDPR Considerations
- User data stored in Supabase (EU region available)
- Implement data export functionality
- Add account deletion feature
- Privacy policy required

### Security Standards
- ✅ OWASP Top 10 mitigation
- ✅ SOC 2 (via Supabase)
- ✅ HTTPS only in production
- ✅ Encrypted data at rest (Supabase)

## Conclusion

This configuration provides a solid foundation for production deployment. Adjust settings based on your specific requirements, traffic patterns, and compliance needs.

**Remember**: Always test thoroughly in a staging environment before deploying to production.
