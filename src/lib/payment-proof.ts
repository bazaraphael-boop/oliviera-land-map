import { z } from "zod";

export const PAYMENT_PROOF_BUCKET = "payment-proofs";
export const PAYMENT_PROOF_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const proofFileSchema = z.object({
  size: z.number().positive().max(50 * 1024 * 1024),
  type: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
});

export function validatePaymentProof(file: Pick<File, "type" | "size">): string | null {
  if (proofFileSchema.safeParse(file).success) return null;
  if (file.size === 0) return "Le fichier est vide.";
  if (file.size > 50 * 1024 * 1024) return "Le fichier dépasse 50 Mo.";
  return "Choisissez une photo JPG, PNG, WebP ou un PDF.";
}

export function paymentProofPath(userId: string, paymentId: string, mimeType: string): string {
  const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" }[mimeType];
  if (!extension) throw new Error("Format de preuve non pris en charge");
  return `${userId}/${paymentId}/proof.${extension}`;
}

// Existing payments are amended with attachment metadata only, never financial fields.
export function paymentProofUpdate(path: string, fileName: string) {
  return { proof_file_path: path, proof_file_name: fileName.slice(0, 255) };
}