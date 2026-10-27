import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Download, Loader2, Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PAYMENT_PROOF_BUCKET, paymentProofPath, paymentProofUpdate, validatePaymentProof } from "@/lib/payment-proof";
import { PaymentProofPicker } from "@/components/PaymentProofPicker";
import { toast } from "sonner";

interface PaymentRecord {
  id: string;
  amount: number;
  payment_date: string;
  invoice_number: string | null;
  proof_file_path?: string | null;
  proof_file_name?: string | null;
}

export function PaymentHistory({ parcelleIds = [], hectareIds = [] }: { parcelleIds?: string[]; hectareIds?: string[] }) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const { data: canEdit = false } = useQuery({
    queryKey: ["payment-proof-edit-access"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;
      const { data, error } = await supabase.rpc("is_admin", { _user_id: session.user.id });
      return !error && data === true;
    },
  });
  const { data: payments = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["payment-history", parcelleIds, hectareIds],
    queryFn: async () => {
      const records: PaymentRecord[] = [];
      for (const [column, ids] of [["parcelle_id", parcelleIds], ["hectare_id", hectareIds]] as const) {
        if (!ids.length) continue;
        const { data, error } = await supabase.from("payments").select("*").in(column, ids);
        if (error) throw error;
        records.push(...(data || []));
      }
      return records.sort((a, b) => b.payment_date.localeCompare(a.payment_date));
    },
  });

  const attachProof = async (payment: PaymentRecord) => {
    if (!proofFile || saving || payment.proof_file_path) return;
    const validationError = validatePaymentProof(proofFile);
    if (validationError) { toast.error(validationError); return; }
    setSaving(true);
    let uploadedPath: string | null = null;
    let linked = false;
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) throw new Error("Session expirée, veuillez vous reconnecter");
      const path = paymentProofPath(session.user.id, payment.id, proofFile.type);
      const { error: uploadError } = await supabase.storage.from(PAYMENT_PROOF_BUCKET).upload(path, proofFile, { contentType: proofFile.type });
      if (uploadError) throw new Error(`Preuve non enregistrée : ${uploadError.message}`);
      uploadedPath = path;
      const { data, error } = await supabase.from("payments")
        .update(paymentProofUpdate(path, proofFile.name))
        .eq("id", payment.id).is("proof_file_path", null).select("id");
      if (error) throw new Error(`Preuve non rattachée : ${error.message}`);
      if (!data?.length) throw new Error("Ce paiement possède déjà une preuve ou vous n'avez pas le droit de le modifier.");
      linked = true;
      setEditingId(null);
      setProofFile(null);
      await queryClient.invalidateQueries({ queryKey: ["payment-history"] });
      toast.success("Preuve ajoutée au paiement existant");
    } catch (error) {
      if (uploadedPath && !linked) await supabase.storage.from(PAYMENT_PROOF_BUCKET).remove([uploadedPath]);
      toast.error(error instanceof Error ? error.message : "Impossible d'ajouter la preuve");
    } finally { setSaving(false); }
  };

  const download = async (payment: PaymentRecord) => {
    if (!payment.proof_file_path) return;
    setDownloading(payment.id);
    try {
      const { data, error } = await supabase.storage.from(PAYMENT_PROOF_BUCKET).download(payment.proof_file_path);
      if (error || !data) throw error || new Error("Preuve introuvable");
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = payment.proof_file_name || "preuve-paiement";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error("Impossible de télécharger la preuve de paiement");
    } finally { setDownloading(null); }
  };

  return <section className="space-y-2">
    <h4 className="text-sm font-semibold">Historique des paiements</h4>
    {isLoading ? <p className="text-sm text-muted-foreground">Chargement…</p> : isError ? <div className="flex items-center gap-2"><p className="text-sm text-destructive">Historique indisponible</p><Button variant="outline" size="sm" onClick={() => refetch()}>Réessayer</Button></div> : payments.length === 0 ? <p className="text-sm text-muted-foreground">Aucun versement enregistré</p> : <div className="max-h-64 overflow-y-auto divide-y divide-border">
      {payments.map(payment => <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
        <div className="min-w-0 flex-1"><p className="text-sm font-medium">{Number(payment.amount).toLocaleString("fr-FR")} USD <span className="font-normal text-muted-foreground">· {new Date(payment.payment_date).toLocaleDateString("fr-FR")}</span></p><p className="break-all text-xs text-muted-foreground">{payment.invoice_number}</p>{payment.proof_file_name && <p className="break-all text-xs text-muted-foreground">{payment.proof_file_name}</p>}</div>
        {payment.proof_file_path ? <Button type="button" variant="outline" size="sm" disabled={downloading === payment.id} onClick={() => download(payment)}>{downloading === payment.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Preuve</Button> : canEdit ? <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => { setEditingId(payment.id); setProofFile(null); }}><Paperclip className="mr-2 h-4 w-4" />Ajouter une preuve</Button> : <span className="text-xs text-muted-foreground">Sans preuve</span>}
        {editingId === payment.id && !payment.proof_file_path && <div className="w-full space-y-3 border-t border-border pt-3">
          <PaymentProofPicker file={proofFile} onChange={setProofFile} disabled={saving} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => { setEditingId(null); setProofFile(null); }}>Annuler</Button>
            <Button type="button" size="sm" disabled={!proofFile || saving} onClick={() => attachProof(payment)}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enregistrer la preuve</Button>
          </div>
        </div>}
      </div>)}
    </div>}
  </section>;
}