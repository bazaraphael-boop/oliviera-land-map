import { Card } from "@/components/ui/card";
import { Map, Database, FileCheck, Bell, Shield, TrendingUp } from "lucide-react";

const features = [
  {
    icon: Map,
    title: "Cartographie Interactive",
    description: "Visualisez et délimitez les parcelles directement sur la carte de Muanda avec des outils de dessin avancés.",
    color: "text-primary"
  },
  {
    icon: Database,
    title: "Base de Données Cadastrale",
    description: "Enregistrement complet des parcelles avec coordonnées GPS, titres, propriétaires et historiques.",
    color: "text-secondary"
  },
  {
    icon: FileCheck,
    title: "Gestion Documentaire",
    description: "Archivage numérique de tous les documents : titres de propriété, plans cadastraux, actes de cession.",
    color: "text-accent"
  },
  {
    icon: Bell,
    title: "Notifications Automatiques",
    description: "Alertes pour les échéances, paiements et changements de statut administratif.",
    color: "text-primary"
  },
  {
    icon: Shield,
    title: "Sécurité Renforcée",
    description: "Authentification à deux facteurs et gestion fine des permissions selon les rôles utilisateurs.",
    color: "text-secondary"
  },
  {
    icon: TrendingUp,
    title: "Rapports & Analytics",
    description: "Génération de rapports détaillés et export des données dans différents formats (PDF, Excel, GeoJSON).",
    color: "text-accent"
  }
];

const Features = () => {
  return (
    <section id="features" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Fonctionnalités Principales
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Une solution complète pour la gestion moderne des terrains et la traçabilité cadastrale
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card 
                key={index}
                className="p-6 bg-card hover:shadow-card transition-smooth border border-border animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className={`w-12 h-12 rounded-lg bg-gradient-hero flex items-center justify-center mb-4`}>
                  <Icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-bold text-card-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground">
                  {feature.description}
                </p>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Features;
