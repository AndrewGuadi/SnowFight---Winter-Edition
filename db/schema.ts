import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  int,
  boolean,
  bigint,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const playerProfiles = mysqlTable("player_profiles", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  displayName: varchar("displayName", { length: 255 }),
  coins: int("coins").default(0).notNull(),
  xp: int("xp").default(0).notNull(),
  level: int("level").default(1).notNull(),
  totalMatches: int("totalMatches").default(0).notNull(),
  wins: int("wins").default(0).notNull(),
  kills: int("kills").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const battlePassSeasons = mysqlTable("battle_pass_seasons", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  price: int("price").default(499).notNull(), // cents (e.g. $4.99 = 499)
  isActive: boolean("isActive").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const battlePassTiers = mysqlTable("battle_pass_tiers", {
  id: serial("id").primaryKey(),
  seasonId: bigint("seasonId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => battlePassSeasons.id, { onDelete: "cascade" }),
  tierNumber: int("tierNumber").notNull(),
  xpRequired: int("xpRequired").notNull(),
  freeRewardType: varchar("freeRewardType", { length: 50 }), // "coins", "hat", "coat", "trail"
  freeRewardValue: varchar("freeRewardValue", { length: 255 }),
  premiumRewardType: varchar("premiumRewardType", { length: 50 }),
  premiumRewardValue: varchar("premiumRewardValue", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const playerBattlePass = mysqlTable("player_battle_pass", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  seasonId: bigint("seasonId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => battlePassSeasons.id, { onDelete: "cascade" }),
  xp: int("xp").default(0).notNull(),
  tier: int("tier").default(0).notNull(),
  hasPremium: boolean("hasPremium").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const playerInventory = mysqlTable("player_inventory", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  itemType: varchar("itemType", { length: 50 }).notNull(), // "hat", "coat", "trail", "emote"
  itemValue: varchar("itemValue", { length: 255 }).notNull(),
  source: varchar("source", { length: 50 }).default("battle_pass").notNull(),
  unlockedAt: timestamp("unlockedAt").defaultNow().notNull(),
});

export const matchHistory = mysqlTable("match_history", {
  id: serial("id").primaryKey(),
  matchId: varchar("matchId", { length: 255 }).notNull(),
  userId: bigint("userId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  mode: varchar("mode", { length: 50 }).notNull(), // "single", "multi"
  team: varchar("team", { length: 10 }).notNull(), // "blue", "red"
  result: varchar("result", { length: 20 }).notNull(), // "win", "loss", "draw"
  kills: int("kills").default(0).notNull(),
  deaths: int("deaths").default(0).notNull(),
  matchDuration: int("matchDuration").default(0).notNull(), // seconds
  xpEarned: int("xpEarned").default(0).notNull(),
  coinsEarned: int("coinsEarned").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const stripeCustomers = mysqlTable("stripe_customers", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const stripePurchases = mysqlTable("stripe_purchases", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }).notNull().unique(),
  amount: int("amount").notNull(), // cents
  currency: varchar("currency", { length: 10 }).default("usd").notNull(),
  status: varchar("status", { length: 50 }).notNull(), // "pending", "completed", "failed"
  productType: varchar("productType", { length: 50 }).notNull(), // "battle_pass", "coins"
  productId: varchar("productId", { length: 255 }).notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PlayerProfile = typeof playerProfiles.$inferSelect;
export type BattlePassSeason = typeof battlePassSeasons.$inferSelect;
export type BattlePassTier = typeof battlePassTiers.$inferSelect;
export type PlayerBattlePass = typeof playerBattlePass.$inferSelect;
export type PlayerInventory = typeof playerInventory.$inferSelect;
export type MatchHistory = typeof matchHistory.$inferSelect;
export type StripeCustomer = typeof stripeCustomers.$inferSelect;
export type StripePurchase = typeof stripePurchases.$inferSelect;
