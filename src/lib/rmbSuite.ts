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

  // Si même RMB (ex: parcelles dans le même hectare), classer par sous-numéro (1..15)
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

/**
 * Extrait le numéro ou code racine RMB d'un hectare (ex: "RMB 223" -> "223", "223" -> "223", "HECTARE 223" -> "223")
 */
export function getHectareRootRmb(hectare?: { rmb_number?: string | null; name?: string | null } | null): string {
  if (!hectare) return "01";
  if (hectare.rmb_number && hectare.rmb_number.trim()) {
    const raw = hectare.rmb_number.trim();
    const clean = raw.replace(/^rmb\s*[-_#]?\s*/i, "").trim();
    if (clean) return clean;
  }
  if (hectare.name && hectare.name.trim()) {
    const match = hectare.name.match(/\d+/);
    if (match) return match[0];
    return hectare.name.trim();
  }
  return "01";
}

/**
 * Calcule le prochain numéro de parcelle dans un hectare suivant son numéro initial (ex: RMB 223/01, RMB 223/02, etc.)
 */
export function getNextParcelleInHectareRmb(
  hectare: { rmb_number?: string | null; name?: string | null } | null | undefined,
  existingParcelles: { rmb_number?: string | null; numero?: string | null }[] = []
): {
  rootRmb: string;
  nextIndex: number;
  formattedNumero: string;
  formattedRmb: string;
  isAvailable: boolean;
} {
  const rootRmb = getHectareRootRmb(hectare);
  const occupiedIndices = new Set<number>();

  existingParcelles.forEach((p) => {
    const numStr = `${p.numero || ""} ${p.rmb_number || ""}`.trim();
    // Chercher directement après le slash ex: "223/01" -> 1, "RMB 223/02" -> 2
    const directSlash = numStr.match(/\/(\d+)/);
    if (directSlash && directSlash[1]) {
      const idx = parseInt(directSlash[1], 10);
      if (!isNaN(idx) && idx > 0 && idx <= 100) {
        occupiedIndices.add(idx);
        return;
      }
    }
    // Fallback : nombre simple en fin de numéro
    const matchEnd = numStr.match(/(?:^|\s|-|_|#)(\d+)$/);
    if (matchEnd && matchEnd[1]) {
      const idx = parseInt(matchEnd[1], 10);
      if (!isNaN(idx) && idx > 0 && idx <= 32) {
        occupiedIndices.add(idx);
      }
    }
  });

  // Chercher le premier index disponible de 1 à 15 (ou au-delà)
  let nextIndex = 1;
  while (occupiedIndices.has(nextIndex) && nextIndex <= 32) {
    nextIndex++;
  }

  const paddedIndex = String(nextIndex).padStart(2, "0");
  const formattedNumero = `${rootRmb}/${paddedIndex}`;
  const formattedRmb = `RMB ${rootRmb}/${paddedIndex}`;

  return {
    rootRmb,
    nextIndex,
    formattedNumero,
    formattedRmb,
    isAvailable: nextIndex <= 15,
  };
}

export interface ParsedRmb {
  raw: string;
  rootNum: number | null;
  subNum: number | null;
  normalized: string;
}

/**
 * Décompose un numéro cadastral ou RMB en racine et sous-indice de parcelle :
 * Exemples :
 * - "RMB 221/01" -> rootNum: 221, subNum: 1, normalized: "221/01"
 * - "221/01"     -> rootNum: 221, subNum: 1, normalized: "221/01"
 * - "RMB 221"    -> rootNum: 221, subNum: null, normalized: "221"
 * - "221"        -> rootNum: 221, subNum: null, normalized: "221"
 */
export function parseRmbParts(str?: string | null): ParsedRmb | null {
  if (!str) return null;
  const clean = str.trim();
  if (!clean) return null;

  // Chercher motif avec slash : <chiffres>/<chiffres>
  const slashMatch = clean.match(/(?:^|\D)(\d+)\s*\/\s*(\d+)(?:\D|$)/);
  if (slashMatch) {
    const root = parseInt(slashMatch[1], 10);
    const sub = parseInt(slashMatch[2], 10);
    return {
      raw: clean,
      rootNum: isNaN(root) ? null : root,
      subNum: isNaN(sub) ? null : sub,
      normalized: `${root}/${String(sub).padStart(2, "0")}`,
    };
  }

  // Chercher motif RMB <chiffres>
  const rmbMatch = clean.match(/rmb\s*[-_#]?\s*(\d+)/i);
  if (rmbMatch && rmbMatch[1]) {
    const root = parseInt(rmbMatch[1], 10);
    return {
      raw: clean,
      rootNum: isNaN(root) ? null : root,
      subNum: null,
      normalized: `${root}`,
    };
  }

  // Chiffres purs sans slash
  const numMatch = clean.match(/(\d+)/);
  if (numMatch) {
    const root = parseInt(numMatch[1], 10);
    return {
      raw: clean,
      rootNum: isNaN(root) ? null : root,
      subNum: null,
      normalized: `${root}`,
    };
  }

  return {
    raw: clean,
    rootNum: null,
    subNum: null,
    normalized: clean.toLowerCase().replace(/[^a-z0-9]/g, ""),
  };
}

/**
 * Vérifie si deux identifiants RMB ou numéros représentent exactement le même bien cadastral :
 * - "RMB 221" et "221" -> TRUE (même numéro racine)
 * - "RMB 221" et "RMB 221/01" -> FALSE (l'un est un hectare racine, l'autre est une sous-parcelle !)
 * - "221/01" et "RMB 221/01" -> TRUE (même sous-parcelle)
 * - "221/01" et "221/02" -> FALSE (deux sous-parcelles distinctes)
 */
export function areRmbConflicting(rmbA?: string | null, rmbB?: string | null): boolean {
  if (!rmbA || !rmbB) return false;
  const a = rmbA.trim();
  const b = rmbB.trim();
  if (!a || !b) return false;

  const parsedA = parseRmbParts(a);
  const parsedB = parseRmbParts(b);
  if (!parsedA || !parsedB) return false;

  // Règle essentielle :
  // Si l'un a un sous-numéro (/01) et l'autre n'en a pas -> PAS DE CONFLIT !
  // (Ex: une sous-parcelle 221/01 ne conflit JAMAIS avec un hectare 221 !)
  if (
    (parsedA.subNum !== null && parsedB.subNum === null) ||
    (parsedA.subNum === null && parsedB.subNum !== null)
  ) {
    return false;
  }

  // Si les deux ont un sous-numéro : la racine ET le sous-numéro doivent être égaux
  if (parsedA.subNum !== null && parsedB.subNum !== null) {
    return (
      parsedA.rootNum !== null &&
      parsedB.rootNum !== null &&
      parsedA.rootNum === parsedB.rootNum &&
      parsedA.subNum === parsedB.subNum
    );
  }

  // Si aucun n'a de sous-numéro : comparer les racines numériques
  if (parsedA.rootNum !== null && parsedB.rootNum !== null) {
    return parsedA.rootNum === parsedB.rootNum;
  }

  return parsedA.normalized === parsedB.normalized;
}

