import { useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ExistingBuyer {
  id: string; // Clé normalisée (lowercase)
  buyer_name: string;
  buyer_phone: string | null;
  buyer_email: string | null;
  buyer_last_name: string | null;
  buyer_first_name: string | null;
  buyer_profession: string | null;
  buyer_birth_place: string | null;
  buyer_birth_date: string | null;
  buyer_marital_status: string | null;
  buyer_children_count: number | null;
  buyer_address: string | null;
  buyer_village_origin: string | null;
  buyer_groupement: string | null;
  buyer_secteur: string | null;
  buyer_territoire: string | null;
  buyer_province: string | null;
  totalSurface: number;
  quotas: number; // Nombre de quotas (surface / 600)
  parcellesCount: number;
  hectaresCount: number;
  rmbNumbers: string[];
  primaryRmb: string | null;
  mergedGroupId: string | null;
}

/**
 * Normalise une chaîne de texte pour la comparaison (sans accents, minuscules, espaces superflus)
 */
export function normalizeText(text?: string | null): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function useBuyerDetection() {
  const { data: buyers = [], isLoading, refetch } = useQuery({
    queryKey: ["existing-buyers-detection"],
    queryFn: async (): Promise<ExistingBuyer[]> => {
      // 1. Récupérer les parcelles vendues avec acheteur
      const { data: parcelles, error: pError } = await supabase
        .from("parcelles")
        .select(`
          id,
          buyer_name,
          buyer_phone,
          buyer_email,
          buyer_last_name,
          buyer_first_name,
          buyer_profession,
          buyer_birth_place,
          buyer_birth_date,
          buyer_marital_status,
          buyer_children_count,
          buyer_address,
          buyer_village_origin,
          buyer_groupement,
          buyer_secteur,
          buyer_territoire,
          buyer_province,
          surface,
          rmb_number,
          merged_group_id,
          hectares (
            rmb_number
          )
        `)
        .eq("status", "vendu")
        .not("buyer_name", "is", null);

      if (pError) throw pError;

      // 2. Récupérer les hectares vendus avec acheteur
      const { data: hectares, error: hError } = await supabase
        .from("hectares")
        .select(`
          id,
          buyer_name,
          buyer_phone,
          buyer_email,
          buyer_last_name,
          buyer_first_name,
          buyer_profession,
          buyer_birth_place,
          buyer_birth_date,
          buyer_marital_status,
          buyer_children_count,
          buyer_address,
          buyer_village_origin,
          buyer_groupement,
          buyer_secteur,
          buyer_territoire,
          buyer_province,
          surface,
          rmb_number
        `)
        .or("status.eq.vendu,status.eq.sold")
        .not("buyer_name", "is", null);

      if (hError) throw hError;

      // 3. Regrouper par acheteur
      const buyersMap = new Map<string, ExistingBuyer>();

      const getOrCreateBuyer = (rawName: string, item: any): ExistingBuyer => {
        const key = normalizeText(rawName);
        if (!buyersMap.has(key)) {
          buyersMap.set(key, {
            id: key,
            buyer_name: rawName.trim(),
            buyer_phone: item.buyer_phone || null,
            buyer_email: item.buyer_email || null,
            buyer_last_name: item.buyer_last_name || null,
            buyer_first_name: item.buyer_first_name || null,
            buyer_profession: item.buyer_profession || null,
            buyer_birth_place: item.buyer_birth_place || null,
            buyer_birth_date: item.buyer_birth_date || null,
            buyer_marital_status: item.buyer_marital_status || null,
            buyer_children_count: item.buyer_children_count || null,
            buyer_address: item.buyer_address || null,
            buyer_village_origin: item.buyer_village_origin || null,
            buyer_groupement: item.buyer_groupement || null,
            buyer_secteur: item.buyer_secteur || null,
            buyer_territoire: item.buyer_territoire || null,
            buyer_province: item.buyer_province || null,
            totalSurface: 0,
            quotas: 0,
            parcellesCount: 0,
            hectaresCount: 0,
            rmbNumbers: [],
            primaryRmb: null,
            mergedGroupId: item.merged_group_id || null,
          });
        }
        const b = buyersMap.get(key)!;
        // Compléter les champs manquants si le record actuel en a
        if (!b.buyer_phone && item.buyer_phone) b.buyer_phone = item.buyer_phone;
        if (!b.buyer_email && item.buyer_email) b.buyer_email = item.buyer_email;
        if (!b.buyer_last_name && item.buyer_last_name) b.buyer_last_name = item.buyer_last_name;
        if (!b.buyer_first_name && item.buyer_first_name) b.buyer_first_name = item.buyer_first_name;
        if (!b.buyer_profession && item.buyer_profession) b.buyer_profession = item.buyer_profession;
        if (!b.buyer_birth_place && item.buyer_birth_place) b.buyer_birth_place = item.buyer_birth_place;
        if (!b.buyer_birth_date && item.buyer_birth_date) b.buyer_birth_date = item.buyer_birth_date;
        if (!b.buyer_marital_status && item.buyer_marital_status) b.buyer_marital_status = item.buyer_marital_status;
        if (b.buyer_children_count === null && item.buyer_children_count) b.buyer_children_count = item.buyer_children_count;
        if (!b.buyer_address && item.buyer_address) b.buyer_address = item.buyer_address;
        if (!b.buyer_village_origin && item.buyer_village_origin) b.buyer_village_origin = item.buyer_village_origin;
        if (!b.buyer_groupement && item.buyer_groupement) b.buyer_groupement = item.buyer_groupement;
        if (!b.buyer_secteur && item.buyer_secteur) b.buyer_secteur = item.buyer_secteur;
        if (!b.buyer_territoire && item.buyer_territoire) b.buyer_territoire = item.buyer_territoire;
        if (!b.buyer_province && item.buyer_province) b.buyer_province = item.buyer_province;
        if (!b.mergedGroupId && item.merged_group_id) b.mergedGroupId = item.merged_group_id;

        return b;
      };

      (parcelles || []).forEach((p) => {
        if (!p.buyer_name) return;
        const b = getOrCreateBuyer(p.buyer_name, p);
        const surface = Number(p.surface || 600);
        b.totalSurface += surface;
        b.quotas += Math.max(1, Math.ceil(surface / 600));
        b.parcellesCount += 1;

        const rmb = p.rmb_number || (p.hectares as any)?.rmb_number;
        if (rmb && !b.rmbNumbers.includes(rmb.trim())) {
          b.rmbNumbers.push(rmb.trim());
        }
      });

      (hectares || []).forEach((h) => {
        if (!h.buyer_name) return;
        const b = getOrCreateBuyer(h.buyer_name, h);
        const rawHectareSurf = Number(h.surface || 1);
        const hSurfM2 = rawHectareSurf >= 100 ? rawHectareSurf : Math.round(rawHectareSurf * 10000);
        b.totalSurface += hSurfM2;
        b.quotas += Math.max(1, Math.ceil(hSurfM2 / 600));
        b.hectaresCount += 1;

        if (h.rmb_number && !b.rmbNumbers.includes(h.rmb_number.trim())) {
          b.rmbNumbers.push(h.rmb_number.trim());
        }
      });

      // Définir primaryRmb pour chaque acheteur
      buyersMap.forEach((b) => {
        if (b.rmbNumbers.length > 0) {
          b.primaryRmb = b.rmbNumbers[0];
        }
      });

      return Array.from(buyersMap.values());
    },
    staleTime: 1000 * 30, // Conserver le cache 30s pour éviter des refetchs en boucle
  });

  /**
   * Détecte si un nom d'acquéreur saisi correspond à un acquéreur déjà enregistré
   */
  const findMatchingBuyers = useCallback(
    (nameQuery?: string | null): ExistingBuyer[] => {
      if (!nameQuery) return [];
      const cleanQuery = normalizeText(nameQuery);
      if (cleanQuery.length < 2) return [];

      const queryWords = cleanQuery.split(" ").filter((w) => w.length > 1);

      return buyers.filter((buyer) => {
        const buyerCleanName = normalizeText(buyer.buyer_name);
        
        // Correspondance exacte ou commence par
        if (buyerCleanName.includes(cleanQuery) || cleanQuery.includes(buyerCleanName)) {
          return true;
        }

        // Correspondance mot à mot
        if (queryWords.length > 0) {
          const matchesAllWords = queryWords.every((w) => buyerCleanName.includes(w));
          if (matchesAllWords) return true;
        }

        // Correspondance prénom / nom
        if (buyer.buyer_first_name && normalizeText(buyer.buyer_first_name).includes(cleanQuery)) {
          return true;
        }
        if (buyer.buyer_last_name && normalizeText(buyer.buyer_last_name).includes(cleanQuery)) {
          return true;
        }

        return false;
      });
    },
    [buyers]
  );

  return {
    buyers,
    isLoading,
    refetch,
    findMatchingBuyers,
  };
}
