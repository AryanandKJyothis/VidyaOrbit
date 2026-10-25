import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportCardDocument } from "@/components/public/report-card-document";
import {
  SharePageShell,
  ShareUnavailable,
} from "@/components/public/share-page-shell";
import { supabase } from "@/integrations/supabase/client";
import { pageHead, PUBLIC_PAGES } from "@/lib/seo";
import { isShareTokenShape, parsePublicReport } from "@/lib/share-links";

export const Route = createFileRoute("/report/$token")({
  component: PublicReportPage,
  head: () => pageHead(PUBLIC_PAGES.publicReport),
});

function PublicReportPage() {
  const { token } = useParams({ from: "/report/$token" });
  const lookup = useQuery({
    queryKey: ["public-report", token],
    enabled: isShareTokenShape(token),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_report", {
        _token: token,
      });
      if (error) throw error;
      return parsePublicReport(data);
    },
  });

  const report = lookup.data;

  return (
    <SharePageShell title="Report card" canPrint={report?.ok === true}>
      {!isShareTokenShape(token) ||
      (lookup.isSuccess &&
        report &&
        !report.ok &&
        report.reason !== "unavailable") ? (
        <ShareUnavailable
          title={
            report && !report.ok && report.reason === "revoked"
              ? "This report link was turned off"
              : "Report card not found"
          }
          body="Ask the centre for a new link if you still need this report."
        />
      ) : lookup.isLoading ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : lookup.isError ||
        (report && !report.ok && report.reason === "unavailable") ? (
        <ShareUnavailable
          title="Could not open this report"
          body="Try again in a moment, or ask the centre to send the link again."
        />
      ) : report?.ok ? (
        <ReportCardDocument report={report} />
      ) : null}
    </SharePageShell>
  );
}
