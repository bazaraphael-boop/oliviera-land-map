import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { toast } from "sonner";

/**
 * Bandeau affiché tant que l'appareil est hors connexion : l'app reste
 * consultable avec les dernières données chargées, mais rien ne peut être
 * enregistré avant le retour du réseau.
 */
const OfflineBanner = () => {
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => {
      setOffline(false);
      toast.success("Connexion rétablie", { description: "Rechargez la page pour voir les données à jour." });
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-center text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        <strong className="font-semibold">Hors connexion.</strong> Vous consultez les dernières données chargées ;
        les enregistrements reprendront au retour du réseau.
      </span>
    </div>
  );
};

export default OfflineBanner;
