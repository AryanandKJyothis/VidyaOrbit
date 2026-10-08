import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Save, Loader2, LogOut, Bell } from "lucide-react";
import { RoutePermissionGate } from "@/components/route-permission-gate";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useInstitute, useUpdateInstitute } from "@/hooks/use-data";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { formatUserError } from "@/lib/format-error";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useReminderPrefs, setReminderPrefs } from "@/hooks/use-reminders";
import { useOnboarding } from "@/hooks/use-onboarding";

export const Route = createFileRoute("/_authenticated/settings/")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <RoutePermissionGate resource="settings" level="read">
      <SettingsPageContent />
    </RoutePermissionGate>
  );
}

function SettingsPageContent() {
  const { user } = useAuth();
  const inst = useInstitute();
  const mut = useUpdateInstitute();
  const reminderPrefs = useReminderPrefs();
  const { resetChecklist } = useOnboarding();
  const [form, setForm] = useState({
    name: "",
    contact_phone: "",
    contact_email: "",
    address: "",
    receipt_prefix: "RCT",
    receipt_footer: "",
    logo_url: "",
  });

  useEffect(() => {
    if (inst.data)
      setForm({
        name: inst.data.name ?? "",
        contact_phone: inst.data.contact_phone ?? "",
        contact_email: inst.data.contact_email ?? "",
        address: inst.data.address ?? "",
        receipt_prefix: inst.data.receipt_prefix ?? "RCT",
        receipt_footer: inst.data.receipt_footer ?? "",
        logo_url: inst.data.logo_url ?? "",
      });
  }, [inst.data]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await mut.mutateAsync(form);
      toast.success("Settings saved");
    } catch (e) {
      toast.error(formatUserError(e, "Could not save settings."));
    }
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Institute branding, receipt details and your account."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Institute</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Institute name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Contact phone</Label>
                <Input
                  value={form.contact_phone}
                  onChange={(e) =>
                    setForm({ ...form, contact_phone: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Contact email</Label>
                <Input
                  type="email"
                  value={form.contact_email}
                  onChange={(e) =>
                    setForm({ ...form, contact_email: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Address</Label>
                <Textarea
                  rows={2}
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Logo URL</Label>
                <Input
                  value={form.logo_url}
                  onChange={(e) =>
                    setForm({ ...form, logo_url: e.target.value })
                  }
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Receipt prefix</Label>
                <Input
                  value={form.receipt_prefix}
                  onChange={(e) =>
                    setForm({ ...form, receipt_prefix: e.target.value })
                  }
                  placeholder="RCT"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Receipt footer</Label>
                <Textarea
                  rows={2}
                  value={form.receipt_footer}
                  onChange={(e) =>
                    setForm({ ...form, receipt_footer: e.target.value })
                  }
                  placeholder="Thank you for your payment."
                />
              </div>
              <div className="sm:col-span-2 flex items-center justify-between pt-2">
                <div className="text-xs text-muted-foreground">
                  Currency: INR · Timezone: Asia/Kolkata
                </div>
                <Button type="submit" disabled={mut.isPending}>
                  {mut.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Email
                </div>
                <div className="mt-0.5 font-medium">{user?.email}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  User ID
                </div>
                <div className="mt-0.5 font-mono text-xs break-all text-muted-foreground">
                  {user?.id}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4 opacity-70" /> Reminders & digest
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">
                    Weekly dashboard digest
                  </Label>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    On your chosen weekday, we&apos;ll show a one-time snapshot
                    toast when you open the dashboard (stored only on this
                    device).
                  </p>
                </div>
                <Switch
                  checked={reminderPrefs.enabled}
                  onCheckedChange={(v) => setReminderPrefs({ enabled: v })}
                  className="shrink-0 mt-1"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Digest weekday</Label>
                <Select
                  value={String(reminderPrefs.digestWeekday)}
                  onValueChange={(v) =>
                    setReminderPrefs({ digestWeekday: Number(v) })
                  }
                  disabled={!reminderPrefs.enabled}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "Sunday",
                      "Monday",
                      "Tuesday",
                      "Wednesday",
                      "Thursday",
                      "Friday",
                      "Saturday",
                    ].map((label, value) => (
                      <SelectItem key={label} value={String(value)}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-lg border border-dashed border-border/80 p-3 space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Getting started
                </Label>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Bring back the onboarding checklist on your dashboard if you
                  dismissed it early.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    resetChecklist();
                    toast.success("Open Dashboard to see the checklist.");
                  }}
                >
                  Show checklist again
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive/20">
            <CardContent className="p-4">
              <Button
                variant="outline"
                className="w-full text-destructive hover:bg-destructive/5 hover:text-destructive"
                onClick={async () => {
                  const { error } = await supabase.auth.signOut();
                  if (error)
                    toast.error("Could not sign out. Please try again.");
                }}
              >
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
