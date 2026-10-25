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
      const first = await supabase
        .from("institute_messaging_settings")
        .select("wa_auto, locale, fee_overdue_dedupe_days")
        .eq("owner_id", ownerId!)
        .maybeSingle();
      if (first.error && /fee_overdue_dedupe_days/i.test(first.error.message)) {
        const fallback = await supabase
          .from("institute_messaging_settings")
          .select("wa_auto, locale")
          .eq("owner_id", ownerId!)
          .maybeSingle();
        if (fallback.error) {
          if (
            fallback.error.code === "42P01" ||
            /does not exist|institute_messaging_settings/i.test(
              fallback.error.message,
            )
          ) {
            return DEFAULT_MESSAGING_SETTINGS;
          }
          throw fallback.error;
        }
        return settingsFromRow(fallback.data);
      }
      if (first.error) {
        if (
          first.error.code === "42P01" ||
          /does not exist|institute_messaging_settings/i.test(
            first.error.message,
          )
        ) {
          return DEFAULT_MESSAGING_SETTINGS;
        }
        throw first.error;
      }
      return settingsFromRow(first.data);
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
        fee_overdue_dedupe_days:
          next.feeOverdueDedupeDays ?? current.feeOverdueDedupeDays,
      };
      const { error } = await supabase
        .from("institute_messaging_settings")
        .upsert({
          owner_id: ownerId,
          wa_auto: merged.wa_auto,
          locale: merged.locale,
          fee_overdue_dedupe_days: merged.fee_overdue_dedupe_days,
        });
      if (error) {
        if (/fee_overdue_dedupe_days/i.test(error.message)) {
          const retry = await supabase
            .from("institute_messaging_settings")
            .upsert({
              owner_id: ownerId,
              wa_auto: merged.wa_auto,
              locale: merged.locale,
            });
          if (retry.error) throw retry.error;
          return;
        }
        throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messaging-settings", ownerId] });
    },
  });
}
