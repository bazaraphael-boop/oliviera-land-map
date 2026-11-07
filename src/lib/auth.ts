import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Session enregistrée par Supabase dans le navigateur (clé sb-<projet>-auth-token).
const readStoredUser = (): User | null => {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
      const stored = JSON.parse(localStorage.getItem(key) || "null");
      return stored?.user ?? stored?.currentSession?.user ?? null;
    }
  } catch {
    // stockage indisponible ou illisible
  }
  return null;
};

/**
 * Utilisateur connecté, lu depuis la session locale.
 *
 * Remplace supabase.auth.getUser(), qui interroge le serveur à chaque appel :
 * hors connexion, cette requête échouait et l'application renvoyait vers la
 * page de connexion. La sécurité des données reste assurée côté base (RLS).
 */
export async function getCurrentUser(): Promise<{ data: { user: User | null }; error: null }> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (data.session?.user) return { data: { user: data.session.user }, error: null };
    // Le jeton n'a pas pu être rafraîchi (réseau coupé) : garder la session locale
    if (error || !navigator.onLine) return { data: { user: readStoredUser() }, error: null };
  } catch {
    return { data: { user: readStoredUser() }, error: null };
  }
  return { data: { user: null }, error: null };
}

/** Vide les données gardées pour l'usage hors connexion (à la déconnexion). */
export function clearOfflineData() {
  navigator.serviceWorker?.controller?.postMessage({ type: "clear-data-cache" });
}
