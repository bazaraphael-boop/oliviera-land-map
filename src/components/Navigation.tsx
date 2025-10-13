import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const Navigation = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-hero">
              <MapPin className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Concession MJO</h1>
              <p className="text-xs text-muted-foreground">Muanda, RDC</p>
            </div>
          </Link>
          
          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm font-medium text-foreground hover:text-primary transition-smooth">
              Fonctionnalités
            </a>
            <a href="#map" className="text-sm font-medium text-foreground hover:text-primary transition-smooth">
              Carte
            </a>
            <a href="#about" className="text-sm font-medium text-foreground hover:text-primary transition-smooth">
              À propos
            </a>
          </div>

          <Link to="/login">
            <Button variant="hero" size="sm">
              Accéder au système
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
