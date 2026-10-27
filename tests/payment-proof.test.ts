import { describe, expect, test } from "bun:test";
import { paymentProofPath, validatePaymentProof } from "../src/lib/payment-proof";

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
});