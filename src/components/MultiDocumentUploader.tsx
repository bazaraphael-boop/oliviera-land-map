import { useState, useRef } from "react";
import { FileText, Camera, Plus, Trash2, Upload, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DocEntry {
  id: string;
  title: string;
  type: string;
  file: File | null;
  uploaded?: boolean; // déjà uploadé (mode édition)
  file_url?: string;
}

const DOC_TYPES = ["Contrat", "Acte de vente", "Plan", "Certificat", "Photo", "Autre"];

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

// ─────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────
interface MultiDocumentUploaderProps {
  /** Documents déjà uploadés (pour le mode édition) */
  existingDocs?: { id: string; title: string; type: string; file_url: string }[];
  /** Appelé lors de la suppression d'un document existant */
  onDeleteExisting?: (docId: string) => void;
  /** Ref vers la liste de nouveaux documents à uploader (contrôlé par le parent) */
  docs: DocEntry[];
  onChange: (docs: DocEntry[]) => void;
}

export function MultiDocumentUploader({
  existingDocs = [],
  onDeleteExisting,
  docs,
  onChange,
}: MultiDocumentUploaderProps) {
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const cameraRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const addDoc = () => {
    onChange([
      ...docs,
      { id: generateId(), title: "", type: "Contrat", file: null },
    ]);
  };

  const removeDoc = (id: string) => {
    onChange(docs.filter((d) => d.id !== id));
  };

  const updateDoc = (id: string, patch: Partial<DocEntry>) => {
    onChange(docs.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const handleFileChange = (id: string, file: File | null) => {
    updateDoc(id, { file });
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">Documents</h4>
          {(existingDocs.length + docs.length) > 0 && (
            <Badge variant="secondary" className="text-xs h-5">
              {existingDocs.length + docs.filter(d => d.file).length}
            </Badge>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addDoc}
          className="h-8 gap-1.5 text-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          Ajouter un document
        </Button>
      </div>

      {/* Documents existants (mode édition) */}
      {existingDocs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Documents enregistrés
          </p>
          {existingDocs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-muted/30"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
                <p className="text-xs text-muted-foreground">{doc.type}</p>
              </div>
              {onDeleteExisting && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0"
                  onClick={() => onDeleteExisting(doc.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Nouveaux documents */}
      {docs.length > 0 && (
        <div className="space-y-3">
          {existingDocs.length > 0 && (
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Nouveaux documents à ajouter
            </p>
          )}
          {docs.map((doc, index) => (
            <div
              key={doc.id}
              className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 space-y-3"
            >
              {/* Top bar */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary">
                  Document {existingDocs.length + index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => removeDoc(doc.id)}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>

              {/* Title + Type */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Titre *</Label>
                  <Input
                    value={doc.title}
                    onChange={(e) => updateDoc(doc.id, { title: e.target.value })}
                    placeholder="Ex: Titre de propriété"
                    className="h-8 text-xs bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={doc.type}
                    onValueChange={(val) => updateDoc(doc.id, { type: val })}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOC_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="text-xs">
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* File / Camera */}
              <div className="grid grid-cols-2 gap-2">
                {/* Fichier */}
                <div
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-md border border-dashed cursor-pointer transition-colors text-center",
                    doc.file
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-border hover:border-primary/50 hover:bg-muted/40"
                  )}
                  onClick={() => fileRefs.current[doc.id]?.click()}
                >
                  <Upload className={cn("w-4 h-4", doc.file ? "text-emerald-500" : "text-muted-foreground")} />
                  <span className={cn("text-[10px] leading-tight", doc.file ? "text-emerald-600 font-semibold" : "text-muted-foreground")}>
                    {doc.file ? doc.file.name.slice(0, 18) + (doc.file.name.length > 18 ? "…" : "") : "Fichier"}
                  </span>
                  <input
                    ref={(el) => { fileRefs.current[doc.id] = el; }}
                    type="file"
                    className="hidden"
                    onChange={(e) => handleFileChange(doc.id, e.target.files?.[0] || null)}
                  />
                </div>

                {/* Caméra */}
                <div
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-md border border-dashed cursor-pointer transition-colors text-center",
                    "border-border hover:border-primary/50 hover:bg-muted/40"
                  )}
                  onClick={() => cameraRefs.current[doc.id]?.click()}
                >
                  <Camera className="w-4 h-4 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground leading-tight">Photo / Caméra</span>
                  <input
                    ref={(el) => { cameraRefs.current[doc.id] = el; }}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handleFileChange(doc.id, e.target.files?.[0] || null)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {docs.length === 0 && existingDocs.length === 0 && (
        <div
          className="flex flex-col items-center justify-center gap-2 py-6 rounded-lg border border-dashed border-border text-muted-foreground cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-colors"
          onClick={addDoc}
        >
          <Upload className="w-7 h-7 opacity-40" />
          <p className="text-xs text-center">Cliquez pour ajouter des documents<br />(contrats, photos, actes…)</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helper: upload une liste de DocEntry vers Supabase Storage
// ─────────────────────────────────────────────────────────────
export async function uploadDocEntries(
  docs: DocEntry[],
  parcelleId: string,
  uploadedById?: string
): Promise<number> {
  let count = 0;
  for (const doc of docs) {
    if (!doc.file || !doc.title) continue;
    try {
      const ext = doc.file.name.split(".").pop();
      const path = `parcelles/${parcelleId}/${Date.now()}_${doc.id}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("buyer-documents")
        .upload(path, doc.file);
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("documents").insert({
        title: doc.title,
        type: doc.type,
        file_url: path,
        uploaded_by: uploadedById ?? null,
        parcelle_id: parcelleId,
      });
      if (dbError) throw dbError;
      count++;
    } catch (err) {
      console.error("Erreur upload document:", err);
      toast.error(`Erreur lors de l'upload du document "${doc.title}"`);
    }
  }
  return count;
}
