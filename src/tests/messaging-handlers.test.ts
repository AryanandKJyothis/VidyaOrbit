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
    const res = await GET(new Request("http://localhost/api/messaging/process-auto"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.processed).toBe(0);
    expect(body.note).toMatch(/assisted send/i);
  });
});
