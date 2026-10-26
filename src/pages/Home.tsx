import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Snowflake, Users, Trophy, Zap } from "lucide-react";

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/50 to-slate-900" />
        <div className="relative max-w-4xl mx-auto px-6 py-20 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Snowflake className="h-10 w-10 text-white" />
            </div>
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-400 mb-4">
            SNOWFIGHT
          </h1>
          <p className="text-xl text-slate-400 mb-8 font-medium">
            Winter Edition — Multiplayer Snowball Mayhem
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-blue-600 hover:bg-blue-500 text-white font-black text-lg px-8 py-6 rounded-xl shadow-lg shadow-blue-600/30 hover:scale-105 transition-transform"
              onClick={() => navigate("/game")}
            >
              <Zap className="h-5 w-5 mr-2" />
              PLAY NOW
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10 font-black text-lg px-8 py-6 rounded-xl"
              onClick={() => navigate("/battle-pass")}
            >
              <Trophy className="h-5 w-5 mr-2" />
              BATTLE PASS
            </Button>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-black text-center mb-12">FEATURES</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-4">
              <Users className="h-6 w-6 text-blue-400" />
            </div>
            <h3 className="text-xl font-bold mb-2">Multiplayer</h3>
            <p className="text-slate-400 text-sm">
              Battle with up to 60 players in real-time. Team up or go solo.
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center mb-4">
              <Zap className="h-6 w-6 text-cyan-400" />
            </div>
            <h3 className="text-xl font-bold mb-2">Fast Action</h3>
            <p className="text-slate-400 text-sm">
              Smooth 60fps gameplay with client-side prediction and interpolation.
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center mb-4">
              <Trophy className="h-6 w-6 text-yellow-400" />
            </div>
            <h3 className="text-xl font-bold mb-2">Battle Pass</h3>
            <p className="text-slate-400 text-sm">
              Earn XP, unlock tiers, and collect exclusive winter cosmetics.
            </p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="max-w-4xl mx-auto px-6 py-12 text-center">
        {user ? (
          <div className="space-y-4">
            <p className="text-slate-400">Welcome back, <span className="text-white font-bold">{user.name || "Player"}</span>!</p>
            <Button
              size="lg"
              className="bg-blue-600 hover:bg-blue-500 text-white font-black text-lg px-8 py-6 rounded-xl"
              onClick={() => navigate("/game")}
            >
              ENTER THE ARENA
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-slate-400">Log in to track your stats and unlock rewards.</p>
            <Button
              size="lg"
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10 font-black text-lg px-8 py-6 rounded-xl"
              onClick={() => window.location.href = "/api/oauth/authorize"}
            >
              LOG IN
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
