import { authRouter } from "./auth-router";
import { playerRouter } from "./routers/player";
import { battlePassRouter } from "./routers/battle-pass";
import { stripeRouter } from "./routers/stripe";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  player: playerRouter,
  battlePass: battlePassRouter,
  stripe: stripeRouter,
});

export type AppRouter = typeof appRouter;
