/**
 * Razorpay checkout component for in-app plan purchases (tier + cycle).
 * Loads Razorpay checkout.js once per page and handles the payment flow.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getContactLabel, getContactLink } from "@/lib/contact-config";
import { TIER_CHANGE_MESSAGE } from "@/lib/billing-guards";
import { planCodeForTier } from "@/lib/plan-limits";

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
  modal: { ondismiss: () => void };
}

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayError {
  error: { description?: string };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (res: RazorpayError) => void) => void;
}

type CheckoutProps = {
  tier: "starter" | "growth" | "large";
  cycle: "monthly" | "annual";
  onSuccess?: () => void | Promise<unknown>;
  onError?: (error: Error) => void;
  buttonLabel?: string;
  disabled?: boolean;
};

let checkoutScriptPromise: Promise<void> | null = null;

function loadRazorpayScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay checkout is browser-only"));
  }
  if (typeof window.Razorpay !== "undefined") {
    return Promise.resolve();
  }
  if (checkoutScriptPromise) return checkoutScriptPromise;

  checkoutScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Could not load payment system.")),
        { once: true },
      );
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      checkoutScriptPromise = null;
      reject(new Error("Could not load payment system."));
    };
    document.body.appendChild(script);
  });

  return checkoutScriptPromise;
}

function planIsActiveForTier(
  data: unknown,
  expectedPlan: string,
): boolean {
  if (!data || typeof data !== "object") return false;
  const row = data as {
    plan?: string;
    status?: string;
    expired?: boolean;
  };
  return (
    row.plan === expectedPlan &&
    row.status === "active" &&
    row.expired === false
  );
}

async function pollSubscriptionRefresh(
  onSuccess: (() => void | Promise<unknown>) | undefined,
  expectedPlan: string,
) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const data = await onSuccess?.();
    if (planIsActiveForTier(data, expectedPlan)) {
      toast.success("Your plan is now active");
      return;
    }
    await new Promise((r) => setTimeout(r, 5_000));
  }
}

export function RazorpayCheckout({
  tier,
  cycle,
  onSuccess,
  onError,
  buttonLabel,
  disabled,
}: CheckoutProps) {
  const [loading, setLoading] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(
    typeof window !== "undefined" && typeof window.Razorpay !== "undefined",
  );

  useEffect(() => {
    let cancelled = false;
    loadRazorpayScript()
      .then(() => {
        if (!cancelled) setScriptLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setScriptLoaded(false);
          toast.error("Could not load payment system.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCheckout = async () => {
    if (!scriptLoaded || typeof window.Razorpay === "undefined") {
      toast.error("Payment system is not ready yet.");
      return;
    }

    setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        toast.error("Please sign in to continue.");
        setLoading(false);
        return;
      }

      const orderRes = await fetch("/api/billing/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tier, cycle }),
      });

      const errorData = await orderRes.json().catch(() => ({}));

      if (!orderRes.ok || !errorData.ok) {
        if (errorData.code === "TIER_CHANGE_CONTACT_SUPPORT") {
          const link =
            (typeof errorData.contactLink === "string" &&
              errorData.contactLink) ||
            getContactLink();
          toast.error(errorData.message || TIER_CHANGE_MESSAGE, {
            action: link
              ? {
                  label: getContactLabel(),
                  onClick: () => window.open(link, "_blank", "noopener"),
                }
              : undefined,
          });
        } else {
          throw new Error(
            errorData.message || `Order creation failed (${orderRes.status})`,
          );
        }
        setLoading(false);
        return;
      }

      const orderData = errorData;

      const rzp = new window.Razorpay({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Vidya Orbit",
        description: `${tier.charAt(0).toUpperCase() + tier.slice(1)} ${cycle} plan`,
        order_id: orderData.orderId,
        handler: async (response: RazorpayResponse) => {
          try {
            const verifyRes = await fetch("/api/billing/verify-payment", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            if (!verifyRes.ok) {
              const verifyErr = await verifyRes.json().catch(() => ({}));
              throw new Error(
                verifyErr.message || "Payment verification failed",
              );
            }

            const verifyData = await verifyRes.json();

            if (!verifyData.ok) {
              throw new Error(
                verifyData.message || "Payment verification failed",
              );
            }

            if (verifyData.needsReview) {
              toast.info(
                verifyData.message ||
                  "Payment received. Changing plans while time remains needs a manual adjustment — we'll be in touch.",
              );
              await onSuccess?.();
            } else if (verifyData.status === "pending") {
              toast.info(
                "Payment received, processing. We'll confirm shortly.",
              );
              void pollSubscriptionRefresh(
                onSuccess,
                planCodeForTier(tier),
              );
            } else {
              toast.success("Your plan is now active");
              await onSuccess?.();
            }
          } catch (e) {
            const error = e as Error;
            console.error("[Razorpay checkout] Verification error:", error);
            toast.error(error?.message || "Payment verification failed");
            onError?.(error);
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            toast.info("Payment cancelled");
          },
        },
      });

      rzp.on("payment.failed", (res: RazorpayError) => {
        setLoading(false);
        const errorMsg =
          res?.error?.description || "Payment failed. Please try again.";
        toast.error(errorMsg);
        onError?.(new Error(errorMsg));
      });

      rzp.open();
    } catch (e) {
      const error = e as Error;
      console.error("[Razorpay checkout] Error:", error);
      toast.error(error?.message || "Could not start checkout");
      onError?.(error);
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleCheckout}
      disabled={disabled || loading || !scriptLoaded}
      className="w-full"
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Processing...
        </>
      ) : (
        buttonLabel || "Pay Now"
      )}
    </Button>
  );
}
