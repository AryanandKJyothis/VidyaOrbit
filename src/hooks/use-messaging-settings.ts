import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import {
  DEFAULT_MESSAGING_SETTINGS,
  type MessagingSettings,
} from "@/lib/messaging/types";
import { settingsFromRow } from "@/lib/messaging/policy";

export function useMessagingSettings() {
  const { active } = useActiveWorkspace();
  const ownerId = active?.ownerId ?? null;
  return useQuery({
    queryKey: ["messaging-settings", ownerId],
    enabled: !!ownerId,
    staleTime: 60_000,
    queryFn: async (): Promise<MessagingSettings> => {
      const { data, error } = await supabase
        .from("institute_messaging_settings")
        .select("wa_auto, locale")
        .eq("owner_id", ownerId!)
        .maybeSingle();
      if (error) {
        if (
          error.code === "42P01" ||
          /does not exist|institute_messaging_settings/i.test(error.message)
        ) {
          return DEFAULT_MESSAGING_SETTINGS;
        }
        throw error;
      }
      return settingsFromRow(data);
    },
  });
}

export function useUpdateMessagingSettings() {
  const qc = useQueryClient();
  const { active } = useActiveWorkspace();
  const ownerId = active?.ownerId ?? null;
  return useMutation({
    mutationFn: async (next: Partial<MessagingSettings>) => {
      if (!ownerId) throw new Error("No active workspace selected");
      const current =
        qc.getQueryData<MessagingSettings>(["messaging-settings", ownerId]) ??
        settingsFromRow(null);
      const merged = {
        wa_auto: next.waAuto ?? current.waAuto,
        locale: next.locale ?? current.locale,
      };
      const { error } = await supabase
        .from("institute_messaging_settings")
        .upsert({
          owner_id: ownerId,
          wa_auto: merged.wa_auto,
          locale: merged.locale,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messaging-settings", ownerId] });
    },
  });
}
