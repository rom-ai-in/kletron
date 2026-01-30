-- =====================================================
-- Supabase Schema for PayMe Multi-Tenant Auth System
-- =====================================================
-- Data Model: Tenant → Company → Group → User
-- Run this in Supabase SQL Editor
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. TENANTS TABLE
-- Top-level organization entity
-- =====================================================
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. COMPANIES TABLE
-- Each tenant has one company (for now)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, slug)
);

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_companies_tenant_id ON public.companies(tenant_id);

-- =====================================================
-- 3. GROUPS TABLE
-- Companies can have multiple groups
-- =====================================================
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_groups_company_id ON public.groups(company_id);

-- =====================================================
-- 4. USER PROFILES TABLE
-- Extends Supabase auth.users
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 5. USER_GROUPS JUNCTION TABLE
-- Many-to-many relationship between users and groups
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member', -- 'admin', 'member', etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, group_id)
);

-- Enable RLS
ALTER TABLE public.user_groups ENABLE ROW LEVEL SECURITY;

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_groups_user_id ON public.user_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_user_groups_group_id ON public.user_groups(group_id);

-- =====================================================
-- 6. ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Tenants: Users can read tenants they belong to
CREATE POLICY "Users can view their tenant" ON public.tenants
    FOR SELECT
    USING (
        id IN (
            SELECT c.tenant_id FROM public.companies c
            JOIN public.groups g ON g.company_id = c.id
            JOIN public.user_groups ug ON ug.group_id = g.id
            WHERE ug.user_id = auth.uid()
        )
    );

-- Companies: Users can read companies they belong to
CREATE POLICY "Users can view their company" ON public.companies
    FOR SELECT
    USING (
        id IN (
            SELECT g.company_id FROM public.groups g
            JOIN public.user_groups ug ON ug.group_id = g.id
            WHERE ug.user_id = auth.uid()
        )
    );

-- Groups: Users can read groups they belong to
CREATE POLICY "Users can view their groups" ON public.groups
    FOR SELECT
    USING (
        id IN (
            SELECT group_id FROM public.user_groups
            WHERE user_id = auth.uid()
        )
    );

-- User Profiles: Users can read and update their own profile
CREATE POLICY "Users can view own profile" ON public.user_profiles
    FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE
    USING (auth.uid() = id);

-- User Profiles: Users can view profiles in their groups
CREATE POLICY "Users can view profiles in their groups" ON public.user_profiles
    FOR SELECT
    USING (
        id IN (
            SELECT ug2.user_id FROM public.user_groups ug1
            JOIN public.user_groups ug2 ON ug1.group_id = ug2.group_id
            WHERE ug1.user_id = auth.uid()
        )
    );

-- User Groups: Users can view their own group memberships
CREATE POLICY "Users can view own group memberships" ON public.user_groups
    FOR SELECT
    USING (user_id = auth.uid());

-- =====================================================
-- 7. FUNCTION: Auto-create user profile on signup
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auto-profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 8. FUNCTION: Update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON public.tenants
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_companies_updated_at
    BEFORE UPDATE ON public.companies
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_groups_updated_at
    BEFORE UPDATE ON public.groups
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 9. HELPER VIEW: Get user's full context
-- =====================================================
CREATE OR REPLACE VIEW public.user_context AS
SELECT 
    up.id AS user_id,
    up.email,
    up.full_name,
    up.avatar_url,
    g.id AS group_id,
    g.name AS group_name,
    ug.role AS group_role,
    c.id AS company_id,
    c.name AS company_name,
    t.id AS tenant_id,
    t.name AS tenant_name
FROM public.user_profiles up
LEFT JOIN public.user_groups ug ON ug.user_id = up.id
LEFT JOIN public.groups g ON g.id = ug.group_id
LEFT JOIN public.companies c ON c.id = g.company_id
LEFT JOIN public.tenants t ON t.id = c.tenant_id;
