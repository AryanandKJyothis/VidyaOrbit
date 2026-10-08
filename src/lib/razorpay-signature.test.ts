/**
 * Tests for Razorpay checkout signature verification (real helper).
 */
import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { verifyCheckoutSignature } from "@/lib/billing-signature";

describe("Razorpay Signature Verification", () => {
  const testSecret = "test_secret_key_12345";
  const testOrderId = "order_ABC123";
  const testPaymentId = "pay_XYZ789";

  it("should verify valid signature", () => {
    const validSignature = crypto
      .createHmac("sha256", testSecret)
      .update(`${testOrderId}|${testPaymentId}`)
      .digest("hex");
    expect(
      verifyCheckoutSignature(
        testOrderId,
        testPaymentId,
        validSignature,
        testSecret,
      ),
    ).toBe(true);
  });

  it("should reject invalid signature", () => {
    expect(
      verifyCheckoutSignature(
        testOrderId,
        testPaymentId,
        "invalid_signature_abcdef1234567890",
        testSecret,
      ),
    ).toBe(false);
  });

  it("should reject signature with wrong order_id", () => {
    const signature = crypto
      .createHmac("sha256", testSecret)
      .update(`wrong_order_id|${testPaymentId}`)
      .digest("hex");
    expect(
      verifyCheckoutSignature(
        testOrderId,
        testPaymentId,
        signature,
        testSecret,
      ),
    ).toBe(false);
  });

  it("should handle length mismatch gracefully", () => {
    expect(
      verifyCheckoutSignature(testOrderId, testPaymentId, "abc123", testSecret),
    ).toBe(false);
  });
});
