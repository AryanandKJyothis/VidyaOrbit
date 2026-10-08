/**
 * Tests for Razorpay signature verification
 */
import { describe, it, expect } from "vitest";
import crypto from "node:crypto";

/**
 * Verify Razorpay payment signature (order_id|payment_id)
 */
function verifyPaymentSignature(
  keySecret: string,
  orderId: string,
  paymentId: string,
  signature: string,
): boolean {
  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  // Length check before timingSafeEqual (it throws if lengths don't match)
  if (expected.length !== signature.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

describe("Razorpay Signature Verification", () => {
  const testSecret = "test_secret_key_12345";
  const testOrderId = "order_ABC123";
  const testPaymentId = "pay_XYZ789";

  it("should verify valid signature", () => {
    const validSignature = crypto
      .createHmac("sha256", testSecret)
      .update(`${testOrderId}|${testPaymentId}`)
      .digest("hex");

    const result = verifyPaymentSignature(
      testSecret,
      testOrderId,
      testPaymentId,
      validSignature,
    );

    expect(result).toBe(true);
  });

  it("should reject invalid signature", () => {
    const invalidSignature = "invalid_signature_abcdef1234567890";

    const result = verifyPaymentSignature(
      testSecret,
      testOrderId,
      testPaymentId,
      invalidSignature,
    );

    expect(result).toBe(false);
  });

  it("should reject signature with wrong order_id", () => {
    const signature = crypto
      .createHmac("sha256", testSecret)
      .update(`wrong_order_id|${testPaymentId}`)
      .digest("hex");

    const result = verifyPaymentSignature(
      testSecret,
      testOrderId,
      testPaymentId,
      signature,
    );

    expect(result).toBe(false);
  });

  it("should reject signature with wrong payment_id", () => {
    const signature = crypto
      .createHmac("sha256", testSecret)
      .update(`${testOrderId}|wrong_payment_id`)
      .digest("hex");

    const result = verifyPaymentSignature(
      testSecret,
      testOrderId,
      testPaymentId,
      signature,
    );

    expect(result).toBe(false);
  });

  it("should reject signature with wrong secret", () => {
    const signature = crypto
      .createHmac("sha256", "wrong_secret")
      .update(`${testOrderId}|${testPaymentId}`)
      .digest("hex");

    const result = verifyPaymentSignature(
      testSecret,
      testOrderId,
      testPaymentId,
      signature,
    );

    expect(result).toBe(false);
  });

  it("should handle length mismatch gracefully", () => {
    const shortSignature = "abc123";

    const result = verifyPaymentSignature(
      testSecret,
      testOrderId,
      testPaymentId,
      shortSignature,
    );

    expect(result).toBe(false);
  });

  it("should be case-sensitive", () => {
    const validSignature = crypto
      .createHmac("sha256", testSecret)
      .update(`${testOrderId}|${testPaymentId}`)
      .digest("hex");

    const uppercaseSignature = validSignature.toUpperCase();

    const result = verifyPaymentSignature(
      testSecret,
      testOrderId,
      testPaymentId,
      uppercaseSignature,
    );

    expect(result).toBe(false);
  });

  it("should verify signature with special characters", () => {
    const specialOrderId = "order_ABC-123_XYZ.456";
    const specialPaymentId = "pay_XYZ-789_ABC.012";

    const signature = crypto
      .createHmac("sha256", testSecret)
      .update(`${specialOrderId}|${specialPaymentId}`)
      .digest("hex");

    const result = verifyPaymentSignature(
      testSecret,
      specialOrderId,
      specialPaymentId,
      signature,
    );

    expect(result).toBe(true);
  });
});
