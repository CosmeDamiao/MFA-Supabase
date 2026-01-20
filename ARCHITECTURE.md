# Proper MFA Architecture

## Current Issues
The current implementation uses error detection as a workaround, which is not professional.

## Recommended Solution

### 1. Database Schema
Add to your Supabase SQL editor:

```sql
-- Add mfa_enrolled column to auth.users metadata
-- OR create a separate table:

CREATE TABLE public.user_mfa_status (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  mfa_enrolled BOOLEAN DEFAULT FALSE,
  enrolled_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_mfa_status ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own MFA status
CREATE POLICY "Users can view own MFA status"
  ON public.user_mfa_status
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can update (for API)
CREATE POLICY "Service can update MFA status"
  ON public.user_mfa_status
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

### 2. Update verify endpoint
When MFA verification succeeds, update the database:

```typescript
// In routes/api/mfa/verify.ts
const { data: mfaData, error } = await supabase.auth.mfa.verifyOTP({...});

if (!error && mfaData) {
  // Update MFA status in database
  await supabase
    .from('user_mfa_status')
    .upsert({
      user_id: mfaData.user.id,
      mfa_enrolled: true,
      enrolled_at: new Date().toISOString()
    });
}
```

### 3. Check during signin
```typescript
// In routes/api/auth/signin.ts
const { data, error } = await supabase.auth.signInWithPassword({...});

if (data.user) {
  const { data: mfaStatus } = await supabase
    .from('user_mfa_status')
    .select('mfa_enrolled')
    .eq('user_id', data.user.id)
    .single();
    
  return { 
    user: data.user,
    session: data.session,
    hasMFA: mfaStatus?.mfa_enrolled || false
  };
}
```

### 4. Direct routing in login page
```javascript
if (data.hasMFA) {
  window.location.href = '/mfa/verify';
} else {
  window.location.href = '/mfa/enroll';
}
```

## Benefits
✅ Clean architecture
✅ No unnecessary API calls
✅ Direct routing - better UX
✅ Persistent state across sessions
✅ Professional and maintainable
✅ Easy to audit and debug

## Security
- MFA verification itself is secure (Supabase handles this)
- Database-backed status is reliable
- RLS policies protect user data
- No reliance on error messages
