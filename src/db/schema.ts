import {
    pgTable,
    uuid,
    text,
    timestamp,
    boolean,
    integer,
    numeric,
    pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ── Enums ──────────────────────────────────────────────────────────────────

export const providerTypeEnum = pgEnum("provider_type", [
    "openai",
    "google",
    "anthropic",
    "oauth",
    "custom",
]);

export const authTypeEnum = pgEnum("auth_type", [
    "bearer",
    "header",
    "oauth",
    "none",
]);

// ── Providers ──────────────────────────────────────────────────────────────

export const providers = pgTable("providers", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    type: providerTypeEnum("type").notNull(),
    baseUrl: text("base_url").notNull(),
    authType: authTypeEnum("auth_type").notNull().default("bearer"),
    encryptedCredentials: text("encrypted_credentials"),
    timeout: integer("timeout").notNull().default(30000),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Models ─────────────────────────────────────────────────────────────────

export const models = pgTable("models", {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
        .notNull()
        .references(() => providers.id, { onDelete: "cascade" }),
    publicName: text("public_name").notNull(),
    upstreamModelName: text("upstream_model_name").notNull(),
    supportsStreaming: boolean("supports_streaming").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    priority: integer("priority").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── API Keys ───────────────────────────────────────────────────────────────

export const apiKeys = pgTable("api_keys", {
    id: uuid("id").primaryKey().defaultRandom(),
    label: text("label").notNull().default(""),
    keyHash: text("key_hash").notNull().unique(),
    keyPrefix: text("key_prefix").notNull().default(""),
    rateLimit: integer("rate_limit").notNull().default(60),
    quotaLimit: integer("quota_limit"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── OAuth Accounts ─────────────────────────────────────────────────────────

export const oauthAccounts = pgTable("oauth_accounts", {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
        .notNull()
        .references(() => providers.id, { onDelete: "cascade" }),
    encryptedAccessToken: text("encrypted_access_token").notNull(),
    encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    email: text("email"),
    healthScore: integer("health_score").notNull().default(70),
    lastUsedAt: timestamp("last_used_at"),
    metadata: text("metadata"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Usage Logs ─────────────────────────────────────────────────────────────

export const usageLogs = pgTable("usage_logs", {
    id: uuid("id").primaryKey().defaultRandom(),
    apiKeyId: uuid("api_key_id").references(() => apiKeys.id, {
        onDelete: "set null",
    }),
    providerId: uuid("provider_id").references(() => providers.id, {
        onDelete: "set null",
    }),
    modelId: uuid("model_id").references(() => models.id, {
        onDelete: "set null",
    }),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cost: numeric("cost", { precision: 12, scale: 6 }).notNull().default("0"),
    latency: integer("latency").notNull().default(0),
    statusCode: integer("status_code"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Admin Users ────────────────────────────────────────────────────────────

export const adminUsers = pgTable("admin_users", {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull().default(""),
    role: text("role").notNull().default("admin"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Admin Sessions ─────────────────────────────────────────────────────────

export const adminSessions = pgTable("admin_sessions", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
        .notNull()
        .references(() => adminUsers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Relations ──────────────────────────────────────────────────────────────

export const providersRelations = relations(providers, ({ many }) => ({
    models: many(models),
    oauthAccounts: many(oauthAccounts),
}));

export const modelsRelations = relations(models, ({ one }) => ({
    provider: one(providers, {
        fields: [models.providerId],
        references: [providers.id],
    }),
}));

export const oauthAccountsRelations = relations(oauthAccounts, ({ one }) => ({
    provider: one(providers, {
        fields: [oauthAccounts.providerId],
        references: [providers.id],
    }),
}));

export const adminSessionsRelations = relations(adminSessions, ({ one }) => ({
    user: one(adminUsers, {
        fields: [adminSessions.userId],
        references: [adminUsers.id],
    }),
}));
