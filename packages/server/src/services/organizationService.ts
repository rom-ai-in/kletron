/**
 * Tenant / organization persistence. Invariant: every authenticated user has exactly one tenant membership.
 */
import { ObjectId, type Collection } from "mongodb";
import { getDb } from "../lib/db";
import * as userProfileService from "./userProfileService";

const TENANTS = "tenants";
const COMPANIES = "tenant_companies";
const GROUPS = "tenant_groups";
const MEMBERS = "tenant_members";
const GROUP_MEMBERS = "tenant_group_members";

export type OrgRole = "admin" | "member";

interface TenantDoc {
  _id?: ObjectId;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

interface CompanyDoc {
  _id?: ObjectId;
  tenantId: ObjectId;
  name: string;
  slug: string;
  createdAt: Date;
}

interface GroupDoc {
  _id?: ObjectId;
  tenantId: ObjectId;
  companyId: ObjectId;
  name: string;
  description: string | null;
  createdAt: Date;
}

interface TenantMemberDoc {
  _id?: ObjectId;
  tenantId: ObjectId;
  userId: string;
  role: OrgRole;
  email: string;
  fullName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface GroupMemberDoc {
  _id?: ObjectId;
  groupId: ObjectId;
  userId: string;
  role: OrgRole;
  createdAt: Date;
}

/** API payload shared by /api/organization and members UI */
export interface OrganizationPayload {
  tenant: {
    id: string;
    name: string;
    slug: string;
    created_at: string;
    updated_at: string;
  };
  companies: Array<{ id: string; name: string; slug: string }>;
  groups: Array<{
    id: string;
    name: string;
    description: string | null;
    company_id: string;
  }>;
  members: Array<{
    user_id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    groups: Array<{ group_id: string; group_name: string; group_role: string }>;
  }>;
  currentUserRole: string;
  stats: { memberCount: number; groupCount: number; companyCount: number };
}

let indexesEnsured = false;

function slugify(input: string): string {
  const s = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.length > 0 ? s.slice(0, 64) : "org";
}

async function uniqueTenantSlug(base: string): Promise<string> {
  const db = await getDb();
  const tenants = db.collection<TenantDoc>(TENANTS);
  let slug = slugify(base);
  let n = 0;
  while (await tenants.findOne({ slug })) {
    n += 1;
    slug = `${slugify(base)}-${n}`;
  }
  return slug;
}

export async function ensureIndexes(): Promise<void> {
  if (indexesEnsured) return;
  const db = await getDb();
  await db.collection(MEMBERS).createIndex({ userId: 1 }, { unique: true });
  await db.collection(MEMBERS).createIndex({ tenantId: 1 });
  await db.collection(COMPANIES).createIndex({ tenantId: 1 });
  await db.collection(GROUPS).createIndex({ tenantId: 1 });
  await db.collection(GROUPS).createIndex({ companyId: 1 });
  await db.collection(GROUP_MEMBERS).createIndex({ groupId: 1, userId: 1 }, { unique: true });
  await db.collection(GROUP_MEMBERS).createIndex({ userId: 1 });
  await db.collection(TENANTS).createIndex({ slug: 1 }, { unique: true });
  indexesEnsured = true;
}

async function getMembersColl(): Promise<Collection<TenantMemberDoc>> {
  await ensureIndexes();
  const db = await getDb();
  return db.collection<TenantMemberDoc>(MEMBERS);
}

export async function getMembershipByUserId(userId: string): Promise<TenantMemberDoc | null> {
  const coll = await getMembersColl();
  return coll.findOne({ userId });
}

/**
 * Ensures the user has a tenant with default company/group and admin membership.
 */
export async function ensureOrganizationForUser(
  userId: string,
  profile: { email: string; fullName?: string | null }
): Promise<void> {
  await ensureIndexes();
  const existing = await getMembershipByUserId(userId);
  if (existing) return;

  const db = await getDb();
  const now = new Date();
  const email = profile.email.toLowerCase().trim();
  const displayName = (profile.fullName?.trim() || email.split("@")[0] || "My").slice(0, 120);
  const tenantName = `${displayName}'s Organization`;

  const slugBase = `${displayName}-org`;
  const slug = await uniqueTenantSlug(slugBase);

  const tenants = db.collection<TenantDoc>(TENANTS);
  const tenantInsert = await tenants.insertOne({
    name: tenantName,
    slug,
    createdAt: now,
    updatedAt: now,
  });
  const tenantId = tenantInsert.insertedId;

  const companies = db.collection<CompanyDoc>(COMPANIES);
  const companyInsert = await companies.insertOne({
    tenantId,
    name: "Default",
    slug: "default",
    createdAt: now,
  });
  const companyId = companyInsert.insertedId;

  const groups = db.collection<GroupDoc>(GROUPS);
  const groupInsert = await groups.insertOne({
    tenantId,
    companyId,
    name: "General",
    description: "Default group",
    createdAt: now,
  });
  const groupId = groupInsert.insertedId;

  const members = db.collection<TenantMemberDoc>(MEMBERS);
  await members.insertOne({
    tenantId,
    userId,
    role: "admin",
    email,
    fullName: profile.fullName ?? null,
    createdAt: now,
    updatedAt: now,
  });

  const gm = db.collection<GroupMemberDoc>(GROUP_MEMBERS);
  await gm.insertOne({
    groupId,
    userId,
    role: "admin",
    createdAt: now,
  });
}

/** Profile + users collection; no placeholder email (for display and sync). */
async function lookupUserContact(
  userId: string
): Promise<{ email: string | null; fullName: string | null }> {
  const profile = await userProfileService.getProfileByUserId(userId);
  let email = profile?.email?.trim() || null;
  let fullName = profile?.fullName ?? null;
  if (!email) {
    try {
      const db = await getDb();
      const u = await db.collection("users").findOne<{ email?: string; name?: string | null }>({
        _id: new ObjectId(userId),
      });
      if (u?.email) email = u.email.toLowerCase().trim();
      if (u?.name) fullName = u.name;
    } catch {
      /* invalid ObjectId — e.g. dev-user, test-user-1 */
    }
  }
  return { email, fullName };
}

async function resolveUserEmailAndName(
  userId: string
): Promise<{ email: string; fullName: string | null }> {
  const { email, fullName } = await lookupUserContact(userId);
  return { email: email || "user@local", fullName };
}

export async function getOrganizationPayloadForUser(userId: string): Promise<OrganizationPayload | null> {
  const { email, fullName } = await resolveUserEmailAndName(userId);
  await ensureOrganizationForUser(userId, {
    email,
    fullName,
  });

  const membership = await getMembershipByUserId(userId);
  if (!membership) return null;

  const db = await getDb();
  const tenant = await db.collection<TenantDoc>(TENANTS).findOne({ _id: membership.tenantId });
  if (!tenant) return null;

  const companies = await db
    .collection<CompanyDoc>(COMPANIES)
    .find({ tenantId: membership.tenantId })
    .toArray();
  const groups = await db
    .collection<GroupDoc>(GROUPS)
    .find({ tenantId: membership.tenantId })
    .toArray();
  const memberDocs = await db
    .collection<TenantMemberDoc>(MEMBERS)
    .find({ tenantId: membership.tenantId })
    .toArray();

  const groupById = new Map(groups.map((g) => [g._id.toString(), g]));
  const gmColl = db.collection<GroupMemberDoc>(GROUP_MEMBERS);
  const membersColl = db.collection<TenantMemberDoc>(MEMBERS);
  const memberPayload: OrganizationPayload["members"] = [];

  for (const m of memberDocs) {
    const contact = await lookupUserContact(m.userId);
    const displayEmail =
      contact.email ??
      (m.email && m.email !== "user@local" ? m.email : null) ??
      m.email;
    const displayName = contact.fullName ?? m.fullName;

    if (
      contact.email &&
      (contact.email !== m.email ||
        (contact.fullName ?? null) !== (m.fullName ?? null))
    ) {
      await membersColl.updateOne(
        { userId: m.userId },
        {
          $set: {
            email: contact.email,
            fullName: contact.fullName ?? m.fullName,
            updatedAt: new Date(),
          },
        }
      );
    }

    const gms = await gmColl.find({ userId: m.userId }).toArray();
    const groupInfos = gms
      .map((row) => {
        const g = groupById.get(row.groupId.toString());
        if (!g) return null;
        return {
          group_id: g._id.toString(),
          group_name: g.name,
          group_role: row.role,
        };
      })
      .filter(Boolean) as OrganizationPayload["members"][0]["groups"];

    memberPayload.push({
      user_id: m.userId,
      email: displayEmail,
      full_name: displayName,
      avatar_url: null,
      groups: groupInfos,
    });
  }

  return {
    tenant: {
      id: tenant._id.toString(),
      name: tenant.name,
      slug: tenant.slug,
      created_at: tenant.createdAt.toISOString(),
      updated_at: tenant.updatedAt.toISOString(),
    },
    companies: companies.map((c) => ({
      id: c._id.toString(),
      name: c.name,
      slug: c.slug,
    })),
    groups: groups.map((g) => ({
      id: g._id.toString(),
      name: g.name,
      description: g.description,
      company_id: g.companyId.toString(),
    })),
    members: memberPayload,
    currentUserRole: membership.role,
    stats: {
      memberCount: memberDocs.length,
      groupCount: groups.length,
      companyCount: companies.length,
    },
  };
}

export async function updateTenantName(
  userId: string,
  tenantId: string,
  name: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await ensureIndexes();
  const membership = await getMembershipByUserId(userId);
  if (!membership || membership.tenantId.toString() !== tenantId) {
    return { ok: false, error: "Not allowed" };
  }
  if (membership.role !== "admin") {
    return { ok: false, error: "Only admins can rename the organization" };
  }
  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, error: "A non-empty name is required" };
  }

  const db = await getDb();
  const r = await db.collection<TenantDoc>(TENANTS).updateOne(
    { _id: membership.tenantId },
    { $set: { name: trimmed.slice(0, 255), updatedAt: new Date() } }
  );
  if (r.matchedCount === 0) {
    return { ok: false, error: "Organization not found" };
  }
  return { ok: true };
}

async function assertTenantAdmin(userId: string, tenantId: ObjectId): Promise<TenantMemberDoc | null> {
  const m = await getMembershipByUserId(userId);
  if (!m || m.tenantId.toString() !== tenantId.toString() || m.role !== "admin") {
    return null;
  }
  return m;
}

export async function addMemberToTenantGroup(
  actorUserId: string,
  tenantId: string,
  inviteEmail: string,
  groupId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await ensureIndexes();
  const db = await getDb();
  const tid = new ObjectId(tenantId);
  const admin = await assertTenantAdmin(actorUserId, tid);
  if (!admin) {
    return { ok: false, error: "Only admins can add members" };
  }

  const email = inviteEmail.toLowerCase().trim();
  if (!email.includes("@")) {
    return { ok: false, error: "Invalid email" };
  }

  const users = db.collection("users");
  const targetUser = await users.findOne<{ _id: ObjectId }>({ email });
  if (!targetUser) {
    return { ok: false, error: "No user registered with that email" };
  }
  const targetUserId = targetUser._id.toString();

  const gid = new ObjectId(groupId);
  const group = await db.collection<GroupDoc>(GROUPS).findOne({ _id: gid, tenantId: tid });
  if (!group) {
    return { ok: false, error: "Group not found" };
  }

  const existing = await getMembershipByUserId(targetUserId);
  const profile = await userProfileService.getProfileByUserId(targetUserId);
  const profEmail = profile?.email ?? email;
  const profName = profile?.fullName ?? null;
  const now = new Date();

  if (existing) {
    if (existing.tenantId.toString() === tenantId) {
      const gm = db.collection<GroupMemberDoc>(GROUP_MEMBERS);
      const already = await gm.findOne({ groupId: gid, userId: targetUserId });
      if (already) {
        return { ok: false, error: "User is already a member of this organization" };
      }
      await gm.insertOne({
        groupId: gid,
        userId: targetUserId,
        role: "member",
        createdAt: now,
      });
      return { ok: true };
    }

    await transferUserToTenant(targetUserId, tid, gid, {
      email: profEmail,
      fullName: profName,
      role: "member",
    });
    return { ok: true };
  }

  const members = db.collection<TenantMemberDoc>(MEMBERS);
  await members.insertOne({
    tenantId: tid,
    userId: targetUserId,
    role: "member",
    email: profEmail,
    fullName: profName,
    createdAt: now,
    updatedAt: now,
  });
  await db.collection<GroupMemberDoc>(GROUP_MEMBERS).insertOne({
    groupId: gid,
    userId: targetUserId,
    role: "member",
    createdAt: now,
  });
  return { ok: true };
}

async function transferUserToTenant(
  targetUserId: string,
  newTenantId: ObjectId,
  defaultGroupId: ObjectId,
  meta: { email: string; fullName: string | null; role: OrgRole }
): Promise<void> {
  const db = await getDb();
  const old = await getMembershipByUserId(targetUserId);
  if (!old) {
    throw new Error("Invariant broken: user has no organization");
  }

  const oldTenantId = old.tenantId;
  const oldGroups = await db
    .collection<GroupDoc>(GROUPS)
    .find({ tenantId: oldTenantId })
    .toArray();
  const oldGroupIds = oldGroups.map((g) => g._id);

  if (oldGroupIds.length > 0) {
    await db.collection(GROUP_MEMBERS).deleteMany({
      userId: targetUserId,
      groupId: { $in: oldGroupIds },
    });
  }

  await db.collection<TenantMemberDoc>(MEMBERS).updateOne(
    { userId: targetUserId },
    {
      $set: {
        tenantId: newTenantId,
        role: meta.role,
        email: meta.email,
        fullName: meta.fullName,
        updatedAt: new Date(),
      },
    }
  );

  await db.collection<GroupMemberDoc>(GROUP_MEMBERS).insertOne({
    groupId: defaultGroupId,
    userId: targetUserId,
    role: meta.role === "admin" ? "admin" : "member",
    createdAt: new Date(),
  });
}

export async function removeMemberFromTenant(
  actorUserId: string,
  tenantId: string,
  targetUserId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await ensureIndexes();
  const db = await getDb();
  const tid = new ObjectId(tenantId);
  const admin = await assertTenantAdmin(actorUserId, tid);
  if (!admin) {
    return { ok: false, error: "Only admins can remove members" };
  }

  const target = await getMembershipByUserId(targetUserId);
  if (!target || target.tenantId.toString() !== tenantId) {
    return { ok: false, error: "Member not found" };
  }

  const groups = await db
    .collection<GroupDoc>(GROUPS)
    .find({ tenantId: tid })
    .toArray();
  const gids = groups.map((g) => g._id);
  if (gids.length > 0) {
    await db.collection(GROUP_MEMBERS).deleteMany({
      userId: targetUserId,
      groupId: { $in: gids },
    });
  }

  await db.collection<TenantMemberDoc>(MEMBERS).deleteOne({ userId: targetUserId });

  const profile = await userProfileService.getProfileByUserId(targetUserId);
  await ensureOrganizationForUser(targetUserId, {
    email: profile?.email ?? target.email,
    fullName: profile?.fullName ?? target.fullName,
  });

  return { ok: true };
}
