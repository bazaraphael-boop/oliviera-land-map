import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MonitorDown,
  CheckCircle2,
  Share,
  PlusSquare,
  MoreVertical,
  Laptop,
  Smartphone,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { usePwaInstall } from "@/hooks/usePwaInstall";

interface InstallAppModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InstallAppModal({ open, onOpenChange }: InstallAppModalProps) {
  const { canInstallDirectly, isInstalled, isIOS, isAndroid, isWindows, isMac, triggerInstall } =
    usePwaInstall();
  const [installing, setInstalling] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleInstallClick = async () => {
    setInstalling(true);
    const result = await triggerInstall();
    setInstalling(false);
    if (result === "accepted") {
      setSuccess(true);
      setTimeout(() => {
        onOpenChange(false);
        setSuccess(false);
      }, 2500);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden bg-card border-border">
        {/* Top Header Card */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 p-6 text-white border-b border-white/10">
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <img
                src="/icon-192.png"
                alt="Concession MJO"
                className="w-16 h-16 rounded-2xl shadow-xl border border-white/20 bg-slate-900"
              />
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white font-bold ring-2 ring-slate-900">
                ✓
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                  <Sparkles className="w-3 h-3 mr-1 text-emerald-400" />
                  Application Bureau & Mobile
                </Badge>
                {isInstalled && (
                  <Badge className="text-[10px] bg-emerald-500 text-white font-semibold">
                    Déjà installée
                  </Badge>
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white mt-1 leading-snug">
                Concession Manuel Joaquim d'Oliveira
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Accès direct 1-clic depuis votre bureau ou écran d'accueil
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Action principale : 1-clic direct si le navigateur le permet */}
          {canInstallDirectly && !isInstalled && !success && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3">
              <p className="text-sm text-foreground font-medium">
                Votre navigateur est prêt ! Vous pouvez ajouter l'application en un clic :
              </p>
              <Button
                size="lg"
                onClick={handleInstallClick}
                disabled={installing}
                className="w-full h-12 gap-2 text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20"
              >
                <MonitorDown className="w-5 h-5" />
                {installing ? "Installation en cours..." : "Ajouter sur le bureau maintenant"}
              </Button>
            </div>
          )}

          {success && (
            <div className="p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="text-sm font-bold text-foreground">
                Application ajoutée avec succès sur votre bureau !
              </p>
              <p className="text-xs text-muted-foreground">
                Vous pouvez maintenant la lancer directement depuis votre bureau.
              </p>
            </div>
          )}

          {isInstalled && !success && (
            <div className="p-4 rounded-xl bg-muted/60 border border-border text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="text-sm font-bold text-foreground">
                L'application est déjà installée sur cet appareil
              </p>
              <p className="text-xs text-muted-foreground">
                Vous la retrouverez sur votre bureau ou dans vos applications.
              </p>
            </div>
          )}

          {/* Guide d'installation pas-à-pas selon la plateforme */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              {isIOS || isAndroid ? (
                <Smartphone className="w-3.5 h-3.5 text-primary" />
              ) : (
                <Laptop className="w-3.5 h-3.5 text-primary" />
              )}
              Instructions détaillées d'installation
            </h3>

            {/* Cas Windows / Mac PC */}
            {!isIOS && !isAndroid && (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="text-xs space-y-1">
                    <p className="font-semibold text-foreground">
                      Depuis Google Chrome ou Microsoft Edge :
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                      Repérez l'icône <MonitorDown className="inline w-3.5 h-3.5 text-primary mx-0.5" />{" "}
                      <strong>Installer l'application</strong> située tout à droite de votre barre d'adresse URL en haut.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="text-xs space-y-1">
                    <p className="font-semibold text-foreground">
                      Ou via le menu du navigateur :
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                      Cliquez sur le menu <MoreVertical className="inline w-3.5 h-3.5 text-foreground mx-0.5" />{" "}
                      (les 3 points en haut à droite) &gt; choisissez{" "}
                      <span className="font-semibold text-foreground">"Installer Concession Manuel Joaquim..."</span>{" "}
                      ou <span className="font-semibold text-foreground">"Enregistrer et partager" &gt; "Créer un raccourci..."</span> (en cochant <em>Ouvrir dans une nouvelle fenêtre</em>).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-600 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="text-xs space-y-1">
                    <p className="font-semibold text-foreground">
                      Raccourci bureau créé :
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                      L'icône <strong className="text-foreground">Concession MJO</strong> apparaît immédiatement sur votre bureau Windows/Mac. Un simple double-clic l'ouvre en plein écran comme un logiciel classique !
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Cas Mobile Android */}
            {isAndroid && (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div className="text-xs">
                    Appuyez sur le menu <MoreVertical className="inline w-3.5 h-3.5 mx-0.5" /> (trois points en haut à droite de Chrome).
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div className="text-xs">
                    Appuyez sur <span className="font-semibold text-foreground">"Installer l'application"</span> ou <span className="font-semibold text-foreground">"Ajouter à l'écran d'accueil"</span>.
                  </div>
                </div>
              </div>
            )}

            {/* Cas iPhone / iPad Safari */}
            {isIOS && (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div className="text-xs">
                    Dans Safari, appuyez sur le bouton de partage <Share className="inline w-3.5 h-3.5 mx-0.5 text-blue-500" /> en bas de l'écran.
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div className="text-xs">
                    Faites défiler vers le bas et touchez <span className="font-semibold text-foreground"><PlusSquare className="inline w-3.5 h-3.5 mx-0.5" /> Sur l'écran d'accueil</span>.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Avantages */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border text-center">
            <div className="p-2 rounded-lg bg-muted/20">
              <span className="block text-[11px] font-bold text-foreground">⚡ 1 Clic</span>
              <span className="text-[10px] text-muted-foreground">Accès instantané</span>
            </div>
            <div className="p-2 rounded-lg bg-muted/20">
              <span className="block text-[11px] font-bold text-foreground">🖥️ Plein écran</span>
              <span className="text-[10px] text-muted-foreground">Sans barre d'adresse</span>
            </div>
            <div className="p-2 rounded-lg bg-muted/20">
              <span className="block text-[11px] font-bold text-foreground">🔒 Données sûres</span>
              <span className="text-[10px] text-muted-foreground">Synchronisé temps réel</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-muted/40 border-t border-border flex justify-end">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
