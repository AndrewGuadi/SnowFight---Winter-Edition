import { Routes, Route } from "react-router";
import { AuthLayout } from "@/layouts/AuthLayout";
import { TRPCProvider } from "@/providers/trpc";
import { Toaster } from "@/components/ui/sonner";

import Home from "./pages/Home";
import Game from "./pages/Game";
import BattlePassPage from "./pages/BattlePassPage";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <TRPCProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game" element={<Game />} />
        <Route path="/battle-pass" element={<BattlePassPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </TRPCProvider>
  );
}
