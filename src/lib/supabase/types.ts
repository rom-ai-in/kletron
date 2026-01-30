// src/lib/supabase/types.ts
// TypeScript types for Supabase database tables

export interface Tenant {
    id: string;
    name: string;
    slug: string;
    created_at: string;
    updated_at: string;
}

export interface Company {
    id: string;
    tenant_id: string;
    name: string;
    slug: string;
    created_at: string;
    updated_at: string;
}

export interface Group {
    id: string;
    company_id: string;
    name: string;
    description: string | null;
    created_at: string;
    updated_at: string;
}

export interface UserProfile {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    created_at: string;
    updated_at: string;
}

export interface UserGroup {
    id: string;
    user_id: string;
    group_id: string;
    role: 'admin' | 'member';
    created_at: string;
}

// View type for user context with all relationships
export interface UserContext {
    user_id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    group_id: string | null;
    group_name: string | null;
    group_role: string | null;
    company_id: string | null;
    company_name: string | null;
    tenant_id: string | null;
    tenant_name: string | null;
}

// Database schema type for Supabase client
export interface Database {
    public: {
        Tables: {
            tenants: {
                Row: Tenant;
                Insert: Omit<Tenant, 'id' | 'created_at' | 'updated_at'> & {
                    id?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: Partial<Omit<Tenant, 'id' | 'created_at'>>;
            };
            companies: {
                Row: Company;
                Insert: Omit<Company, 'id' | 'created_at' | 'updated_at'> & {
                    id?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: Partial<Omit<Company, 'id' | 'created_at'>>;
            };
            groups: {
                Row: Group;
                Insert: Omit<Group, 'id' | 'created_at' | 'updated_at'> & {
                    id?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: Partial<Omit<Group, 'id' | 'created_at'>>;
            };
            user_profiles: {
                Row: UserProfile;
                Insert: Omit<UserProfile, 'created_at' | 'updated_at'> & {
                    created_at?: string;
                    updated_at?: string;
                };
                Update: Partial<Omit<UserProfile, 'id' | 'created_at'>>;
            };
            user_groups: {
                Row: UserGroup;
                Insert: Omit<UserGroup, 'id' | 'created_at'> & {
                    id?: string;
                    created_at?: string;
                };
                Update: Partial<Omit<UserGroup, 'id' | 'created_at'>>;
            };
        };
        Views: {
            user_context: {
                Row: UserContext;
            };
        };
    };
}

// Auth-related types
export interface AuthUser {
    id: string;
    email: string;
    email_confirmed_at?: string;
    created_at: string;
    updated_at: string;
}

export interface SignUpData {
    email: string;
    password: string;
    fullName?: string;
}

export interface SignInData {
    email: string;
    password: string;
}

export interface AuthResponse {
    success: boolean;
    message: string;
    user?: AuthUser;
    error?: string;
}
