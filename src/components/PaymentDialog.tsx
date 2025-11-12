import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import jsPDF from "jspdf";
import headerImage from "@/assets/en_tete_concession_manuel.jpg";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  itemType: "hectare" | "parcelle";
  itemName: string;
  totalPrice: number;
  remainingAmount: number;
  buyerName?: string;
  onPaymentComplete: () => void;
}

export const PaymentDialog = ({
  open,
  onOpenChange,
  itemId,
  itemType,
  itemName,
  totalPrice,
  remainingAmount,
  buyerName,
  onPaymentComplete,
}: PaymentDialogProps) => {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const generateInvoice = async (
    invoiceNumber: string,
    paymentAmount: number,
    isFullPayment: boolean,
    newRemainingAmount: number
  ) => {
    const pdf = new jsPDF();
    
    const img = new Image();
    img.src = headerImage;
    await new Promise((resolve) => {
      img.onload = resolve;
    });
    
    const imgWidth = 210;
    const imgHeight = (img.height * imgWidth) / img.width;
    pdf.addImage(img, "JPEG", 0, 0, imgWidth, imgHeight);
    
    let yPos = imgHeight + 20;
    
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text(isFullPayment ? "FACTURE DE PAIEMENT TOTAL" : "FACTURE D'ACOMPTE", 105, yPos, { align: "center" });
    
    yPos += 15;
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "normal");
    pdf.text(`N° Facture: ${invoiceNumber}`, 20, yPos);
    pdf.text(`Date: ${new Date().toLocaleDateString("fr-FR")}`, 150, yPos);
    
    yPos += 10;
    pdf.text(`Type: ${itemType === "hectare" ? "Hectare" : "Parcelle"}`, 20, yPos);
    pdf.text(`Nom: ${itemName}`, 20, yPos + 7);
    if (buyerName) {
      pdf.text(`Acheteur: ${buyerName}`, 20, yPos + 14);
    }
    
    yPos += 30;
    pdf.setDrawColor(0);
    pdf.setLineWidth(0.5);
    pdf.line(20, yPos, 190, yPos);
    
    yPos += 10;
    pdf.setFont("helvetica", "bold");
    pdf.text("Description", 25, yPos);
    pdf.text("Montant", 155, yPos);
    
    yPos += 7;
    pdf.line(20, yPos, 190, yPos);
    
    yPos += 10;
    pdf.setFont("helvetica", "normal");
    pdf.text(`Prix total ${itemType}`, 25, yPos);
    pdf.text(`$${totalPrice.toLocaleString()}`, 155, yPos);
    
    yPos += 7;
    pdf.text(isFullPayment ? "Paiement total" : "Acompte versé", 25, yPos);
    pdf.text(`$${paymentAmount.toLocaleString()}`, 155, yPos);
    
    if (!isFullPayment) {
      yPos += 7;
      pdf.setFont("helvetica", "bold");
      pdf.text("Reste à payer", 25, yPos);
      pdf.text(`$${newRemainingAmount.toLocaleString()}`, 155, yPos);
    }
    
    yPos += 10;
    pdf.line(20, yPos, 190, yPos);
    
    if (paymentMethod) {
      yPos += 10;
      pdf.setFont("helvetica", "normal");
      pdf.text(`Mode de paiement: ${paymentMethod}`, 25, yPos);
    }
    
    if (notes) {
      yPos += 10;
      pdf.text(`Notes: ${notes}`, 25, yPos);
    }
    
    pdf.save(`Facture_${invoiceNumber}_${itemName}.pdf`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      toast.error("Montant invalide");
      return;
    }
    
    if (paymentAmount > remainingAmount) {
      toast.error("Le montant ne peut pas dépasser le reste à payer");
      return;
    }
    
    setLoading(true);
    
    try {
      // Générer un numéro de facture unique
      const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      // Enregistrer le paiement
      const paymentData: any = {
        amount: paymentAmount,
        payment_method: paymentMethod,
        notes: notes,
        invoice_number: invoiceNumber,
      };
      
      if (itemType === "hectare") {
        paymentData.hectare_id = itemId;
      } else {
        paymentData.parcelle_id = itemId;
      }
      
      const { error: paymentError } = await supabase
        .from("payments")
        .insert([paymentData]);
      
      if (paymentError) throw paymentError;
      
      // Calculer le nouveau reste à payer
      const newRemainingAmount = remainingAmount - paymentAmount;
      const isFullPayment = newRemainingAmount <= 0;
      
      // Mettre à jour l'hectare ou la parcelle
      const updateData: any = {
        amount_paid: (totalPrice - remainingAmount) + paymentAmount,
        remaining_amount: newRemainingAmount,
        payment_type: isFullPayment ? "total" : "partiel",
      };
      
      if (isFullPayment) {
        updateData.status = "vendu";
        updateData.sale_date = new Date().toISOString();
      }
      
      const table = itemType === "hectare" ? "hectares" : "parcelles";
      const { error: updateError } = await supabase
        .from(table)
        .update(updateData)
        .eq("id", itemId);
      
      if (updateError) throw updateError;
      
      // Générer la facture
      await generateInvoice(invoiceNumber, paymentAmount, isFullPayment, newRemainingAmount);
      
      toast.success(isFullPayment ? "Paiement total effectué !" : "Acompte enregistré !");
      onPaymentComplete();
      onOpenChange(false);
      setAmount("");
      setPaymentMethod("");
      setNotes("");
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de l'enregistrement du paiement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enregistrer un paiement</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Prix total:</span>
              <span className="font-semibold">${totalPrice.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Déjà payé:</span>
              <span className="font-semibold">${(totalPrice - remainingAmount).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-border pt-2">
              <span className="text-muted-foreground">Reste à payer:</span>
              <span className="font-bold text-primary">${remainingAmount.toLocaleString()}</span>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Montant du paiement (USD)</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Entrez le montant"
                required
                max={remainingAmount}
              />
            </div>
            
            <div>
              <Label>Mode de paiement</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="especes">Espèces</SelectItem>
                  <SelectItem value="virement">Virement bancaire</SelectItem>
                  <SelectItem value="cheque">Chèque</SelectItem>
                  <SelectItem value="mobile">Mobile Money</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Notes (optionnel)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Informations complémentaires..."
                rows={3}
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Enregistrement..." : "Enregistrer le paiement"}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};
