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

const STORAGE_KEY = "vidya.active-workspace";

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const fetchWorkspaces = useServerFn(listMyWorkspaces);
  const query = useQuery({
    queryKey: ["workspaces", user?.id],
    enabled: !!user,
    queryFn: () => fetchWorkspaces(),
    staleTime: 30_000,
  });

  const [activeOwnerId, setActiveOwnerId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY);
  });

  // Default active = own workspace
  useEffect(() => {
    if (!query.data || query.data.length === 0) return;
    const exists =
      activeOwnerId && query.data.find((w) => w.ownerId === activeOwnerId);
    if (!exists) {
      const own = query.data.find((w) => w.isOwn) ?? query.data[0];
      setActiveOwnerId(own.ownerId);
    }
  }, [query.data, activeOwnerId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (activeOwnerId) localStorage.setItem(STORAGE_KEY, activeOwnerId);
  }, [activeOwnerId]);

  const active = useMemo(
    () => query.data?.find((w) => w.ownerId === activeOwnerId) ?? null,
    [query.data, activeOwnerId],
  );

  return (
    <WorkspaceCtx.Provider
      value={{
        workspaces: query.data ?? [],
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
