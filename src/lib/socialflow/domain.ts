export const PLATFORMS = ["instagram", "facebook", "linkedin", "tiktok"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLAN_IDS = ["free", "creator", "business", "agency"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const ROLES = ["owner", "admin", "editor", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export type PostStatus =
  | "draft"
  | "scheduled"
  | "published"
  | "failed"
  | "blocked";

export type Currency = "PKR" | "USD";
export type Interval = "month" | "year";

export type PlanSpec = {
  id: PlanId;
  name: string;
  blurb: string;
  pkr: number;
  usd: number;
  workspaces: number;
  profiles: number;
  postsPerMonth: number | null;
  aiPerMonth: number;
  media: number;
  team: boolean;
  analytics: boolean;
  approval: boolean;
};

export const PLANS: Record<PlanId, PlanSpec> = {
  free: {
    id: "free",
    name: "Free",
    blurb: "One brand, a real calendar, and a small planning quota.",
    pkr: 0,
    usd: 0,
    workspaces: 1,
    profiles: 1,
    postsPerMonth: 10,
    aiPerMonth: 3,
    media: 12,
    team: false,
    analytics: false,
    approval: false,
  },
  creator: {
    id: "creator",
    name: "Creator",
    blurb: "More profiles, unlimited drafts, and caption help.",
    pkr: 799,
    usd: 9,
    workspaces: 1,
    profiles: 3,
    postsPerMonth: null,
    aiPerMonth: 40,
    media: 80,
    team: false,
    analytics: false,
    approval: false,
  },
  business: {
    id: "business",
    name: "Business",
    blurb: "Several brands, a team, and a fuller reporting view.",
    pkr: 1999,
    usd: 19,
    workspaces: 5,
    profiles: 10,
    postsPerMonth: null,
    aiPerMonth: 120,
    media: 300,
    team: true,
    analytics: true,
    approval: false,
  },
  agency: {
    id: "agency",
    name: "Agency",
    blurb: "Client workspaces, roles, and an approval step.",
    pkr: 4999,
    usd: 49,
    workspaces: 25,
    profiles: 40,
    postsPerMonth: null,
    aiPerMonth: 400,
    media: 800,
    team: true,
    analytics: true,
    approval: true,
  },
};

export const PLATFORM_LABEL: Record<Platform, string> = {
  instagram: "Instagram",
  facebook: "Facebook Page",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
};

const ROLE_RANK: Record<Role, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
};

export function isPlatform(value: string): value is Platform {
  return (PLATFORMS as readonly string[]).includes(value);
}

export function isPlan(value: string): value is PlanId {
  return (PLAN_IDS as readonly string[]).includes(value);
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function roleAtLeast(role: Role, min: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export function priceFor(plan: PlanId, currency: Currency, interval: Interval): number {
  const monthly = currency === "PKR" ? PLANS[plan].pkr : PLANS[plan].usd;
  return interval === "year" ? monthly * 10 : monthly;
}

export function formatMoney(amount: number, currency: Currency): string {
  if (amount === 0) return currency === "PKR" ? "PKR 0" : "USD 0";
  return currency === "PKR" ? `PKR ${amount.toLocaleString("en-PK")}` : `USD ${amount}`;
}

export function normalizeHashtags(raw: string): string[] {
  const parts = raw
    .split(/[\s,]+/)
    .map((part) => part.replace(/^#+/, "").trim().toLowerCase())
    .filter(Boolean);
  const out: string[] = [];
  for (const part of parts) {
    if (!/^[a-z0-9_]{1,40}$/.test(part)) continue;
    if (!out.includes(part)) out.push(part);
    if (out.length >= 30) break;
  }
  return out;
}

export function backoffMs(attemptNo: number): number {
  const n = Math.max(1, attemptNo);
  return Math.min(30_000 * 2 ** (n - 1), 6 * 60 * 60 * 1000);
}

export type ContentInput = {
  caption: string;
  hashtags: string;
  platforms: Platform[];
  mediaCount: number;
  hasVideo: boolean;
};

export function validateContent(input: ContentInput): string[] {
  const errors: string[] = [];
  const caption = input.caption.trim();
  if (caption.length > 5000) errors.push("Caption must be 5,000 characters or fewer.");
  if (input.platforms.length === 0) errors.push("Choose at least one destination.");
  const tags = normalizeHashtags(input.hashtags);
  if (input.hashtags.trim() && tags.length === 0) {
    errors.push("Hashtags can use letters, numbers, and underscores only.");
  }
  for (const platform of input.platforms) {
    if (platform === "instagram") {
      if (caption.length > 2200) errors.push("Instagram captions must be 2,200 characters or fewer.");
      if (input.mediaCount < 1) errors.push("Instagram feed posts need an image.");
    }
    if (platform === "linkedin" && caption.length > 3000) {
      errors.push("LinkedIn captions must be 3,000 characters or fewer.");
    }
    if (platform === "tiktok") {
      errors.push(
        "TikTok needs a video file. Video storage is not connected, so TikTok cannot be selected yet.",
      );
    }
    if ((platform === "facebook" || platform === "linkedin") && !caption && input.mediaCount < 1) {
      errors.push(`${PLATFORM_LABEL[platform]} needs a caption or an image.`);
    }
  }
  if (input.hasVideo) {
    errors.push("Video upload needs object storage, which is not connected.");
  }
  return [...new Set(errors)];
}

export function withinLimit(used: number, limit: number | null): boolean {
  if (limit === null) return true;
  return used < limit;
}

export const TIMEZONES = [
  "Asia/Karachi",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "UTC",
] as const;

export function safeTimezone(value: string): string {
  return (TIMEZONES as readonly string[]).includes(value) ? value : "Asia/Karachi";
}
