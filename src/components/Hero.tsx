import { Button } from "@/components/ui/button";
import { MapPin, Database, FileText } from "lucide-react";
import heroImage from "@/assets/hero-land.jpg";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src={heroImage} 
          alt="Vue aérienne des parcelles de terrain à Muanda"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/85 to-background/70" />
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-20 relative z-10">
        <div className="max-w-3xl animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <MapPin className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Système de Gestion Cadastrale</span>
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-tight">
            Concession Manuel Joaquim d'Olivera
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 leading-relaxed">
            Gestion moderne et interactive des terrains à Muanda. Visualisation cartographique, 
            suivi administratif et documentation complète en temps réel.
          </p>

          <div className="flex flex-wrap gap-4 mb-12">
            <Button variant="hero" size="lg">
              Explorer les terrains
            </Button>
            <Button variant="outline" size="lg">
              Documentation
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 pt-8 border-t border-border">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-5 h-5 text-primary" />
                <h3 className="text-2xl font-bold text-foreground">500+</h3>
              </div>
              <p className="text-sm text-muted-foreground">Parcelles enregistrées</p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-5 h-5 text-secondary" />
                <h3 className="text-2xl font-bold text-foreground">2000+</h3>
              </div>
              <p className="text-sm text-muted-foreground">Hectares gérés</p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-accent" />
                <h3 className="text-2xl font-bold text-foreground">100%</h3>
              </div>
              <p className="text-sm text-muted-foreground">Traçabilité</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
