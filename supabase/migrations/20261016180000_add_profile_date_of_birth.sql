-- Add an optional date of birth to each user's profile.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Allow authenticated users to update this column.
-- Existing profile RLS policies must still restrict updates
-- to the authenticated user's own profile.
GRANT UPDATE (date_of_birth)
ON TABLE public.profiles
TO authenticated;

COMMENT ON COLUMN public.profiles.date_of_birth
IS 'Optional date of birth. Calculate age when needed; do not store age separately.';