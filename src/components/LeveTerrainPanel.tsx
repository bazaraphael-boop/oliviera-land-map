import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as turf from "@turf/turf";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  MapPin,
  Crosshair,
  Trash2,
  Square,
  Save,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  Signal,
  CheckCircle2,
  ChevronDown,
  Settings2,
  HelpCircle,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

interface CapturedPoint {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const OFFLINE_KEY = "leves_offline_queue";

const LeveTerrainPanel = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const mapReady = useRef(false);
  const watchId = useRef<number | null>(null);
  const userMarker = useRef<mapboxgl.Marker | null>(null);
  const pointMarkers = useRef<mapboxgl.Marker[]>([]);

  const [points, setPoints] = useState<CapturedPoint[]>([]);
  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [isClosed, setIsClosed] = useState(false);
  const [surfaceM2, setSurfaceM2] = useState(0);
  const [agentName, setAgentName] = useState("");
  const [clientName, setClientName] = useState("");
  const [notes, setNotes] = useState("");
  const [offlineMode, setOfflineMode] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [collisionAlert, setCollisionAlert] = useState<{
    point: CapturedPoint;
    conflicts: { id: string; nom_agent: string; nom_client: string | null }[];
  } | null>(null);

  // -------- Init map --------
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      if (!mapContainer.current) return;
      try {
        const { data } = await supabase.functions.invoke("get-secret", {
          body: { secret_name: "MAPBOX_PUBLIC_TOKEN" },
        });
        const token = data?.MAPBOX_PUBLIC_TOKEN;
        if (!token || !mounted) {
          toast.error("Token Mapbox non disponible");
          return;
        }
        mapboxgl.accessToken = token;
        map.current = new mapboxgl.Map({
          container: mapContainer.current!,
          style: "mapbox://styles/mapbox/satellite-streets-v12",
          center: [12.3528, -5.9338],
          zoom: 17,
        });
        map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
        map.current.on("load", () => {
          mapReady.current = true;
          // Source / layers for live polyline + polygon
          map.current!.addSource("lt-line", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
          map.current!.addLayer({
            id: "lt-line-layer",
            type: "line",
            source: "lt-line",
            paint: {
              "line-color": "#22c55e",
              "line-width": 3,
              "line-dasharray": [2, 1],
            },
          });
          map.current!.addSource("lt-fill", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
          map.current!.addLayer({
            id: "lt-fill-layer",
            type: "fill",
            source: "lt-fill",
            paint: {
              "fill-color": "#22c55e",
              "fill-opacity": 0.25,
              "fill-outline-color": "#16a34a",
            },
          });
          // Existing polygons (background)
          map.current!.addSource("lt-existing", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
          map.current!.addLayer({
            id: "lt-existing-layer",
            type: "fill",
            source: "lt-existing",
            paint: {
              "fill-color": "#94a3b8",
              "fill-opacity": 0.25,
              "fill-outline-color": "#475569",
            },
          });
          loadExistingPolygons();
          startWatch();
        });
      } catch (e) {
        console.error(e);
        toast.error("Erreur d'initialisation de la carte");
      }
    };
    init();

    return () => {
      mounted = false;
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      pointMarkers.current.forEach((m) => m.remove());
      userMarker.current?.remove();
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------- Offline queue --------
  useEffect(() => {
    refreshPendingCount();
    const handleOnline = () => {
      refreshPendingCount();
      syncOfflineQueue(true);
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshPendingCount = () => {
    try {
      const raw = localStorage.getItem(OFFLINE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      setPendingCount(Array.isArray(arr) ? arr.length : 0);
    } catch {
      setPendingCount(0);
    }
  };

  const loadExistingPolygons = async () => {
    try {
      const { data } = await supabase
        .from("leves_terrain")
        .select("id, points, nom_agent, nom_client")
        .limit(500);
      if (!data || !map.current) return;
      const features = data
        .filter((r: any) => Array.isArray(r.points) && r.points.length >= 3)
        .map((r: any) => {
          const ring = r.points.map((p: CapturedPoint) => [p.lng, p.lat]);
          ring.push(ring[0]);
          return {
            type: "Feature" as const,
            properties: { id: r.id, nom_agent: r.nom_agent, nom_client: r.nom_client },
            geometry: { type: "Polygon" as const, coordinates: [ring] },
          };
        });
      const src = map.current.getSource("lt-existing") as mapboxgl.GeoJSONSource | undefined;
      src?.setData({ type: "FeatureCollection", features } as any);
    } catch (e) {
      console.error("loadExistingPolygons", e);
    }
  };

  // -------- GPS watch (live position) --------
  const startWatch = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Géolocalisation non supportée par ce navigateur");
      return;
    }
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setCurrentPos({ lat: latitude, lng: longitude, accuracy });
        if (map.current && mapReady.current) {
          if (!userMarker.current) {
            const el = document.createElement("div");
            el.style.width = "18px";
            el.style.height = "18px";
            el.style.borderRadius = "50%";
            el.style.background = "#3b82f6";
            el.style.border = "3px solid white";
            el.style.boxShadow = "0 0 0 4px rgba(59,130,246,0.35)";
            userMarker.current = new mapboxgl.Marker(el)
              .setLngLat([longitude, latitude])
              .addTo(map.current);
            map.current.flyTo({ center: [longitude, latitude], zoom: 19 });
          } else {
            userMarker.current.setLngLat([longitude, latitude]);
          }
        }
      },
      (err) => {
        console.warn("watchPosition", err);
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 }
    );
  };

  // -------- Capture point --------
  const capturePoint = useCallback(() => {
    if (!("geolocation" in navigator)) {
      toast.error("Géolocalisation non disponible");
      return;
    }
    if (isClosed) {
      toast.warning("Parcelle déjà clôturée");
      return;
    }
    setCapturing(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const point: CapturedPoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: Date.now(),
        };

        // Collision check (RPC)
        try {
          const { data: conflicts } = await supabase.rpc("point_in_existing_parcelle", {
            _lat: point.lat,
            _lng: point.lng,
          });
          if (conflicts && conflicts.length > 0) {
            setCollisionAlert({ point, conflicts: conflicts as any });
            setCapturing(false);
            return;
          }
        } catch (e) {
          console.warn("Collision check failed:", e);
        }

        addPoint(point);
        setCapturing(false);
      },
      (err) => {
        setCapturing(false);
        toast.error(`Erreur GPS: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }, [isClosed]);

  // Validate the current live (watched) position as a vertex — no re-query
  const validateCurrentPosition = useCallback(async () => {
    if (isClosed) {
      toast.warning("Parcelle déjà clôturée");
      return;
    }
    if (!currentPos) {
      toast.error("Aucune position GPS disponible. Patientez quelques secondes.");
      return;
    }
    if (currentPos.accuracy > 20) {
      toast.warning(`Précision faible (±${currentPos.accuracy.toFixed(1)}m). Recommandé: attendre <10m.`);
    }
    const point: CapturedPoint = {
      lat: currentPos.lat,
      lng: currentPos.lng,
      accuracy: currentPos.accuracy,
      timestamp: Date.now(),
    };
    try {
      const { data: conflicts } = await supabase.rpc("point_in_existing_parcelle", {
        _lat: point.lat,
        _lng: point.lng,
      });
      if (conflicts && conflicts.length > 0) {
        setCollisionAlert({ point, conflicts: conflicts as any });
        return;
      }
    } catch (e) {
      console.warn("Collision check failed:", e);
    }
    addPoint(point);
  }, [isClosed, currentPos]);

  const addPoint = (point: CapturedPoint) => {
    setPoints((prev) => {
      const next = [...prev, point];
      renderPoints(next, false);
      toast.success(`Point ${LETTERS[next.length - 1] || next.length} capturé (±${point.accuracy.toFixed(1)}m)`);
      return next;
    });
  };

  const undoLastPoint = () => {
    if (points.length === 0) return;
    if (isClosed) {
      setIsClosed(false);
      setSurfaceM2(0);
      const fillSrc = map.current?.getSource("lt-fill") as mapboxgl.GeoJSONSource | undefined;
      fillSrc?.setData({ type: "FeatureCollection", features: [] } as any);
    }
    const next = points.slice(0, -1);
    setPoints(next);
    renderPoints(next, false);
    toast.info("Dernier point annulé");
  };

  const closePolygon = () => {
    if (points.length < 3) {
      toast.error("Au moins 3 points requis pour clôturer la parcelle");
      return;
    }
    const ring = points.map((p) => [p.lng, p.lat]);
    ring.push(ring[0]);
    const polygon = turf.polygon([ring]);
    const area = turf.area(polygon);
    setSurfaceM2(area);
    setIsClosed(true);
    renderPoints(points, true);
    toast.success(`Parcelle clôturée • Surface : ${area.toFixed(2)} m²`);
  };

  const renderPoints = (pts: CapturedPoint[], closed: boolean) => {
    if (!map.current || !mapReady.current) return;

    // Markers
    pointMarkers.current.forEach((m) => m.remove());
    pointMarkers.current = pts.map((p, i) => {
      const el = document.createElement("div");
      el.style.width = "26px";
      el.style.height = "26px";
      el.style.borderRadius = "50%";
      el.style.background = "#16a34a";
      el.style.color = "white";
      el.style.fontWeight = "bold";
      el.style.fontSize = "13px";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.border = "2px solid white";
      el.style.boxShadow = "0 2px 6px rgba(0,0,0,0.4)";
      el.textContent = LETTERS[i] || String(i + 1);
      return new mapboxgl.Marker(el).setLngLat([p.lng, p.lat]).addTo(map.current!);
    });

    // Line
    const lineCoords = pts.map((p) => [p.lng, p.lat]);
    if (closed && pts.length >= 3) lineCoords.push(lineCoords[0]);
    const lineSrc = map.current.getSource("lt-line") as mapboxgl.GeoJSONSource | undefined;
    lineSrc?.setData({
      type: "FeatureCollection",
      features:
        lineCoords.length >= 2
          ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: lineCoords } }]
          : [],
    } as any);

    // Fill
    const fillSrc = map.current.getSource("lt-fill") as mapboxgl.GeoJSONSource | undefined;
    if (closed && pts.length >= 3) {
      const ring = pts.map((p) => [p.lng, p.lat]);
      ring.push(ring[0]);
      fillSrc?.setData({
        type: "FeatureCollection",
        features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } }],
      } as any);
    } else {
      fillSrc?.setData({ type: "FeatureCollection", features: [] } as any);
    }
  };

  // -------- Save --------
  const resetForm = () => {
    setPoints([]);
    setIsClosed(false);
    setSurfaceM2(0);
    setClientName("");
    setNotes("");
    renderPoints([], false);
  };

  const saveLeve = async () => {
    if (!isClosed) {
      toast.error("Clôturez d'abord la parcelle");
      return;
    }
    if (!agentName.trim()) {
      toast.error("Renseignez le nom de l'agent");
      return;
    }
    setSaving(true);
    const ring = points.map((p) => [p.lng, p.lat]);
    ring.push(ring[0]);
    const wkt = `SRID=4326;POLYGON((${ring.map(([lng, lat]) => `${lng} ${lat}`).join(",")}))`;

    const { data: userData } = await supabase.auth.getUser();
    const payload = {
      nom_agent: agentName.trim(),
      nom_client: clientName.trim() || null,
      points,
      geometry: wkt,
      surface_calculee: surfaceM2,
      notes: notes.trim() || null,
      created_by: userData.user?.id ?? null,
    };

    const isOffline = offlineMode || !navigator.onLine;
    if (isOffline) {
      const raw = localStorage.getItem(OFFLINE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      arr.push(payload);
      localStorage.setItem(OFFLINE_KEY, JSON.stringify(arr));
      refreshPendingCount();
      toast.success("Levé enregistré hors-ligne (sera synchronisé)");
      resetForm();
      setSaving(false);
      return;
    }

    try {
      const { error } = await supabase.from("leves_terrain").insert(payload as any);
      if (error) throw error;
      toast.success("Levé sauvegardé avec succès");
      resetForm();
      loadExistingPolygons();
    } catch (e: any) {
      console.error(e);
      toast.error(`Erreur de sauvegarde: ${e.message}. Sauvegardé hors-ligne.`);
      const raw = localStorage.getItem(OFFLINE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      arr.push(payload);
      localStorage.setItem(OFFLINE_KEY, JSON.stringify(arr));
      refreshPendingCount();
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const syncOfflineQueue = async (silent = false) => {
    const raw = localStorage.getItem(OFFLINE_KEY);
    if (!raw) {
      if (!silent) toast.info("Aucun levé en attente");
      return;
    }
    const arr = JSON.parse(raw) as any[];
    if (arr.length === 0) {
      if (!silent) toast.info("Aucun levé en attente");
      return;
    }
    let ok = 0;
    const remaining: any[] = [];
    for (const item of arr) {
      try {
        const { error } = await supabase.from("leves_terrain").insert(item);
        if (error) throw error;
        ok++;
      } catch (e) {
        remaining.push(item);
      }
    }
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(remaining));
    refreshPendingCount();
    if (ok > 0) {
      toast.success(`${ok} levé(s) synchronisé(s)`);
      loadExistingPolygons();
    } else if (!silent) {
      toast.error("Échec de la synchronisation");
    }
  };

  // -------- Signal quality --------
  const signalColor = !currentPos
    ? "bg-muted text-muted-foreground"
    : currentPos.accuracy < 5
    ? "bg-green-500 text-white"
    : currentPos.accuracy <= 10
    ? "bg-orange-500 text-white"
    : "bg-red-500 text-white";

  const signalLabel = !currentPos
    ? "GPS en attente…"
    : currentPos.accuracy < 5
    ? `Excellent • ±${currentPos.accuracy.toFixed(1)}m`
    : currentPos.accuracy <= 10
    ? `Moyen • ±${currentPos.accuracy.toFixed(1)}m`
    : `Faible • ±${currentPos.accuracy.toFixed(1)}m`;

  // Step status
  const stepCaptureDone = points.length >= 3;
  const stepCloseDone = isClosed;
  const stepSaveReady = isClosed && agentName.trim().length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[440px_1fr] gap-4 h-[calc(100vh-12rem)]">
      {/* Control panel */}
      <Card className="flex flex-col overflow-hidden">
        {/* Sticky header: GPS + progress */}
        <div className="border-b border-border p-3 space-y-2 bg-card/95 backdrop-blur">
          <div className={`flex items-center gap-3 rounded-lg p-2.5 ${signalColor}`}>
            <Signal className="w-5 h-5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold leading-tight">Signal GPS</p>
              <p className="text-[11px] opacity-90 truncate">{signalLabel}</p>
            </div>
            {navigator.onLine ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          </div>
          {/* Progress steps */}
          <div className="flex items-center gap-1 text-[11px]">
            <StepBadge n={1} label="Points" active={!stepCaptureDone} done={stepCaptureDone} />
            <div className="flex-1 h-px bg-border" />
            <StepBadge n={2} label="Clôturer" active={stepCaptureDone && !stepCloseDone} done={stepCloseDone} />
            <div className="flex-1 h-px bg-border" />
            <StepBadge n={3} label="Sauver" active={stepCloseDone && !saving} done={false} />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* ÉTAPE 1 — Capture */}
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="rounded-full w-6 h-6 p-0 flex items-center justify-center">1</Badge>
                <h3 className="text-sm font-bold">Capturer les coins de la parcelle</h3>
              </div>
              <p className="text-[11px] text-muted-foreground pl-8">
                Déplacez-vous physiquement à chaque coin (A, B, C, D…) puis appuyez sur un bouton.
              </p>

              {/* Moved to map overlay */}
              <p className="text-[11px] text-muted-foreground pl-8">
                Déplacez-vous physiquement à chaque coin (A, B, C, D…) puis appuyez sur <strong>Capturer</strong> ou <strong>Valider</strong> en bas de la carte.
              </p>

              {/* Points list */}
              <div className="flex items-center justify-between pt-1">
                <p className="text-xs font-semibold">
                  {points.length} point{points.length > 1 ? "s" : ""} capturé{points.length > 1 ? "s" : ""}
                  {points.length > 0 && points.length < 3 && (
                    <span className="text-muted-foreground font-normal"> (min. 3)</span>
                  )}
                </p>
                {points.length > 0 && (
                  <Button size="sm" variant="ghost" onClick={undoLastPoint} className="h-7 text-xs">
                    <Undo2 className="w-3.5 h-3.5 mr-1" />
                    Annuler dernier
                  </Button>
                )}
              </div>
              {points.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto rounded-md border border-border p-1.5 bg-muted/20">
                  {points.map((p, i) => (
                    <div
                      key={p.timestamp}
                      className="flex items-center justify-between rounded px-2 py-1.5 text-[11px] hover:bg-muted/60"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="default" className="w-5 h-5 p-0 flex items-center justify-center text-[10px]">
                          {LETTERS[i] || i + 1}
                        </Badge>
                        <span className="font-mono truncate">
                          {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          p.accuracy < 5
                            ? "border-green-500 text-green-600"
                            : p.accuracy <= 10
                            ? "border-orange-500 text-orange-600"
                            : "border-red-500 text-red-600"
                        }`}
                      >
                        ±{p.accuracy.toFixed(1)}m
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ÉTAPE 2 — Clôturer */}
            <section className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center gap-2">
                <Badge
                  variant={stepCloseDone ? "default" : "outline"}
                  className="rounded-full w-6 h-6 p-0 flex items-center justify-center"
                >
                  2
                </Badge>
                <h3 className="text-sm font-bold">Clôturer la parcelle</h3>
              </div>
              <Button
                onClick={closePolygon}
                disabled={points.length < 3 || isClosed}
                variant={isClosed ? "outline" : "secondary"}
                className="w-full h-12"
              >
                <Square className="w-5 h-5 mr-2" />
                {isClosed ? "✓ Parcelle clôturée" : "Clôturer (calculer la surface)"}
              </Button>
              {isClosed && (
                <Card className="p-3 bg-primary/10 border-primary/30">
                  <p className="text-[11px] text-muted-foreground">Surface calculée</p>
                  <p className="text-2xl font-bold text-primary leading-tight">
                    {surfaceM2.toFixed(2)} m²
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    ≈ {(surfaceM2 / 10000).toFixed(4)} ha
                  </p>
                </Card>
              )}
            </section>

            {/* ÉTAPE 3 — Infos & Sauvegarde */}
            <section className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center gap-2">
                <Badge
                  variant={stepSaveReady ? "default" : "outline"}
                  className="rounded-full w-6 h-6 p-0 flex items-center justify-center"
                >
                  3
                </Badge>
                <h3 className="text-sm font-bold">Informations & Sauvegarde</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="agent" className="text-xs">
                  Nom de l'agent <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="agent"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="Ex: Jean Mukendi"
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client" className="text-xs">Nom du client</Label>
                <Input
                  id="client"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ex: Mme Kabongo"
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes" className="text-xs">Notes (facultatif)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observations sur le terrain…"
                  rows={2}
                  className="text-sm"
                />
              </div>
            </section>

            {/* Paramètres avancés (collapsible) */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted/50 transition-colors">
                  <span className="flex items-center gap-2">
                    <Settings2 className="w-3.5 h-3.5" />
                    Paramètres avancés
                    {pendingCount > 0 && (
                      <Badge variant="destructive" className="text-[10px] h-4 px-1.5">
                        {pendingCount} en attente
                      </Badge>
                    )}
                  </span>
                  <ChevronDown className="w-4 h-4" />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-2">
                <div className="flex items-center justify-between rounded-lg border border-border p-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold">Mode hors-ligne</p>
                    <p className="text-[10.5px] text-muted-foreground">
                      Stocker localement avant synchro
                    </p>
                  </div>
                  <Switch checked={offlineMode} onCheckedChange={setOfflineMode} />
                </div>
                {pendingCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => syncOfflineQueue(false)}
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-2" />
                    Synchroniser ({pendingCount})
                  </Button>
                )}
                {points.length > 0 && (
                  <Button variant="ghost" size="sm" className="w-full text-destructive" onClick={resetForm}>
                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                    Réinitialiser le levé
                  </Button>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        </ScrollArea>

        {/* Sticky footer: Save CTA */}
        <div className="border-t border-border p-3 bg-card/95 backdrop-blur">
          <Button
            onClick={saveLeve}
            disabled={!stepSaveReady || saving}
            className="w-full h-12 text-base font-semibold"
            size="lg"
          >
            <Save className="w-5 h-5 mr-2" />
            {saving
              ? "Sauvegarde…"
              : !isClosed
              ? "Clôturez d'abord la parcelle"
              : !agentName.trim()
              ? "Renseignez le nom de l'agent"
              : "Sauvegarder le levé"}
          </Button>
        </div>
      </Card>

      {/* Map */}
      <Card className="relative overflow-hidden min-h-[400px]">
        <div ref={mapContainer} className="absolute inset-0" />
        <Card className="absolute top-3 left-3 p-2 bg-card/95 backdrop-blur text-xs space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 ring-2 ring-blue-500/40" />
            <span>Position de l'agent</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-600 border border-white" />
            <span>Points capturés</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-slate-400/40 border border-slate-600" />
            <span>Parcelles existantes</span>
          </div>
        </Card>
        {currentPos && (
          <Card className="absolute bottom-3 left-3 p-2 bg-card/95 backdrop-blur text-xs flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            <span className="font-mono">
              {currentPos.lat.toFixed(6)}, {currentPos.lng.toFixed(6)}
            </span>
          </Card>
        )}
      </Card>

      {/* Collision alert */}
      <AlertDialog open={!!collisionAlert} onOpenChange={(open) => !open && setCollisionAlert(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              ⚠️ Position invalide
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Ce point se trouve à l'intérieur d'une parcelle existante :
                </p>
                <ul className="list-disc list-inside text-sm">
                  {collisionAlert?.conflicts.map((c) => (
                    <li key={c.id}>
                      Agent : <strong>{c.nom_agent}</strong>
                      {c.nom_client ? ` • Client : ${c.nom_client}` : ""}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  Si ce conflit est volontaire (morcellement), vous pouvez l'ignorer.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCollisionAlert(null)}>
              Annuler le point
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (collisionAlert) addPoint(collisionAlert.point);
                setCollisionAlert(null);
              }}
            >
              Ignorer pour morcellement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const StepBadge = ({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) => (
  <div
    className={`flex items-center gap-1 px-2 py-1 rounded-full border transition-colors ${
      done
        ? "bg-primary/15 border-primary/40 text-primary"
        : active
        ? "bg-secondary border-secondary text-secondary-foreground font-semibold"
        : "bg-muted/40 border-border text-muted-foreground"
    }`}
  >
    <span className="w-4 h-4 rounded-full bg-background/60 flex items-center justify-center text-[10px] font-bold">
      {done ? "✓" : n}
    </span>
    <span className="text-[10.5px]">{label}</span>
  </div>
);

export default LeveTerrainPanel;
