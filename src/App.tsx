import React, { Component, ErrorInfo, ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Sites from "./pages/Sites";
import Hectares from "./pages/Hectares";
import Parcelles from "./pages/Parcelles";
import Acheteurs from "./pages/Acheteurs";
import Localisation from "./pages/Localisation";
import Rapports from "./pages/Rapports";
import Parametres from "./pages/Parametres";
import Utilisateurs from "./pages/Utilisateurs";
import Documents from "./pages/Documents";
import NotFound from "./pages/NotFound";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in React tree:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full p-6 rounded-xl border border-destructive/30 bg-destructive/5 text-center space-y-4 shadow-lg">
            <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Une erreur inattendue est survenue</h2>
            <p className="text-xs text-muted-foreground break-words font-mono bg-background/50 p-2.5 rounded border border-border">
              {this.state.error?.message || "Erreur de chargement"}
            </p>
            <div className="pt-2 flex justify-center gap-2">
              <Button
                variant="default"
                size="sm"
                className="gap-2"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="w-3.5 h-3.5" /> Recharger la page
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

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
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <NotificationProvider>
          <TooltipProvider>
            <BrowserRouter>
              <Sonner />
              <Toaster />
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
            </BrowserRouter>
          </TooltipProvider>
        </NotificationProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
