import { Button } from "@/components/ui/button";
import { MapPin, Search, Layers } from "lucide-react";
import { Link } from "react-router-dom";
import mapImage from "@/assets/map-feature.jpg";

const MapPreview = () => {
  return (
    <section id="map" className="py-20">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-fade-in">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
              Interface Cartographique Puissante
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Accédez à une vue complète de tous les terrains de la concession. 
              Dessinez, modifiez et consultez les parcelles en temps réel avec des informations détaillées.
            </p>

            <div className="space-y-4 mb-8">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Search className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Recherche Avancée</h3>
                  <p className="text-muted-foreground">
                    Trouvez rapidement une parcelle par numéro, localisation ou nom du propriétaire
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
                  <Layers className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Couches Multiples</h3>
                  <p className="text-muted-foreground">
                    Affichez différentes informations : limites, statuts, propriétaires, infrastructures
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Délimitation Interactive</h3>
                  <p className="text-muted-foreground">
                    Dessinez et modifiez les parcelles directement sur la carte avec précision GPS
                  </p>
                </div>
              </div>
            </div>

            <Link to="/login">
              <Button variant="hero" size="lg">
                Voir la carte complète
              </Button>
            </Link>
          </div>

          <div className="relative animate-fade-in" style={{ animationDelay: '200ms' }}>
            <div className="relative rounded-2xl overflow-hidden shadow-elegant border border-border">
              <img 
                src={mapImage} 
                alt="Interface de la carte interactive du système cadastral"
                className="w-full h-auto"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
              
              {/* Floating Info Card */}
              <div className="absolute bottom-6 left-6 right-6 bg-card/95 backdrop-blur-md border border-border rounded-lg p-4 shadow-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-card-foreground">Parcelle #MJO-2024-001</span>
                  <span className="text-xs px-2 py-1 rounded-full bg-secondary/20 text-secondary font-medium">
                    Disponible
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">Superficie: 2,5 hectares</p>
                <p className="text-xs text-muted-foreground">Quartier: Centre-ville, Muanda</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MapPreview;
