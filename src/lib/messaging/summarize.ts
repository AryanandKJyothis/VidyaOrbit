import type { AbsenceQueueSummary, MessageOutboxRow } from "./types";
import { EMPTY_ABSENCE_QUEUE_SUMMARY } from "./types";

export function summarizeOutboxRows(
  rows: Pick<MessageOutboxRow, "status" | "skip_reason">[],
): AbsenceQueueSummary {
  const summary = { ...EMPTY_ABSENCE_QUEUE_SUMMARY };
  for (const row of rows) {
    if (row.status === "queued") summary.queued += 1;
    else if (row.status === "sent") summary.sent += 1;
    else if (row.status === "failed") summary.failed += 1;
    else if (row.status === "skipped" && row.skip_reason === "no_phone") {
      summary.skippedNoPhone += 1;
    } else if (row.status === "skipped") {
      summary.skippedNotAbsent += 1;
    }
  }
  return summary;
}

/** Staff-facing line after attendance save. */
export function formatAbsenceQueueToast(summary: AbsenceQueueSummary): {
  title: string;
  description?: string;
} {
  if (summary.queued > 0 && summary.skippedNoPhone > 0) {
    return {
      title: `${summary.queued} parent${summary.queued === 1 ? "" : "s"} to notify`,
      description: `${summary.skippedNoPhone} skipped — no parent phone.`,
    };
  }
  if (summary.queued > 0) {
    return {
      title: `${summary.queued} parent${summary.queued === 1 ? "" : "s"} to notify`,
      description: "Open the queue to send from your WhatsApp.",
    };
  }
  if (summary.skippedNoPhone > 0) {
    return {
      title: "No parent phone on file",
      description: `Add a guardian phone for ${summary.skippedNoPhone} student${summary.skippedNoPhone === 1 ? "" : "s"} so we can queue a WhatsApp draft.`,
    };
  }
  if (summary.already > 0 || summary.sent > 0) {
    return {
      title: "Attendance saved",
      description: "Parent alerts were already queued for these absences.",
    };
  }
  return { title: "Attendance saved" };
}
