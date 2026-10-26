// Conversion UTM (WGS84) -> degrés décimaux, et parsing des bornes du Cadastre.
export type CoordFormat = "dd" | "utm" | "cadastre";

export interface ParsedPoint {
  lat: number;
  lng: number;
  rawX: string; // texte d'origine conservé (zéros devant inclus)
  rawY: string;
}

const a = 6378137;
const f = 1 / 298.257223563;
const k0 = 0.9996;

export function utmToLatLng(easting: number, northing: number, zone = 33, south = true) {
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);
  const x = easting - 500000;
  const y = south ? northing - 10000000 : northing;
  const M = y / k0;
  const mu = M / (a * (1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const sin1 = Math.sin(phi1), cos1 = Math.cos(phi1), tan1 = Math.tan(phi1);
  const N1 = a / Math.sqrt(1 - e2 * sin1 ** 2);
  const T1 = tan1 ** 2;
  const C1 = ep2 * cos1 ** 2;
  const R1 = (a * (1 - e2)) / Math.pow(1 - e2 * sin1 ** 2, 1.5);
  const D = x / (N1 * k0);
  const lat =
    phi1 -
    ((N1 * tan1) / R1) *
      (D ** 2 / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * ep2) * D ** 4) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * ep2 - 3 * C1 ** 2) * D ** 6) / 720);
  const lng0 = ((zone - 1) * 6 - 180 + 3) * (Math.PI / 180);
  const lng =
    lng0 +
    (D - ((1 + 2 * T1 + C1) * D ** 3) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * ep2 + 24 * T1 ** 2) * D ** 5) / 120) /
      cos1;
  return { lat: (lat * 180) / Math.PI, lng: (lng * 180) / Math.PI };
}

/** Découpe "X,Y: X,Y; X,Y\nX,Y" en points convertis en degrés décimaux. */
export function parseCoordinates(
  text: string,
  format: CoordFormat,
  zone = 33,
  south = true
): { points: ParsedPoint[]; errors: string[] } {
  const cleaned = text.replace(/^\s*parcelle\s*\d*\s*[=:]\s*/i, "");
  const chunks = cleaned.split(/[:;\n\r]+/).map((s) => s.trim()).filter(Boolean);
  const points: ParsedPoint[] = [];
  const errors: string[] = [];
  chunks.forEach((chunk, i) => {
    const parts = chunk.split(/[,\s\t]+/).filter(Boolean);
    if (parts.length !== 2) {
      errors.push(`Point ${i + 1} illisible : « ${chunk} »`);
      return;
    }
    const [rawX, rawY] = parts;
    const v1 = Number(rawX), v2 = Number(rawY);
    if (!Number.isFinite(v1) || !Number.isFinite(v2)) {
      errors.push(`Point ${i + 1} : nombres invalides « ${chunk} »`);
      return;
    }
    if (format === "dd") {
      // DD : latitude, longitude
      if (Math.abs(v1) > 90 || Math.abs(v2) > 180) {
        errors.push(`Point ${i + 1} : ce n'est pas du format DD`);
        return;
      }
      points.push({ lat: v1, lng: v2, rawX, rawY });
    } else {
      // UTM / Cadastre : X = Easting, Y = Northing
      if (v1 < 100000 || v1 > 900000 || v2 < 0 || v2 > 10000000) {
        errors.push(`Point ${i + 1} : X/Y hors plage UTM « ${chunk} »`);
        return;
      }
      const { lat, lng } = utmToLatLng(v1, v2, zone, south);
      points.push({ lat, lng, rawX, rawY });
    }
  });
  return { points, errors };
}
