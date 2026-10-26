import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { createRouter, publicQuery, authedQuery } from "../middleware";
import { getDb } from "../queries/connection";
import {
  battlePassSeasons,
  battlePassTiers,
  playerBattlePass,
  playerInventory,
} from "@db/schema";

export const battlePassRouter = createRouter({
  getActiveSeason: publicQuery.query(async () => {
    const db = getDb();
    const season = await db.query.battlePassSeasons.findFirst({
      where: eq(battlePassSeasons.isActive, true),
    });
    if (!season) return null;

    const tiers = await db.query.battlePassTiers.findMany({
      where: eq(battlePassTiers.seasonId, season.id),
      orderBy: (t, { asc }) => [asc(t.tierNumber)],
    });

    return { season, tiers };
  }),

  getMyProgress: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const season = await db.query.battlePassSeasons.findFirst({
      where: eq(battlePassSeasons.isActive, true),
    });
    if (!season) return null;

    let progress = await db.query.playerBattlePass.findFirst({
      where: and(
        eq(playerBattlePass.userId, ctx.user.id),
        eq(playerBattlePass.seasonId, season.id)
      ),
    });

    if (!progress) {
      const result = await db.insert(playerBattlePass).values({
        userId: ctx.user.id,
        seasonId: season.id,
        xp: 0,
        tier: 0,
        hasPremium: false,
      });
      progress = {
        id: Number(result[0].insertId),
        userId: ctx.user.id,
        seasonId: season.id,
        xp: 0,
        tier: 0,
        hasPremium: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    const tiers = await db.query.battlePassTiers.findMany({
      where: eq(battlePassTiers.seasonId, season.id),
      orderBy: (t, { asc }) => [asc(t.tierNumber)],
    });

    return { season, progress, tiers };
  }),

  claimReward: authedQuery
    .input(z.object({ tierNumber: z.number().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const season = await db.query.battlePassSeasons.findFirst({
        where: eq(battlePassSeasons.isActive, true),
      });
      if (!season) throw new Error("No active season");

      const progress = await db.query.playerBattlePass.findFirst({
        where: and(
          eq(playerBattlePass.userId, ctx.user.id),
          eq(playerBattlePass.seasonId, season.id)
        ),
      });
      if (!progress || progress.tier < input.tierNumber) {
        throw new Error("Tier not reached");
      }

      const tier = await db.query.battlePassTiers.findFirst({
        where: and(
          eq(battlePassTiers.seasonId, season.id),
          eq(battlePassTiers.tierNumber, input.tierNumber)
        ),
      });
      if (!tier) throw new Error("Tier not found");

      const rewards = [];
      if (tier.freeRewardType && tier.freeRewardValue) {
        rewards.push({ type: tier.freeRewardType, value: tier.freeRewardValue });
        await db.insert(playerInventory).values({
          userId: ctx.user.id,
          itemType: tier.freeRewardType,
          itemValue: tier.freeRewardValue,
          source: "battle_pass_free",
        });
      }
      if (progress.hasPremium && tier.premiumRewardType && tier.premiumRewardValue) {
        rewards.push({ type: tier.premiumRewardType, value: tier.premiumRewardValue });
        await db.insert(playerInventory).values({
          userId: ctx.user.id,
          itemType: tier.premiumRewardType,
          itemValue: tier.premiumRewardValue,
          source: "battle_pass_premium",
        });
      }

      return { success: true, rewards };
    }),

  addXp: authedQuery
    .input(z.object({ xp: z.number().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const season = await db.query.battlePassSeasons.findFirst({
        where: eq(battlePassSeasons.isActive, true),
      });
      if (!season) return { success: false };

      let progress = await db.query.playerBattlePass.findFirst({
        where: and(
          eq(playerBattlePass.userId, ctx.user.id),
          eq(playerBattlePass.seasonId, season.id)
        ),
      });

      if (!progress) {
        const result = await db.insert(playerBattlePass).values({
          userId: ctx.user.id,
          seasonId: season.id,
          xp: input.xp,
          tier: 0,
          hasPremium: false,
        });
        progress = {
          id: Number(result[0].insertId),
          userId: ctx.user.id,
          seasonId: season.id,
          xp: input.xp,
          tier: 0,
          hasPremium: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      } else {
        await db
          .update(playerBattlePass)
          .set({ xp: progress.xp + input.xp })
          .where(eq(playerBattlePass.id, progress.id));
        progress.xp += input.xp;
      }

      // Calculate tier
      const tiers = await db.query.battlePassTiers.findMany({
        where: eq(battlePassTiers.seasonId, season.id),
        orderBy: (t, { asc }) => [asc(t.tierNumber)],
      });

      let newTier = 0;
      for (const tier of tiers) {
        if (progress.xp >= tier.xpRequired) {
          newTier = tier.tierNumber;
        } else {
          break;
        }
      }

      if (newTier > progress.tier) {
        await db
          .update(playerBattlePass)
          .set({ tier: newTier })
          .where(eq(playerBattlePass.id, progress.id));
      }

      return { success: true, newTier, xp: progress.xp };
    }),
});
