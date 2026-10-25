import { Check, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate, formatINR } from "@/lib/format";
import type { OutboxStatus } from "@/lib/messaging/types";

export type OverdueQueueItem = {
  studentId: string;
  studentName: string;
  balance: number;
  dueDate: string;
  lastRemindedAt: string | null;
  outboxId: string | null;
  status: OutboxStatus | null;
  skipReason: string | null;
};

/** Overdue-only list (amount desc). Queue all, then assisted wa.me send. */
export function FeeOverdueQueue({
  open,
  onOpenChange,
  items,
  canQueue,
  canSend,
  queueing,
  sendingId,
  onQueueAll,
  onSend,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: OverdueQueueItem[];
  canQueue: boolean;
  canSend: boolean;
  queueing: boolean;
  sendingId: string | null;
  onQueueAll: () => void;
  onSend: (item: OverdueQueueItem) => void;
}) {
  const skipped = items.filter(
    (item) => item.status === "skipped" && item.skipReason === "no_phone",
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg min-w-0 overflow-hidden">
        <DialogHeader className="min-w-0 pr-8">
          <DialogTitle>Remind overdue</DialogTitle>
        </DialogHeader>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No students have a balance past their due date.
          </p>
        ) : (
          <div className="min-w-0 space-y-3">
            <p className="text-sm text-muted-foreground">
              {items.length} overdue student{items.length === 1 ? "" : "s"},
              largest balance first. No UPI link — you send from the
              centre&apos;s WhatsApp.
            </p>
            {skipped > 0 && (
              <p className="text-xs text-destructive">
                {skipped} skipped — add a parent phone on the student record.
              </p>
            )}
            <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-lg border">
              {items.map((item) => (
                <OverdueRow
                  key={item.studentId}
                  item={item}
                  canSend={canSend}
                  sending={sendingId === item.outboxId}
                  onSend={onSend}
                />
              ))}
            </ul>
          </div>
        )}
        <DialogFooter className="min-w-0 flex-wrap gap-2 sm:flex-row sm:justify-end">
          {canQueue && items.length > 0 && (
            <Button type="button" disabled={queueing} onClick={onQueueAll}>
              <MessageCircle className="mr-1.5 h-4 w-4" />
              {queueing ? "Queuing…" : "Queue all overdue"}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OverdueRow({
  item,
  canSend,
  sending,
  onSend,
}: {
  item: OverdueQueueItem;
  canSend: boolean;
  sending: boolean;
  onSend: (item: OverdueQueueItem) => void;
}) {
  return (
    <li className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{item.studentName}</p>
        <p className="text-xs text-muted-foreground">
          {formatINR(item.balance)} · due {formatDate(item.dueDate)}
        </p>
        <LastRemindedLine item={item} />
      </div>
      {canSend && item.status === "queued" && item.outboxId && (
        <Button
          type="button"
          size="sm"
          disabled={sending}
          onClick={() => onSend(item)}
        >
          <MessageCircle className="mr-1.5 h-4 w-4" />
          Send to parent
        </Button>
      )}
      {canSend && item.status === "sent" && item.outboxId && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={sending}
          onClick={() => onSend(item)}
        >
          Open again
        </Button>
      )}
    </li>
  );
}

function LastRemindedLine({ item }: { item: OverdueQueueItem }) {
  if (item.status === "skipped" && item.skipReason === "no_phone") {
    return (
      <p className="mt-0.5 text-xs text-destructive">
        Skipped — no parent phone
      </p>
    );
  }
  if (item.status === "queued") {
    return (
      <p className="mt-0.5 text-xs text-muted-foreground">
        Draft ready
        {item.lastRemindedAt
          ? ` · last reminded ${formatDate(item.lastRemindedAt)}`
          : ""}
      </p>
    );
  }
  if (item.lastRemindedAt) {
    return (
      <p className="mt-0.5 flex items-center gap-1 text-xs text-success">
        <Check className="h-3.5 w-3.5" /> last reminded{" "}
        {formatDate(item.lastRemindedAt)}
      </p>
    );
  }
  return (
    <p className="mt-0.5 text-xs text-muted-foreground">Not reminded yet</p>
  );
}
