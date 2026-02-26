import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, useNavigate } from "react-router-dom";
import { ReactNode, useEffect, useState } from "react";
import { getSettings } from "@/lib/storage";

import Setup from "./pages/Setup";
import Home from "./pages/Home";
import Library from "./pages/Library";
import Memories from "./pages/Memories";
import Resources from "./pages/Resources";
import Learn from "./pages/Learn";
import Shadowing from "./pages/Shadowing";
import Srs from "./pages/Srs";
import Stats from "./pages/Stats";
import Settings from "./pages/Settings";
import SettingsMemo from "./pages/SettingsMemo";
import NotFound from "./pages/NotFound";

function RootRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    const settings = getSettings();
    navigate(settings.setupComplete ? "/home" : "/setup", { replace: true });
  }, [navigate]);

  return null;
}

function AppRouter() {
  // Apply dark mode on mount
  useEffect(() => {
    const settings = getSettings();
    document.documentElement.classList.toggle("dark", settings.darkMode);
  }, []);

  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="/home" element={<Home />} />
      <Route path="/library" element={<Library />} />
      <Route path="/memories" element={<Memories />} />
      <Route path="/resources" element={<Resources />} />
      <Route path="/learn/:clipId" element={<Learn />} />
      <Route path="/shadowing/:clipId" element={<Shadowing />} />
      <Route path="/srs" element={<Srs />} />
      <Route path="/stats" element={<Stats />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/settings/memo" element={<SettingsMemo />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {children}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

const App = () => (
  <AppProviders>
    <AppRouter />
  </AppProviders>
);

export default App;
