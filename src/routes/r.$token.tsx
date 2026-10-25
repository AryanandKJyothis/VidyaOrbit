import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { ReceiptDocument } from "@/components/public/receipt-document";
import {
  SharePageShell,
  ShareUnavailable,
} from "@/components/public/share-page-shell";
import { supabase } from "@/integrations/supabase/client";
import { pageHead, PUBLIC_PAGES } from "@/lib/seo";
import { isShareTokenShape, parsePublicReceipt } from "@/lib/share-links";

export const Route = createFileRoute("/r/$token")({
  component: PublicReceiptPage,
  head: () => pageHead(PUBLIC_PAGES.publicReceipt),
});

function PublicReceiptPage() {
  const { token } = useParams({ from: "/r/$token" });
  const lookup = useQuery({
    queryKey: ["public-receipt", token],
    enabled: isShareTokenShape(token),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_receipt", {
        _token: token,
      });
      if (error) throw error;
      return parsePublicReceipt(data);
    },
  });

  const receipt = lookup.data;

  return (
    <SharePageShell title="Fee receipt" canPrint={receipt?.ok === true}>
      {!isShareTokenShape(token) ||
      (lookup.isSuccess &&
        receipt &&
        !receipt.ok &&
        receipt.reason !== "unavailable") ? (
        <ShareUnavailable
          title={
            receipt && !receipt.ok && receipt.reason === "revoked"
              ? "This receipt link was turned off"
              : "Receipt not found"
          }
          body="Ask the centre for a new link if you still need this receipt."
        />
      ) : lookup.isLoading ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : lookup.isError ||
        (receipt && !receipt.ok && receipt.reason === "unavailable") ? (
        <ShareUnavailable
          title="Could not open this receipt"
          body="Try again in a moment, or ask the centre to send the link again."
        />
      ) : receipt?.ok ? (
        <ReceiptDocument receipt={receipt} />
      ) : null}
    </SharePageShell>
  );
}
