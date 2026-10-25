import { supabase } from "@/integrations/supabase/client";
import type { AbsenceQueueSummary, FeePaidQueueSummary } from "./types";

export type EnqueueAbsencesResponse = {
  ok: boolean;
  code?: string;
  message?: string;
  summary?: AbsenceQueueSummary;
};

export type EnqueueFeePaidResponse = {
  ok: boolean;
  code?: string;
  message?: string;
  summary?: FeePaidQueueSummary;
};

export type MarkSentResponse = {
  ok: boolean;
  code?: string;
  message?: string;
  href?: string | null;
};

async function bearerToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function enqueueAbsencesAfterSave(input: {
  ownerId: string;
  sessionId: string;
}): Promise<EnqueueAbsencesResponse> {
  const token = await bearerToken();
  if (!token) {
    return { ok: false, code: "UNAUTHORIZED", message: "Sign in again." };
  }
  try {
    const res = await fetch("/api/messaging/enqueue-absences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
    const body = (await res
      .json()
      .catch(() => null)) as EnqueueAbsencesResponse | null;
    if (!body) {
      return {
        ok: false,
        code: "BAD_RESPONSE",
        message: "Could not queue parent alerts.",
      };
    }
    return body;
  } catch {
    return {
      ok: false,
      code: "NETWORK",
      message: "Could not queue parent alerts.",
    };
  }
}

export async function enqueueFeePaidAfterPayment(input: {
  ownerId: string;
  paymentId: string;
}): Promise<EnqueueFeePaidResponse> {
  const token = await bearerToken();
  if (!token) {
    return { ok: false, code: "UNAUTHORIZED", message: "Sign in again." };
  }
  try {
    const res = await fetch("/api/messaging/enqueue-fee-paid", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
    const body = (await res.json().catch(() => null)) as
      | EnqueueFeePaidResponse
      | null;
    if (!body) {
      return {
        ok: false,
        code: "BAD_RESPONSE",
        message: "Could not queue the receipt acknowledgement.",
      };
    }
    return body;
  } catch {
    return {
      ok: false,
      code: "NETWORK",
      message: "Could not queue the receipt acknowledgement.",
    };
  }
}

export async function markOutboxSent(input: {
  ownerId: string;
  outboxId: string;
}): Promise<MarkSentResponse> {
  const token = await bearerToken();
  if (!token) {
    return { ok: false, code: "UNAUTHORIZED", message: "Sign in again." };
  }
  try {
    const res = await fetch("/api/messaging/mark-sent", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
    const body = (await res
      .json()
      .catch(() => null)) as MarkSentResponse | null;
    if (!body) {
      return {
        ok: false,
        code: "BAD_RESPONSE",
        message: "Could not mark the message sent.",
      };
    }
    return body;
  } catch {
    return {
      ok: false,
      code: "NETWORK",
      message: "Could not mark the message sent.",
    };
  }
}
