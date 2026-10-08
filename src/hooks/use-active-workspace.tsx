import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import {
  listMyWorkspaces,
  type Permissions,
  type WorkspaceRole,
} from "@/lib/workspace.functions";

export type Workspace = {
  ownerId: string;
  role: WorkspaceRole;
  permissions: Permissions;
  name: string;
  isOwn: boolean;
};

type Ctx = {
  workspaces: Workspace[];
  active: Workspace | null;
  setActiveOwnerId: (ownerId: string) => void;
  loading: boolean;
  refresh: () => void;
};

const WorkspaceCtx = createContext<Ctx>({
  workspaces: [],
  active: null,
  setActiveOwnerId: () => {},
  loading: true,
  refresh: () => {},
});

function getStorageKey(userId: string) {
  return `vidya.active-workspace.${userId}`;
}

const OWNER_PERMISSIONS: Permissions = {
  students: "write",
  batches: "write",
  attendance: "write",
  fees: "write",
  settings: "write",
  billing: "write",
};

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const fetchWorkspaces = useServerFn(listMyWorkspaces);
  const query = useQuery({
    queryKey: ["workspaces", user?.id],
    enabled: !!user,
    queryFn: () => fetchWorkspaces(),
    staleTime: 30_000,
  });

  // The signed-in owner still gets a full menu if the workspace request fails.
  const workspaces = useMemo<Workspace[]>(() => {
    if (query.data && query.data.length > 0) return query.data;
    if (!query.isError || !user) return [];
    return [
      {
        ownerId: user.id,
        role: "owner",
        permissions: OWNER_PERMISSIONS,
        name: "My Institute",
        isOwn: true,
      },
    ];
  }, [query.data, query.isError, user]);

  const [activeOwnerId, setActiveOwnerId] = useState<string | null>(() => {
    if (typeof window === "undefined" || !user) return null;
    try {
      return localStorage.getItem(getStorageKey(user.id));
    } catch {
      return null;
    }
  });

  // Default active = own workspace, and validate stored workspace against memberships
  useEffect(() => {
    if (workspaces.length === 0) return;

    // Validate stored workspace is still in memberships
    const exists =
      activeOwnerId && workspaces.find((w) => w.ownerId === activeOwnerId);

    if (!exists) {
      // Stored workspace not found, default to own workspace
      const own = workspaces.find((w) => w.isOwn) ?? workspaces[0];
      setActiveOwnerId(own.ownerId);
    }
  }, [workspaces, activeOwnerId]);

  useEffect(() => {
    if (typeof window === "undefined" || !user) return;
    if (activeOwnerId) {
      try {
        localStorage.setItem(getStorageKey(user.id), activeOwnerId);
      } catch {
        /* ignore quota */
      }
    }
  }, [activeOwnerId, user]);

  const active = useMemo(
    () => workspaces.find((w) => w.ownerId === activeOwnerId) ?? null,
    [workspaces, activeOwnerId],
  );

  return (
    <WorkspaceCtx.Provider
      value={{
        workspaces,
        active,
        setActiveOwnerId,
        loading: query.isLoading,
        refresh: () => query.refetch(),
      }}
    >
      {children}
    </WorkspaceCtx.Provider>
  );
}

export const useActiveWorkspace = () => useContext(WorkspaceCtx);

export function useCan(
  resource: keyof Permissions,
  level: "read" | "write" = "read",
): boolean {
  const { active } = useActiveWorkspace();
  if (!active) return false;
  const p = active.permissions[resource];
  if (level === "write") return p === "write";
  return p === "read" || p === "write";
}
