/**
 * Utilitaires pour le classement et la gestion de la suite logique RMB
 */

/**
 * Extrait le numéro entier d'une chaîne RMB (ex: "RMB 001" -> 1, "RMB-045" -> 45, "RMB 225/3" -> 225)
 */
export function extractRmbNumber(rmbString?: string | null): number | null {
  if (!rmbString) return null;
  const clean = rmbString.trim();
  if (!clean) return null;

  // Chercher d'abord le motif RMB <chiffres>
  const rmbMatch = clean.match(/rmb\s*[-_#]?\s*(\d+)/i);
  if (rmbMatch && rmbMatch[1]) {
    const n = parseInt(rmbMatch[1], 10);
    return isNaN(n) ? null : n;
  }

  // Sinon, extraire les premiers chiffres
  const digits = clean.replace(/\D/g, "");
  if (digits) {
    const n = parseInt(digits, 10);
    return isNaN(n) ? null : n;
  }

  return null;
}

/**
 * Extrait le sous-numéro de parcelle (ex: "RMB 225/3" -> 3, "P-12" -> 12, "005" -> 5)
 */
export function extractParcelleSubNumber(numero?: string | null): number {
  if (!numero) return 0;
  const matchSlash = numero.trim().match(/(?:[\/\-_#\s]|^)(\d+)\s*$/);
  if (matchSlash && matchSlash[1]) {
    const val = parseInt(matchSlash[1], 10);
    return isNaN(val) ? 0 : val;
  }
  const digits = numero.replace(/\D/g, "");
  if (digits) {
    const val = parseInt(digits, 10);
    return isNaN(val) ? 0 : val;
  }
  return 0;
}

/**
 * Comparateur naturel pour classer les parcelles strictement dans la suite logique RMB :
 * 1. Parcelles avec numéro RMB classées en premier par ordre numérique croissant (RMB 001, RMB 002, ...)
 * 2. Si même RMB (ex: même hectare RMB 225), classées par sous-numéro de parcelle croissant (RMB 225/1, RMB 225/2, ...)
 * 3. Parcelles sans RMB classées ensuite par numéro de parcelle naturel.
 */
// Cache WeakMap pour éviter d'exécuter les regex à chaque comparaison O(N log N)
const sortInfoCache = new WeakMap<object, { hasRmb: boolean; rmbNum: number; subNum: number; numero: string }>();

export function getParcelleSortInfo(p: any) {
  if (p && typeof p === "object") {
    const cached = sortInfoCache.get(p);
    if (cached) return cached;
  }

  let rmbNum = extractRmbNumber(p?.rmb_number) ?? extractRmbNumber(p?.hectares?.rmb_number);

  if (rmbNum === null && p?.numero) {
    rmbNum = extractRmbNumber(p.numero);
  }

  const subNum = extractParcelleSubNumber(p?.numero);

  const info = {
    hasRmb: rmbNum !== null,
    rmbNum: rmbNum !== null ? rmbNum : 9999999,
    subNum,
    numero: p?.numero || "",
  };

  if (p && typeof p === "object") {
    sortInfoCache.set(p, info);
  }

  return info;
}

export function compareParcellesByRmbSuite(a: any, b: any): number {
  const infoA = getParcelleSortInfo(a);
  const infoB = getParcelleSortInfo(b);

  // Parcelles avec RMB classées selon la suite logique (RMB 001 -> RMB 002 -> ...)
  if (infoA.rmbNum !== infoB.rmbNum) {
    return infoA.rmbNum - infoB.rmbNum;
  }

  // Si même RMB (ex: parcelles dans le même hectare), classer par sous-numéro (1..16)
  if (infoA.subNum !== infoB.subNum) {
    return infoA.subNum - infoB.subNum;
  }

  return (infoA.numero || "").localeCompare(infoB.numero || "", undefined, { numeric: true });
}

/**
 * Calcule le prochain numéro RMB de la suite logique en comblant le premier trou manquant
 * ou en incrémentant le plus grand numéro existant.
 */
export function getNextAvailableRmb(
  allParcelles: { rmb_number?: string | null; numero?: string | null }[] = [],
  allHectares: { rmb_number?: string | null; name?: string | null }[] = []
): { nextNumber: number; nextFormatted: string; isGap: boolean } {
  const numericSet = new Set<number>();
  let maxFound = 0;

  const processRmb = (rmb?: string | null) => {
    const num = extractRmbNumber(rmb);
    if (num !== null && num > 0) {
      numericSet.add(num);
      if (num > maxFound) maxFound = num;
    }
  };

  allParcelles.forEach((p) => {
    processRmb(p.rmb_number);
    // Si pas de rmb_number explicite mais numero commence par RMB
    if (!p.rmb_number && p.numero && p.numero.toUpperCase().includes("RMB")) {
      processRmb(p.numero);
    }
  });

  allHectares.forEach((h) => {
    processRmb(h.rmb_number);
    if (!h.rmb_number && h.name && h.name.toUpperCase().includes("RMB")) {
      processRmb(h.name);
    }
  });

  // Chercher d'abord un trou (gap) dans la séquence existante à partir de 1
  if (maxFound > 0) {
    for (let i = 1; i <= maxFound; i++) {
      if (!numericSet.has(i)) {
        return {
          nextNumber: i,
          nextFormatted: `RMB ${String(i).padStart(3, "0")}`,
          isGap: true,
        };
      }
    }
  }

  // Aucun trou, prendre max + 1 (ou 1 si aucun RMB trouvé)
  const next = maxFound > 0 ? maxFound + 1 : 1;
  return {
    nextNumber: next,
    nextFormatted: `RMB ${String(next).padStart(3, "0")}`,
    isGap: false,
  };
}
