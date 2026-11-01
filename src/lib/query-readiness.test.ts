import { describe, expect, it } from "vitest";
import { isOwnerDataPending } from "./query-readiness";

const ready = { loading: false, hasActive: true, workspaceCount: 1 };
const done = { isPending: false };
const pending = { isPending: true };

describe("isOwnerDataPending", () => {
  it("is pending while workspaces load, even though owner queries are disabled", () => {
    expect(
      isOwnerDataPending(
        { loading: true, hasActive: false, workspaceCount: 0 },
        [pending],
      ),
    ).toBe(true);
  });
  it("is pending in the render before the default workspace is selected", () => {
    expect(
      isOwnerDataPending(
        { loading: false, hasActive: false, workspaceCount: 1 },
        [pending],
      ),
    ).toBe(true);
  });
  it("is pending until every query has data (no partial totals)", () => {
    expect(isOwnerDataPending(ready, [done, pending, done])).toBe(true);
    expect(isOwnerDataPending(ready, [done, done, done])).toBe(false);
  });
  it("is not pending forever when the user has no workspace", () => {
    expect(
      isOwnerDataPending(
        { loading: false, hasActive: false, workspaceCount: 0 },
        [pending],
      ),
    ).toBe(false);
  });
});
