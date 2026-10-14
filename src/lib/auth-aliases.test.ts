import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AUTH_ALIAS_REDIRECT_STATUS,
  AUTH_ALIAS_ROUTES,
  AUTH_LOGIN_PATH,
  AUTH_SIGNUP_SEARCH,
  incomingAliasSearch,
  loginHrefFromAlias,
  loginSearchFromAlias,
  throwAuthAliasRedirect,
} from "./auth-aliases";

function caughtRedirect(run: () => void) {
  try {
    run();
  } catch (error) {
    return error as {
      status: number;
      options: {
        to?: string;
        search?: { mode?: string; plan?: string; invite?: string };
        statusCode?: number;
        replace?: boolean;
      };
    };
  }
  throw new Error("expected a redirect to be thrown");
}

describe("auth alias destinations", () => {
  it("sends signup-style aliases to /login?mode=signup", () => {
    for (const route of AUTH_ALIAS_ROUTES.filter((r) => r.kind === "signup")) {
      expect(loginSearchFromAlias({}, route.kind)).toEqual({ mode: "signup" });
      expect(loginHrefFromAlias({}, route.kind)).toBe("/login?mode=signup");
    }
  });

  it("sends sign-in aliases to /login without forcing a mode", () => {
    for (const route of AUTH_ALIAS_ROUTES.filter((r) => r.kind === "login")) {
      expect(loginSearchFromAlias({}, route.kind)).toEqual({});
      expect(loginHrefFromAlias({}, route.kind)).toBe("/login");
    }
  });

  it("preserves plan and other query params", () => {
    expect(
      loginSearchFromAlias(
        { plan: "growth", invite: "tok_abcdefghij" },
        "signup",
      ),
    ).toEqual({
      mode: "signup",
      plan: "growth",
      invite: "tok_abcdefghij",
    });
    expect(
      loginHrefFromAlias({ plan: "growth", utm_source: "wa" }, "signup"),
    ).toBe("/login?plan=growth&utm_source=wa&mode=signup");
    expect(loginHrefFromAlias({ plan: "starter" }, "login")).toBe(
      "/login?plan=starter",
    );
  });

  it("keeps an explicit mode on sign-in aliases and overrides it on signup aliases", () => {
    expect(loginSearchFromAlias({ mode: "signup" }, "login")).toEqual({
      mode: "signup",
    });
    expect(loginSearchFromAlias({ mode: "login" }, "signup")).toEqual({
      mode: "signup",
    });
  });

  it("reads query params from the location search string", () => {
    expect(incomingAliasSearch({}, "?plan=growth&x=1")).toEqual({
      plan: "growth",
      x: "1",
    });
  });
});

describe("permanent route-level redirect", () => {
  it("throws a 301 to /login with the signup search", () => {
    const thrown = caughtRedirect(() =>
      throwAuthAliasRedirect("signup", {
        search: { plan: "growth" },
        location: { searchStr: "?plan=growth" },
      }),
    );
    expect(thrown.status).toBe(AUTH_ALIAS_REDIRECT_STATUS);
    expect(thrown.options.statusCode).toBe(301);
    expect(thrown.options.to).toBe(AUTH_LOGIN_PATH);
    expect(thrown.options.search).toEqual({ mode: "signup", plan: "growth" });
    expect(thrown.options.replace).toBe(true);
  });

  it("throws a 301 to /login for sign-in aliases", () => {
    const thrown = caughtRedirect(() =>
      throwAuthAliasRedirect("login", { search: { plan: "growth" } }),
    );
    expect(thrown.status).toBe(301);
    expect(thrown.options.to).toBe("/login");
    expect(thrown.options.search).toEqual({ plan: "growth" });
  });
});

describe("alias route files", () => {
  it("registers every public alias as a file route that redirects", () => {
    expect(AUTH_ALIAS_ROUTES.map((r) => r.path)).toEqual([
      "/signup",
      "/sign-up",
      "/register",
      "/join",
      "/signin",
      "/sign-in",
    ]);
    for (const route of AUTH_ALIAS_ROUTES) {
      expect(existsSync(route.file)).toBe(true);
      const src = readFileSync(route.file, "utf8");
      const routeId = route.path === "/join" ? "/join/" : route.path;
      expect(src).toContain(`createFileRoute("${routeId}")`);
      expect(src).toContain("throwAuthAliasRedirect");
      expect(src).toContain(`"${route.kind}"`);
      expect(src).toContain("beforeLoad");
    }
  });

  it("does not turn /join/$token into a signup alias", () => {
    const joinToken = readFileSync("src/routes/join.$token.tsx", "utf8");
    const joinIndex = readFileSync("src/routes/join.index.tsx", "utf8");
    const tree = readFileSync("src/routeTree.gen.ts", "utf8");
    expect(existsSync("src/routes/join.tsx")).toBe(false);
    expect(joinToken).toContain('createFileRoute("/join/$token")');
    expect(joinToken).not.toContain("throwAuthAliasRedirect");
    expect(joinIndex).toContain('createFileRoute("/join/")');
    expect(joinIndex).toContain("throwAuthAliasRedirect");
    expect(tree).toContain("from './routes/join.index'");
    expect(tree).toContain("from './routes/join.$token'");
    expect(tree).not.toContain("JoinRouteWithChildren");
  });
});

describe("404 Start free CTA", () => {
  it("points at the same signup screen as the aliases", () => {
    const root = readFileSync("src/routes/__root.tsx", "utf8");
    expect(AUTH_SIGNUP_SEARCH).toEqual({ mode: "signup" });
    expect(root).toContain("AUTH_SIGNUP_SEARCH");
    expect(root).toContain('to="/login"');
    expect(root).toContain("Start free");
    expect(root).not.toMatch(/to="\/signup"/);
    expect(root).not.toMatch(/to="\/register"/);
  });
});
