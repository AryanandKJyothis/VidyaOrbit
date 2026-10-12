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
  markReminderOpened,
  openWhatsApp,
  parseOpenedReminderKeys,
  reminderOpenedKey,
  reminderSkipReason,
  REMINDER_OPENED_STORAGE_KEY,
  serializeOpenedReminderKeys,
  type FeeReminderResult,
} from "@/lib/fee-reminder";
import { todayISO } from "@/lib/format";
import { toast } from "sonner";

export type ReminderQueueItem = {
  studentId: string;
  studentName: string;
  feeDueDate?: string | null;
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
  const [openedKeys, setOpenedKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (open) setIndex(0);
  }, [open, items]);

  useEffect(() => {
    try {
      setOpenedKeys(
        parseOpenedReminderKeys(
          window.localStorage.getItem(REMINDER_OPENED_STORAGE_KEY),
        ),
      );
    } catch {
      /* ignore */
    }
  }, [open]);

  const current = sendable[index];
  const finished = !current;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md min-w-0 overflow-hidden">
        <DialogHeader className="min-w-0 pr-8">
          <DialogTitle>Send fee reminders</DialogTitle>
        </DialogHeader>
        {finished ? (
          <p className="text-sm text-muted-foreground">
            {sendable.length === 0
              ? "None of the selected students have a phone number WhatsApp can open."
              : "Those reminders are ready in WhatsApp."}
          </p>
        ) : (
          <div className="min-w-0 space-y-3">
            <p className="text-sm text-muted-foreground">
              {index + 1} of {sendable.length} · {current.studentName}
              {current.result.phoneSource === "student"
                ? " · student phone"
                : " · guardian phone"}
            </p>
            <div className="max-h-48 min-w-0 overflow-x-hidden overflow-y-auto rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap break-all [overflow-wrap:anywhere]">
              {current.result.message}
            </div>
          </div>
        )}
        {skipped.length > 0 && (
          <ul className="min-w-0 space-y-1 text-xs text-muted-foreground break-words">
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
        <DialogFooter className="min-w-0 flex-wrap gap-2 sm:flex-row sm:justify-end">
          {current && (
            <Button
              type="button"
              onClick={() => {
                if (!openWhatsApp(current.result.href)) {
                  toast.error("Allow pop-ups to open WhatsApp.");
                  return;
                }
                const key = reminderOpenedKey(
                  current.studentId,
                  current.feeDueDate ?? null,
                  todayISO(),
                );
                const next = markReminderOpened(openedKeys, key);
                setOpenedKeys(next);
                try {
                  window.localStorage.setItem(
                    REMINDER_OPENED_STORAGE_KEY,
                    serializeOpenedReminderKeys(next),
                  );
                } catch {
                  /* ignore */
                }
              }}
            >
              {openedKeys.has(
                reminderOpenedKey(
                  current.studentId,
                  current.feeDueDate ?? null,
                  todayISO(),
                ),
              )
                ? "Opened again"
                : "Open WhatsApp"}
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
