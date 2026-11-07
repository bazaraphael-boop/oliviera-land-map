import { useEffect, useState } from "react";
import { CloudUpload, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type QueueMessage =
  | { type: "queue-size"; size: number }
  | {
      type: "queue-flushed";
      sent: number;
      remaining: number;
      failed: { table: string; method: string; message: string }[];
    };

// Demande au service worker d'envoyer les enregistrements faits hors connexion
const flushOfflineQueue = async () => {
  const controller = navigator.serviceWorker?.controller;
  if (!controller) return;
  const { data } = await supabase.auth.getSession();
  controller.postMessage({ type: "flush-queue", token: data.session?.access_token });
};

/**
 * Bandeau hors connexion : l'app reste consultable avec les dernières données
 * chargées, et les enregistrements sont gardés sur l'appareil puis envoyés
 * automatiquement au retour du réseau.
 */
const OfflineBanner = () => {
  const queryClient = useQueryClient();
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const onMessage = (event: MessageEvent<QueueMessage>) => {
      const message = event.data;
      if (message?.type === "queue-size") setPending(message.size);
      if (message?.type === "queue-flushed") {
        setPending(message.remaining);
        if (message.sent > 0) {
          toast.success(`${message.sent} enregistrement${message.sent > 1 ? "s" : ""} fait${message.sent > 1 ? "s" : ""} hors connexion envoyé${message.sent > 1 ? "s" : ""}`, {
            description: "Rechargez la page pour voir les données à jour.",
          });
          queryClient.invalidateQueries();
        }
        message.failed.forEach((f) =>
          toast.error(`Un enregistrement hors connexion a été refusé (${f.table})`, { description: f.message, duration: 15000 })
        );
      }
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);

    const goOffline = () => setOffline(true);
    const goOnline = () => {
      setOffline(false);
      flushOfflineQueue();
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);

    // Au chargement : connaître la file et l'envoyer si le réseau est là
    navigator.serviceWorker?.ready.then(() => {
      navigator.serviceWorker.controller?.postMessage({ type: "get-queue-size" });
      if (navigator.onLine) flushOfflineQueue();
    });

    return () => {
      navigator.serviceWorker?.removeEventListener("message", onMessage);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, [queryClient]);

  if (!offline && pending === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`sticky top-0 z-50 flex items-center justify-center gap-2 px-4 py-2 text-center text-sm ${
        offline
          ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100"
          : "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100"
      }`}
    >
      {offline ? (
        <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <CloudUpload className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      <span>
        {offline ? (
          <>
            <strong className="font-semibold">Hors connexion.</strong> Vos enregistrements sont gardés sur l'appareil
            et seront envoyés au retour du réseau
            {pending > 0 && <> ({pending} en attente)</>}. Les photos et documents ne peuvent pas être joints.
          </>
        ) : (
          <>
            Envoi de {pending} enregistrement{pending > 1 ? "s" : ""} fait{pending > 1 ? "s" : ""} hors connexion…
          </>
        )}
      </span>
    </div>
  );
};

export default OfflineBanner;
