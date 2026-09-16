-- ==============================================================================
-- DEV MAVERICKS Community Portal — Phase 3: Admin Dashboard & Workflow Migration
-- ==============================================================================
-- Architecture: Serverless PostgreSQL + Supabase Auth + Supabase Storage + RLS
-- Security: SECURITY DEFINER with fixed search_path = public, strictly checks is_admin()
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ATOMIC APPROVAL FUNCTION
-- Approves an application and creates a corresponding member record atomically.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_application(
    app_id UUID,
    member_role TEXT DEFAULT 'Member'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_app public.applications%ROWTYPE;
    v_member_id UUID;
    v_admin_id UUID;
    v_clean_role TEXT;
BEGIN
    v_admin_id := auth.uid();

    -- 1. Strict admin verification
    IF v_admin_id IS NULL OR NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied: Only authorized administrators can approve membership applications.'
            USING ERRCODE = '42501';
    END IF;

    -- 2. Fetch application with pessimistic row lock
    SELECT * INTO v_app
    FROM public.applications
    WHERE id = app_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Application not found (ID: %).', app_id;
    END IF;

    -- 3. Prevent re-approving an already approved application
    IF v_app.status = 'approved' THEN
        RAISE EXCEPTION 'This application has already been approved.';
    END IF;

    -- 4. Prevent duplicate member creation for the same application
    IF EXISTS (SELECT 1 FROM public.members WHERE application_id = app_id) THEN
        RAISE EXCEPTION 'A member profile is already associated with this application.';
    END IF;

    -- Sanitize role input
    v_clean_role := COALESCE(NULLIF(TRIM(member_role), ''), 'Member');

    -- 5. Atomically update application status and audit fields
    UPDATE public.applications
    SET 
        status = 'approved',
        reviewed_at = timezone('utc'::text, now()),
        reviewed_by = v_admin_id
    WHERE id = app_id;

    -- 6. Atomically insert into members table
    INSERT INTO public.members (
        application_id,
        full_name,
        email,
        phone,
        college,
        branch,
        year,
        track,
        role,
        github_url,
        linkedin_url,
        portfolio_url,
        photo_path,
        joined_at,
        active
    ) VALUES (
        v_app.id,
        v_app.full_name,
        v_app.email,
        v_app.phone,
        v_app.college,
        v_app.branch,
        v_app.year,
        v_app.track,
        v_clean_role,
        v_app.github_url,
        v_app.linkedin_url,
        v_app.portfolio_url,
        v_app.photo_path,
        timezone('utc'::text, now()),
        true
    )
    RETURNING id INTO v_member_id;

    -- 7. Return detailed confirmation payload
    RETURN jsonb_build_object(
        'success', true,
        'application_id', app_id,
        'member_id', v_member_id,
        'full_name', v_app.full_name,
        'email', v_app.email,
        'phone', v_app.phone,
        'track', v_app.track,
        'college', v_app.college,
        'role', v_clean_role,
        'message', 'Application approved and member record created successfully.'
    );
END;
$$;

-- Grant execution to authenticated users (admin check is inside the function)
GRANT EXECUTE ON FUNCTION public.approve_application(UUID, TEXT) TO authenticated;


-- ------------------------------------------------------------------------------
-- 2. REJECTION FUNCTION
-- Rejects a pending application with audit timestamp and reviewer ID.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_application(app_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_app public.applications%ROWTYPE;
    v_admin_id UUID;
BEGIN
    v_admin_id := auth.uid();

    -- 1. Strict admin verification
    IF v_admin_id IS NULL OR NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied: Only authorized administrators can reject membership applications.'
            USING ERRCODE = '42501';
    END IF;

    -- 2. Fetch application with lock
    SELECT * INTO v_app
    FROM public.applications
    WHERE id = app_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Application not found (ID: %).', app_id;
    END IF;

    -- 3. Prevent re-rejecting an already rejected application
    IF v_app.status = 'rejected' THEN
        RAISE EXCEPTION 'This application has already been rejected.';
    END IF;

    -- 4. Update status without deleting the record
    UPDATE public.applications
    SET 
        status = 'rejected',
        reviewed_at = timezone('utc'::text, now()),
        reviewed_by = v_admin_id
    WHERE id = app_id;

    RETURN jsonb_build_object(
        'success', true,
        'application_id', app_id,
        'full_name', v_app.full_name,
        'email', v_app.email,
        'track', v_app.track,
        'message', 'Application rejected successfully.'
    );
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.reject_application(UUID) TO authenticated;


-- ==============================================================================
-- 3. FIRST ADMIN ACCOUNT ONBOARDING INSTRUCTIONS
-- ==============================================================================
-- To create your first administrator:
-- Step A: In Supabase Dashboard -> Authentication -> Users, click "Add User" (or sign up with Email & Password).
-- Step B: Copy the User's UID from the dashboard.
-- Step C: Run the following SQL query in the Supabase SQL Editor:
--
-- INSERT INTO public.admin_users (id, email, role)
-- VALUES (
--     'PASTE_SUPABASE_AUTH_USER_UUID_HERE',
--     'admin@devmavericks.tech',
--     'admin'
-- )
-- ON CONFLICT (id) DO NOTHING;
-- ==============================================================================
