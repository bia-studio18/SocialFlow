import { createHmac, timingSafeEqual } from "node:crypto";
import { getSql, type Sql } from "@/lib/db";
import {
  PLANS,
  PLATFORM_LABEL,
  type Currency,
  type Interval,
  type PlanId,
  type Platform,
  type Role,
  backoffMs,
  isPlan,
  isPlatform,
  isRole,
  normalizeHashtags,
  priceFor,
  roleAtLeast,
  safeTimezone,
  validateContent,
  withinLimit,
} from "@/lib/socialflow/domain";

type Member = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: Role;
  email: string;
  status: string;
  workspace_name: string;
  timezone: string;
};

function iso(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString();
}

function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

async function audit(
  sql: Sql,
  row: {
    workspaceId: string | null;
    actor: string;
    action: string;
    entity: string;
    entityId?: string;
    detail?: string;
  },
) {
  await sql`
    insert into audit_logs (id, workspace_id, actor_user_id, action, entity, entity_id, detail)
    values (
      ${crypto.randomUUID()},
      ${row.workspaceId},
      ${row.actor},
      ${row.action},
      ${row.entity},
      ${row.entityId ?? ""},
      ${(row.detail ?? "").slice(0, 400)}
    )
  `;
}

async function notify(
  sql: Sql,
  row: {
    userId: string;
    workspaceId: string | null;
    kind: string;
    title: string;
    body: string;
    refId?: string;
  },
) {
  await sql`
    insert into notifications (id, user_id, workspace_id, kind, title, body, ref_id)
    values (
      ${crypto.randomUUID()},
      ${row.userId},
      ${row.workspaceId},
      ${row.kind},
      ${row.title},
      ${row.body},
      ${row.refId ?? ""}
    )
    on conflict (user_id, kind, ref_id) where ref_id <> '' do nothing
  `;
}

async function sessionUser(sql: Sql, userId: string) {
  const rows = await sql<{ email: string; name: string }>`
    select email, name from "user" where id = ${userId}
  `;
  return { email: rows[0]?.email ?? "", name: rows[0]?.name ?? "Member" };
}

async function ensureActor(sql: Sql, userId: string) {
  const person = await sessionUser(sql, userId);
  await sql`
    insert into profiles (user_id, display_name)
    values (${userId}, ${person.name})
    on conflict (user_id) do nothing
  `;
  await sql`
    insert into subscriptions (user_id, plan)
    values (${userId}, ${"free"})
    on conflict (user_id) do nothing
  `;
  if (person.email) {
    await sql`
      update workspace_memberships
      set user_id = ${userId}, status = 'active'
      where status = 'invited'
        and lower(email) = lower(${person.email})
        and not exists (
          select 1 from workspace_memberships m2
          where m2.workspace_id = workspace_memberships.workspace_id
            and m2.user_id = ${userId}
        )
    `;
  }
  let members = await listMemberships(sql, userId);
  if (members.length === 0) {
    const wsId = crypto.randomUUID();
    await sql`
      insert into workspaces (id, name, timezone)
      values (${wsId}, ${"My brand"}, ${"Asia/Karachi"})
    `;
    await sql`
      insert into workspace_memberships (id, workspace_id, user_id, role, email, status)
      values (${crypto.randomUUID()}, ${wsId}, ${userId}, ${"owner"}, ${person.email}, ${"active"})
    `;
    await sql`
      update profiles set active_workspace_id = ${wsId}, updated_at = now()
      where user_id = ${userId}
    `;
    await audit(sql, {
      workspaceId: wsId,
      actor: userId,
      action: "workspace.create",
      entity: "workspace",
      entityId: wsId,
      detail: "My brand",
    });
    members = await listMemberships(sql, userId);
  }
  const profile = (
    await sql<{
      display_name: string;
      timezone: string;
      active_workspace_id: string | null;
    }>`
      select display_name, timezone, active_workspace_id from profiles where user_id = ${userId}
    `
  )[0];
  let active = profile?.active_workspace_id ?? "";
  if (!members.some((m) => m.workspace_id === active)) {
    active = members[0]!.workspace_id;
    await sql`
      update profiles set active_workspace_id = ${active}, updated_at = now()
      where user_id = ${userId}
    `;
  }
  return { person, members, active, profile };
}

async function listMemberships(sql: Sql, userId: string): Promise<Member[]> {
  const rows = await sql<{
    id: string;
    workspace_id: string;
    user_id: string;
    role: string;
    email: string;
    status: string;
    workspace_name: string;
    timezone: string;
  }>`
    select m.id, m.workspace_id, m.user_id, m.role, m.email, m.status,
           w.name as workspace_name, w.timezone
    from workspace_memberships m
    join workspaces w on w.id = m.workspace_id
    where m.user_id = ${userId} and m.status = 'active'
    order by w.created_at asc
  `;
  return rows
    .filter((row) => isRole(row.role))
    .map((row) => ({ ...row, role: row.role as Role }));
}

function memberOf(members: Member[], workspaceId: string, min: Role): Member {
  const member = members.find((row) => row.workspace_id === workspaceId);
  if (!member || !roleAtLeast(member.role, min)) {
    throw new Error("You do not have access to that workspace.");
  }
  return member;
}

async function ownerOf(sql: Sql, workspaceId: string): Promise<string> {
  const rows = await sql<{ user_id: string }>`
    select user_id from workspace_memberships
    where workspace_id = ${workspaceId} and role = 'owner' and status = 'active'
    limit 1
  `;
  if (!rows[0]) throw new Error("This workspace has no owner.");
  return rows[0].user_id;
}

async function planForUser(sql: Sql, userId: string): Promise<PlanId> {
  const rows = await sql<{ plan: string }>`
    select plan from subscriptions where user_id = ${userId}
  `;
  const plan = rows[0]?.plan ?? "free";
  return isPlan(plan) ? plan : "free";
}

async function usageFor(sql: Sql, workspaceId: string, ownerId: string) {
  const posts = await sql<{ n: number }>`
    select count(*) as n from posts
    where workspace_id = ${workspaceId}
      and created_at >= date_trunc('month', now())
  `;
  const profiles = await sql<{ n: number }>`
    select count(*) as n from social_accounts where workspace_id = ${workspaceId}
  `;
  const media = await sql<{ n: number }>`
    select count(*) as n from media_assets where workspace_id = ${workspaceId}
  `;
  const ai = await sql<{ n: number }>`
    select count(*) as n from ai_usage
    where workspace_id = ${workspaceId}
      and created_at >= date_trunc('month', now())
  `;
  const owned = await sql<{ n: number }>`
    select count(*) as n from workspace_memberships
    where user_id = ${ownerId} and role = 'owner' and status = 'active'
  `;
  return {
    postsThisMonth: num(posts[0]?.n),
    profiles: num(profiles[0]?.n),
    media: num(media[0]?.n),
    aiThisMonth: num(ai[0]?.n),
    ownedWorkspaces: num(owned[0]?.n),
  };
}

function platformReady() {
  return {
    instagram: false,
    facebook: Boolean(process.env.SOCIALFLOW_FB_PAGE_ID && process.env.SOCIALFLOW_FB_PAGE_TOKEN),
    linkedin: Boolean(process.env.SOCIALFLOW_LI_AUTHOR_URN && process.env.SOCIALFLOW_LI_ACCESS_TOKEN),
    tiktok: false,
  } as Record<Platform, boolean>;
}

function parsePlatforms(raw: string): Platform[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is Platform => typeof item === "string" && isPlatform(item));
  } catch {
    return [];
  }
}

async function syncHashtags(sql: Sql, postId: string, tags: string[]) {
  await sql`delete from post_hashtags where post_id = ${postId}`;
  for (const tag of tags) {
    const existing = await sql<{ id: string }>`select id from hashtags where tag = ${tag}`;
    const hid = existing[0]?.id ?? crypto.randomUUID();
    if (!existing[0]) {
      await sql`insert into hashtags (id, tag) values (${hid}, ${tag})`;
    }
    await sql`
      insert into post_hashtags (post_id, hashtag_id) values (${postId}, ${hid})
      on conflict do nothing
    `;
  }
}

type PublishResult = {
  status: "published" | "failed" | "blocked";
  errorCode: string;
  message: string;
  externalId: string;
};

async function callOfficial(platform: Platform, caption: string): Promise<PublishResult> {
  const ready = platformReady();
  if (!ready[platform]) {
    return {
      status: "blocked",
      errorCode: "CREDENTIALS_NOT_CONFIGURED",
      message: `${PLATFORM_LABEL[platform]} was not published. Official credentials are not configured, so SocialFlow will not report a success.`,
      externalId: "",
    };
  }
  try {
    if (platform === "facebook") {
      const pageId = process.env.SOCIALFLOW_FB_PAGE_ID ?? "";
      const token = process.env.SOCIALFLOW_FB_PAGE_TOKEN ?? "";
      const body = new URLSearchParams({ message: caption, access_token: token });
      const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/feed`, {
        method: "POST",
        body,
        signal: AbortSignal.timeout(15_000),
      });
      const json = (await res.json()) as { id?: string; error?: { message?: string } };
      if (!res.ok || !json.id) {
        return {
          status: "failed",
          errorCode: "PLATFORM_REJECTED",
          message: json.error?.message ?? `Facebook returned ${res.status}. The post was not published.`,
          externalId: "",
        };
      }
      return {
        status: "published",
        errorCode: "",
        message: "Facebook accepted the post.",
        externalId: json.id,
      };
    }
    if (platform === "linkedin") {
      const urn = process.env.SOCIALFLOW_LI_AUTHOR_URN ?? "";
      const token = process.env.SOCIALFLOW_LI_ACCESS_TOKEN ?? "";
      const res = await fetch("https://api.linkedin.com/rest/posts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "LinkedIn-Version": "202401",
          "X-Restli-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify({
          author: urn,
          commentary: caption,
          visibility: "PUBLIC",
          distribution: {
            feedDistribution: "MAIN_FEED",
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          lifecycleState: "PUBLISHED",
          isReshareDisabledByAuthor: false,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (res.status !== 201) {
        const text = await res.text();
        return {
          status: "failed",
          errorCode: "PLATFORM_REJECTED",
          message: `LinkedIn returned ${res.status}. ${text.slice(0, 240)}`.trim(),
          externalId: "",
        };
      }
      return {
        status: "published",
        errorCode: "",
        message: "LinkedIn accepted the post.",
        externalId: res.headers.get("x-restli-id") ?? "",
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "The platform request failed.";
    return { status: "failed", errorCode: "NETWORK", message, externalId: "" };
  }
  return {
    status: "blocked",
    errorCode: "ADAPTER_PENDING",
    message: `${PLATFORM_LABEL[platform]} publishing is not approved yet. Nothing was sent.`,
    externalId: "",
  };
}

async function recordAttempt(
  sql: Sql,
  row: {
    workspaceId: string;
    postId: string;
    platform: Platform;
    key: string;
    attemptNo: number;
    result: PublishResult;
    actor: string;
  },
) {
  const next = new Date(Date.now() + backoffMs(row.attemptNo)).toISOString();
  const inserted = await sql<{ id: string }>`
    insert into publish_attempts (
      id, workspace_id, post_id, platform, status, idempotency_key, attempt_no,
      error_code, message, external_id, next_retry_at
    )
    values (
      ${crypto.randomUUID()},
      ${row.workspaceId},
      ${row.postId},
      ${row.platform},
      ${row.result.status},
      ${row.key},
      ${row.attemptNo},
      ${row.result.errorCode},
      ${row.result.message},
      ${row.result.externalId},
      ${row.result.status === "published" ? null : next}
    )
    on conflict (post_id, platform, idempotency_key) do nothing
    returning id
  `;
  if (!inserted[0]) return false;
  if (row.result.status === "published") {
    await sql`
      insert into published_posts (id, post_id, platform, external_id)
      values (${crypto.randomUUID()}, ${row.postId}, ${row.platform}, ${row.result.externalId})
      on conflict (post_id, platform) do nothing
    `;
  }
  const kind = row.result.status === "published" ? "publish_success" : "publish_failed";
  const title = row.result.status === "published" ? "Post published" : "Publishing did not complete";
  await notify(sql, {
    userId: row.actor,
    workspaceId: row.workspaceId,
    kind,
    title,
    body: row.result.message,
    refId: `${row.postId}:${row.platform}:${row.key}`,
  });
  return true;
}

async function reconcileWorkspace(sql: Sql, workspaceId: string, actor: string) {
  const due = await sql<{
    id: string;
    caption: string;
    hashtags: string;
    platforms: string;
    approval_status: string;
  }>`
    select id, caption, hashtags, platforms, approval_status
    from posts
    where workspace_id = ${workspaceId}
      and status = 'scheduled'
      and scheduled_at is not null
      and scheduled_at <= now()
  `;
  for (const post of due) {
    if (post.approval_status === "pending" || post.approval_status === "changes") continue;
    const platforms = parsePlatforms(post.platforms);
    const tags = normalizeHashtags(post.hashtags);
    const caption = [post.caption.trim(), tags.map((t) => `#${t}`).join(" ")].filter(Boolean).join("\n\n");
    let published = 0;
    let blocked = 0;
    let failed = 0;
    for (const platform of platforms) {
      const key = `initial:${platform}`;
      const existing = await sql<{ id: string }>`
        select id from publish_attempts
        where post_id = ${post.id} and platform = ${platform} and idempotency_key = ${key}
      `;
      if (existing[0]) continue;
      const result = await callOfficial(platform, caption);
      const wrote = await recordAttempt(sql, {
        workspaceId,
        postId: post.id,
        platform,
        key,
        attemptNo: 1,
        result,
        actor,
      });
      if (!wrote) continue;
      if (result.status === "published") published += 1;
      else if (result.status === "failed") failed += 1;
      else blocked += 1;
    }
    const attempts = await sql<{ status: string }>`
      select status from publish_attempts where post_id = ${post.id}
    `;
    const statuses = attempts.map((a) => a.status);
    let status = "blocked";
    if (statuses.length && statuses.every((s) => s === "published")) status = "published";
    else if (statuses.some((s) => s === "failed")) status = "failed";
    else if (published + blocked + failed === 0) status = "scheduled";
    if (status !== "scheduled") {
      await sql`
        update posts set status = ${status}, updated_at = now() where id = ${post.id}
      `;
      await sql`
        update scheduled_posts set status = ${status} where post_id = ${post.id}
      `;
    }
  }
}

async function remind(sql: Sql, workspaceId: string, userId: string) {
  const soon = await sql<{ id: string; scheduled_at: string }>`
    select id, scheduled_at from posts
    where workspace_id = ${workspaceId}
      and status = 'scheduled'
      and scheduled_at > now()
      and scheduled_at < now() + interval '24 hours'
  `;
  for (const post of soon) {
    await notify(sql, {
      userId,
      workspaceId,
      kind: "reminder",
      title: "Scheduled post coming up",
      body: `A post is set for ${iso(post.scheduled_at)}.`,
      refId: post.id,
    });
  }
}

export async function bootstrapFor(userId: string) {
  const sql = await getSql();
  const actor = await ensureActor(sql, userId);
  const me = actor.members.find((m) => m.workspace_id === actor.active)!;
  const ownerId = await ownerOf(sql, actor.active);
  const plan = await planForUser(sql, userId);
  const wsPlan = await planForUser(sql, ownerId);
  const usage = await usageFor(sql, actor.active, userId);
  const unread = await sql<{ n: number }>`
    select count(*) as n from notifications where user_id = ${userId} and read_at is null
  `;
  const admins = (process.env.SOCIALFLOW_ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return {
    user: { id: userId, email: actor.person.email, name: actor.person.name },
    profile: {
      displayName: actor.profile?.display_name || actor.person.name,
      timezone: actor.profile?.timezone || "Asia/Karachi",
    },
    workspaces: actor.members.map((m) => ({
      id: m.workspace_id,
      name: m.workspace_name,
      role: m.role,
      timezone: m.timezone,
    })),
    activeWorkspaceId: actor.active,
    role: me.role,
    plan,
    workspacePlan: wsPlan,
    usage,
    unread: num(unread[0]?.n),
    isAdmin: admins.includes(actor.person.email.toLowerCase()),
  };
}

export async function updateProfileFor(
  userId: string,
  input: { displayName: string; timezone: string },
) {
  const sql = await getSql();
  await ensureActor(sql, userId);
  const name = input.displayName.trim().slice(0, 80);
  if (!name) throw new Error("Display name is required.");
  const timezone = safeTimezone(input.timezone);
  await sql`
    update profiles
    set display_name = ${name}, timezone = ${timezone}, updated_at = now()
    where user_id = ${userId}
  `;
  return { ok: true as const };
}

export async function createWorkspaceFor(userId: string, input: { name: string; timezone: string }) {
  const sql = await getSql();
  const actor = await ensureActor(sql, userId);
  const plan = PLANS[await planForUser(sql, userId)];
  const owned = actor.members.filter((m) => m.role === "owner").length;
  if (!withinLimit(owned, plan.workspaces)) {
    throw new Error(`${plan.name} includes ${plan.workspaces} workspace${plan.workspaces === 1 ? "" : "s"}.`);
  }
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new Error("Workspace name is required.");
  const timezone = safeTimezone(input.timezone);
  const wsId = crypto.randomUUID();
  await sql`insert into workspaces (id, name, timezone) values (${wsId}, ${name}, ${timezone})`;
  await sql`
    insert into workspace_memberships (id, workspace_id, user_id, role, email, status)
    values (${crypto.randomUUID()}, ${wsId}, ${userId}, ${"owner"}, ${actor.person.email}, ${"active"})
  `;
  await sql`
    update profiles set active_workspace_id = ${wsId}, updated_at = now() where user_id = ${userId}
  `;
  await audit(sql, {
    workspaceId: wsId,
    actor: userId,
    action: "workspace.create",
    entity: "workspace",
    entityId: wsId,
    detail: name,
  });
  return { id: wsId };
}

export async function updateWorkspaceFor(
  userId: string,
  input: { name: string; timezone: string },
) {
  const sql = await getSql();
  const actor = await ensureActor(sql, userId);
  const member = memberOf(actor.members, actor.active, "admin");
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new Error("Workspace name is required.");
  const timezone = safeTimezone(input.timezone);
  await sql`
    update workspaces set name = ${name}, timezone = ${timezone}, updated_at = now()
    where id = ${member.workspace_id}
  `;
  await audit(sql, {
    workspaceId: member.workspace_id,
    actor: userId,
    action: "workspace.update",
    entity: "workspace",
    entityId: member.workspace_id,
    detail: name,
  });
  return { ok: true as const };
}

export async function deleteWorkspaceFor(userId: string, confirmName: string) {
  const sql = await getSql();
  const actor = await ensureActor(sql, userId);
  const member = memberOf(actor.members, actor.active, "owner");
  if (actor.members.filter((m) => m.role === "owner").length < 2 && actor.members.length < 2) {
    throw new Error("Create another workspace before deleting this one.");
  }
  if (confirmName.trim() !== member.workspace_name) {
    throw new Error("Type the workspace name to confirm deletion.");
  }
  await sql`delete from workspaces where id = ${member.workspace_id}`;
  await audit(sql, {
    workspaceId: null,
    actor: userId,
    action: "workspace.delete",
    entity: "workspace",
    entityId: member.workspace_id,
    detail: member.workspace_name,
  });
  return { ok: true as const };
}

export async function setActiveFor(userId: string, workspaceId: string) {
  const sql = await getSql();
  const actor = await ensureActor(sql, userId);
  memberOf(actor.members, workspaceId, "viewer");
  await sql`
    update profiles set active_workspace_id = ${workspaceId}, updated_at = now()
    where user_id = ${userId}
  `;
  return { ok: true as const };
}

async function loadContext(userId: string, min: Role) {
  const sql = await getSql();
  const actor = await ensureActor(sql, userId);
  const member = memberOf(actor.members, actor.active, min);
  const ownerId = await ownerOf(sql, member.workspace_id);
  const planId = await planForUser(sql, ownerId);
  return { sql, actor, member, ownerId, planId, plan: PLANS[planId] };
}

export async function loadBoardFor(userId: string) {
  const { sql, member, planId, plan } = await loadContext(userId, "viewer");
  await reconcileWorkspace(sql, member.workspace_id, userId);
  await remind(sql, member.workspace_id, userId);
  const accounts = await sql<{
    id: string;
    platform: string;
    display_name: string;
    status: string;
    status_detail: string;
    created_at: unknown;
  }>`
    select id, platform, display_name, status, status_detail, created_at
    from social_accounts
    where workspace_id = ${member.workspace_id}
    order by created_at asc
  `;
  const posts = await sql<{
    id: string;
    caption: string;
    hashtags: string;
    status: string;
    approval_status: string;
    scheduled_at: unknown;
    platforms: string;
    created_at: unknown;
    updated_at: unknown;
    author_user_id: string;
  }>`
    select id, caption, hashtags, status, approval_status, scheduled_at, platforms,
           created_at, updated_at, author_user_id
    from posts
    where workspace_id = ${member.workspace_id}
    order by coalesce(scheduled_at, created_at) desc
    limit 200
  `;
  const mediaLinks = await sql<{ post_id: string; media_id: string }>`
    select pm.post_id, pm.media_id
    from post_media pm
    join posts p on p.id = pm.post_id
    where p.workspace_id = ${member.workspace_id}
  `;
  const byPost = new Map<string, string[]>();
  for (const link of mediaLinks) {
    const list = byPost.get(link.post_id) ?? [];
    list.push(link.media_id);
    byPost.set(link.post_id, list);
  }
  const attempts = await sql<{
    id: string;
    post_id: string;
    platform: string;
    status: string;
    attempt_no: number;
    error_code: string;
    message: string;
    next_retry_at: unknown;
    created_at: unknown;
  }>`
    select id, post_id, platform, status, attempt_no, error_code, message, next_retry_at, created_at
    from publish_attempts
    where workspace_id = ${member.workspace_id}
    order by created_at desc
    limit 80
  `;
  const members = await sql<{
    id: string;
    user_id: string;
    role: string;
    email: string;
    status: string;
    name: string | null;
    account_email: string | null;
  }>`
    select m.id, m.user_id, m.role, m.email, m.status, u.name, u.email as account_email
    from workspace_memberships m
    left join "user" u on u.id = m.user_id
    where m.workspace_id = ${member.workspace_id}
    order by m.created_at asc
  `;
  const notes = await sql<{
    id: string;
    kind: string;
    title: string;
    body: string;
    read_at: unknown;
    created_at: unknown;
  }>`
    select id, kind, title, body, read_at, created_at
    from notifications
    where user_id = ${userId}
    order by created_at desc
    limit 40
  `;
  const activity = await sql<{
    id: string;
    action: string;
    entity: string;
    detail: string;
    created_at: unknown;
  }>`
    select id, action, entity, detail, created_at
    from audit_logs
    where workspace_id = ${member.workspace_id}
    order by created_at desc
    limit 12
  `;
  const usage = await usageFor(sql, member.workspace_id, await ownerOf(sql, member.workspace_id));
  const sub = await sql<{
    plan: string;
    status: string;
    billing_interval: string;
    currency: string;
    current_period_end: unknown;
  }>`
    select plan, status, billing_interval, currency, current_period_end
    from subscriptions where user_id = ${userId}
  `;
  const payments = await sql<{
    id: string;
    plan: string;
    amount: number;
    currency: string;
    billing_interval: string;
    status: string;
    provider: string;
    detail: string;
    created_at: unknown;
  }>`
    select id, plan, amount, currency, billing_interval, status, provider, detail, created_at
    from payments where user_id = ${userId}
    order by created_at desc
    limit 20
  `;
  return {
    workspace: {
      id: member.workspace_id,
      name: member.workspace_name,
      timezone: member.timezone,
      role: member.role,
    },
    plan: planId,
    limits: {
      workspaces: plan.workspaces,
      profiles: plan.profiles,
      postsPerMonth: plan.postsPerMonth,
      aiPerMonth: plan.aiPerMonth,
      media: plan.media,
      team: plan.team,
      analytics: plan.analytics,
      approval: plan.approval,
    },
    usage,
    platformReady: platformReady(),
    accounts: accounts
      .filter((a) => isPlatform(a.platform))
      .map((a) => ({
        id: a.id,
        platform: a.platform as Platform,
        displayName: a.display_name,
        status: a.status,
        detail: a.status_detail,
        createdAt: iso(a.created_at),
      })),
    posts: posts.map((p) => ({
      id: p.id,
      caption: p.caption,
      hashtags: p.hashtags,
      status: p.status,
      approval: p.approval_status,
      scheduledAt: iso(p.scheduled_at),
      platforms: parsePlatforms(p.platforms),
      mediaIds: byPost.get(p.id) ?? [],
      createdAt: iso(p.created_at),
      updatedAt: iso(p.updated_at),
      mine: p.author_user_id === userId,
    })),
    attempts: attempts.map((a) => ({
      id: a.id,
      postId: a.post_id,
      platform: a.platform,
      status: a.status,
      attemptNo: a.attempt_no,
      errorCode: a.error_code,
      message: a.message,
      nextRetryAt: iso(a.next_retry_at),
      createdAt: iso(a.created_at),
    })),
    members: members.map((m) => ({
      id: m.id,
      role: m.role,
      status: m.status,
      email: m.account_email || m.email,
      name: m.name || m.email || "Invited",
    })),
    notifications: notes.map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      read: Boolean(n.read_at),
      createdAt: iso(n.created_at),
    })),
    activity: activity.map((a) => ({
      id: a.id,
      action: a.action,
      entity: a.entity,
      detail: a.detail,
      createdAt: iso(a.created_at),
    })),
    subscription: sub[0]
      ? {
          plan: sub[0].plan,
          status: sub[0].status,
          interval: sub[0].billing_interval,
          currency: sub[0].currency,
          periodEnd: iso(sub[0].current_period_end),
        }
      : null,
    payments: payments.map((p) => ({
      id: p.id,
      plan: p.plan,
      amount: p.amount,
      currency: p.currency,
      interval: p.billing_interval,
      status: p.status,
      provider: p.provider,
      detail: p.detail,
      createdAt: iso(p.created_at),
    })),
  };
}

type SaveInput = {
  id?: string;
  caption: string;
  hashtags: string;
  platforms: string[];
  mediaIds: string[];
  scheduledAt: string | null;
  intent: "draft" | "schedule" | "publish";
};

export async function savePostFor(userId: string, input: SaveInput) {
  const { sql, member, plan } = await loadContext(userId, "editor");
  const platforms = [...new Set(input.platforms.filter(isPlatform))];
  const mediaIds = [...new Set(input.mediaIds.filter((id) => typeof id === "string"))].slice(0, 10);
  if ((input.caption ?? "").length > 5000) throw new Error("Caption must be 5,000 characters or fewer.");
  if (input.intent !== "draft") {
    if (!platforms.length) throw new Error("Choose at least one destination.");
    const realErrors = validateContent({
      caption: input.caption ?? "",
      hashtags: input.hashtags ?? "",
      platforms,
      mediaCount: mediaIds.length,
      hasVideo: false,
    });
    if (realErrors.length) throw new Error(realErrors[0]);
  }
  if (input.intent !== "draft") {
    const known = await sql<{ platform: string }>`
      select platform from social_accounts where workspace_id = ${member.workspace_id}
    `;
    const have = new Set(known.map((row) => row.platform));
    for (const platform of platforms) {
      if (!have.has(platform)) {
        throw new Error(`Add a ${PLATFORM_LABEL[platform]} profile before targeting it.`);
      }
    }
  }
  if (mediaIds.length) {
    const found = await sql<{ id: string }>`
      select id from media_assets where workspace_id = ${member.workspace_id}
    `;
    const have = new Set(found.map((row) => row.id));
    if (mediaIds.some((id) => !have.has(id))) {
      throw new Error("One of those images is not in this workspace.");
    }
  }
  const tags = normalizeHashtags(input.hashtags ?? "");
  const caption = (input.caption ?? "").trim();
  let scheduled: string | null = null;
  if (input.intent === "schedule") {
    if (!input.scheduledAt) throw new Error("Pick a date and time.");
    const when = new Date(input.scheduledAt);
    if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() - 60_000) {
      throw new Error("Schedule a time in the future.");
    }
    scheduled = when.toISOString();
  }
  if (input.intent === "publish") scheduled = new Date().toISOString();
  let status = "draft";
  let approval = "none";
  if (input.intent === "schedule" || input.intent === "publish") {
    if (plan.approval && member.role === "editor") {
      status = "draft";
      approval = "pending";
    } else {
      status = "scheduled";
      approval = plan.approval ? "approved" : "none";
    }
  }
  let postId = input.id?.trim() || "";
  if (!postId) {
    const usage = await usageFor(sql, member.workspace_id, await ownerOf(sql, member.workspace_id));
    if (!withinLimit(usage.postsThisMonth, plan.postsPerMonth)) {
      throw new Error(`This workspace has used its ${plan.postsPerMonth} planned posts for the month.`);
    }
    postId = crypto.randomUUID();
    await sql`
      insert into posts (
        id, workspace_id, author_user_id, caption, hashtags, status, approval_status,
        scheduled_at, platforms
      )
      values (
        ${postId}, ${member.workspace_id}, ${userId}, ${caption}, ${tags.join(" ")},
        ${status}, ${approval}, ${scheduled}, ${JSON.stringify(platforms)}
      )
    `;
  } else {
    const existing = await sql<{ status: string }>`
      select status from posts where id = ${postId} and workspace_id = ${member.workspace_id}
    `;
    if (!existing[0]) throw new Error("That post was not found in this workspace.");
    if (existing[0].status === "published") throw new Error("Published posts stay as history. Duplicate it to edit a copy.");
    await sql`
      update posts
      set caption = ${caption},
          hashtags = ${tags.join(" ")},
          status = ${status},
          approval_status = ${approval},
          scheduled_at = ${scheduled},
          platforms = ${JSON.stringify(platforms)},
          updated_at = now()
      where id = ${postId} and workspace_id = ${member.workspace_id}
    `;
    await sql`delete from publish_attempts where post_id = ${postId} and status <> 'published'`;
  }
  await syncHashtags(sql, postId, tags);
  await sql`delete from post_media where post_id = ${postId}`;
  for (let i = 0; i < mediaIds.length; i += 1) {
    await sql`
      insert into post_media (post_id, media_id, position)
      values (${postId}, ${mediaIds[i]}, ${i})
    `;
  }
  if (scheduled && status === "scheduled") {
    await sql`
      insert into scheduled_posts (post_id, run_at, status)
      values (${postId}, ${scheduled}, ${"queued"})
      on conflict (post_id) do update set run_at = ${scheduled}, status = 'queued'
    `;
  } else {
    await sql`delete from scheduled_posts where post_id = ${postId}`;
  }
  await audit(sql, {
    workspaceId: member.workspace_id,
    actor: userId,
    action: `post.${input.intent}`,
    entity: "post",
    entityId: postId,
    detail: approval === "pending" ? "Waiting for approval" : status,
  });
  if (approval === "pending") {
    const admins = await sql<{ user_id: string }>`
      select user_id from workspace_memberships
      where workspace_id = ${member.workspace_id}
        and status = 'active'
        and role in ('owner', 'admin')
    `;
    for (const admin of admins) {
      await notify(sql, {
        userId: admin.user_id,
        workspaceId: member.workspace_id,
        kind: "approval",
        title: "Post needs approval",
        body: "An editor submitted a post for review.",
        refId: postId,
      });
    }
  }
  if (input.intent === "publish" && status === "scheduled") {
    await reconcileWorkspace(sql, member.workspace_id, userId);
  }
  return { id: postId, approval };
}

export async function deletePostFor(userId: string, postId: string) {
  const { sql, member } = await loadContext(userId, "editor");
  const rows = await sql<{ status: string }>`
    select status from posts where id = ${postId} and workspace_id = ${member.workspace_id}
  `;
  if (!rows[0]) throw new Error("That post was not found in this workspace.");
  if (rows[0].status === "published") throw new Error("Published posts stay in history.");
  await sql`delete from posts where id = ${postId}`;
  await audit(sql, {
    workspaceId: member.workspace_id,
    actor: userId,
    action: "post.delete",
    entity: "post",
    entityId: postId,
  });
  return { ok: true as const };
}

export async function duplicatePostFor(userId: string, postId: string) {
  const { sql, member, plan } = await loadContext(userId, "editor");
  const usage = await usageFor(sql, member.workspace_id, await ownerOf(sql, member.workspace_id));
  if (!withinLimit(usage.postsThisMonth, plan.postsPerMonth)) {
    throw new Error(`This workspace has used its ${plan.postsPerMonth} planned posts for the month.`);
  }
  const rows = await sql<{ caption: string; hashtags: string; platforms: string }>`
    select caption, hashtags, platforms from posts
    where id = ${postId} and workspace_id = ${member.workspace_id}
  `;
  if (!rows[0]) throw new Error("That post was not found in this workspace.");
  const id = crypto.randomUUID();
  await sql`
    insert into posts (id, workspace_id, author_user_id, caption, hashtags, status, platforms)
    values (
      ${id}, ${member.workspace_id}, ${userId}, ${rows[0].caption}, ${rows[0].hashtags},
      ${"draft"}, ${rows[0].platforms}
    )
  `;
  const links = await sql<{ media_id: string; position: number }>`
    select media_id, position from post_media where post_id = ${postId}
  `;
  for (const link of links) {
    await sql`
      insert into post_media (post_id, media_id, position)
      values (${id}, ${link.media_id}, ${link.position})
    `;
  }
  await syncHashtags(sql, id, normalizeHashtags(rows[0].hashtags));
  return { id };
}

export async function decidePostFor(userId: string, input: { postId: string; decision: "approved" | "changes" }) {
  const { sql, member, plan } = await loadContext(userId, "admin");
  if (!plan.approval) throw new Error("Approvals are part of the Agency plan.");
  const rows = await sql<{ id: string; scheduled_at: unknown }>`
    select id, scheduled_at from posts
    where id = ${input.postId} and workspace_id = ${member.workspace_id} and approval_status = 'pending'
  `;
  if (!rows[0]) throw new Error("That post is not waiting for approval.");
  if (input.decision === "changes") {
    await sql`
      update posts set approval_status = 'changes', status = 'draft', updated_at = now()
      where id = ${input.postId}
    `;
  } else {
    const when = rows[0].scheduled_at ? iso(rows[0].scheduled_at) : new Date().toISOString();
    await sql`
      update posts
      set approval_status = 'approved', status = 'scheduled', scheduled_at = ${when}, updated_at = now()
      where id = ${input.postId}
    `;
    await sql`
      insert into scheduled_posts (post_id, run_at, status)
      values (${input.postId}, ${when}, ${"queued"})
      on conflict (post_id) do update set run_at = ${when}, status = 'queued'
    `;
    await reconcileWorkspace(sql, member.workspace_id, userId);
  }
  await audit(sql, {
    workspaceId: member.workspace_id,
    actor: userId,
    action: `post.${input.decision}`,
    entity: "post",
    entityId: input.postId,
  });
  return { ok: true as const };
}

export async function movePostFor(userId: string, input: { postId: string; scheduledAt: string }) {
  const { sql, member } = await loadContext(userId, "editor");
  const when = new Date(input.scheduledAt);
  if (Number.isNaN(when.getTime())) throw new Error("That time is not valid.");
  const rows = await sql<{ status: string }>`
    select status from posts where id = ${input.postId} and workspace_id = ${member.workspace_id}
  `;
  if (!rows[0]) throw new Error("That post was not found in this workspace.");
  if (rows[0].status === "published") throw new Error("Published posts cannot be moved.");
  const isoWhen = when.toISOString();
  await sql`
    update posts
    set scheduled_at = ${isoWhen}, status = 'scheduled', updated_at = now()
    where id = ${input.postId}
  `;
  await sql`
    insert into scheduled_posts (post_id, run_at, status)
    values (${input.postId}, ${isoWhen}, ${"queued"})
    on conflict (post_id) do update set run_at = ${isoWhen}, status = 'queued'
  `;
  await sql`delete from publish_attempts where post_id = ${input.postId} and status <> 'published'`;
  return { ok: true as const };
}

export async function listMediaFor(userId: string) {
  const { sql, member } = await loadContext(userId, "viewer");
  const rows = await sql<{
    id: string;
    name: string;
    mime: string;
    size_bytes: number;
    data_url: string;
    created_at: unknown;
  }>`
    select id, name, mime, size_bytes, data_url, created_at
    from media_assets
    where workspace_id = ${member.workspace_id}
    order by created_at desc
    limit 60
  `;
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    mime: row.mime,
    size: row.size_bytes,
    dataUrl: row.data_url,
    createdAt: iso(row.created_at),
  }));
}

const MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function uploadMediaFor(
  userId: string,
  input: { name: string; mime: string; dataUrl: string },
) {
  const { sql, member, plan } = await loadContext(userId, "editor");
  if (!MIME.has(input.mime)) throw new Error("Use a JPEG, PNG, WebP, or GIF image.");
  if (!input.dataUrl.startsWith(`data:${input.mime};base64,`)) {
    throw new Error("That file did not match its declared type.");
  }
  if (input.dataUrl.length > 420_000) throw new Error("Images must be under about 300 KB.");
  const usage = await usageFor(sql, member.workspace_id, await ownerOf(sql, member.workspace_id));
  if (!withinLimit(usage.media, plan.media)) {
    throw new Error(`This plan stores ${plan.media} images per workspace.`);
  }
  const id = crypto.randomUUID();
  const name = (input.name || "image").slice(0, 120);
  const size = Math.floor((input.dataUrl.length - input.dataUrl.indexOf(",") - 1) * 0.75);
  await sql`
    insert into media_assets (id, workspace_id, name, mime, size_bytes, data_url, created_by)
    values (${id}, ${member.workspace_id}, ${name}, ${input.mime}, ${size}, ${input.dataUrl}, ${userId})
  `;
  return { id };
}

export async function deleteMediaFor(userId: string, mediaId: string) {
  const { sql, member } = await loadContext(userId, "editor");
  const rows = await sql`
    delete from media_assets
    where id = ${mediaId} and workspace_id = ${member.workspace_id}
    returning id
  `;
  if (!rows[0]) throw new Error("That image was not found in this workspace.");
  return { ok: true as const };
}

export async function connectAccountFor(
  userId: string,
  input: { platform: string; displayName: string },
) {
  const { sql, member, plan } = await loadContext(userId, "admin");
  if (!isPlatform(input.platform)) throw new Error("Unknown platform.");
  const name = input.displayName.trim().slice(0, 80);
  if (!name) throw new Error("Name the profile you want to connect.");
  const usage = await usageFor(sql, member.workspace_id, await ownerOf(sql, member.workspace_id));
  if (!withinLimit(usage.profiles, plan.profiles)) {
    throw new Error(`${plan.name} includes ${plan.profiles} social profile${plan.profiles === 1 ? "" : "s"}.`);
  }
  const id = crypto.randomUUID();
  const state = crypto.randomUUID();
  const detail =
    input.platform === "instagram" || input.platform === "tiktok"
      ? `${PLATFORM_LABEL[input.platform]} official publishing is pending app review. No token was stored and nothing will be marked published.`
      : platformReady()[input.platform]
        ? "Server credentials are present. Publishing will call the official API and record its response."
        : "No official token is stored. Publishing stays blocked until server credentials are configured.";
  await sql`
    insert into social_accounts (id, workspace_id, platform, display_name, status, status_detail)
    values (${id}, ${member.workspace_id}, ${input.platform}, ${name}, ${"awaiting_credentials"}, ${detail})
  `;
  await sql`
    insert into oauth_states (id, workspace_id, user_id, platform, state, expires_at)
    values (
      ${crypto.randomUUID()},
      ${member.workspace_id},
      ${userId},
      ${input.platform},
      ${state},
      now() + interval '15 minutes'
    )
  `;
  await notify(sql, {
    userId,
    workspaceId: member.workspace_id,
    kind: "account",
    title: `${PLATFORM_LABEL[input.platform]} is not live yet`,
    body: detail,
    refId: id,
  });
  await audit(sql, {
    workspaceId: member.workspace_id,
    actor: userId,
    action: "account.connect_request",
    entity: "social_account",
    entityId: id,
    detail: input.platform,
  });
  return { id, status: "awaiting_credentials" as const };
}

export async function disconnectAccountFor(userId: string, accountId: string) {
  const { sql, member } = await loadContext(userId, "admin");
  const rows = await sql`
    delete from social_accounts
    where id = ${accountId} and workspace_id = ${member.workspace_id}
    returning id
  `;
  if (!rows[0]) throw new Error("That profile was not found in this workspace.");
  await audit(sql, {
    workspaceId: member.workspace_id,
    actor: userId,
    action: "account.disconnect",
    entity: "social_account",
    entityId: accountId,
  });
  return { ok: true as const };
}

export async function retryAttemptFor(userId: string, attemptId: string) {
  const { sql, member } = await loadContext(userId, "editor");
  const rows = await sql<{
    id: string;
    post_id: string;
    platform: string;
    status: string;
    attempt_no: number;
    next_retry_at: unknown;
  }>`
    select id, post_id, platform, status, attempt_no, next_retry_at
    from publish_attempts
    where id = ${attemptId} and workspace_id = ${member.workspace_id}
  `;
  const attempt = rows[0];
  if (!attempt || !isPlatform(attempt.platform)) throw new Error("That attempt was not found.");
  if (attempt.status === "published") throw new Error("That attempt already published.");
  const nextAt = attempt.next_retry_at ? new Date(String(attempt.next_retry_at)).getTime() : 0;
  if (nextAt && nextAt > Date.now()) {
    throw new Error(`Retry opens at ${iso(attempt.next_retry_at)}.`);
  }
  const post = await sql<{ caption: string; hashtags: string }>`
    select caption, hashtags from posts where id = ${attempt.post_id}
  `;
  if (!post[0]) throw new Error("The post no longer exists.");
  const tags = normalizeHashtags(post[0].hashtags);
  const caption = [post[0].caption.trim(), tags.map((t) => `#${t}`).join(" ")].filter(Boolean).join("\n\n");
  const attemptNo = attempt.attempt_no + 1;
  const key = `retry:${attemptNo}:${attempt.platform}`;
  const result = await callOfficial(attempt.platform, caption);
  await recordAttempt(sql, {
    workspaceId: member.workspace_id,
    postId: attempt.post_id,
    platform: attempt.platform,
    key,
    attemptNo,
    result,
    actor: userId,
  });
  await sql`
    update posts set status = ${result.status}, updated_at = now() where id = ${attempt.post_id}
  `;
  return { status: result.status, message: result.message };
}

export async function markNotesReadFor(userId: string) {
  const sql = await getSql();
  await sql`
    update notifications set read_at = now()
    where user_id = ${userId} and read_at is null
  `;
  return { ok: true as const };
}

export async function inviteMemberFor(
  userId: string,
  input: { email: string; role: string },
) {
  const { sql, member, plan } = await loadContext(userId, "admin");
  if (!plan.team) throw new Error("Team seats start on the Business plan.");
  if (!isRole(input.role) || input.role === "owner") throw new Error("Choose admin, editor, or viewer.");
  if (!roleAtLeast(member.role, input.role)) throw new Error("You cannot grant a role above your own.");
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email.");
  const existingUser = await sql<{ id: string }>`
    select id from "user" where lower(email) = ${email}
  `;
  const targetId = existingUser[0]?.id ?? `invite:${crypto.randomUUID()}`;
  const status = existingUser[0] ? "active" : "invited";
  const dup = await sql<{ id: string }>`
    select id from workspace_memberships
    where workspace_id = ${member.workspace_id} and (user_id = ${targetId} or lower(email) = ${email})
  `;
  if (dup[0]) throw new Error("That person is already on this workspace.");
  await sql`
    insert into workspace_memberships (id, workspace_id, user_id, role, email, status)
    values (${crypto.randomUUID()}, ${member.workspace_id}, ${targetId}, ${input.role}, ${email}, ${status})
  `;
  if (existingUser[0]) {
    await notify(sql, {
      userId: existingUser[0].id,
      workspaceId: member.workspace_id,
      kind: "invite",
      title: "You joined a workspace",
      body: `${member.workspace_name} added you as ${input.role}.`,
      refId: member.workspace_id,
    });
  }
  await audit(sql, {
    workspaceId: member.workspace_id,
    actor: userId,
    action: "member.invite",
    entity: "membership",
    detail: `${email} ${input.role}`,
  });
  return { status };
}

export async function updateMemberFor(userId: string, input: { membershipId: string; role: string }) {
  const { sql, member } = await loadContext(userId, "admin");
  if (!isRole(input.role) || input.role === "owner") throw new Error("Choose admin, editor, or viewer.");
  const rows = await sql<{ id: string; role: string; user_id: string }>`
    select id, role, user_id from workspace_memberships
    where id = ${input.membershipId} and workspace_id = ${member.workspace_id}
  `;
  if (!rows[0]) throw new Error("That member was not found.");
  if (rows[0].role === "owner") throw new Error("The owner role stays with the owner.");
  await sql`
    update workspace_memberships set role = ${input.role}
    where id = ${input.membershipId} and workspace_id = ${member.workspace_id}
  `;
  return { ok: true as const };
}

export async function removeMemberFor(userId: string, membershipId: string) {
  const { sql, member } = await loadContext(userId, "admin");
  const rows = await sql<{ role: string; user_id: string }>`
    select role, user_id from workspace_memberships
    where id = ${membershipId} and workspace_id = ${member.workspace_id}
  `;
  if (!rows[0]) throw new Error("That member was not found.");
  if (rows[0].role === "owner" || rows[0].user_id === userId) {
    throw new Error("Owners cannot be removed this way.");
  }
  await sql`delete from workspace_memberships where id = ${membershipId}`;
  return { ok: true as const };
}

export async function requestPlanFor(
  userId: string,
  input: { plan: string; currency: string; interval: string },
) {
  const sql = await getSql();
  await ensureActor(sql, userId);
  if (!isPlan(input.plan)) throw new Error("Unknown plan.");
  const currency: Currency = input.currency === "USD" ? "USD" : "PKR";
  const interval: Interval = input.interval === "year" ? "year" : "month";
  const amount = priceFor(input.plan, currency, interval);
  if (input.plan === "free" || amount === 0) {
    await sql`
      update subscriptions
      set plan = 'free', status = 'active', billing_interval = 'month', currency = ${currency},
          current_period_end = null, updated_at = now()
      where user_id = ${userId}
    `;
    await sql`
      insert into payments (id, user_id, plan, amount, currency, billing_interval, status, provider, detail)
      values (
        ${crypto.randomUUID()}, ${userId}, ${"free"}, ${0}, ${currency}, ${"month"},
        ${"cancelled"}, ${"none"}, ${"Subscription cancelled. No charge was made."}
      )
    `;
    await audit(sql, {
      workspaceId: null,
      actor: userId,
      action: "billing.cancel",
      entity: "subscription",
      entityId: userId,
    });
    return { status: "active" as const, message: "You are on Free. No charge was made." };
  }
  const id = crypto.randomUUID();
  await sql`
    insert into payments (id, user_id, plan, amount, currency, billing_interval, status, provider, detail)
    values (
      ${id}, ${userId}, ${input.plan}, ${amount}, ${currency}, ${interval},
      ${"awaiting_provider"}, ${"unconfigured"},
      ${"Waiting for a signed payment webhook. The plan does not change until payment succeeds."}
    )
  `;
  return {
    status: "awaiting_provider" as const,
    message: `${PLANS[input.plan].name} stays unpaid until a verified webhook confirms ${currency} ${amount}.`,
  };
}

export async function aiAssistFor(
  userId: string,
  input: { kind: string; draft: string; platform: string },
) {
  const { sql, member, plan } = await loadContext(userId, "editor");
  const usage = await usageFor(sql, member.workspace_id, await ownerOf(sql, member.workspace_id));
  if (!withinLimit(usage.aiThisMonth, plan.aiPerMonth)) {
    throw new Error(`This workspace has used its ${plan.aiPerMonth} AI assists this month.`);
  }
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error("AI caption assistance is not available in this environment.");
  const kind = input.kind === "hashtags" || input.kind === "ideas" ? input.kind : "caption";
  const platform = isPlatform(input.platform) ? PLATFORM_LABEL[input.platform] : "social";
  const draft = (input.draft ?? "").slice(0, 1200);
  const ask =
    kind === "hashtags"
      ? `Suggest 8 hashtags for a ${platform} post. Return only the tags separated by spaces. Draft:\n${draft}`
      : kind === "ideas"
        ? `Give 4 short post ideas for a ${platform} brand. Plain sentences, no emoji. Context:\n${draft || "general small business"}`
        : `Write one ${platform} caption under 400 characters. No emoji. Draft notes:\n${draft || "announce something useful"}`;
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "grok-4.5",
      max_tokens: 280,
      messages: [{ role: "user", content: ask }],
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`AI request failed (${res.status}).`);
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = body.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error("AI returned an empty response.");
  await sql`
    insert into ai_usage (id, user_id, workspace_id, kind)
    values (${crypto.randomUUID()}, ${userId}, ${member.workspace_id}, ${kind})
  `;
  return { text };
}

export async function analyticsFor(userId: string, input: { platform: string; from: string; to: string }) {
  const { sql, member, plan } = await loadContext(userId, "viewer");
  const from = input.from ? new Date(input.from) : new Date(Date.now() - 30 * 86400_000);
  const to = input.to ? new Date(input.to) : new Date();
  const platform = isPlatform(input.platform) ? input.platform : "";
  const rows = await sql<{ status: string; platforms: string; created_at: unknown }>`
    select status, platforms, created_at from posts
    where workspace_id = ${member.workspace_id}
      and created_at >= ${from.toISOString()}
      and created_at <= ${to.toISOString()}
  `;
  const filtered = rows.filter((row) => !platform || parsePlatforms(row.platforms).includes(platform));
  const count = (status: string) => filtered.filter((row) => row.status === status).length;
  const snapshotId = crypto.randomUUID();
  await sql`
    insert into analytics_snapshots (id, workspace_id, platform, metric, availability, value)
    values (${snapshotId}, ${member.workspace_id}, ${platform || "all"}, ${"posts_total"}, ${"available"}, ${filtered.length})
  `;
  return {
    advanced: plan.analytics,
    totals: {
      total: filtered.length,
      draft: count("draft"),
      scheduled: count("scheduled"),
      published: count("published"),
      failed: count("failed") + count("blocked"),
    },
    engagement: {
      likes: "unavailable" as const,
      comments: "unavailable" as const,
      shares: "unavailable" as const,
      reach: "unavailable" as const,
      impressions: "unavailable" as const,
      reason:
        "Likes, comments, shares, reach, and impressions are not invented. They appear only after an official platform returns them.",
    },
  };
}

export async function adminOverviewFor(userId: string) {
  const sql = await getSql();
  const actor = await ensureActor(sql, userId);
  const admins = (process.env.SOCIALFLOW_ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (!admins.includes(actor.person.email.toLowerCase())) {
    throw new Error("Platform admin is not enabled for this account.");
  }
  const users = await sql<{ n: number }>`select count(*) as n from "user"`;
  const workspaces = await sql<{ n: number }>`select count(*) as n from workspaces`;
  const subs = await sql<{ plan: string; n: number }>`
    select plan, count(*) as n from subscriptions group by plan
  `;
  const pays = await sql<{ status: string; n: number }>`
    select status, count(*) as n from payments group by status
  `;
  const fails = await sql<{ n: number }>`
    select count(*) as n from publish_attempts where status in ('failed', 'blocked')
  `;
  return {
    users: num(users[0]?.n),
    workspaces: num(workspaces[0]?.n),
    subscriptions: subs.map((row) => ({ plan: row.plan, count: num(row.n) })),
    payments: pays.map((row) => ({ status: row.status, count: num(row.n) })),
    publishingProblems: num(fails[0]?.n),
    database: "ok" as const,
  };
}

export async function handleWebhook(request: Request): Promise<Response> {
  const secret = process.env.SOCIALFLOW_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json(
      { ok: false, error: "Payment webhooks are not configured." },
      { status: 503 },
    );
  }
  const raw = await request.text();
  const provided = request.headers.get("x-socialflow-signature") ?? "";
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ ok: false, error: "Invalid signature." }, { status: 401 });
  }
  let body: {
    id?: string;
    type?: string;
    userId?: string;
    plan?: string;
    amount?: number;
    currency?: string;
    interval?: string;
  };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  if (!body.id || !body.type || !body.userId) {
    return Response.json({ ok: false, error: "Missing event fields." }, { status: 400 });
  }
  const sql = await getSql();
  const seen = await sql<{ id: string }>`
    select id from webhook_events where provider = 'billing' and event_id = ${body.id}
  `;
  if (seen[0]) return Response.json({ ok: true, duplicate: true });
  const user = await sql<{ id: string }>`select id from "user" where id = ${body.userId}`;
  if (!user[0]) return Response.json({ ok: false, error: "Unknown user." }, { status: 422 });
  if (body.type === "payment.failed") {
    await sql`
      insert into webhook_events (id, provider, event_id, status)
      values (${crypto.randomUUID()}, ${"billing"}, ${body.id}, ${"failed"})
    `;
    await sql`
      update payments set status = 'failed', detail = 'Provider reported a failed payment.'
      where id = (
        select id from payments
        where user_id = ${body.userId} and status = 'awaiting_provider'
        order by created_at desc limit 1
      )
    `;
    await notify(sql, {
      userId: body.userId,
      workspaceId: null,
      kind: "billing",
      title: "Payment failed",
      body: "The plan was not changed.",
      refId: body.id,
    });
    return Response.json({ ok: true });
  }
  if (body.type !== "payment.succeeded") {
    return Response.json({ ok: false, error: "Unsupported event." }, { status: 400 });
  }
  if (!body.plan || !isPlan(body.plan)) {
    return Response.json({ ok: false, error: "Unknown plan." }, { status: 422 });
  }
  const currency: Currency = body.currency === "USD" ? "USD" : "PKR";
  const interval: Interval = body.interval === "year" ? "year" : "month";
  const expectedAmount = priceFor(body.plan, currency, interval);
  if (body.amount !== expectedAmount) {
    return Response.json({ ok: false, error: "Amount does not match the plan price." }, { status: 422 });
  }
  const inserted = await sql<{ id: string }>`
    insert into webhook_events (id, provider, event_id, status)
    values (${crypto.randomUUID()}, ${"billing"}, ${body.id}, ${"succeeded"})
    on conflict (provider, event_id) do nothing
    returning id
  `;
  if (!inserted[0]) return Response.json({ ok: true, duplicate: true });
  const period = new Date(Date.now() + (interval === "year" ? 365 : 31) * 86400_000).toISOString();
  await sql`
    insert into subscriptions (user_id, plan, status, billing_interval, currency, current_period_end)
    values (${body.userId}, ${body.plan}, ${"active"}, ${interval}, ${currency}, ${period})
    on conflict (user_id) do update
    set plan = ${body.plan}, status = 'active', billing_interval = ${interval},
        currency = ${currency}, current_period_end = ${period}, updated_at = now()
  `;
  await sql`
    insert into payments (id, user_id, plan, amount, currency, billing_interval, status, provider, detail)
    values (
      ${crypto.randomUUID()}, ${body.userId}, ${body.plan}, ${expectedAmount}, ${currency}, ${interval},
      ${"succeeded"}, ${"webhook"}, ${"Confirmed by signed webhook."}
    )
  `;
  await notify(sql, {
    userId: body.userId,
    workspaceId: null,
    kind: "billing",
    title: "Subscription updated",
    body: `${PLANS[body.plan].name} is active.`,
    refId: body.id,
  });
  return Response.json({ ok: true });
}
