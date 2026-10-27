import { useEffect, useRef, useState } from "react";
import { Camera, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { PAYMENT_PROOF_ACCEPT, validatePaymentProof } from "@/lib/payment-proof";

export function PaymentProofPicker({ file, onChange, disabled }: {
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file?.type.startsWith("image/")) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const selectFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;
    const error = validatePaymentProof(selected);
    if (error) { toast.error(error); return; }
    onChange(selected);
  };

  return <div className="space-y-2">
    <Label>Preuve de paiement (optionnel)</Label>
    <input ref={fileRef} type="file" accept={PAYMENT_PROOF_ACCEPT} onChange={selectFile} className="hidden" aria-label="Fichier de preuve de paiement" disabled={disabled} />
    <input ref={cameraRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={selectFile} className="hidden" aria-label="Photo de preuve de paiement" disabled={disabled} />
    {file ? <div className="flex items-center gap-3 rounded-md border border-border p-3">
      {preview ? <img src={preview} alt="Preuve sélectionnée" className="h-14 w-14 shrink-0 rounded object-cover" /> : <Paperclip className="h-5 w-5 shrink-0 text-primary" />}
      <div className="min-w-0 flex-1"><p className="break-all text-sm font-medium">{file.name}</p><p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} Mo</p></div>
      <Button type="button" variant="ghost" size="icon" onClick={() => onChange(null)} disabled={disabled} aria-label="Retirer la preuve" title="Retirer la preuve"><X className="h-4 w-4" /></Button>
    </div> : <div className="grid grid-cols-2 gap-2">
      <Button type="button" variant="outline" disabled={disabled} onClick={() => fileRef.current?.click()}><Paperclip className="mr-2 h-4 w-4 shrink-0" />Joindre un fichier</Button>
      <Button type="button" variant="outline" disabled={disabled} onClick={() => cameraRef.current?.click()}><Camera className="mr-2 h-4 w-4 shrink-0" />Photo</Button>
    </div>}
  </div>;
}