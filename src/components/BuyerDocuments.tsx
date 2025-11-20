import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Camera, Upload, FileText, Trash2, Eye, X } from "lucide-react";
import { toast } from "sonner";

interface BuyerDocument {
  id: string;
  document_type: string;
  file_path: string;
  file_name: string;
  uploaded_at: string;
  notes: string | null;
}

interface BuyerDocumentsProps {
  buyerId: string; // Identifiant unique de l'acheteur
  buyerName: string;
}

export const BuyerDocuments = ({ buyerId, buyerName }: BuyerDocumentsProps) => {
  const [documents, setDocuments] = useState<BuyerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewDocument, setPreviewDocument] = useState<BuyerDocument | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  const [uploadForm, setUploadForm] = useState({
    document_type: "",
    notes: "",
    file: null as File | null,
  });

  const documentTypes = [
    { value: "carte_identite", label: "Carte d'identité" },
    { value: "attestation", label: "Attestation" },
    { value: "contrat", label: "Contrat de vente" },
    { value: "recu_paiement", label: "Reçu de paiement" },
    { value: "autre", label: "Autre document" },
  ];

  useEffect(() => {
    loadDocuments();
    
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [buyerId]);

  const loadDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from("buyer_documents")
        .select("*")
        .eq("buyer_id", buyerId)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      console.error("Erreur chargement documents:", error);
      toast.error("Erreur lors du chargement des documents");
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
        setIsCameraActive(true);
      }
    } catch (error) {
      console.error("Erreur accès caméra:", error);
      toast.error("Impossible d'accéder à la caméra");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    
    canvas.toBlob((blob) => {
      if (!blob) return;
      
      const file = new File([blob], `photo_${Date.now()}.jpg`, {
        type: "image/jpeg",
      });
      
      setUploadForm(prev => ({ ...prev, file }));
      stopCamera();
      toast.success("Photo capturée avec succès");
    }, "image/jpeg", 0.9);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadForm(prev => ({ ...prev, file }));
      toast.success("Fichier sélectionné");
    }
  };

  const handleUpload = async () => {
    if (!uploadForm.file || !uploadForm.document_type) {
      toast.error("Veuillez sélectionner un type de document et un fichier");
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // Upload vers storage
      const fileExt = uploadForm.file.name.split(".").pop();
      const fileName = `${buyerId}/${Date.now()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from("buyer-documents")
        .upload(filePath, uploadForm.file);

      if (uploadError) throw uploadError;

      // Enregistrer dans la base de données
      const { error: dbError } = await supabase
        .from("buyer_documents")
        .insert({
          buyer_id: buyerId,
          document_type: uploadForm.document_type,
          file_path: filePath,
          file_name: uploadForm.file.name,
          uploaded_by: user.id,
          notes: uploadForm.notes || null,
        });

      if (dbError) throw dbError;

      toast.success("Document ajouté avec succès");
      setShowUploadDialog(false);
      setUploadForm({ document_type: "", notes: "", file: null });
      loadDocuments();
    } catch (error: any) {
      console.error("Erreur upload:", error);
      toast.error("Erreur lors de l'upload du document");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: BuyerDocument) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce document ?")) return;

    try {
      // Supprimer du storage
      const { error: storageError } = await supabase.storage
        .from("buyer-documents")
        .remove([doc.file_path]);

      if (storageError) throw storageError;

      // Supprimer de la base de données
      const { error: dbError } = await supabase
        .from("buyer_documents")
        .delete()
        .eq("id", doc.id);

      if (dbError) throw dbError;

      toast.success("Document supprimé");
      loadDocuments();
    } catch (error: any) {
      console.error("Erreur suppression:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handlePreview = async (doc: BuyerDocument) => {
    try {
      const { data } = await supabase.storage
        .from("buyer-documents")
        .createSignedUrl(doc.file_path, 3600);

      if (data?.signedUrl) {
        setPreviewUrl(data.signedUrl);
        setPreviewDocument(doc);
        setShowPreview(true);
      }
    } catch (error) {
      console.error("Erreur preview:", error);
      toast.error("Impossible d'afficher le document");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Documents de {buyerName}</h3>
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogTrigger asChild>
            <Button size="sm">
              <FileText className="w-4 h-4 mr-2" />
              Ajouter un document
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Ajouter un document</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label>Type de document</Label>
                <Select
                  value={uploadForm.document_type}
                  onValueChange={(value) =>
                    setUploadForm(prev => ({ ...prev, document_type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner le type" />
                  </SelectTrigger>
                  <SelectContent>
                    {documentTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Notes (optionnel)</Label>
                <Textarea
                  placeholder="Ajouter des notes sur ce document..."
                  value={uploadForm.notes}
                  onChange={(e) =>
                    setUploadForm(prev => ({ ...prev, notes: e.target.value }))
                  }
                />
              </div>

              {!uploadForm.file && (
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={startCamera}
                    disabled={isCameraActive}
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Prendre une photo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Choisir un fichier
                  </Button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileSelect}
              />

              {isCameraActive && (
                <div className="space-y-3">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full rounded-lg border"
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="flex gap-2">
                    <Button onClick={capturePhoto} className="flex-1">
                      <Camera className="w-4 h-4 mr-2" />
                      Capturer
                    </Button>
                    <Button onClick={stopCamera} variant="outline">
                      Annuler
                    </Button>
                  </div>
                </div>
              )}

              {uploadForm.file && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">Fichier sélectionné :</p>
                  <p className="text-sm text-muted-foreground">{uploadForm.file.name}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setUploadForm(prev => ({ ...prev, file: null }))}
                    className="mt-2"
                  >
                    Changer de fichier
                  </Button>
                </div>
              )}

              <Button
                onClick={handleUpload}
                disabled={uploading || !uploadForm.file || !uploadForm.document_type}
                className="w-full"
              >
                {uploading ? "Upload en cours..." : "Enregistrer le document"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : documents.length === 0 ? (
        <Card className="p-6 text-center">
          <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Aucun document pour cet acheteur
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {documents.map((doc) => (
            <Card key={doc.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm">
                      {documentTypes.find(t => t.value === doc.document_type)?.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{doc.file_name}</p>
                  {doc.notes && (
                    <p className="text-xs text-muted-foreground mt-1">{doc.notes}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(doc.uploaded_at).toLocaleDateString('fr-FR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handlePreview(doc)}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(doc)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{previewDocument?.file_name}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowPreview(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <div className="overflow-auto">
              {previewDocument?.file_name.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-[70vh]"
                  title="Document preview"
                />
              ) : (
                <img
                  src={previewUrl}
                  alt="Document preview"
                  className="w-full h-auto rounded-lg"
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
