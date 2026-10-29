import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { MapPin, Lock, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Login = () => {
  const navigate = useNavigate();
  
  // États pour la connexion
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (error) {
        toast.error("Erreur de connexion", {
          description: error.message,
        });
        return;
      }

      if (data.user) {
        toast.success("Connexion réussie !", {
          description: `Bienvenue ${loginEmail}`,
        });
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Une erreur est survenue lors de la connexion");
    } finally {
      setIsLoggingIn(false);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-background shadow-elegant mb-4">
            <MapPin className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-primary-foreground mb-2">
            Concession MJO
          </h1>
          <p className="text-primary-foreground/80">
            Système de Gestion Cadastrale
          </p>
        </div>

        <Card className="p-8 shadow-elegant">
          {/* Connexion uniquement : les comptes sont créés par un administrateur */}
          <h2 className="text-2xl font-bold text-center mb-6 text-foreground">
            Connexion
          </h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email" className="text-foreground">
                Adresse email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  id="login-email"
                  type="email"
                  placeholder="votre.email@exemple.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-password" className="text-foreground">
                Mot de passe
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <Button type="submit" variant="hero" className="w-full" size="lg" disabled={isLoggingIn}>
              {isLoggingIn ? "Connexion..." : "Se connecter"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link 
              to="/" 
              className="text-sm text-muted-foreground hover:text-primary transition-smooth"
            >
              ← Retour à l'accueil
            </Link>
          </div>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground text-center">
              Besoin d'aide ?{" "}
              <a href="#" className="text-primary font-medium hover:underline">
                Contactez l'administration
              </a>
            </p>
          </div>
        </Card>

        <p className="text-center mt-6 text-sm text-primary-foreground/60">
          Système sécurisé - Tous droits réservés © 2025
        </p>
      </div>
    </div>
  );
};

export default Login;
