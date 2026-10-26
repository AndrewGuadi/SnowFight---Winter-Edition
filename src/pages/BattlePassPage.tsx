import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Lock, Gift, Crown, Loader2 } from "lucide-react";
import { useState } from "react";

export default function BattlePassPage() {
  const { user } = useAuth();
  const { data, isLoading } = trpc.battlePass.getMyProgress.useQuery(undefined, {
    enabled: !!user,
  });
  const claimMutation = trpc.battlePass.claimReward.useMutation();
  const utils = trpc.useUtils();

  const [claimingTier, setClaimingTier] = useState<number | null>(null);

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-4">Battle Pass</h1>
          <p className="text-slate-400">Please log in to view your battle pass progress.</p>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const { progress, tiers } = data;
  const currentTier = progress.tier;
  const nextTier = tiers.find((t) => t.tierNumber === currentTier + 1);
  const xpIntoTier = nextTier ? progress.xp - (tiers.find((t) => t.tierNumber === currentTier)?.xpRequired ?? 0) : 0;
  const xpForNext = nextTier ? nextTier.xpRequired - (tiers.find((t) => t.tierNumber === currentTier)?.xpRequired ?? 0) : 1;
  const xpProgress = nextTier ? Math.min(100, Math.round((xpIntoTier / xpForNext) * 100)) : 100;

  const handleClaim = async (tierNumber: number) => {
    setClaimingTier(tierNumber);
    try {
      await claimMutation.mutateAsync({ tierNumber });
      utils.battlePass.getMyProgress.invalidate();
    } catch (e) {
      console.error(e);
    } finally {
      setClaimingTier(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 mb-2">
            WINTER BATTLE PASS
          </h1>
          <p className="text-slate-400 text-sm">Season 1 • Ends in 45 days</p>
        </div>

        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-3xl font-black">Tier {currentTier}</div>
              <div className="text-sm text-slate-400">{progress.xp.toLocaleString()} XP total</div>
            </div>
            <div className="text-right">
              {progress.hasPremium ? (
                <div className="flex items-center gap-1 text-yellow-400">
                  <Crown className="h-5 w-5" />
                  <span className="font-bold">Premium</span>
                </div>
              ) : (
                <div>
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold"
                    onClick={() => alert("Coming soon! Stripe integration in progress.")}
                  >
                    <Crown className="h-4 w-4 mr-1" />
                    Upgrade $4.99
                  </Button>
                </div>
              )}
            </div>
          </div>

          {nextTier && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-bold">
                <span className="text-slate-400">Next Tier</span>
                <span className="text-slate-400">{xpIntoTier} / {xpForNext} XP</span>
              </div>
              <Progress value={xpProgress} className="h-3 bg-white/10" />
            </div>
          )}
        </div>

        <div className="space-y-3">
          {tiers.map((tier) => {
            const isUnlocked = tier.tierNumber <= currentTier;
            const canClaimFree = isUnlocked && !progress.claimedFree?.includes(tier.tierNumber);
            const canClaimPremium = progress.hasPremium && isUnlocked && !progress.claimedPremium?.includes(tier.tierNumber);

            return (
              <div
                key={tier.tierNumber}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                  isUnlocked
                    ? "bg-white/10 border-white/20"
                    : "bg-white/5 border-white/5 opacity-50"
                }`}
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center font-black text-lg">
                  {tier.tierNumber}
                </div>

                <div className="flex-1">
                  <div className="text-xs font-bold text-slate-400 mb-1">
                    {tier.xpRequired.toLocaleString()} XP
                  </div>
                  <div className="flex gap-4">
                    {/* Free reward */}
                    <div className="flex items-center gap-2">
                      {canClaimFree ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-400 border-green-400/50 hover:bg-green-400/10"
                          onClick={() => handleClaim(tier.tierNumber)}
                          disabled={claimingTier === tier.tierNumber}
                        >
                          {claimingTier === tier.tierNumber ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Gift className="h-4 w-4 mr-1" />
                          )}
                          Free
                        </Button>
                      ) : (
                        <div className="flex items-center gap-1 text-sm text-slate-500">
                          <Gift className="h-4 w-4" />
                          <span>{tier.freeRewardType || "—"}</span>
                        </div>
                      )}
                    </div>

                    {/* Premium reward */}
                    <div className="flex items-center gap-2">
                      {canClaimPremium ? (
                        <Button
                          size="sm"
                          className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold"
                          onClick={() => handleClaim(tier.tierNumber)}
                          disabled={claimingTier === tier.tierNumber}
                        >
                          {claimingTier === tier.tierNumber ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Crown className="h-4 w-4 mr-1" />
                          )}
                          Premium
                        </Button>
                      ) : (
                        <div className="flex items-center gap-1 text-sm text-slate-500">
                          <Lock className="h-4 w-4" />
                          <span>{tier.premiumRewardType || "—"}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
