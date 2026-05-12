## Système de Levé Topographique GPS - Page Localisation

Ajout d'un nouvel onglet "Levé de Terrain" dans la page Localisation permettant à un agent de capturer physiquement les coins d'une parcelle via GPS, dessiner le polygone en temps réel sur Mapbox, calculer la surface, détecter les collisions avec parcelles existantes, et sauvegarder en base.

### 1. Base de données (migration Supabase)

Activer PostGIS et créer une table dédiée aux levés terrain :

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE public.leves_terrain (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_agent text NOT NULL,
  nom_client text,
  points jsonb NOT NULL,           -- [{lat,lng,accuracy,timestamp}, ...]
  geometry geometry(Polygon, 4326),-- polygone PostGIS
  surface_calculee numeric,        -- en m²
  date_enregistrement timestamptz DEFAULT now(),
  created_by uuid,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX leves_terrain_geom_idx ON public.leves_terrain USING GIST (geometry);
ALTER TABLE public.leves_terrain ENABLE ROW LEVEL SECURITY;
-- Policies : admin full access, users authentifiés peuvent créer/voir leurs levés
```

Fonction RPC pour détection de collision :
```sql
CREATE FUNCTION public.point_in_existing_parcelle(_lat numeric, _lng numeric)
RETURNS TABLE(id uuid, nom_agent text)  -- liste des polygones contenant ce point
```

### 2. Composant `LeveTerrainPanel` (nouveau)

Fichier : `src/components/LeveTerrainPanel.tsx`

État local :
- `points: CapturedPoint[]` (lat, lng, accuracy, timestamp)
- `currentPosition`, `accuracy` (watchPosition continu)
- `isClosed: boolean`, `surfaceM2: number`
- `agentName`, `clientName`, `notes`
- `offlineMode: boolean` (stocke dans `localStorage` clé `leves_offline_queue`)
- `ignoreCollision: boolean`

UX mobile :
- Gros bouton vert "📍 Capturer ma position" (h-16, full width)
- Indicateur signal GPS : pastille verte (<5m) / orange (5-10m) / rouge (>10m) + précision affichée
- Liste des points capturés (Point A, B, C, D…) avec bouton "Annuler dernier point"
- Bouton "Clôturer la parcelle" (actif si ≥3 points)
- Bouton "Sauvegarder" (après clôture)
- Toggle "Mode Hors-ligne"

Logique de capture :
1. `navigator.geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 })`
2. Appel RPC `point_in_existing_parcelle` → si conflit, toast rouge + bouton "Ignorer pour morcellement"
3. Push dans `points`, marker + polyline mis à jour sur la carte

Calcul de surface : utilisation de `@turf/turf` (déjà compatible) `turf.area(polygon)` en m².

### 3. Carte Mapbox temps réel

Dans le même composant :
- Récupère le token via edge function existante `get-secret` (MAPBOX_PUBLIC_TOKEN)
- Affiche position courante de l'agent (marker bleu pulsant via `watchPosition`)
- Pour chaque point capturé : marker numéroté (A, B, C…)
- Polyline reliant les points au fur et à mesure
- Au "Clôturer" : ferme le polygone (fill semi-transparent) + affiche la surface au centre
- Affiche aussi en arrière-plan les polygones existants (`leves_terrain` en gris) pour repérage visuel

### 4. Mode Hors-ligne

- Si activé OU si `navigator.onLine === false` lors du save : push vers `localStorage['leves_offline_queue']`
- Au montage du composant et sur évènement `online` : tente la synchro auto, toast de succès/échec
- Bouton "Synchroniser maintenant (N en attente)"

### 5. Intégration dans `Localisation.tsx`

Wrapper la page existante dans des `Tabs` :
- Onglet "Carte des parcelles" (contenu actuel inchangé)
- Onglet "Levé de Terrain" (nouveau composant)

### 6. Dépendances

- `@turf/turf` (calcul surface + point-in-polygon côté client en fallback)
- `mapbox-gl` (déjà présent)

### Fichiers touchés

- migration Supabase (nouvelle table + RPC + RLS)
- `src/components/LeveTerrainPanel.tsx` (nouveau)
- `src/pages/Localisation.tsx` (ajout des tabs)
- `package.json` (ajout `@turf/turf`)

### Notes

- Le token Mapbox est déjà configuré (`MAPBOX_PUBLIC_TOKEN`).
- PostGIS sera activé par la migration.
- La géolocalisation HTTPS est assurée par le domaine Lovable.
- Test réel recommandé en extérieur (précision GPS dégradée en intérieur).