import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { Loader2 } from "lucide-react";

// Lazy loading des routes pour un démarrage et une navigation ultra-rapides
const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Sites = lazy(() => import("./pages/Sites"));
const Hectares = lazy(() => import("./pages/Hectares"));
const Parcelles = lazy(() => import("./pages/Parcelles"));
const Acheteurs = lazy(() => import("./pages/Acheteurs"));
const Localisation = lazy(() => import("./pages/Localisation"));
const Rapports = lazy(() => import("./pages/Rapports"));
const Parametres = lazy(() => import("./pages/Parametres"));
const Utilisateurs = lazy(() => import("./pages/Utilisateurs"));
const Documents = lazy(() => import("./pages/Documents"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Composant de chargement fluide et léger
const PageLoader = () => (
  <div className="flex min-h-[60vh] items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <span className="text-xs text-muted-foreground font-medium">Chargement...</span>
    </div>
  </div>
);

// Configuration optimale de React Query pour réduire la charge réseau et les re-renders
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // Données fraîches pendant 5 minutes
      gcTime: 1000 * 60 * 15, // Mise en cache mémoire pendant 15 minutes
      refetchOnWindowFocus: false, // Évite de recharger l'ensemble des données quand on change d'onglet
      retry: 1,
    },
  },
});

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <NotificationProvider>
        <TooltipProvider>
          <BrowserRouter>
            <Sonner />
            <Toaster />
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/sites" element={<Sites />} />
                <Route path="/hectares" element={<Hectares />} />
                <Route path="/parcelles" element={<Parcelles />} />
                <Route path="/acheteurs" element={<Acheteurs />} />
                <Route path="/localisation" element={<Localisation />} />
                <Route path="/rapports" element={<Rapports />} />
                <Route path="/parametres" element={<Parametres />} />
                <Route path="/utilisateurs" element={<Utilisateurs />} />
                <Route path="/documents" element={<Documents />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </NotificationProvider>
    </QueryClientProvider>
  );
};

export default App;
