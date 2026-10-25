import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.fn();
const parseBearerMock = vi.fn();

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

vi.mock("@/server/require-bearer-user", () => ({
  parseBearerUserId: (...args: unknown[]) => parseBearerMock(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  allowRequest: () => true,
  clientAddress: () => "127.0.0.1",
  tooManyRequests: () =>
    Response.json({ error: "TOO_MANY_REQUESTS" }, { status: 429 }),
}));

const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STAFF = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const VIEWER = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const SESSION = "11111111-1111-4111-8111-111111111111";
const OUTBOX = "22222222-2222-4222-8222-222222222222";
const PAYMENT = "33333333-3333-4333-8333-333333333333";
const STUDENT = "44444444-4444-4444-8444-444444444444";

function thenable(result: { data?: unknown; error?: unknown }) {
  const api: Record<string, unknown> = {};
  const self = () => api;
  for (const m of [
    "select",
    "insert",
    "update",
    "upsert",
    "eq",
    "in",
    "limit",
    "order",
    "gte",
  ]) {
    api[m] = vi.fn(self);
  }
  api.maybeSingle = vi.fn(async () => result);
  api.single = vi.fn(async () => result);
  api.then = (
    resolve: (v: unknown) => unknown,
    reject?: (e: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return api;
}

function handlerOf(route: unknown, method: "GET" | "POST") {
  const h = (
    route as {
      options: {
        server: {
          handlers: Record<
            string,
            (ctx: { request: Request }) => Promise<Response>
          >;
        };
      };
    }
  ).options.server.handlers[method];
  if (!h) throw new Error(`missing ${method} handler`);
  return (request: Request) => h({ request } as never);
}

function jsonReq(url: string, body: unknown, headers?: HeadersInit) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/messaging/mark-sent", () => {
  beforeEach(() => {
    fromMock.mockReset();
    parseBearerMock.mockReset();
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("rejects fees:read without messages:write", async () => {
    parseBearerMock.mockResolvedValue({ ok: true, userId: VIEWER });
    fromMock.mockImplementation((table: string) => {
      if (table === "workspace_members") {
        return thenable({
          data: {
            role: "viewer",
            permissions: { fees: "read", messages: "none" },
          },
          error: null,
        });
      }
      return thenable({ data: null, error: null });
    });

    const { Route } = await import("@/routes/api/messaging/mark-sent");
    const POST = handlerOf(Route, "POST");
    const res = await POST(
      jsonReq("http://localhost/api/messaging/mark-sent", {
        ownerId: OWNER,
        outboxId: OUTBOX,
      }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("FORBIDDEN_MESSAGES");
  });

  it("rejects a viewer even if they post the owner's id", async () => {
    parseBearerMock.mockResolvedValue({ ok: true, userId: VIEWER });
    fromMock.mockImplementation((table: string) => {
      if (table === "workspace_members") {
        return thenable({
          data: { role: "viewer", permissions: { messages: "none" } },
          error: null,
        });
      }
      return thenable({ data: null, error: null });
    });

    const { Route } = await import("@/routes/api/messaging/mark-sent");
    const POST = handlerOf(Route, "POST");
    const res = await POST(
      jsonReq("http://localhost/api/messaging/mark-sent", {
        ownerId: OWNER,
        outboxId: OUTBOX,
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.code).toBe("FORBIDDEN_MESSAGES");
  });

  it("returns the wa.me href and marks sent for staff", async () => {
    parseBearerMock.mockResolvedValue({ ok: true, userId: STAFF });
    const updateApi = thenable({ data: null, error: null });
    fromMock.mockImplementation((table: string) => {
      if (table === "workspace_members") {
        return thenable({
          data: { role: "staff", permissions: {} },
          error: null,
        });
      }
      if (table === "message_outbox") {
        const api = thenable({
          data: {
            id: OUTBOX,
            owner_id: OWNER,
            phone: "+919876543210",
            body: "Dear parent, Amina was absent today",
            status: "queued",
          },
          error: null,
        });
        api.update = vi.fn(() => updateApi);
        return api;
      }
      return thenable({ data: null, error: null });
    });

    const { Route } = await import("@/routes/api/messaging/mark-sent");
    const POST = handlerOf(Route, "POST");
    const res = await POST(
      jsonReq("http://localhost/api/messaging/mark-sent", {
        ownerId: OWNER,
        outboxId: OUTBOX,
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.href).toContain("https://wa.me/919876543210?text=");
  });
});

describe("POST /api/messaging/enqueue-fee-paid", () => {
  beforeEach(() => {
    fromMock.mockReset();
    parseBearerMock.mockReset();
    vi.resetModules();
  });

  it("rejects fees:read — queueing a payment ack is a fees write", async () => {
    parseBearerMock.mockResolvedValue({ ok: true, userId: VIEWER });
    fromMock.mockImplementation((table: string) => {
      if (table === "workspace_members") {
        return thenable({
          data: {
            role: "viewer",
            permissions: { fees: "read", messages: "none" },
          },
          error: null,
        });
      }
      return thenable({ data: null, error: null });
    });
    const { Route } = await import("@/routes/api/messaging/enqueue-fee-paid");
    const POST = handlerOf(Route, "POST");
    const res = await POST(
      jsonReq("http://localhost/api/messaging/enqueue-fee-paid", {
        ownerId: OWNER,
        paymentId: PAYMENT,
      }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("FORBIDDEN_FEES");
  });

  it("does not insert a second row when the payment is already queued", async () => {
    parseBearerMock.mockResolvedValue({ ok: true, userId: STAFF });
    const upsertFn = vi.fn(() => thenable({ data: null, error: null }));
    fromMock.mockImplementation((table: string) => {
      if (table === "workspace_members") {
        return thenable({
          data: { role: "staff", permissions: {} },
          error: null,
        });
      }
      if (table === "fee_payments") {
        const api = thenable({
          data: {
            id: PAYMENT,
            owner_id: OWNER,
            student_id: STUDENT,
            amount: 1500,
            payment_date: "2026-10-25",
            receipt_number: "RCT-1",
          },
          error: null,
        });
        api.then = (
          resolve: (v: unknown) => unknown,
          reject?: (e: unknown) => unknown,
        ) =>
          Promise.resolve({
            data: [{ amount: 1500 }],
            error: null,
          }).then(resolve, reject);
        return api;
      }
      if (table === "students") {
        return thenable({
          data: {
            id: STUDENT,
            full_name: "Amina",
            guardian_phone: "9876543210",
            phone: null,
            fee_total: 2000,
          },
          error: null,
        });
      }
      if (table === "institute_messaging_settings") {
        return thenable({
          data: { wa_auto: false, locale: "en" },
          error: null,
        });
      }
      if (table === "receipt_shares") {
        return thenable({
          data: { share_token: "a".repeat(48), revoked_at: null },
          error: null,
        });
      }
      if (table === "message_outbox") {
        const api = thenable({
          data: [
            {
              id: OUTBOX,
              dedupe_key: `fee_paid:${PAYMENT}`,
              status: "queued",
              skip_reason: null,
            },
          ],
          error: null,
        });
        api.upsert = upsertFn;
        return api;
      }
      return thenable({ data: null, error: null });
    });

    const { Route } = await import("@/routes/api/messaging/enqueue-fee-paid");
    const POST = handlerOf(Route, "POST");
    const res = await POST(
      jsonReq("http://localhost/api/messaging/enqueue-fee-paid", {
        ownerId: OWNER,
        paymentId: PAYMENT,
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.summary.already).toBe(1);
    expect(upsertFn).not.toHaveBeenCalled();
  });
});

describe("POST /api/messaging/enqueue-fee-overdue", () => {
  beforeEach(() => {
    fromMock.mockReset();
    parseBearerMock.mockReset();
    vi.resetModules();
  });

  it("rejects fees:read — queueing overdue reminders is a fees write", async () => {
    parseBearerMock.mockResolvedValue({ ok: true, userId: VIEWER });
    fromMock.mockImplementation((table: string) => {
      if (table === "workspace_members") {
        return thenable({
          data: {
            role: "viewer",
            permissions: { fees: "read", messages: "none" },
          },
          error: null,
        });
      }
      return thenable({ data: null, error: null });
    });
    const { Route } =
      await import("@/routes/api/messaging/enqueue-fee-overdue");
    const POST = handlerOf(Route, "POST");
    const res = await POST(
      jsonReq("http://localhost/api/messaging/enqueue-fee-overdue", {
        ownerId: OWNER,
        studentIds: [STUDENT],
      }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("FORBIDDEN_FEES");
  });

  it("does not insert a second row inside the 3-day window", async () => {
    parseBearerMock.mockResolvedValue({ ok: true, userId: OWNER });
    const upsertFn = vi.fn(() => thenable({ data: null, error: null }));
    fromMock.mockImplementation((table: string) => {
      if (table === "students") {
        return thenable({
          data: [
            {
              id: STUDENT,
              full_name: "Amina",
              guardian_phone: "9876543210",
              phone: null,
              fee_total: 2000,
              fee_due_date: "2026-10-01",
              status: "active",
            },
          ],
          error: null,
        });
      }
      if (table === "fee_payments") {
        return thenable({
          data: [{ student_id: STUDENT, amount: 0 }],
          error: null,
        });
      }
      if (table === "institutes") {
        return thenable({
          data: { name: "Orbit Coaching" },
          error: null,
        });
      }
      if (table === "institute_messaging_settings") {
        return thenable({
          data: {
            wa_auto: false,
            locale: "en",
            fee_overdue_dedupe_days: 3,
          },
          error: null,
        });
      }
      if (table === "message_outbox") {
        const api = thenable({
          data: [
            {
              student_id: STUDENT,
              dedupe_key: `fee_overdue:${STUDENT}:2026-10-25`,
              status: "sent",
              created_at: "2026-10-25T04:00:00.000Z",
              sent_at: "2026-10-25T04:05:00.000Z",
              skip_reason: null,
            },
          ],
          error: null,
        });
        api.upsert = upsertFn;
        return api;
      }
      return thenable({ data: [], error: null });
    });

    const { Route } =
      await import("@/routes/api/messaging/enqueue-fee-overdue");
    const POST = handlerOf(Route, "POST");
    const res = await POST(
      jsonReq("http://localhost/api/messaging/enqueue-fee-overdue", {
        ownerId: OWNER,
        studentIds: [STUDENT],
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.summary.already).toBe(1);
    expect(upsertFn).not.toHaveBeenCalled();
  });

  it("drops zero-balance students and writes no UPI in the body", async () => {
    parseBearerMock.mockResolvedValue({ ok: true, userId: OWNER });
    const upsertFn = vi.fn(() => thenable({ data: null, error: null }));
    const paid = "55555555-5555-4555-8555-555555555555";
    fromMock.mockImplementation((table: string) => {
      if (table === "students") {
        return thenable({
          data: [
            {
              id: STUDENT,
              full_name: "Amina",
              guardian_phone: "9876543210",
              phone: null,
              fee_total: 2000,
              fee_due_date: "2026-10-01",
              status: "active",
            },
            {
              id: paid,
              full_name: "Paid Kid",
              guardian_phone: "9123456789",
              phone: null,
              fee_total: 2000,
              fee_due_date: "2026-10-01",
              status: "active",
            },
          ],
          error: null,
        });
      }
      if (table === "fee_payments") {
        return thenable({
          data: [
            { student_id: STUDENT, amount: 500 },
            { student_id: paid, amount: 2000 },
          ],
          error: null,
        });
      }
      if (table === "institutes") {
        return thenable({ data: { name: "Orbit Coaching" }, error: null });
      }
      if (table === "institute_messaging_settings") {
        return thenable({
          data: { wa_auto: false, locale: "en", fee_overdue_dedupe_days: 3 },
          error: null,
        });
      }
      if (table === "message_outbox") {
        const api = thenable({ data: [], error: null });
        api.upsert = upsertFn;
        return api;
      }
      return thenable({ data: [], error: null });
    });

    const { Route } =
      await import("@/routes/api/messaging/enqueue-fee-overdue");
    const POST = handlerOf(Route, "POST");
    const res = await POST(
      jsonReq("http://localhost/api/messaging/enqueue-fee-overdue", {
        ownerId: OWNER,
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(upsertFn).toHaveBeenCalledTimes(1);
    const rows = upsertFn.mock.calls[0]![0] as {
      student_id: string;
      body: string;
      kind: string;
    }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.student_id).toBe(STUDENT);
    expect(rows[0]?.kind).toBe("fee_overdue");
    expect(rows[0]?.body).toContain("₹1,500");
    expect(rows[0]?.body).toContain("Orbit Coaching");
    expect(rows[0]?.body).not.toMatch(/upi:/i);
  });
});

describe("POST /api/messaging/enqueue-absences", () => {
  beforeEach(() => {
    fromMock.mockReset();
    parseBearerMock.mockReset();
    vi.resetModules();
  });

  it("requires attendance write", async () => {
    parseBearerMock.mockResolvedValue({ ok: true, userId: VIEWER });
    fromMock.mockImplementation((table: string) => {
      if (table === "workspace_members") {
        return thenable({
          data: { role: "viewer", permissions: { attendance: "read" } },
          error: null,
        });
      }
      return thenable({ data: null, error: null });
    });
    const { Route } = await import("@/routes/api/messaging/enqueue-absences");
    const POST = handlerOf(Route, "POST");
    const res = await POST(
      jsonReq("http://localhost/api/messaging/enqueue-absences", {
        ownerId: OWNER,
        sessionId: SESSION,
      }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("FORBIDDEN_ATTENDANCE");
  });
});

describe("GET /api/messaging/process-auto", () => {
  beforeEach(() => {
    fromMock.mockReset();
    delete process.env.CRON_SECRET;
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  });

  it("does nothing when no centre has wa_auto on", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "institute_messaging_settings") {
        return thenable({ data: [], error: null });
      }
      return thenable({ data: [], error: null });
    });
    const { Route } = await import("@/routes/api/messaging/process-auto");
    const GET = handlerOf(Route, "GET");
    const res = await GET(
      new Request("http://localhost/api/messaging/process-auto"),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.processed).toBe(0);
    expect(body.note).toMatch(/assisted send/i);
  });
});
