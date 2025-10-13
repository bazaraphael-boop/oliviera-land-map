import { MapPin, Mail, Phone } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-muted/50 border-t border-border py-12">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-hero">
                <MapPin className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Concession MJO</h3>
                <p className="text-xs text-muted-foreground">Muanda, RDC</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Système moderne de gestion cadastrale pour la Concession Manuel Joaquim d'Olivera
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">Contact</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-primary" />
                <span className="text-sm text-muted-foreground">contact@concession-mjo.cd</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-primary" />
                <span className="text-sm text-muted-foreground">+243 XX XXX XXXX</span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="text-sm text-muted-foreground">Muanda, Province du Kongo Central</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">Liens Rapides</h4>
            <div className="space-y-2">
              <a href="#features" className="block text-sm text-muted-foreground hover:text-primary transition-smooth">
                Fonctionnalités
              </a>
              <a href="#map" className="block text-sm text-muted-foreground hover:text-primary transition-smooth">
                Carte Interactive
              </a>
              <a href="#about" className="block text-sm text-muted-foreground hover:text-primary transition-smooth">
                À Propos
              </a>
              <a href="#" className="block text-sm text-muted-foreground hover:text-primary transition-smooth">
                Documentation
              </a>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-border text-center">
          <p className="text-sm text-muted-foreground">
            © 2025 Concession Manuel Joaquim d'Olivera. Tous droits réservés.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
