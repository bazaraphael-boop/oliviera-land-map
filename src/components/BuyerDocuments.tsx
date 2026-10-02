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
import { Camera, Upload, FileText, Trash2, Eye, X, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { normalizeText } from "@/hooks/useBuyerDetection";

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
  onDocumentsCountChange?: (count: number) => void;
  onDocumentsUpdated?: () => void;
}

export const BuyerDocuments = ({ 
  buyerId, 
  buyerName,
  onDocumentsCountChange,
  onDocumentsUpdated,
}: BuyerDocumentsProps) => {
  const queryClient = useQueryClient();
  const [documents, setDocuments] = useState<BuyerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
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
    checkAuthAndLoadDocuments();
    
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [buyerId, buyerName]);

  const checkAuthAndLoadDocuments = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        toast.error("Session expirée", {
          description: "Veuillez vous reconnecter pour gérer les documents"
        });
        setLoading(false);
        return;
      }
      
      await loadDocuments();
    } catch (error) {
      console.error("Erreur vérification authentification:", error);
      toast.error("Erreur d'authentification");
      setLoading(false);
    }
  };

  const loadDocuments = async () => {
    try {
      setLoading(true);
      let query = supabase.from("buyer_documents").select("*");
      if (buyerId && buyerName) {
        query = query.or(`buyer_id.eq.${buyerId},buyer_id.ilike.%${buyerName.trim()}%`);
      } else if (buyerId) {
        query = query.eq("buyer_id", buyerId);
      }
      const { data, error } = await query.order("uploaded_at", { ascending: false });

      if (error) throw error;

      const normId = normalizeText(buyerId);
      const normName = normalizeText(buyerName);

      const matched: BuyerDocument[] = (data || []).filter((doc: any) => {
        if (!doc.buyer_id) return false;
        const docNorm = normalizeText(doc.buyer_id);
        return (
          docNorm === normId ||
          docNorm === normName ||
          doc.buyer_id === buyerId ||
          (normName.length >= 3 && docNorm.includes(normName)) ||
          (docNorm.length >= 3 && normName.includes(docNorm))
        );
      });

      setDocuments(matched);
      onDocumentsCountChange?.(matched.length);
    } catch (error: any) {
      console.error("Erreur chargement documents:", error);
      toast.error("Erreur lors du chargement des documents");
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    try {
      // Vérifier si getUserMedia est disponible
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error("Votre navigateur ne supporte pas la caméra", {
          description: "Utilisez l'option 'Choisir un fichier' à la place"
        });
        return;
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false,
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play(); // Assurer que la vidéo démarre
        setStream(mediaStream);
        setIsCameraActive(true);
        toast.success("Caméra activée");
      }
    } catch (error: any) {
      console.error("Erreur accès caméra:", error);
      
      if (error.name === 'NotAllowedError') {
        toast.error("Permission caméra refusée", {
          description: "Autorisez l'accès à la caméra dans les paramètres"
        });
      } else if (error.name === 'NotFoundError') {
        toast.error("Aucune caméra trouvée sur cet appareil");
      } else {
        toast.error("Impossible d'accéder à la caméra", {
          description: "Utilisez 'Choisir un fichier' à la place"
        });
      }
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
      // Vérifier la session d'abord
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.user) {
        toast.error("Session expirée", {
          description: "Veuillez vous reconnecter pour ajouter des documents"
        });
        setUploading(false);
        return;
      }

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
          uploaded_by: session.user.id,
          notes: uploadForm.notes || null,
        });

      if (dbError) throw dbError;

      toast.success("Document ajouté avec succès");
      setShowUploadDialog(false);
      setUploadForm({ document_type: "", notes: "", file: null });
      await loadDocuments();
      queryClient.invalidateQueries({ queryKey: ["acheteurs"] });
      onDocumentsUpdated?.();
    } catch (error: any) {
      console.error("Erreur upload:", error);
      
      if (error.message?.includes("JWT")) {
        toast.error("Session expirée", {
          description: "Veuillez vous reconnecter"
        });
      } else {
        toast.error("Erreur lors de l'upload du document", {
          description: error.message
        });
      }
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
      await loadDocuments();
      queryClient.invalidateQueries({ queryKey: ["acheteurs"] });
      onDocumentsUpdated?.();
    } catch (error: any) {
      console.error("Erreur suppression:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleDownload = async (doc: BuyerDocument) => {
    try {
      setDownloadingId(doc.id);
      toast.info("Téléchargement du document en cours...");

      // Tentative 1 : téléchargement direct Blob via storage.download
      const { data, error } = await supabase.storage
        .from("buyer-documents")
        .download(doc.file_path);

      if (error || !data) {
        // Tentative 2 : fallback via createSignedUrl
        const { data: signedData, error: signedError } = await supabase.storage
          .from("buyer-documents")
          .createSignedUrl(doc.file_path, 3600, {
            download: doc.file_name || "document",
          });

        if (signedError || !signedData?.signedUrl) {
          throw signedError || new Error("Impossible de générer le lien de téléchargement");
        }

        const link = document.createElement("a");
        link.href = signedData.signedUrl;
        link.download = doc.file_name || "document";
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const blobUrl = window.URL.createObjectURL(data);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = doc.file_name || "document";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(blobUrl);
        document.body.removeChild(a);
      }
      toast.success("Téléchargement réussi");
    } catch (err: any) {
      console.error("Erreur téléchargement:", err);
      toast.error("Erreur lors du téléchargement : " + (err?.message || "inconnue"));
    } finally {
      setDownloadingId(null);
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

              {!uploadForm.file && !isCameraActive && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={startCamera}
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Caméra Web
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Choisir
                    </Button>
                  </div>
                  
                  {/* Option mobile directe pour capturer avec la caméra */}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileSelect}
                    className="w-full text-sm text-muted-foreground
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-semibold
                      file:bg-primary file:text-primary-foreground
                      hover:file:bg-primary/90 file:cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Sur mobile, utilisez le bouton ci-dessus pour prendre une photo directement
                  </p>
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
                <div className="flex gap-1 items-center shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownload(doc)}
                    disabled={downloadingId === doc.id}
                    className="h-8 px-2.5 text-xs gap-1"
                    title="Télécharger ce document"
                  >
                    {downloadingId === doc.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5 text-primary" />
                    )}
                    <span className="hidden sm:inline">Télécharger</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handlePreview(doc)}
                    className="h-8 w-8 p-0"
                    title="Aperçu"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(doc)}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-4 sm:p-6">
          <DialogHeader className="shrink-0 pb-3 border-b">
            <div className="flex items-center justify-between gap-3 pr-6">
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate text-base sm:text-lg">
                  {previewDocument?.file_name}
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {documentTypes.find(t => t.value === previewDocument?.document_type)?.label || "Document"}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {previewDocument && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownload(previewDocument)}
                    disabled={downloadingId === previewDocument.id}
                    className="gap-1.5 h-8 text-xs font-medium"
                  >
                    {downloadingId === previewDocument.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>Télécharger</span>
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowPreview(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>
          {previewUrl && (
            <div className="flex-1 overflow-auto py-4 flex items-center justify-center min-h-[300px]">
              {previewDocument?.file_name.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-[70vh] border rounded-lg"
                  title="Document preview"
                />
              ) : (
                <img
                  src={previewUrl}
                  alt="Document preview"
                  className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-sm"
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
