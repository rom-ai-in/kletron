// scripts/seed-organization.ts
// Seed a default organization (tenant → company → group → user_groups) for the current Supabase user.
// Fully idempotent — safe to re-run.
//
// Usage:
//   npx tsx scripts/seed-organization.ts
//   npx tsx scripts/seed-organization.ts --email romain.magnin@gmail.com
//   npx tsx scripts/seed-organization.ts --user-id <UUID>

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

// ── Config ────────────────────────────────────────────────────────────────────
const TENANT_NAME = "Kletron";
const TENANT_SLUG = "kletron";
const COMPANY_NAME = "Kletron SAS";
const COMPANY_SLUG = "kletron-sas";
const GROUP_NAME = "Engineering";
const GROUP_DESC = "Core engineering team";

// ── CLI args ──────────────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  let email: string | undefined;
  let userId: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--email" && args[i + 1]) {
      email = args[++i];
    } else if (args[i] === "--user-id" && args[i + 1]) {
      userId = args[++i];
    }
  }
  return { email, userId };
}

// ── Supabase admin client ─────────────────────────────────────────────────────
function getAdmin() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

// ── Resolve user ──────────────────────────────────────────────────────────────
async function resolveUser(
  admin: ReturnType<typeof getAdmin>,
  opts: { email?: string; userId?: string }
): Promise<{ id: string; email: string }> {
  // 1. Explicit user ID
  if (opts.userId) {
    const { data, error } = await admin.auth.admin.getUserById(opts.userId);
    if (error || !data.user) throw new Error(`User not found: ${opts.userId}`);
    return { id: data.user.id, email: data.user.email ?? "" };
  }

  // 2. Explicit email
  if (opts.email) {
    const perPage = 200;
    let page = 1;
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) throw new Error(error.message);
      const users = data?.users ?? [];
      const match = users.find(
        (u) => u.email?.toLowerCase() === opts.email!.toLowerCase()
      );
      if (match) return { id: match.id, email: match.email ?? "" };
      if (users.length < perPage) break;
      page++;
    }
    throw new Error(`User not found for email: ${opts.email}`);
  }

  // 3. Fallback: first user in the system
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) throw new Error(error.message);
  const user = data?.users?.[0];
  if (!user) throw new Error("No users found in Supabase auth.users");
  return { id: user.id, email: user.email ?? "" };
}

// ── Main ──────────────────────────────────────────────────────────────────────
export async function seedOrganization(opts?: {
  userId?: string;
  email?: string;
  tenantName?: string;
  tenantSlug?: string;
}) {
  const admin = getAdmin();
  const user = await resolveUser(admin, {
    userId: opts?.userId,
    email: opts?.email,
  });

  const tenantName = opts?.tenantName ?? TENANT_NAME;
  const tenantSlug = opts?.tenantSlug ?? TENANT_SLUG;

  console.log(`[Seed] Seeding organization for user: ${user.email} (${user.id})`);

  // 1. Ensure user_profiles row exists
  const { data: existingProfile } = await admin
    .from("user_profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  if (!existingProfile) {
    const { error: profileErr } = await admin.from("user_profiles").insert({
      id: user.id,
      email: user.email,
      full_name: user.email.split("@")[0],
    } as never);
    if (profileErr && !profileErr.message?.includes("duplicate")) {
      throw new Error(`Failed to create user_profile: ${profileErr.message}`);
    }
    console.log(`[Seed] ✅ Created user_profiles row`);
  } else {
    console.log(`[Seed] ✅ user_profiles row already exists`);
  }

  // 2. Upsert tenant
  let tenantId: string;
  const { data: existingTenant } = await admin
    .from("tenants")
    .select("id")
    .eq("slug", tenantSlug)
    .single();

  if (existingTenant) {
    tenantId = existingTenant.id;
    console.log(`[Seed] ✅ Tenant "${tenantName}" already exists (${tenantId})`);
  } else {
    const { data: newTenant, error: tenantErr } = await admin
      .from("tenants")
      .insert({ name: tenantName, slug: tenantSlug } as never)
      .select("id")
      .single();
    if (tenantErr || !newTenant) {
      throw new Error(`Failed to create tenant: ${tenantErr?.message}`);
    }
    tenantId = newTenant.id;
    console.log(`[Seed] ✅ Created tenant "${tenantName}" (${tenantId})`);
  }

  // 3. Upsert company
  let companyId: string;
  const { data: existingCompany } = await admin
    .from("companies")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("slug", COMPANY_SLUG)
    .single();

  if (existingCompany) {
    companyId = existingCompany.id;
    console.log(`[Seed] ✅ Company "${COMPANY_NAME}" already exists (${companyId})`);
  } else {
    const { data: newCompany, error: companyErr } = await admin
      .from("companies")
      .insert({ tenant_id: tenantId, name: COMPANY_NAME, slug: COMPANY_SLUG } as never)
      .select("id")
      .single();
    if (companyErr || !newCompany) {
      throw new Error(`Failed to create company: ${companyErr?.message}`);
    }
    companyId = newCompany.id;
    console.log(`[Seed] ✅ Created company "${COMPANY_NAME}" (${companyId})`);
  }

  // 4. Upsert group
  let groupId: string;
  const { data: existingGroup } = await admin
    .from("groups")
    .select("id")
    .eq("company_id", companyId)
    .eq("name", GROUP_NAME)
    .single();

  if (existingGroup) {
    groupId = existingGroup.id;
    console.log(`[Seed] ✅ Group "${GROUP_NAME}" already exists (${groupId})`);
  } else {
    const { data: newGroup, error: groupErr } = await admin
      .from("groups")
      .insert({ company_id: companyId, name: GROUP_NAME, description: GROUP_DESC } as never)
      .select("id")
      .single();
    if (groupErr || !newGroup) {
      throw new Error(`Failed to create group: ${groupErr?.message}`);
    }
    groupId = newGroup.id;
    console.log(`[Seed] ✅ Created group "${GROUP_NAME}" (${groupId})`);
  }

  // 5. Add user to group with admin role (skip if already member)
  const { data: existingMembership } = await admin
    .from("user_groups")
    .select("id")
    .eq("user_id", user.id)
    .eq("group_id", groupId)
    .single();

  if (existingMembership) {
    console.log(`[Seed] ✅ User already in group "${GROUP_NAME}"`);
  } else {
    const { error: memberErr } = await admin.from("user_groups").insert({
      user_id: user.id,
      group_id: groupId,
      role: "admin",
    } as never);
    if (memberErr && !memberErr.message?.includes("duplicate")) {
      throw new Error(`Failed to add user to group: ${memberErr.message}`);
    }
    console.log(`[Seed] ✅ Added user to group "${GROUP_NAME}" as admin`);
  }

  console.log(`\n[Seed] 🎉 Organization seeded successfully!`);
  console.log(`  Tenant:  ${tenantName} (${tenantId})`);
  console.log(`  Company: ${COMPANY_NAME} (${companyId})`);
  console.log(`  Group:   ${GROUP_NAME} (${groupId})`);
  console.log(`  User:    ${user.email} (${user.id}) — admin`);

  return { tenantId, companyId, groupId, userId: user.id };
}

// ── CLI entry point ──────────────────────────────────────────────────────────
const isMain = process.argv[1]?.endsWith("seed-organization.ts") ||
  import.meta.url.endsWith("seed-organization.ts");
if (isMain) {
  const { email, userId } = parseArgs();
  seedOrganization({ email, userId })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[Seed] ❌ Failed:", err);
      process.exit(1);
    });
}
