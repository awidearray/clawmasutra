export const APP_NAME = "Clawmasutra";

export const CONNECTOR_APPS = ["hinge", "tinder", "bumble", "feeld", "okcupid"] as const;
export type ConnectorApp = (typeof CONNECTOR_APPS)[number];

export const GENDERS = ["woman", "man", "nonbinary", "other"] as const;
export type Gender = (typeof GENDERS)[number];

export const LOOKING_FOR = ["relationship", "dating", "friends", "figuring-out"] as const;
export type LookingFor = (typeof LOOKING_FOR)[number];

export const AUTONOMY = ["suggest", "guarded", "auto"] as const;
export type Autonomy = (typeof AUTONOMY)[number];

export const SWIPE_DIRECTIONS = ["like", "pass", "superlike"] as const;
export type SwipeDirection = (typeof SWIPE_DIRECTIONS)[number];

export const DAILY_LIKE_CAP = 100;
export const PAIRING_TTL_MS = 15 * 60 * 1000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE = "cms_session";

export function appUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return "http://localhost:3000";
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
