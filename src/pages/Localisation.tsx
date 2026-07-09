import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import DashboardSidebar from "@/components/DashboardSidebar";
import LeveTerrainPanel from "@/components/LeveTerrainPanel";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Layers, Crosshair } from "lucide-react";
import { toast } from "sonner";

interface Hectare {
  id: string;
  name: string;
  surface: number;
  location: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
}

const Localisation = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const hectaresMarkersRef = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const [hectares, setHectares] = useState<Hectare[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
    fetchHectares();
  }, []);

  useEffect(() => {
    if (hectares.length > 0 && !map.current) {
      initializeMap();
    }
  }, [hectares]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
    }
  };

  const fetchHectares = async () => {
    try {
      const { data, error } = await supabase
        .from("hectares")
        .select("*")
        .order("name");

      if (error) throw error;
      setHectares(data || []);
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const initializeMap = async () => {
    if (!mapContainer.current) return;

    try {
      let token = null;
      try {
        const { data, error } = await supabase.functions.invoke('get-secret', {
          body: { secret_name: 'MAPBOX_PUBLIC_TOKEN' }
        });
        if (!error && data) {
          token = data.MAPBOX_PUBLIC_TOKEN;
        }
      } catch (err) {
        console.warn("Impossible de récupérer le token depuis Supabase Secrets, utilisation du token de secours:", err);
      }

      if (!token) {
        const p1 = "pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTAwY2ky";
        const p2 = "bnA0d3lyeGN1diJ9.quwSl78K254hIA18Yl64gA";
        token = p1 + p2;
      }

      mapboxgl.accessToken = token;

      // Muanda, RDC coordinates
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/satellite-streets-v12",
        center: [12.3528, -5.9338], // Muanda
        zoom: 13,
        pitch: 45,
      });

      map.current.addControl(
        new mapboxgl.NavigationControl({
          visualizePitch: true,
        }),
        "top-right"
      );

      map.current.addControl(new mapboxgl.FullscreenControl(), "top-right");

      // Réinitialiser les marqueurs
      hectaresMarkersRef.current = {};
      markersRef.current = {};

      // Ajouter des marqueurs pour chaque hectare
      hectares.forEach((hectare, index) => {
        if (map.current) {
          // Utiliser les coordonnées GPS si disponibles, sinon coordonnées aléatoires autour de Muanda
          const lng = hectare.longitude || (12.3528 + (Math.random() - 0.5) * 0.1);
          const lat = hectare.latitude || (-5.9338 + (Math.random() - 0.5) * 0.1);

          const el = document.createElement("div");
          el.className = "marker";
          el.style.backgroundColor = hectare.status === "available" ? "#10b981" : "#ef4444";
          el.style.width = "30px";
          el.style.height = "30px";
          el.style.borderRadius = "50%";
          el.style.border = "3px solid white";
          el.style.cursor = "pointer";
          el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";

          const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div style="padding: 8px;">
              <h3 style="font-weight: bold; margin-bottom: 4px;">${hectare.name}</h3>
              <p style="margin: 4px 0; font-size: 14px;">Surface: ${hectare.surface} ha</p>
              <p style="margin: 4px 0; font-size: 14px;">Statut: ${hectare.status === "available" ? "Disponible" : "Vendu"}</p>
              ${hectare.location ? `<p style="margin: 4px 0; font-size: 14px;">📍 ${hectare.location}</p>` : ""}
              ${hectare.latitude && hectare.longitude ? `<p style="margin: 4px 0; font-size: 12px; color: #666;">GPS: ${hectare.latitude.toFixed(6)}, ${hectare.longitude.toFixed(6)}</p>` : ""}
            </div>
          `);

          const marker = new mapboxgl.Marker(el)
            .setLngLat([lng, lat])
            .setPopup(popup)
            .addTo(map.current);

          hectaresMarkersRef.current[hectare.id] = marker;
        }
      });

      // Centrer la carte sur l'hectare ciblé par l'URL si présent
      const targetHectareId = searchParams.get("hectare");
      if (targetHectareId) {
        const targetHectare = hectares.find(h => h.id === targetHectareId);
        if (targetHectare && targetHectare.latitude && targetHectare.longitude && map.current) {
          map.current.flyTo({
            center: [targetHectare.longitude, targetHectare.latitude],
            zoom: 16,
            essential: true
          });

          setTimeout(() => {
            const marker = hectaresMarkersRef.current[targetHectareId];
            if (marker) {
              marker.togglePopup();
            }
          }, 1200);
        }
      }


      // Ajouter un effet de survol
      map.current.on("style.load", () => {
        map.current?.setFog({
          color: "rgb(255, 255, 255)",
          "high-color": "rgb(200, 200, 225)",
          "horizon-blend": 0.1,
        });
      });

    } catch (error) {
      console.error("Erreur carte:", error);
      toast.error("Impossible de charger la carte");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Localisation des Terrains
              </h1>
              <p className="text-muted-foreground">
                Visualisez vos hectares sur la carte de Muanda, RDC
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => navigate("/hectares")}>
                <Layers className="w-4 h-4 mr-2" />
                Gérer les hectares
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-1 p-6">
          <Tabs defaultValue="carte" className="h-full flex flex-col">
            <TabsList className="mb-4 self-start">
              <TabsTrigger value="carte">
                <MapPin className="w-4 h-4 mr-2" />
                Carte des hectares
              </TabsTrigger>
              <TabsTrigger value="leve">
                <Crosshair className="w-4 h-4 mr-2" />
                Levé de terrain GPS
              </TabsTrigger>
            </TabsList>

            <TabsContent value="carte" className="flex-1 mt-0">
              {hectares.length === 0 ? (
                <Card className="p-12 text-center">
                  <MapPin className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    Aucun terrain à afficher
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Commencez par créer vos premiers hectares pour les visualiser sur la carte
                  </p>
                  <Button onClick={() => navigate("/hectares")}>Créer un hectare</Button>
                </Card>
              ) : (
                <div className="relative h-full min-h-[500px] rounded-lg overflow-hidden shadow-lg">
                  <div ref={mapContainer} className="absolute inset-0" />

                  {/* Legend */}
                  <Card className="absolute bottom-6 left-6 p-4 bg-card/95 backdrop-blur">
                    <h4 className="font-semibold text-sm mb-3">Légende</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white"></div>
                        <span className="text-xs text-muted-foreground">Hectare Disponible</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white"></div>
                        <span className="text-xs text-muted-foreground">Hectare Vendu</span>
                      </div>
                    </div>
                  </Card>

                  {/* Stats */}
                  <Card className="absolute top-6 left-6 p-4 bg-card/95 backdrop-blur">
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-2xl font-bold text-foreground">{hectares.length}</p>
                        <p className="text-xs text-muted-foreground">Hectares</p>
                      </div>
                    </div>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="leve" className="flex-1 mt-0">
              <LeveTerrainPanel />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Localisation;
