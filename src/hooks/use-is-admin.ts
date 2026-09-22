import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

/**
 * Reads the current user's roles from `public.user_roles` (RLS lets a user
 * read their own rows) and returns true if they have the admin role.
 */
export function useIsAdmin(): boolean {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();
      if (error) return false;
      return !!data;
    },
  });
  return !!data;
}
