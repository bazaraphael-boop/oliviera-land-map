export interface ParcelleItem {
  id: string;
  numero: string;
  hectare_id: string;
  status?: string;
  buyer_name?: string | null;
  rmb_number?: string | null;
  surface?: number;
}

export interface HectareItem {
  id: string;
  name: string;
  rmb_number?: string | null;
  location?: string | null;
}

/**
 * Extrait le préfixe propre d'un hectare (ex: "Hectare RMB 225 de Jeannette" -> "RMB 225")
 */
export function getCleanHectarePrefix(name: string): string {
  if (!name) return "";
  let clean = name.replace(/\s+/g, " ").trim();

  // Enlever "Hectare " au début si présent
  if (clean.toLowerCase().startsWith("hectare ")) {
    clean = clean.substring(8).trim();
  }

  // Couper avant " de " ou " par "
  const deIndex = clean.toLowerCase().indexOf(" de ");
  if (deIndex > 0) {
    clean = clean.substring(0, deIndex).trim();
  }
  const parIndex = clean.toLowerCase().indexOf(" par ");
  if (parIndex > 0) {
    clean = clean.substring(0, parIndex).trim();
  }

  const words = clean.split(" ");
  if (words.length >= 2 && words[0].toUpperCase() === "RMB") {
    return `${words[0]} ${words[1]}`;
  }
  return clean;
}

/**
 * Extrait le suffixe numérique d'un numéro de parcelle
 * Exemples:
 *  - "RMB 225/3" -> 3
 *  - "P-12" -> 12
 *  - "14" -> 14
 */
export function extractParcelleNumber(numero: string): number | null {
  if (!numero) return null;
  const match = numero.trim().match(/(?:[\/\-_#\s]|^)(\d+)\s*$/);
  if (match && match[1]) {
    const val = parseInt(match[1], 10);
    return isNaN(val) ? null : val;
  }
  return null;
}

export interface HectareAuditResult {
  hectareId: string;
  hectareName: string;
  prefix: string;
  totalParcelles: number;
  maxCapacity: number;
  highestNumber: number;
  presentMap: Map<number, ParcelleItem[]>;
  /** Trous détectés dans la séquence existante (ex: 1, 2, 4 -> trou: 3) */
  missingGaps: number[];
  /** Emplacements restants après le plus grand numéro jusqu'à la capacité (ex: 5..16) */
  remainingSlots: number[];
  /** Tous les numéros manquants (trous + restants jusqu'à maxCapacity) */
  allMissingUpToCapacity: number[];
  /** Numéros en double */
  duplicates: { num: number; fullNumero: string; parcelles: ParcelleItem[] }[];
  /** Prochain numéro suggéré (comble le premier trou s'il existe, sinon highest + 1) */
  nextSuggestedNumber: number;
  nextSuggestedNumero: string;
  hasGaps: boolean;
  hasDuplicates: boolean;
}

/**
 * Analyse la numérotation des parcelles pour un hectare donné
 */
export function auditHectare(
  hectare: HectareItem,
  parcelles: ParcelleItem[],
  maxCapacity: number = 16
): HectareAuditResult {
  const prefix = getCleanHectarePrefix(hectare.name);
  const presentMap = new Map<number, ParcelleItem[]>();
  const duplicates: { num: number; fullNumero: string; parcelles: ParcelleItem[] }[] = [];

  let highestNumber = 0;

  parcelles.forEach((p) => {
    const num = extractParcelleNumber(p.numero);
    if (num !== null) {
      if (num > highestNumber) highestNumber = num;
      const list = presentMap.get(num) || [];
      list.push(p);
      presentMap.set(num, list);
    }
  });

  // Détecter les doublons
  presentMap.forEach((list, num) => {
    if (list.length > 1) {
      duplicates.push({
        num,
        fullNumero: list[0].numero,
        parcelles: list,
      });
    }
  });

  // Détecter les trous (gaps) entre 1 et highestNumber
  const missingGaps: number[] = [];
  const limitForGaps = Math.max(highestNumber, 1);
  for (let i = 1; i <= limitForGaps; i++) {
    if (!presentMap.has(i)) {
      missingGaps.push(i);
    }
  }

  // Emplacements restants jusqu'à maxCapacity
  const remainingSlots: number[] = [];
  for (let i = highestNumber + 1; i <= maxCapacity; i++) {
    if (!presentMap.has(i)) {
      remainingSlots.push(i);
    }
  }

  // Tous les numéros manquants de 1 à maxCapacity
  const allMissingUpToCapacity: number[] = [];
  for (let i = 1; i <= maxCapacity; i++) {
    if (!presentMap.has(i)) {
      allMissingUpToCapacity.push(i);
    }
  }

  // Prochain numéro suggéré : comble d'abord le premier trou s'il existe !
  let nextSuggestedNumber = 1;
  if (missingGaps.length > 0) {
    nextSuggestedNumber = missingGaps[0];
  } else if (highestNumber > 0) {
    nextSuggestedNumber = highestNumber + 1;
  }

  const isIsetech = hectare.name.toUpperCase().includes("ISETECH");
  const nextSuggestedNumero = isIsetech
    ? String(nextSuggestedNumber)
    : `${prefix}/${nextSuggestedNumber}`;

  return {
    hectareId: hectare.id,
    hectareName: hectare.name,
    prefix,
    totalParcelles: parcelles.length,
    maxCapacity,
    highestNumber,
    presentMap,
    missingGaps,
    remainingSlots,
    allMissingUpToCapacity,
    duplicates,
    nextSuggestedNumber,
    nextSuggestedNumero,
    hasGaps: missingGaps.length > 0,
    hasDuplicates: duplicates.length > 0,
  };
}

export interface GlobalRmbAuditResult {
  totalItemsWithRmb: number;
  minRmb: number | null;
  maxRmb: number | null;
  presentNumbers: number[];
  missingNumbers: number[];
  duplicates: { rmb: string; count: number; items: { id: string; name: string; type: "parcelle" | "hectare" }[] }[];
}

/**
 * Analyse globale des numéros RMB (trous dans la série de numéros)
 */
export function auditGlobalRmb(
  parcelles: { id: string; numero: string; rmb_number?: string | null }[],
  hectares: { id: string; name: string; rmb_number?: string | null }[]
): GlobalRmbAuditResult {
  const rmbMap = new Map<string, { id: string; name: string; type: "parcelle" | "hectare" }[]>();
  const numericSet = new Set<number>();

  const processRmb = (rmb: string | null | undefined, id: string, name: string, type: "parcelle" | "hectare") => {
    if (!rmb) return;
    const clean = rmb.trim();
    if (!clean) return;

    // Comptage pour doublons
    const list = rmbMap.get(clean) || [];
    list.push({ id, name, type });
    rmbMap.set(clean, list);

    // Extraction numérique
    const digits = clean.replace(/\D/g, "");
    if (digits) {
      const num = parseInt(digits, 10);
      if (!isNaN(num) && num > 0) {
        numericSet.add(num);
      }
    }
  };

  parcelles.forEach((p) => processRmb(p.rmb_number, p.id, `Parcelle ${p.numero}`, "parcelle"));
  hectares.forEach((h) => processRmb(h.rmb_number, h.id, h.name, "hectare"));

  const sortedNumbers = Array.from(numericSet).sort((a, b) => a - b);
  const minRmb = sortedNumbers.length > 0 ? sortedNumbers[0] : null;
  const maxRmb = sortedNumbers.length > 0 ? sortedNumbers[sortedNumbers.length - 1] : null;

  const missingNumbers: number[] = [];
  if (minRmb !== null && maxRmb !== null) {
    // Éviter des boucles infinies si un numéro aberrant existe
    const effectiveMax = Math.min(maxRmb, minRmb + 500);
    for (let i = minRmb; i <= effectiveMax; i++) {
      if (!numericSet.has(i)) {
        missingNumbers.push(i);
      }
    }
  }

  const duplicates: { rmb: string; count: number; items: { id: string; name: string; type: "parcelle" | "hectare" }[] }[] = [];
  rmbMap.forEach((items, rmb) => {
    if (items.length > 1) {
      duplicates.push({ rmb, count: items.length, items });
    }
  });

  return {
    totalItemsWithRmb: rmbMap.size,
    minRmb,
    maxRmb,
    presentNumbers: sortedNumbers,
    missingNumbers,
    duplicates,
  };
}
