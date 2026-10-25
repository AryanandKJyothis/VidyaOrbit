import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, MessageCircle, UserX } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import {
  QueryErrorState,
  QueryLoadingSkeleton,
} from "@/components/query-state";
import { RoutePermissionGate } from "@/components/route-permission-gate";
import { InitialsAvatar } from "@/components/app/initials-avatar";
import { useInstitute } from "@/hooks/use-data";
import { useActiveWorkspace, useCan } from "@/hooks/use-active-workspace";
import { supabase } from "@/integrations/supabase/client";
import { todayISO } from "@/lib/format";
import { canMessageAbsentees } from "@/lib/absentees";
import { markOutboxSent } from "@/lib/messaging/client";
import {
  buildAssistedWhatsAppHref,
  openAssistedWhatsApp,
} from "@/lib/messaging/wa-me";
import { summarizeOutboxRows } from "@/lib/messaging/summarize";
import type { MessageOutboxRow, OutboxStatus } from "@/lib/messaging/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/absentees")({
  component: () => (
    <RoutePermissionGate resource="attendance" level="read">
      <AbsenteesPage />
    </RoutePermissionGate>
  ),
});

type QueueRow = {
  id: string;
  studentId: string | null;
  studentName: string;
  batchName: string;
  phone: string | null;
  body: string | null;
  status: OutboxStatus;
  skipReason: string | null;
  href: string | null;
};

function AbsenteesPage() {
  const { active } = useActiveWorkspace();
  const canSend = canMessageAbsentees(useCan("messages", "write"));
  const institute = useInstitute();
  const qc = useQueryClient();
  const today = todayISO();
  const [sendingId, setSendingId] = useState<string | null>(null);

  const outbox = useQuery({
    queryKey: ["message-outbox", active?.ownerId, today],
    enabled: !!active?.ownerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_outbox")
        .select(
          "id, student_id, session_date, phone, body, status, skip_reason, payload, kind",
        )
        .eq("owner_id", active!.ownerId)
        .eq("kind", "absence")
        .eq("session_date", today)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Pick<
        MessageOutboxRow,
        | "id"
        | "student_id"
        | "session_date"
        | "phone"
        | "body"
        | "status"
        | "skip_reason"
        | "payload"
        | "kind"
      >[];
    },
  });

  const rows = useMemo<QueueRow[]>(() => {
    return (outbox.data ?? []).map((row) => {
      const payload = (row.payload ?? {}) as {
        studentName?: string;
        batchName?: string;
      };
      return {
        id: row.id,
        studentId: row.student_id,
        studentName: payload.studentName ?? "Student",
        batchName: payload.batchName ?? "Class",
        phone: row.phone,
        body: row.body,
        status: row.status as OutboxStatus,
        skipReason: row.skip_reason,
        href: buildAssistedWhatsAppHref(row.phone, row.body),
      };
    });
  }, [outbox.data]);

  const summary = useMemo(
    () =>
      summarizeOutboxRows(
        (outbox.data ?? []).map((row) => ({
          status: row.status as OutboxStatus,
          skip_reason: row.skip_reason,
        })),
      ),
    [outbox.data],
  );

  const sendOne = async (row: QueueRow) => {
    if (!active?.ownerId) return;
    if (row.status === "skipped" && row.skipReason === "no_phone") {
      toast.error("Add a parent phone on the student record first.");
      return;
    }
    if (!row.href) {
      toast.error("This draft has no WhatsApp number.");
      return;
    }
    if (!openAssistedWhatsApp(row.href)) {
      toast.error("Allow pop-ups to open WhatsApp.");
      return;
    }
    setSendingId(row.id);
    const result = await markOutboxSent({
      ownerId: active.ownerId,
      outboxId: row.id,
    });
    setSendingId(null);
    if (!result.ok && result.code !== "ALREADY_PROCESSED") {
      toast.error(result.message ?? "Could not mark this message sent.");
      return;
    }
    void qc.invalidateQueries({ queryKey: ["message-outbox"] });
  };

  if (outbox.isLoading || institute.isLoading) {
    return <QueryLoadingSkeleton />;
  }

  if (outbox.isError) {
    return (
      <QueryErrorState
        error={outbox.error as Error}
        title="Could not load today's parent alerts"
        onRetry={() => void outbox.refetch()}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Today's absentees"
        description={
          summary.queued > 0
            ? `${summary.queued} parent${summary.queued === 1 ? "" : "s"} to notify from your WhatsApp.`
            : "Absence drafts for today. You send from the centre's own WhatsApp."
        }
        actions={
          <Button asChild variant="outline">
            <Link to="/attendance">Back to attendance</Link>
          </Button>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={UserX}
          title="No absentees yet"
          description="When you mark someone absent today, a WhatsApp draft is queued here for the parent."
        >
          <Button asChild>
            <Link to="/attendance">Mark attendance</Link>
          </Button>
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {summary.skippedNoPhone > 0 && (
            <p className="text-sm text-destructive">
              {summary.skippedNoPhone} student
              {summary.skippedNoPhone === 1 ? "" : "s"} skipped — add a parent
              phone on the student record.
            </p>
          )}
          {groupByBatch(rows).map((group) => (
            <Card key={group.batchName}>
              <CardContent className="p-4 sm:p-5">
                <h2 className="font-display text-base font-semibold">
                  {group.batchName}
                </h2>
                <p className="mb-3 text-xs text-muted-foreground">
                  {group.rows.length} absent
                </p>
                <ul className="divide-y divide-border">
                  {group.rows.map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <InitialsAvatar name={row.studentName} size="sm" />
                        <div className="min-w-0">
                          {row.studentId ? (
                            <Link
                              to="/students/$id"
                              params={{ id: row.studentId }}
                              className="truncate text-sm font-semibold hover:underline"
                            >
                              {row.studentName}
                            </Link>
                          ) : (
                            <p className="truncate text-sm font-semibold">
                              {row.studentName}
                            </p>
                          )}
                          <StatusLine row={row} />
                        </div>
                      </div>
                      {canSend && row.status !== "skipped" && (
                        <Button
                          size="sm"
                          disabled={sendingId === row.id}
                          onClick={() => void sendOne(row)}
                        >
                          <MessageCircle className="mr-1.5 h-4 w-4" />
                          {row.status === "sent" ? "Open again" : "Send to parent"}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusLine({ row }: { row: QueueRow }) {
  if (row.status === "sent") {
    return (
      <p className="mt-0.5 flex items-center gap-1 text-xs text-success">
        <Check className="h-3.5 w-3.5" /> Sent from your WhatsApp
      </p>
    );
  }
  if (row.status === "skipped" && row.skipReason === "no_phone") {
    return (
      <p className="mt-0.5 text-xs text-destructive">
        Skipped — no parent phone
      </p>
    );
  }
  if (row.status === "skipped") {
    return (
      <p className="mt-0.5 text-xs text-muted-foreground">
        Skipped — no longer marked absent
      </p>
    );
  }
  if (row.status === "failed") {
    return (
      <p className="mt-0.5 text-xs text-destructive">Send failed — try again</p>
    );
  }
  return (
    <p className="mt-0.5 text-xs text-muted-foreground">
      Draft ready · {row.phone ?? "no number"}
    </p>
  );
}

function groupByBatch(rows: QueueRow[]) {
  const map = new Map<string, QueueRow[]>();
  for (const row of rows) {
    const list = map.get(row.batchName) ?? [];
    list.push(row);
    map.set(row.batchName, list);
  }
  return [...map.entries()]
    .map(([batchName, groupRows]) => ({ batchName, rows: groupRows }))
    .sort((a, b) => a.batchName.localeCompare(b.batchName, "en"));
}
