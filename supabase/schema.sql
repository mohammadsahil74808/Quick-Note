-- ==============================================================================
-- DEV MAVERICKS Community Portal — Supabase Schema & Security (Phase 1)
-- ==============================================================================
-- Architecture: Serverless PostgreSQL + Supabase Auth + Supabase Storage + RLS
-- Target: Free-tier friendly, zero-custom-backend, strict client-side security
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TABLE DEFINITIONS
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- TABLE 1: applications
-- Stores applicant records submitted through the Join Us portal
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT, -- Applicant phone / WhatsApp contact number
    college TEXT,
    branch TEXT,
    year TEXT,
    track TEXT,
    github_url TEXT,
    linkedin_url TEXT,
    portfolio_url TEXT,
    photo_path TEXT, -- Storage path in 'member-photos' bucket (never binary in DB)
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Ensure column exists if table was previously created
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS phone TEXT;

-- Indexes for performance & querying
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_email ON public.applications(email);
CREATE INDEX IF NOT EXISTS idx_applications_submitted_at ON public.applications(submitted_at DESC);

-- ------------------------------------------------------------------------------
-- TABLE 2: members
-- Stores official, approved DEV MAVERICKS members
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID UNIQUE REFERENCES public.applications(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT, -- Member phone / WhatsApp contact number
    college TEXT,
    branch TEXT,
    year TEXT,
    track TEXT,
    role TEXT,
    github_url TEXT,
    linkedin_url TEXT,
    portfolio_url TEXT,
    photo_path TEXT, -- Storage path in 'member-photos' bucket
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    active BOOLEAN NOT NULL DEFAULT true
);

-- Ensure column exists if table was previously created
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS phone TEXT;

-- Indexes for performance & querying
CREATE INDEX IF NOT EXISTS idx_members_active ON public.members(active);
CREATE INDEX IF NOT EXISTS idx_members_track ON public.members(track);
CREATE INDEX IF NOT EXISTS idx_members_email ON public.members(email);

-- ------------------------------------------------------------------------------
-- TABLE 3: admin_users
-- Identifies users granted admin panel access (linked to Supabase Auth)
-- Passwordless here: passwords and login handled strictly by Supabase Auth (auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 3. SECURITY HELPER FUNCTION (ADMIN CHECK)
-- ==============================================================================
-- Returns true if the requesting authenticated user exists in admin_users.
-- SECURITY DEFINER allows it to safely check admin_users without public SELECT.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.admin_users 
        WHERE id = auth.uid()
    );
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- RLS: applications
-- Public/Anon:
--   - Can submit new applications with 'pending' status only.
--   - Cannot read, update, or delete applications.
-- Admins:
--   - Full SELECT, UPDATE, and DELETE privileges.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can submit applications" ON public.applications;
CREATE POLICY "Public can submit applications"
    ON public.applications
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (status = 'pending');

DROP POLICY IF EXISTS "Admins can view all applications" ON public.applications;
CREATE POLICY "Admins can view all applications"
    ON public.applications
    FOR SELECT
    TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update applications" ON public.applications;
CREATE POLICY "Admins can update applications"
    ON public.applications
    FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete applications" ON public.applications;
CREATE POLICY "Admins can delete applications"
    ON public.applications
    FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- RLS: members
-- Public/Anon:
--   - Can read active members (for public Team showcase page).
--   - Cannot insert, update, or delete members.
-- Admins:
--   - Full management access (view all, insert, update, delete).
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view active members" ON public.members;
CREATE POLICY "Public can view active members"
    ON public.members
    FOR SELECT
    TO anon, authenticated
    USING (active = true);

DROP POLICY IF EXISTS "Admins can view all members" ON public.members;
CREATE POLICY "Admins can view all members"
    ON public.members
    FOR SELECT
    TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert members" ON public.members;
CREATE POLICY "Admins can insert members"
    ON public.members
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update members" ON public.members;
CREATE POLICY "Admins can update members"
    ON public.members
    FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete members" ON public.members;
CREATE POLICY "Admins can delete members"
    ON public.members
    FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- RLS: admin_users
-- Public:
--   - Zero access.
-- Authenticated non-admins:
--   - Zero access.
-- Admins:
--   - Can view and manage the admin_users list.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view admin_users" ON public.admin_users;
CREATE POLICY "Admins can view admin_users"
    ON public.admin_users
    FOR SELECT
    TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage admin_users" ON public.admin_users;
CREATE POLICY "Admins can manage admin_users"
    ON public.admin_users
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ==============================================================================
-- 5. STORAGE BUCKET: member-photos
-- ==============================================================================
-- Create the bucket if it doesn't already exist.
-- Public = true allows public CDN reads for active member/applicant photos.
-- Writes are controlled via RLS below.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'member-photos',
    'member-photos',
    true,
    5242880, -- 5 MB limit per photo
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Storage RLS Policies on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 1. Public Read: anyone can view profile images in member-photos
DROP POLICY IF EXISTS "Public can view member-photos" ON storage.objects;
CREATE POLICY "Public can view member-photos"
    ON storage.objects
    FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'member-photos');

-- 2. Applicant Upload: applicants can upload photo during submission
DROP POLICY IF EXISTS "Anyone can upload applicant photo" ON storage.objects;
CREATE POLICY "Anyone can upload applicant photo"
    ON storage.objects
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (bucket_id = 'member-photos');

-- 3. Admin Full Control: admins can update or delete storage objects
DROP POLICY IF EXISTS "Admins can update member-photos" ON storage.objects;
CREATE POLICY "Admins can update member-photos"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (bucket_id = 'member-photos' AND public.is_admin())
    WITH CHECK (bucket_id = 'member-photos' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can delete member-photos" ON storage.objects;
CREATE POLICY "Admins can delete member-photos"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'member-photos' AND public.is_admin());
