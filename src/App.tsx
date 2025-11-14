import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Hectares from "./pages/Hectares";
import Parcelles from "./pages/Parcelles";
import Acheteurs from "./pages/Acheteurs";
import Localisation from "./pages/Localisation";
import Rapports from "./pages/Rapports";
import Parametres from "./pages/Parametres";
import Utilisateurs from "./pages/Utilisateurs";
import Documents from "./pages/Documents";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <Sonner />
        <Toaster />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
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
  </QueryClientProvider>
);

export default App;
