/**
 * Tier 2 auto-send worker. Stubbed for A1.
 * Assisted wa.me is the main path. This runs only when a centre has
 * `wa_auto` on and a verified WhatsApp number + templates.
 */

export type WorkerOutboxRow = {
  id: string;
  phone: string | null;
  body: string | null;
  kind: string;
};

export type WorkerSendResult =
  | { ok: false; code: "WA_AUTO_OFF" }
  | { ok: false; code: "NOT_CONFIGURED"; message: string }
  | { ok: false; code: "SEND_FAILED"; message: string }
  | { ok: true; providerMessageId: string };

export type ParentMessageWorker = {
  send: (row: WorkerOutboxRow) => Promise<WorkerSendResult>;
};

export type WhatsAppWorkerConfig = {
  accessToken: string | null;
  phoneNumberId: string | null;
  apiVersion: string;
};

export function readWhatsAppWorkerConfig(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): WhatsAppWorkerConfig {
  return {
    accessToken: env.WHATSAPP_ACCESS_TOKEN?.trim() || null,
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID?.trim() || null,
    apiVersion: env.WHATSAPP_API_VERSION?.trim() || "v21.0",
  };
}

export function isWhatsAppWorkerConfigured(config: WhatsAppWorkerConfig): boolean {
  return Boolean(config.accessToken && config.phoneNumberId);
}

/**
 * Never reports success unless a live provider ack exists.
 * When credentials are missing, returns NOT_CONFIGURED — not sent.
 */
export function createWhatsAppWorker(
  config: WhatsAppWorkerConfig,
  fetchImpl: typeof fetch = fetch,
): ParentMessageWorker {
  return {
    async send(row) {
      if (!isWhatsAppWorkerConfigured(config)) {
        return {
          ok: false,
          code: "NOT_CONFIGURED",
          message:
            "WhatsApp auto-send is not configured. Use assisted wa.me send.",
        };
      }
      if (!row.phone || !row.body?.trim()) {
        return {
          ok: false,
          code: "SEND_FAILED",
          message: "Missing phone or message body.",
        };
      }
      const version = config.apiVersion.replace(/^\/+|\/+$/g, "");
      const url = `https://graph.facebook.com/${version}/${config.phoneNumberId}/messages`;
      const to = row.phone.replace(/^\+/, "");
      try {
        const res = await fetchImpl(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to,
            type: "text",
            text: { preview_url: false, body: row.body },
          }),
        });
        const json = (await res.json().catch(() => null)) as {
          messages?: { id?: string }[];
          error?: { message?: string };
        } | null;
        const providerMessageId = json?.messages?.[0]?.id;
        if (!res.ok || !providerMessageId) {
          return {
            ok: false,
            code: "SEND_FAILED",
            message:
              json?.error?.message ||
              `WhatsApp API ${res.status} ${res.statusText}`,
          };
        }
        return { ok: true, providerMessageId };
      } catch (e) {
        return {
          ok: false,
          code: "SEND_FAILED",
          message: e instanceof Error ? e.message : String(e),
        };
      }
    },
  };
}

/** Gate used by the cron stub. Auto-send never runs when the flag is off. */
export function shouldAutoSend(waAuto: boolean): boolean {
  return waAuto === true;
}

export async function dispatchAutoSend(input: {
  waAuto: boolean;
  row: WorkerOutboxRow;
  worker: ParentMessageWorker;
}): Promise<WorkerSendResult> {
  if (!shouldAutoSend(input.waAuto)) {
    return { ok: false, code: "WA_AUTO_OFF" };
  }
  return input.worker.send(input.row);
}
