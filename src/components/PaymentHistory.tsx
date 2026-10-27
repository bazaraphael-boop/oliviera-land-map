import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PAYMENT_PROOF_BUCKET } from "@/lib/payment-proof";
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
        {payment.proof_file_path ? <Button variant="outline" size="sm" disabled={downloading === payment.id} onClick={() => download(payment)}>{downloading === payment.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Preuve</Button> : <span className="text-xs text-muted-foreground">Sans preuve</span>}
      </div>)}
    </div>}
  </section>;
}