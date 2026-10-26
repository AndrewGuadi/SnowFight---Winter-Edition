import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRouter, authedQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { stripeCustomers, stripePurchases, playerBattlePass, battlePassSeasons } from "@db/schema";
import { TRPCError } from "@trpc/server";

// Stripe is loaded lazily to avoid errors if STRIPE_SECRET_KEY is not set
async function getStripe() {
  const { default: Stripe } = await import("stripe");
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe not configured" });
  return new Stripe(key, { apiVersion: "2026-09-30.endive" });
}

export const stripeRouter = createRouter({
  createCheckoutSession: authedQuery
    .input(
      z.object({
        productType: z.enum(["battle_pass", "coins"]),
        productId: z.string(),
        successUrl: z.string().url(),
        cancelUrl: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const stripe = await getStripe();

      // Get or create Stripe customer
      let customer = await db.query.stripeCustomers.findFirst({
        where: eq(stripeCustomers.userId, ctx.user.id),
      });

      if (!customer) {
        const stripeCustomer = await stripe.customers.create({
          email: ctx.user.email ?? undefined,
          name: ctx.user.name ?? undefined,
          metadata: { userId: String(ctx.user.id) },
        });
        const result = await db.insert(stripeCustomers).values({
          userId: ctx.user.id,
          stripeCustomerId: stripeCustomer.id,
        });
        customer = {
          id: Number(result[0].insertId),
          userId: ctx.user.id,
          stripeCustomerId: stripeCustomer.id,
          createdAt: new Date(),
        };
      }

      // Determine price based on product
      let priceCents = 499; // default battle pass
      if (input.productType === "coins") {
        const coinPacks: Record<string, number> = {
          "coins_100": 99,
          "coins_500": 399,
          "coins_1000": 699,
        };
        priceCents = coinPacks[input.productId] ?? 99;
      }

      const session = await stripe.checkout.sessions.create({
        customer: customer.stripeCustomerId,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name:
                  input.productType === "battle_pass"
                    ? "Battle Pass"
                    : "Coin Pack",
                description: input.productId,
              },
              unit_amount: priceCents,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: {
          userId: String(ctx.user.id),
          productType: input.productType,
          productId: input.productId,
        },
      });

      // Record pending purchase
      await db.insert(stripePurchases).values({
        userId: ctx.user.id,
        stripePaymentIntentId: session.payment_intent as string,
        amount: priceCents,
        currency: "usd",
        status: "pending",
        productType: input.productType,
        productId: input.productId,
        metadata: JSON.stringify({ sessionId: session.id }),
      });

      return { sessionId: session.id, url: session.url };
    }),

  getPurchaseHistory: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const purchases = await db.query.stripePurchases.findMany({
      where: eq(stripePurchases.userId, ctx.user.id),
      orderBy: (p, { desc }) => [desc(p.createdAt)],
    });
    return purchases;
  }),
});

// Webhook handler (not tRPC — used directly in Hono route)
export async function handleStripeWebhook(body: string, signature: string) {
  const stripe = await getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error("Missing STRIPE_WEBHOOK_SECRET");

  const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    const { userId, productType, productId } = session.metadata;

    const db = getDb();

    // Update purchase status
    await db
      .update(stripePurchases)
      .set({ status: "completed" })
      .where(eq(stripePurchases.stripePaymentIntentId, session.payment_intent));

    // Fulfill the purchase
    if (productType === "battle_pass") {
      const season = await db.query.battlePassSeasons.findFirst({
        where: eq(battlePassSeasons.isActive, true),
      });
      if (season) {
        const existing = await db.query.playerBattlePass.findFirst({
          where: eq(playerBattlePass.userId, Number(userId)),
        });
        if (existing) {
          await db
            .update(playerBattlePass)
            .set({ hasPremium: true })
            .where(eq(playerBattlePass.id, existing.id));
        } else {
          await db.insert(playerBattlePass).values({
            userId: Number(userId),
            seasonId: season.id,
            xp: 0,
            tier: 0,
            hasPremium: true,
          });
        }
      }
    } else if (productType === "coins") {
      const coinAmounts: Record<string, number> = {
        "coins_100": 100,
        "coins_500": 500,
        "coins_1000": 1000,
      };
      const amount = coinAmounts[productId] ?? 100;
      const { playerProfiles } = await import("@db/schema");
      const profile = await db.query.playerProfiles.findFirst({
        where: eq(playerProfiles.userId, Number(userId)),
      });
      if (profile) {
        await db
          .update(playerProfiles)
          .set({ coins: profile.coins + amount })
          .where(eq(playerProfiles.userId, Number(userId)));
      }
    }
  }

  return { received: true };
}
