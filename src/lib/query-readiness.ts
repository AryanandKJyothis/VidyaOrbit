/**
 * Owner-scoped queries are `enabled: !!ownerId`. While the active workspace is
 * still resolving, those queries are *disabled*, and TanStack Query v5 reports
 * `isLoading === false` for a disabled query (isLoading = isPending && isFetching).
 * Pages that gated on `isLoading` therefore rendered with empty arrays: zero
 * totals / empty states first, then real data a moment later. Gate on
 * `isPending` plus workspace resolution instead.
 */
export type WorkspaceReadiness = {
  /** Workspace list query still loading. */
  loading: boolean;
  /** An active workspace (owner id) is selected. */
  hasActive: boolean;
  /** Number of workspaces available (an active one is auto-selected if > 0). */
  workspaceCount: number;
};

export function isOwnerDataPending(
  ws: WorkspaceReadiness,
  queries: ReadonlyArray<{ isPending: boolean }>,
): boolean {
  if (ws.loading) return true;
  // Workspaces loaded but the default one is selected in an effect on the
  // next render: still pending. With zero workspaces nothing will ever load.
  if (!ws.hasActive) return ws.workspaceCount > 0;
  return queries.some((q) => q.isPending);
}
