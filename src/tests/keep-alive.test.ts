import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.fn();

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

function thenable(result: { error?: unknown; count?: number | null }) {
  const api: Record<string, unknown> = {};
  const self = () => api;
  api.select = vi.fn(self);
  api.limit = vi.fn(self);
  api.then = (
    resolve: (v: unknown) => unknown,
    reject?: (e: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return api;
}

function handlerOf(route: unknown) {
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
  ).options.server.handlers.GET;
  if (!h) throw new Error("missing GET handler");
  return (request: Request) => h({ request } as never);
}

async function getRoute() {
  const { Route } = await import("@/routes/api/keep-alive");
  return handlerOf(Route);
}

function onlyOk(body: unknown): asserts body is { ok: boolean } {
  expect(body).toEqual({ ok: expect.any(Boolean) });
  expect(Object.keys(body as object)).toEqual(["ok"]);
}

describe("GET /api/keep-alive", () => {
  beforeEach(() => {
    fromMock.mockReset();
    delete process.env.CRON_SECRET;
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("returns {ok:true} after a cheap head/count read when CRON_SECRET is unset", async () => {
    const query = thenable({ error: null, count: 1 });
    fromMock.mockReturnValue(query);

    const GET = await getRoute();
    const res = await GET(new Request("http://localhost/api/keep-alive"));
    const body = await res.json();

    expect(res.status).toBe(200);
    onlyOk(body);
    expect(body.ok).toBe(true);
    expect(fromMock).toHaveBeenCalledWith("institutes");
    expect(query.select).toHaveBeenCalledWith("id", {
      count: "exact",
      head: true,
    });
    expect(query.limit).toHaveBeenCalledWith(1);
  });

  it("returns {ok:false} and no data when the Supabase read fails", async () => {
    fromMock.mockReturnValue(thenable({ error: { message: "boom" } }));

    const GET = await getRoute();
    const res = await GET(new Request("http://localhost/api/keep-alive"));
    const body = await res.json();

    expect(res.status).toBe(500);
    onlyOk(body);
    expect(body.ok).toBe(false);
  });

  it("returns {ok:false} when CRON_SECRET is set and the bearer header is missing", async () => {
    process.env.CRON_SECRET = "cron-test-secret";
    fromMock.mockReturnValue(thenable({ error: null, count: 1 }));

    const GET = await getRoute();
    const res = await GET(new Request("http://localhost/api/keep-alive"));
    const body = await res.json();

    expect(res.status).toBe(401);
    onlyOk(body);
    expect(body.ok).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns {ok:true} when CRON_SECRET matches the Vercel cron bearer header", async () => {
    process.env.CRON_SECRET = "cron-test-secret";
    fromMock.mockReturnValue(thenable({ error: null, count: 1 }));

    const GET = await getRoute();
    const res = await GET(
      new Request("http://localhost/api/keep-alive", {
        headers: { Authorization: "Bearer cron-test-secret" },
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    onlyOk(body);
    expect(body.ok).toBe(true);
    expect(fromMock).toHaveBeenCalledWith("institutes");
  });
});
