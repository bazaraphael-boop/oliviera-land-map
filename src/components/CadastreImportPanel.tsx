import { useMemo, useState } from "react";
import * as turf from "@turf/turf";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileInput, Save } from "lucide-react";
import { toast } from "sonner";
import { CoordFormat, parseCoordinates } from "@/lib/utm";

interface ParcelInput {
  client: string;
  text: string;
}

const EXAMPLE = "0203417,9346432: 0203434,9346394: 0203453,9346417: 0203436,9346427";

const CadastreImportPanel = () => {
  const [format, setFormat] = useState<CoordFormat>("cadastre");
  const [zone, setZone] = useState("33");
  const [agent, setAgent] = useState("");
  const [parcels, setParcels] = useState<ParcelInput[]>(
    Array.from({ length: 4 }, () => ({ client: "", text: "" }))
  );
  const [saving, setSaving] = useState(false);

  const results = useMemo(
    () =>
      parcels.map((p) => {
        if (!p.text.trim()) return null;
        const { points, errors } = parseCoordinates(p.text, format, Number(zone) || 33, true);
        let surface: number | null = null;
        if (points.length >= 3 && errors.length === 0) {
          try {
            const ring = points.map((pt) => [pt.lng, pt.lat]);
            ring.push(ring[0]);
            surface = turf.area(turf.polygon([ring]));
          } catch (e: any) {
            errors.push("Polygone invalide : " + e.message);
          }
        } else if (points.length < 3 && errors.length === 0) {
          errors.push("Il faut au moins 3 bornes");
        }
        return { points, errors, surface };
      }),
    [parcels, format, zone]
  );

  const update = (i: number, patch: Partial<ParcelInput>) =>
    setParcels((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  const saveAll = async () => {
    if (!agent.trim()) return toast.error("Renseignez le nom de l'agent");
    const ready = results
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r && r.errors.length === 0 && r.surface);
    if (ready.length === 0) return toast.error("Aucune parcelle valide à enregistrer");
    const invalid = results.filter((r) => r && r.errors.length > 0).length;
    if (invalid > 0) return toast.error(`${invalid} parcelle(s) contiennent des erreurs`);

    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const label = format === "dd" ? "DD" : format === "utm" ? `UTM WGS84 ${zone}S` : `Cadastre ${zone}S`;
    const payload = ready.map(({ r, i }) => {
      const ring = r!.points.map((p) => [p.lng, p.lat]);
      ring.push(ring[0]);
      return {
        nom_agent: agent.trim(),
        nom_client: parcels[i].client.trim() || null,
        points: r!.points.map((p, k) => ({
          lat: p.lat,
          lng: p.lng,
          accuracy: 0,
          timestamp: Date.now(),
          source: "manual",
          raw_x: p.rawX,
          raw_y: p.rawY,
          label: String.fromCharCode(65 + k),
        })),
        geometry: `SRID=4326;POLYGON((${ring.map(([lng, lat]) => `${lng} ${lat}`).join(",")}))`,
        surface_calculee: r!.surface,
        notes: `Parcelle ${i + 1} – import ${label}. Bornes : ${parcels[i].text.trim()}`,
        created_by: userData.user?.id ?? null,
      };
    });
    const { error } = await supabase.from("leves_terrain").insert(payload as any);
    setSaving(false);
    if (error) return toast.error("Erreur d'enregistrement : " + error.message);
    toast.success(`${payload.length} parcelle(s) enregistrée(s)`);
    setParcels(Array.from({ length: 4 }, () => ({ client: "", text: "" })));
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <FileInput className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Enregistrer des parcelles depuis les bornes du Cadastre</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label>Format des coordonnées</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as CoordFormat)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dd">Degrés décimaux (lat, lng)</SelectItem>
                <SelectItem value="utm">UTM WGS84 (X,Y)</SelectItem>
                <SelectItem value="cadastre">Local Cadastre (0203xxx, 9346xxx)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Zone UTM (hémisphère Sud)</Label>
            <Input value={zone} onChange={(e) => setZone(e.target.value)} disabled={format === "dd"} />
          </div>
          <div>
            <Label>Nom de l'agent *</Label>
            <Input value={agent} onChange={(e) => setAgent(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Collez les bornes séparées par « : », « ; » ou un retour à la ligne.
          {format !== "dd" ? " Premier nombre = X (Easting), second = Y (Northing). Datum WGS84." : " Format : latitude, longitude."}
        </p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {parcels.map((p, i) => {
          const r = results[i];
          return (
            <Card key={i} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-foreground">Parcelle {i + 1}</h4>
                {r && r.errors.length === 0 && r.surface && (
                  <Badge>{r.surface.toFixed(1)} m²</Badge>
                )}
              </div>
              <Input
                placeholder="Nom du client (optionnel)"
                value={p.client}
                onChange={(e) => update(i, { client: e.target.value })}
              />
              <Textarea
                rows={4}
                className="font-mono text-sm"
                placeholder={EXAMPLE}
                value={p.text}
                onChange={(e) => update(i, { text: e.target.value })}
              />
              {r && r.errors.length > 0 && (
                <ul className="text-xs text-destructive space-y-1">
                  {r.errors.map((e, k) => <li key={k}>• {e}</li>)}
                </ul>
              )}
              {r && r.points.length > 0 && (
                <div className="text-xs font-mono text-muted-foreground space-y-0.5">
                  {r.points.map((pt, k) => (
                    <div key={k}>
                      {String.fromCharCode(65 + k)} : {pt.rawX}, {pt.rawY} → {pt.lat.toFixed(7)}, {pt.lng.toFixed(7)}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Button className="w-full h-12" onClick={saveAll} disabled={saving}>
        <Save className="w-4 h-4 mr-2" />
        {saving ? "Enregistrement…" : "Enregistrer toutes les parcelles valides"}
      </Button>
    </div>
  );
};

export default CadastreImportPanel;
