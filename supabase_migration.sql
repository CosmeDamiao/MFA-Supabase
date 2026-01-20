-- ============================================
-- MFA Status Table Migration
-- ============================================
-- Run this in your Supabase SQL Editor
-- Dashboard > SQL Editor > New Query > Paste and Run
-- ============================================

-- Create user MFA status table
CREATE TABLE IF NOT EXISTS public.user_mfa_status (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  mfa_enrolled BOOLEAN DEFAULT FALSE NOT NULL,
  enrolled_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_mfa_status_user_id ON public.user_mfa_status(user_id);
CREATE INDEX IF NOT EXISTS idx_user_mfa_status_enrolled ON public.user_mfa_status(mfa_enrolled);

-- Enable Row Level Security
ALTER TABLE public.user_mfa_status ENABLE ROW LEVEL SECURITY;
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own MFA status" ON public.user_mfa_status;
DROP POLICY IF EXISTS "Users can update own MFA status" ON public.user_mfa_status;
DROP POLICY IF EXISTS "Users can insert own MFA status" ON public.user_mfa_status;
DROP POLICY IF EXISTS "Service role can manage all MFA status" ON public.user_mfa_status;


-- Policy: Users can view their own MFA status
CREATE POLICY "Users can view own MFA status"
  ON public.user_mfa_status
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can update their own MFA status
CREATE POLICY "Users can update own MFA status"
  ON public.user_mfa_status
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can insert their own MFA status
CREATE POLICY "Users can insert own MFA status"
  ON public.user_mfa_status
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Service role can do everything (for API using service key)
CREATE POLICY "Service role can manage all MFA status"
  ON public.user_mfa_status
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update updated_at on every update
DROP TRIGGER IF EXISTS update_user_mfa_status_updated_at ON public.user_mfa_status;
CREATE TRIGGER update_user_mfa_status_updated_at
  BEFORE UPDATE ON public.user_mfa_status
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Optional: Migrate existing enrolled users (if any)
-- This checks Supabase auth MFA factors and creates records
-- Comment this out if you want to start fresh
/*
INSERT INTO public.user_mfa_status (user_id, mfa_enrolled, enrolled_at)
SELECT 
  id as user_id,
  TRUE as mfa_enrolled,
  NOW() as enrolled_at
FROM auth.users
WHERE id IN (
  SELECT user_id 
  FROM auth.mfa_factors 
  WHERE status = 'verified'
)
ON CONFLICT (user_id) DO NOTHING;
*/

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.user_mfa_status TO authenticated;
GRANT ALL ON public.user_mfa_status TO service_role;

-- Verify the table was created
SELECT 'Migration completed successfully!' as status;
SELECT COUNT(*) as existing_records FROM public.user_mfa_status;
