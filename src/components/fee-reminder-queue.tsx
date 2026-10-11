import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  openWhatsApp,
  reminderSkipReason,
  type FeeReminderResult,
} from "@/lib/fee-reminder";
import { toast } from "sonner";

export type ReminderQueueItem = {
  studentId: string;
  studentName: string;
  result: FeeReminderResult;
};

/** One WhatsApp chat at a time. Skipped students stay visible so nothing is silent. */
export function FeeReminderQueue({
  open,
  onOpenChange,
  items,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: ReminderQueueItem[];
}) {
  const sendable = items.filter(
    (
      item,
    ): item is ReminderQueueItem & {
      result: Extract<FeeReminderResult, { ok: true }>;
    } => item.result.ok,
  );
  const skipped = items.filter((item) => !item.result.ok);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (open) setIndex(0);
  }, [open, items]);

  const current = sendable[index];
  const finished = !current;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send fee reminders</DialogTitle>
        </DialogHeader>
        {finished ? (
          <p className="text-sm text-muted-foreground">
            {sendable.length === 0
              ? "None of the selected students have a phone number WhatsApp can open."
              : "Those reminders are ready in WhatsApp."}
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {index + 1} of {sendable.length} · {current.studentName}
              {current.result.phoneSource === "student"
                ? " · student phone"
                : " · guardian phone"}
            </p>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm">
              {current.result.message}
            </pre>
          </div>
        )}
        {skipped.length > 0 && (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {skipped.map((item) => (
              <li key={item.studentId}>
                {item.studentName}
                {!item.result.ok
                  ? `: ${reminderSkipReason(item.result.reason)}`
                  : ""}
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          {current && (
            <Button
              type="button"
              onClick={() => {
                if (!openWhatsApp(current.result.href)) {
                  toast.error("Allow pop-ups to open WhatsApp.");
                }
              }}
            >
              Open WhatsApp
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!current || index >= sendable.length - 1) {
                onOpenChange(false);
                return;
              }
              setIndex((i) => i + 1);
            }}
          >
            {!current || index >= sendable.length - 1 ? "Done" : "Next"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
