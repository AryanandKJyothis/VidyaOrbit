/**
 * Razorpay checkout component for in-app annual plan purchase.
 * Loads Razorpay checkout.js and handles the payment flow.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    Razorpay?: any;
  }
}

type CheckoutProps = {
  intent: "activate" | "renew";
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  buttonLabel?: string;
  disabled?: boolean;
};

export function RazorpayCheckout({
  intent,
  onSuccess,
  onError,
  buttonLabel,
  disabled,
}: CheckoutProps) {
  const [loading, setLoading] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Load Razorpay checkout.js
  useEffect(() => {
    if (typeof window.Razorpay !== "undefined") {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => {
      toast.error("Could not load payment system.");
      setScriptLoaded(false);
    };
    document.body.appendChild(script);

    return () => {
      try {
        document.body.removeChild(script);
      } catch {
        // Script already removed
      }
    };
  }, []);

  const handleCheckout = async () => {
    if (!scriptLoaded || typeof window.Razorpay === "undefined") {
      toast.error("Payment system is not ready yet.");
      return;
    }

    setLoading(true);

    try {
      // Get session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        toast.error("Please sign in to continue.");
        setLoading(false);
        return;
      }

      // Create order
      const orderRes = await fetch("/api/billing/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ intent }),
      });

      if (!orderRes.ok) {
        const errorData = await orderRes.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Order creation failed (${orderRes.status})`,
        );
      }

      const orderData = await orderRes.json();

      if (!orderData.ok) {
        throw new Error(orderData.message || "Order creation failed");
      }

      // Initialize Razorpay checkout
      const rzp = new window.Razorpay({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Vidya Orbit",
        description: intent === "activate" ? "Annual Plan Activation" : "Annual Plan Renewal",
        order_id: orderData.orderId,
        handler: async (response: any) => {
          try {
            // Verify payment
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
              const errorData = await verifyRes.json().catch(() => ({}));
              throw new Error(
                errorData.message || "Payment verification failed",
              );
            }

            const verifyData = await verifyRes.json();

            if (!verifyData.ok) {
              throw new Error(verifyData.message || "Payment verification failed");
            }

            toast.success("Payment successful! Your plan is now active.");
            onSuccess?.();
          } catch (e: any) {
            console.error("[Razorpay checkout] Verification error:", e);
            toast.error(e?.message || "Payment verification failed");
            onError?.(e);
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

      rzp.on("payment.failed", (res: any) => {
        setLoading(false);
        const errorMsg =
          res?.error?.description || "Payment failed. Please try again.";
        toast.error(errorMsg);
        onError?.(new Error(errorMsg));
      });

      rzp.open();
    } catch (e: any) {
      console.error("[Razorpay checkout] Error:", e);
      toast.error(e?.message || "Could not start checkout");
      onError?.(e);
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
