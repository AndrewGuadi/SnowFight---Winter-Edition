import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRouter, publicQuery, authedQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { playerProfiles, playerInventory, matchHistory } from "@db/schema";

export const playerRouter = createRouter({
  getProfile: publicQuery
    .input(z.object({ userId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = getDb();
      if (!input.userId) return null;
      const profile = await db.query.playerProfiles.findFirst({
        where: eq(playerProfiles.userId, input.userId),
      });
      return profile ?? null;
    }),

  getMyProfile: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const profile = await db.query.playerProfiles.findFirst({
      where: eq(playerProfiles.userId, ctx.user.id),
    });
    return profile ?? null;
  }),

  getInventory: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const items = await db.query.playerInventory.findMany({
      where: eq(playerInventory.userId, ctx.user.id),
    });
    return items;
  }),

  getMatchHistory: authedQuery
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const matches = await db.query.matchHistory.findMany({
        where: eq(matchHistory.userId, ctx.user.id),
        orderBy: (m, { desc }) => [desc(m.createdAt)],
        limit: input.limit,
      });
      return matches;
    }),

  updateDisplayName: authedQuery
    .input(z.object({ name: z.string().min(1).max(20) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .update(playerProfiles)
        .set({ displayName: input.name })
        .where(eq(playerProfiles.userId, ctx.user.id));
      return { success: true };
    }),

  addXp: authedQuery
    .input(z.object({ xp: z.number().min(0), coins: z.number().min(0).default(0) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const profile = await db.query.playerProfiles.findFirst({
        where: eq(playerProfiles.userId, ctx.user.id),
      });
      if (!profile) return { success: false };

      const newXp = profile.xp + input.xp;
      const newLevel = Math.floor(newXp / 1000) + 1;

      await db
        .update(playerProfiles)
        .set({ xp: newXp, level: newLevel, coins: profile.coins + input.coins })
        .where(eq(playerProfiles.userId, ctx.user.id));

      return { success: true, newXp, newLevel, coinsEarned: input.coins };
    }),
});
