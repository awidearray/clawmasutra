import { z } from "zod";
import { AUTONOMY, CONNECTOR_APPS, GENDERS, LOOKING_FOR, SWIPE_DIRECTIONS } from "./config";
import { badRequest } from "./errors";

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(200);

export const photoSchema = z.object({
  url: z
    .string()
    .url()
    .refine((u) => u.startsWith("https://"), "Photo URLs must be https"),
  alt: z.string().max(200).optional(),
});

export const promptSchema = z.object({
  question: z.string().trim().min(2).max(120),
  answer: z.string().trim().min(2).max(500),
});

export const profileInput = z.object({
  displayName: z.string().trim().min(1).max(40).optional(),
  headline: z.string().trim().max(80).optional(),
  bio: z.string().trim().max(1200).optional(),
  gender: z.enum(GENDERS).optional(),
  seeking: z.array(z.enum(GENDERS)).min(1).max(4).optional(),
  city: z.string().trim().max(80).optional(),
  region: z.string().trim().max(80).optional(),
  country: z.string().trim().max(80).optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  photos: z.array(photoSchema).max(8).optional(),
  prompts: z.array(promptSchema).max(6).optional(),
  interests: z.array(z.string().trim().min(1).max(40)).max(24).optional(),
  lookingFor: z.enum(LOOKING_FOR).optional(),
  heightCm: z.number().int().min(120).max(230).nullable().optional(),
  occupation: z.string().trim().max(80).optional(),
  agentName: z.string().trim().max(40).optional(),
  agentStyle: z.string().trim().max(500).optional(),
  autonomySwipe: z.enum(AUTONOMY).optional(),
  autonomyMessage: z.enum(AUTONOMY).optional(),
  autonomyDate: z.enum(AUTONOMY).optional(),
  isPublished: z.boolean().optional(),
});

export const registerHumanInput = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1).max(40),
  age: z.number().int().min(18).max(99),
  ageConfirmed: z.literal(true),
});

export const loginInput = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const claimInput = z.object({
  token: z.string().min(8),
  email: emailSchema,
  password: passwordSchema,
});

export const agentRegisterInput = z.object({
  agentName: z.string().trim().min(1).max(40),
  agentStyle: z.string().trim().max(500).optional(),
  human: z.object({
    name: z.string().trim().min(1).max(40),
    age: z.number().int().min(18).max(99),
    email: emailSchema.optional(),
    gender: z.enum(GENDERS),
    seeking: z.array(z.enum(GENDERS)).min(1),
    city: z.string().trim().max(80).optional(),
    bio: z.string().trim().max(1200).optional(),
    interests: z.array(z.string().trim().min(1).max(40)).max(24).optional(),
    lookingFor: z.enum(LOOKING_FOR).optional(),
    photos: z.array(photoSchema).max(8).optional(),
    prompts: z.array(promptSchema).max(6).optional(),
  }),
});

export const pairInput = z.object({
  code: z.string().trim().min(8).max(12),
  agentName: z.string().trim().min(1).max(40),
});

export const swipeInput = z.object({
  targetId: z.string().min(4),
  direction: z.enum(SWIPE_DIRECTIONS),
  reason: z.string().trim().max(500).optional(),
});

export const messageInput = z.object({
  body: z.string().trim().min(1).max(4000),
});

export const dateInput = z.object({
  matchId: z.string().min(4),
  startsAt: z.iso.datetime(),
  timezone: z.string().trim().min(1).max(80).optional(),
  venue: z.string().trim().min(2).max(200),
  notes: z.string().trim().max(1000).optional(),
});

export const connectorEventInput = z.object({
  type: z.enum(["swipe", "match", "message_in", "message_out", "date", "error", "session"]),
  payload: z.record(z.string(), z.unknown()),
});

export const connectorToggleInput = z.object({
  app: z.enum(CONNECTOR_APPS),
  enabled: z.boolean(),
  notes: z.string().trim().max(500).optional(),
});

export function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path?.join(".") || "body";
    throw badRequest(`${path}: ${issue?.message || "invalid"}`, "validation_error");
  }
  return result.data;
}

export const CONTACT_LEAK =
  /(\+\d[\d\s.-]{7,}\d)|(\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b)|([\w.+-]+@[\w-]+\.[\w.-]+)|(instagram\.com\/\w+)|(t\.me\/\w+)|(wa\.me\/\w+)/i;

export function containsContact(text: string): boolean {
  return CONTACT_LEAK.test(text);
}
