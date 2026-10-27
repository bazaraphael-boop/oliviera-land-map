import { describe, expect, test } from "bun:test";
import { paymentProofPath, paymentProofUpdate, validatePaymentProof } from "../src/lib/payment-proof";

describe("payment proof", () => {
  test("accepts a payment photo and a PDF", () => {
    expect(validatePaymentProof({ type: "image/jpeg", size: 2048 })).toBeNull();
    expect(validatePaymentProof({ type: "application/pdf", size: 2048 })).toBeNull();
  });
  test("rejects empty and executable attachments", () => {
    expect(validatePaymentProof({ type: "image/jpeg", size: 0 })).not.toBeNull();
    expect(validatePaymentProof({ type: "application/javascript", size: 2048 })).not.toBeNull();
  });
  test("uses owner and payment IDs instead of accented buyer or file names", () => {
    expect(paymentProofPath("owner-id", "payment-id", "image/jpeg")).toBe("owner-id/payment-id/proof.jpg");
  });
  test("attaches proof to an existing payment without changing financial fields", () => {
    const payment = { amount: 22442, payment_date: "2026-10-27", invoice_number: "RMB 201" };
    const update = paymentProofUpdate("owner/payment/proof.pdf", "reçu.pdf");
    expect(Object.keys(update).sort()).toEqual(["proof_file_name", "proof_file_path"]);
    expect({ ...payment, ...update }).toEqual({
      amount: 22442, payment_date: "2026-10-27", invoice_number: "RMB 201",
      proof_file_path: "owner/payment/proof.pdf", proof_file_name: "reçu.pdf",
    });
  });
});