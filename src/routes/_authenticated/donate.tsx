import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Heart, Copy, Check, Smartphone, QrCode } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/donate")({
  component: DonatePage,
});

const UPI_ID = "jyothiskaryan@oksbi";
const PAYEE_NAME = "Aryanand K Jyothis";
const PAYMENT_PHONE = "+91 9446205826";

const PRESETS = [99, 299, 499, 999, 1999];

function DonatePage() {
  const [amount, setAmount] = useState<string>("299");
  const [copied, setCopied] = useState<string | null>(null);

  const numericAmount = Math.max(0, Number(amount) || 0);
  const upiLink = `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(PAYEE_NAME)}&cu=INR${numericAmount > 0 ? `&am=${numericAmount}` : ""}&tn=${encodeURIComponent("Support Vidya")}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiLink)}`;

  const copy = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div>
      <PageHeader
        title="Support Vidya"
        description="Vidya runs on institute subscriptions — tips here are optional and help fund ongoing development."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Heart className="h-4 w-4 text-rose-500" /> Make a donation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label className="text-xs text-muted-foreground">Choose an amount</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {PRESETS.map((v) => (
                  <Button
                    key={v}
                    variant={String(v) === amount ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAmount(String(v))}
                  >
                    ₹{v}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="amt">Or enter any amount (₹)</Label>
              <Input
                id="amt"
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="500"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button asChild size="lg" className="w-full">
                <a href={upiLink}>
                  <Smartphone className="mr-2 h-4 w-4" /> Pay with any UPI app
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full">
                <a href={upiLink.replace("upi://", "gpay://upi/")}>Pay with Google Pay</a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The UPI button works with Google Pay, PhonePe, Paytm, BHIM and any UPI app on your
              phone. On desktop, scan the QR with your phone.
            </p>

            <div className="rounded-lg border border-dashed p-4 text-sm">
              <div className="mb-2 font-medium">Or pay manually</div>
              <div className="grid gap-2">
                <Row
                  label="UPI ID"
                  value={UPI_ID}
                  onCopy={() => copy(UPI_ID, "upi")}
                  copied={copied === "upi"}
                />
                <Row
                  label="Phone (UPI)"
                  value={PAYMENT_PHONE}
                  onCopy={() => copy(PAYMENT_PHONE, "phone")}
                  copied={copied === "phone"}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCode className="h-4 w-4" /> Scan to pay
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <div className="rounded-lg border bg-white p-3">
              <img src={qrUrl} alt="UPI QR code" width={240} height={240} />
            </div>
            <div className="text-center text-xs text-muted-foreground">
              {numericAmount > 0 ? (
                <>
                  Pre-filled with{" "}
                  <span className="font-medium text-foreground">₹{numericAmount}</span>
                </>
              ) : (
                "Enter any amount in your UPI app"
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Donations are voluntary and non-refundable. Thank you for supporting independent software ❤️
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="truncate font-mono text-sm">{value}</div>
      </div>
      <Button size="sm" variant="ghost" onClick={onCopy}>
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}
