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
  rmbNumber?: string;
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
  rmbNumber,
  onPaymentComplete,
}: PaymentDialogProps) => {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastPaymentData, setLastPaymentData] = useState<{
    invoiceNumber: string;
    paymentAmount: number;
    isFullPayment: boolean;
    newRemainingAmount: number;
  } | null>(null);

  const generateInvoice = async (
    invoiceNumber: string,
    paymentAmount: number,
    isFullPayment: boolean,
    newRemainingAmount: number
  ) => {
    const pdf = new jsPDF();
    const pageWidth = 210;
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    
    const img = new Image();
    img.src = headerImage;
    await new Promise((resolve) => {
      img.onload = resolve;
    });
    
     // En-tête : préserver proportions avec limite de hauteur maximale
     const maxHeaderHeight = 40; // hauteur maximale en mm
     const headerRatio = img.width / img.height;
     
     let imgWidth = contentWidth;
     let imgHeight = imgWidth / headerRatio;
     
     // Limiter la hauteur si elle dépasse le maximum
     if (imgHeight > maxHeaderHeight) {
       imgHeight = maxHeaderHeight;
       imgWidth = imgHeight * headerRatio;
     }
     
     const imgX = margin + (contentWidth - imgWidth) / 2; // Centrer horizontalement
     pdf.addImage(img, "JPEG", imgX, 8, imgWidth, imgHeight);
     
     let yPos = 8 + imgHeight + 10;
    
    // Ligne de séparation
    pdf.setDrawColor(30, 60, 110);
    pdf.setLineWidth(0.8);
    pdf.line(margin, yPos, pageWidth - margin, yPos);
    
    // Titre
    yPos += 12;
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(30, 60, 110);
    pdf.text(isFullPayment ? "REÇU DE PAIEMENT TOTAL" : "REÇU D'ACOMPTE", pageWidth / 2, yPos, { align: "center" });
    
    // N° et Date sur la même ligne
    yPos += 12;
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(80, 80, 80);
    const displayRmbNumber = rmbNumber || invoiceNumber;
    pdf.text(`N° RMB: ${displayRmbNumber}`, margin, yPos);
    pdf.text(`Date: ${new Date().toLocaleDateString("fr-FR")}`, pageWidth - margin, yPos, { align: "right" });
    
    // Section Client
    yPos += 10;
    pdf.setFillColor(240, 245, 250);
    pdf.setDrawColor(30, 60, 110);
    pdf.setLineWidth(0.3);
    const clientBoxHeight = buyerName ? 28 : 22;
    pdf.roundedRect(margin, yPos, contentWidth, clientBoxHeight, 2, 2, "FD");
    
    yPos += 7;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(30, 60, 110);
    pdf.text("INFORMATIONS CLIENT", margin + 5, yPos);
    
    yPos += 6;
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(40, 40, 40);
    pdf.setFontSize(9);
    pdf.text(`Type: ${itemType === "hectare" ? "Hectare" : "Parcelle"}`, margin + 5, yPos);
    pdf.text(`Référence: ${itemName}`, margin + 80, yPos);
    if (buyerName) {
      yPos += 6;
      pdf.text(`Acheteur: ${buyerName}`, margin + 5, yPos);
    }
    
    // Tableau des montants
    yPos += 14;
    const col1W = contentWidth * 0.65;
    const col2W = contentWidth * 0.35;
    
    // Header tableau
    pdf.setFillColor(30, 60, 110);
    pdf.roundedRect(margin, yPos - 6, contentWidth, 10, 1, 1, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(255, 255, 255);
    pdf.text("DÉSIGNATION", margin + 5, yPos);
    pdf.text("MONTANT (USD)", margin + col1W + 5, yPos);
    
    // Lignes du tableau
    pdf.setTextColor(40, 40, 40);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.3);
    
    // Ligne 1 : Prix total
    yPos += 10;
    pdf.setFillColor(255, 255, 255);
    pdf.rect(margin, yPos - 6, col1W, 10, "FD");
    pdf.rect(margin + col1W, yPos - 6, col2W, 10, "FD");
    pdf.text(`Prix total ${itemType}`, margin + 5, yPos);
    pdf.text(`$ ${totalPrice.toLocaleString()}`, margin + col1W + 5, yPos);
    
    // Ligne 2 : Paiement
    yPos += 10;
    pdf.setFillColor(248, 248, 248);
    pdf.rect(margin, yPos - 6, col1W, 10, "FD");
    pdf.rect(margin + col1W, yPos - 6, col2W, 10, "FD");
    pdf.text(isFullPayment ? "Paiement total" : "Acompte versé", margin + 5, yPos);
    pdf.setFont("helvetica", "bold");
    pdf.text(`$ ${paymentAmount.toLocaleString()}`, margin + col1W + 5, yPos);
    pdf.setFont("helvetica", "normal");
    
    // Ligne 3 : Reste à payer
    if (!isFullPayment) {
      yPos += 10;
      pdf.setFillColor(255, 248, 230);
      pdf.rect(margin, yPos - 6, col1W, 10, "FD");
      pdf.rect(margin + col1W, yPos - 6, col2W, 10, "FD");
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(180, 100, 0);
      pdf.text("Reste à payer", margin + 5, yPos);
      pdf.text(`$ ${newRemainingAmount.toLocaleString()}`, margin + col1W + 5, yPos);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(40, 40, 40);
    }
    
    // Infos complémentaires
    yPos += 16;
    if (paymentMethod) {
      pdf.setFontSize(9);
      pdf.setTextColor(80, 80, 80);
      pdf.text(`Mode de paiement: ${paymentMethod}`, margin, yPos);
      yPos += 7;
    }
    
    if (notes) {
      pdf.setFontSize(9);
      pdf.setTextColor(80, 80, 80);
      pdf.text(`Notes: ${notes}`, margin, yPos);
      yPos += 7;
    }
    
    // Ligne de séparation finale
    yPos += 5;
    pdf.setDrawColor(30, 60, 110);
    pdf.setLineWidth(0.3);
    pdf.line(margin, yPos, pageWidth - margin, yPos);
    
    // Pied de page
    yPos += 7;
    pdf.setFontSize(8);
    pdf.setTextColor(140, 140, 140);
    pdf.text("Ce document fait office de reçu de paiement.", pageWidth / 2, yPos, { align: "center" });
    
    pdf.save(`Recu_${displayRmbNumber}_${itemName}.pdf`);
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
      
      // Stocker les données du paiement pour permettre la génération de facture
      setLastPaymentData({
        invoiceNumber,
        paymentAmount,
        isFullPayment,
        newRemainingAmount,
      });
      
      toast.success(isFullPayment ? "Paiement total effectué !" : "Acompte enregistré !");
      onPaymentComplete();
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
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        setLastPaymentData(null);
      }
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {lastPaymentData ? "Paiement enregistré" : "Enregistrer un paiement"}
          </DialogTitle>
        </DialogHeader>
        
        {lastPaymentData ? (
          <div className="space-y-4">
            <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-lg">
              <p className="text-sm text-foreground">
                Le paiement de <span className="font-bold">${lastPaymentData.paymentAmount.toLocaleString()}</span> a été enregistré avec succès.
              </p>
              {!lastPaymentData.isFullPayment && (
                <p className="text-sm text-muted-foreground mt-2">
                  Reste à payer: <span className="font-semibold">${lastPaymentData.newRemainingAmount.toLocaleString()}</span>
                </p>
              )}
            </div>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setLastPaymentData(null);
                  onOpenChange(false);
                }}
              >
                Fermer
              </Button>
              <Button
                className="flex-1"
                onClick={async () => {
                  await generateInvoice(
                    lastPaymentData.invoiceNumber,
                    lastPaymentData.paymentAmount,
                    lastPaymentData.isFullPayment,
                    lastPaymentData.newRemainingAmount
                  );
                  toast.success("Facture générée avec succès");
                }}
              >
                Générer facture
              </Button>
            </div>
          </div>
        ) : (
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
        )}
      </DialogContent>
    </Dialog>
  );
};
