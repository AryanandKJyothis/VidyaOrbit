import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, MessageCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { formatUserError } from "@/lib/format-error";
import { todayISO } from "@/lib/format";
import { inviteMember } from "@/lib/workspace.functions";
import { getWhatsAppHref } from "@/lib/contact-config";
import { SAMPLE_DATA_ENABLED } from "@/lib/feature-flags";
import { useQuickStart } from "@/hooks/use-quick-start";
import {
  DEFAULT_BATCH_DAYS,
  FIRST_GOALS,
  GUIDED_ATTENDANCE_KEY,
  QS_COPY,
  STAFF_BUCKETS,
  STAFF_PREVIEW,
  STUDENT_BUCKETS,
  TIMING_CHIPS,
  answerValue,
  batchesFromTimings,
  newBatchSeeds,
  nextQuickStep,
  parseOtherNumber,
  parsePastedNames,
  prevQuickStep,
  quickStepsFor,
  recommendedPlan,
  segmentFor,
  staffInviteWhatsAppUrl,
  type Answer,
  type Bilingual,
  type ChoiceOption,
  type QuickStep,
} from "@/lib/onboarding-v2";

const ATT_BATCH_KEY = "vidya:attendance:last-batch";

function Copy({ c, className }: { c: Bilingual; className?: string }) {
  return (
    <span className={className}>
      {c.en}
      <span
        lang="ml"
        className="mt-0.5 block text-xs font-normal text-muted-foreground"
      >
        {c.ml}
      </span>
    </span>
  );
}

function ChoiceGrid({
  options,
  answer,
  onPick,
}: {
  options: readonly ChoiceOption[];
  answer: Answer | null;
  onPick: (a: Answer, auto: boolean) => void;
}) {
  const isOther = answer?.optionId === "other";
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2" role="radiogroup">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={answer?.optionId === o.id}
            onClick={() => onPick({ optionId: o.id, other: "" }, true)}
            className={cn(
              "min-h-12 rounded-xl border px-3 py-2 text-left text-sm font-medium transition-colors",
              answer?.optionId === o.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:bg-muted",
            )}
          >
            {o.label.en}
            {o.label.ml !== o.label.en && (
              <span
                lang="ml"
                className="block text-xs font-normal text-muted-foreground"
              >
                {o.label.ml}
              </span>
            )}
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={isOther}
          onClick={() =>
            onPick({ optionId: "other", other: answer?.other ?? "" }, false)
          }
          className={cn(
            "min-h-12 rounded-xl border px-3 py-2 text-left text-sm font-medium",
            isOther
              ? "border-primary bg-primary/10 text-primary"
              : "border-border hover:bg-muted",
          )}
        >
          Other: enter number
          <span
            lang="ml"
            className="block text-xs font-normal text-muted-foreground"
          >
            മറ്റുള്ളവ: എണ്ണം നൽകുക
          </span>
        </button>
      </div>
      {isOther && (
        <Input
          autoFocus
          inputMode="numeric"
          aria-label="Enter a number"
          className="h-12"
          placeholder="e.g. 80"
          value={answer?.other ?? ""}
          onChange={(e) =>
            onPick({ optionId: "other", other: e.target.value }, false)
          }
        />
      )}
    </div>
  );
}

export function QuickStartDialog({
  open,
  userId,
  ownerId,
  initialCentreName,
  onClose,
  onImport,
}: {
  open: boolean;
  userId: string;
  ownerId: string;
  initialCentreName: string;
  onClose: () => void;
  onImport: () => void;
}) {
  const { state, patch } = useQuickStart(userId);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const invite = useServerFn(inviteMember);
  const [centreName, setCentreName] = useState(initialCentreName);
  const [customDraft, setCustomDraft] = useState("");
  const [pasted, setPasted] = useState("");
  const [sample, setSample] = useState(false);
  const [busy, setBusy] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [staffPhone, setStaffPhone] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [savedName, setSavedName] = useState(initialCentreName);

  /** Centre name is prefilled silently; saved on blur and again on finish. */
  const saveName = async () => {
    const name = centreName.trim();
    if (name.length < 2 || name === savedName) return;
    const { error } = await supabase
      .from("institutes")
      .update({ name } as never)
      .eq("owner_id", ownerId);
    if (error) throw error;
    setSavedName(name);
    qc.invalidateQueries({ queryKey: ["institute"] });
  };

  const students = answerValue(STUDENT_BUCKETS, state.students);
  const steps = quickStepsFor(students);
  const step: QuickStep = steps.includes(state.step) ? state.step : "students";
  const stepNo = steps.indexOf(step) + 1;
  const parsedNames = useMemo(() => parsePastedNames(pasted), [pasted]);
  const seg = students === null ? "small" : segmentFor(students);
  const plan = students === null ? null : recommendedPlan(students);

  const go = (next: QuickStep) => patch({ step: next });
  const advance = () => go(nextQuickStep(step, students));

  const ensureBatches = async (): Promise<string | null> => {
    const seeds = batchesFromTimings(state.chips, state.custom);
    const { data: existing, error } = await supabase
      .from("batches")
      .select("id, name")
      .eq("owner_id", ownerId);
    if (error) throw error;
    const toAdd = newBatchSeeds(
      seeds.length
        ? seeds
        : [
            {
              name: "Main batch",
              timing: null,
              days_of_week: [...DEFAULT_BATCH_DAYS],
            },
          ],
      (existing ?? []).map((b) => b.name),
    );
    if (toAdd.length) {
      const { error: insErr } = await supabase.from("batches").insert(
        toAdd.map((s) => ({
          owner_id: ownerId,
          name: s.name,
          timing: s.timing,
          days_of_week: s.days_of_week,
        })) as never,
      );
      if (insErr) throw insErr;
    }
    const { data: all, error: e2 } = await supabase
      .from("batches")
      .select("id, name")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: true });
    if (e2) throw e2;
    qc.invalidateQueries({ queryKey: ["batches"] });
    const firstName = (seeds[0]?.name ?? "Main batch").toLowerCase();
    return (
      (all ?? []).find((b) => b.name.toLowerCase() === firstName)?.id ??
      all?.[0]?.id ??
      null
    );
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(formatUserError(e, "Could not save. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const finish = async (batchId: string | null) => {
    await saveName();
    patch({ completed: true, step: "done" });
    if (batchId) {
      try {
        localStorage.setItem(ATT_BATCH_KEY, batchId);
        localStorage.setItem(GUIDED_ATTENDANCE_KEY, batchId);
      } catch {
        /* ignore */
      }
    }
    onClose();
    void navigate({ to: state.goal === "fees" ? "/fees" : "/attendance" });
  };

  const saveNamesAndFinish = () =>
    run(async () => {
      const batchId = await ensureBatches();
      const rows = parsedNames.map((n) => ({
        owner_id: ownerId,
        full_name: n.name,
        phone: n.phone,
        batch_id: batchId,
        joining_date: todayISO(),
        status: "active",
      }));
      if (sample && SAMPLE_DATA_ENABLED) {
        [
          "Anu (Sample)",
          "Rahul (Sample)",
          "Fathima (Sample)",
          "Arjun (Sample)",
          "Diya (Sample)",
        ].forEach((name) =>
          rows.push({
            owner_id: ownerId,
            full_name: name,
            phone: null,
            batch_id: batchId,
            joining_date: todayISO(),
            status: "active",
            is_sample: true,
          } as (typeof rows)[number]),
        );
      }
      if (rows.length) {
        const { error } = await supabase.from("students").insert(rows as never);
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ["students"] });
        toast.success(
          `${rows.length} student${rows.length === 1 ? "" : "s"} added`,
        );
      }
      await finish(batchId);
    });

  const body: Record<QuickStep, ReactNode> = {
    name: null,
    students: (
      <div className="space-y-3">
        <ChoiceGrid
          options={STUDENT_BUCKETS}
          answer={state.students}
          onPick={(a, auto) => {
            patch({ students: a });
            if (auto)
              patch({
                step: nextQuickStep(
                  "students",
                  answerValue(STUDENT_BUCKETS, a),
                ),
              });
          }}
        />
      </div>
    ),
    staff: (
      <ChoiceGrid
        options={STAFF_BUCKETS}
        answer={state.staff}
        onPick={(a, auto) => {
          patch({ staff: a });
          if (auto) advance();
        }}
      />
    ),
    timings: (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {TIMING_CHIPS.map((c) => {
            const on = state.chips.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  patch({
                    chips: on
                      ? state.chips.filter((x) => x !== c.id)
                      : [...state.chips, c.id],
                  })
                }
                className={cn(
                  "min-h-11 min-w-11 rounded-full border px-4 text-sm font-medium",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-muted",
                )}
              >
                {c.label}
              </button>
            );
          })}
          {state.custom.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed
              onClick={() =>
                patch({ custom: state.custom.filter((x) => x !== c) })
              }
              className="min-h-11 rounded-full border border-primary bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              {c} ×
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = customDraft.trim();
            if (v && !state.custom.includes(v))
              patch({ custom: [...state.custom, v] });
            setCustomDraft("");
          }}
        >
          <Input
            className="h-11"
            aria-label="Custom timing"
            placeholder="+ Custom, e.g. 3:30–4:30 PM"
            value={customDraft}
            onChange={(e) => setCustomDraft(e.target.value)}
          />
          <Button type="submit" variant="outline" className="h-11">
            Add
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          {batchesFromTimings(state.chips, state.custom)
            .map((b) => b.name)
            .join(" · ") || "No timing picked — we'll make one “Main batch”."}
        </p>
      </div>
    ),
    goal: (
      <div className="grid gap-2">
        {FIRST_GOALS.map((g) => (
          <button
            key={g.id}
            type="button"
            aria-pressed={state.goal === g.id}
            onClick={() => {
              patch({ goal: g.id });
              advance();
            }}
            className={cn(
              "min-h-12 rounded-xl border px-4 py-2 text-left text-sm font-medium",
              state.goal === g.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:bg-muted",
            )}
          >
            <Copy c={g.label} />
            {g.comingSoon && (
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                {QS_COPY.parentsSoon.en}. Today you send WhatsApp messages
                yourself.
              </span>
            )}
          </button>
        ))}
        {plan && (
          <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
            Recommended plan:{" "}
            <strong className="text-foreground">{plan.name}</strong>
            {plan.monthlyPrice
              ? ` · ₹${plan.monthlyPrice.toLocaleString("en-IN")}/month`
              : plan.monthlyPrice === 0
                ? " · Free"
                : " · talk to us"}{" "}
            ({plan.cap}). Your free trial starts now.
          </p>
        )}
      </div>
    ),
    names: (
      <div className="space-y-3">
        <Textarea
          rows={7}
          aria-label="Student names"
          placeholder={"Anu\nRahul 9876543210\nFathima"}
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          <Copy c={QS_COPY.namesHint} />{" "}
          {parsedNames.length > 0 && (
            <strong className="text-foreground">
              {parsedNames.length} names found.
            </strong>
          )}
        </p>
        {SAMPLE_DATA_ENABLED && (
          <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border px-3">
            <Copy c={QS_COPY.sample} className="text-sm" />
            <Switch
              checked={sample}
              onCheckedChange={setSample}
              aria-label="Add sample students"
            />
          </label>
        )}
        <Button
          variant="link"
          className="h-auto p-0 text-xs"
          onClick={onImport}
        >
          Have Excel? Import instead
        </Button>
      </div>
    ),
    invite: (
      <div className="space-y-3">
        <div className="grid gap-2">
          <Input
            className="h-11"
            aria-label="Staff name"
            placeholder="Teacher's name"
            value={staffName}
            onChange={(e) => setStaffName(e.target.value)}
          />
          <Input
            className="h-11"
            aria-label="Staff WhatsApp number"
            inputMode="tel"
            placeholder="WhatsApp number"
            value={staffPhone}
            onChange={(e) => setStaffPhone(e.target.value)}
          />
          <Label htmlFor="qs-staff-email" className="text-xs">
            Email (required — staff sign in with it)
          </Label>
          <Input
            id="qs-staff-email"
            className="h-11"
            aria-label="Staff email (required for sign-in)"
            type="email"
            placeholder="Their email — needed for sign-in"
            value={staffEmail}
            onChange={(e) => setStaffEmail(e.target.value)}
          />
        </div>
        {inviteUrl ? (
          <Button asChild className="h-12 w-full">
            <a href={inviteUrl} target="_blank" rel="noreferrer">
              <MessageCircle className="mr-2 h-4 w-4" />
              Open WhatsApp — you tap Send
            </a>
          </Button>
        ) : (
          <Button
            className="h-12 w-full"
            disabled={busy || !staffEmail.trim()}
            onClick={() =>
              run(async () => {
                const res = await invite({
                  data: {
                    ownerId,
                    email: staffEmail.trim().toLowerCase(),
                    role: "staff",
                  },
                });
                const joinUrl = `${window.location.origin}/join/${res.token}`;
                setInviteUrl(
                  staffInviteWhatsAppUrl({
                    phone: staffPhone,
                    staffName,
                    centreName,
                    joinUrl,
                  }),
                );
              })
            }
          >
            Create invite link
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
          <Copy c={QS_COPY.inviteHint} />
        </p>
        <div
          className="rounded-xl border bg-muted/40 p-3 text-xs"
          aria-label="What staff see"
        >
          <p className="mb-1 font-medium text-foreground">What staff see</p>
          <ul className="space-y-0.5">
            {STAFF_PREVIEW.can.map((c) => (
              <li key={c}>
                <Check className="mr-1 inline h-3 w-3 text-emerald-600" />
                {c}
              </li>
            ))}
            {STAFF_PREVIEW.cannot.map((c) => (
              <li key={c} className="text-muted-foreground">
                ✕ {c}
              </li>
            ))}
          </ul>
        </div>
      </div>
    ),
    import: (
      <div className="space-y-3">
        <p className="text-sm">
          <Copy c={QS_COPY.importHint} />
        </p>
        {(() => {
          const href = getWhatsAppHref(
            `Hi, I run ${centreName || "a centre"} with ${students ?? "400+"} students. Please help me import my data into Vidya Orbit.`,
          );
          return href ? (
            <Button asChild className="h-12 w-full">
              <a href={href} target="_blank" rel="noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" />
                Send Excel on WhatsApp
              </a>
            </Button>
          ) : null;
        })()}
        <Button variant="outline" className="h-12 w-full" onClick={onImport}>
          I'll import it myself
        </Button>
        {plan && (
          <p className="text-xs text-muted-foreground">
            Recommended: <strong>{plan.name}</strong>
            {plan.code === "custom"
              ? " — we'll quote for branches and admin roles."
              : plan.monthlyPrice
                ? ` · ₹${plan.monthlyPrice.toLocaleString("en-IN")}/month`
                : ""}
          </p>
        )}
      </div>
    ),
    done: null,
  };

  const titles: Record<QuickStep, Bilingual> = {
    name: QS_COPY.nameTitle,
    students: QS_COPY.studentsTitle,
    staff: QS_COPY.staffTitle,
    timings: QS_COPY.timingsTitle,
    goal: QS_COPY.goalTitle,
    names: QS_COPY.namesTitle,
    invite: QS_COPY.inviteTitle,
    import: QS_COPY.importTitle,
    done: { en: "", ml: "" },
  };

  const otherInvalid =
    (step === "students" &&
      state.students?.optionId === "other" &&
      parseOtherNumber(state.students.other) === null) ||
    (step === "staff" &&
      state.staff?.optionId === "other" &&
      parseOtherNumber(state.staff.other) === null);

  const onContinue = () => {
    if (step === "names") return saveNamesAndFinish();
    const next = nextQuickStep(step, students);
    if (next === "done" || (step === "invite" && seg === "large")) {
      return run(async () => finish(await ensureBatches()));
    }
    advance();
  };

  const continueLabel =
    step === "names"
      ? parsedNames.length
        ? `Add ${parsedNames.length} & mark attendance`
        : "Skip & mark attendance"
      : step === "invite"
        ? inviteUrl
          ? "Next"
          : "Do it later"
        : "Continue";
  const prev = prevQuickStep(step, students);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          patch({ dismissed: true });
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[min(92dvh,760px)] overflow-y-auto sm:max-w-[28rem]">
        <div className="flex min-h-11 items-center justify-between gap-2 text-xs text-muted-foreground">
          {editingName ? (
            <Input
              autoFocus
              aria-label="Centre name"
              className="h-11 flex-1"
              value={centreName}
              placeholder="Your centre's name"
              onChange={(e) => setCentreName(e.target.value)}
              onBlur={() => {
                setEditingName(false);
                void saveName().catch((e) =>
                  toast.error(formatUserError(e, "Could not save the name.")),
                );
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
            />
          ) : (
            <button
              type="button"
              className="min-h-11 truncate text-left font-medium text-foreground underline decoration-dotted underline-offset-4"
              onClick={() => setEditingName(true)}
              aria-label="Edit centre name"
            >
              {centreName.trim() || "Name your centre"} ✎
            </button>
          )}
          <span className="shrink-0">
            Step {stepNo} of {steps.length - 1}
          </span>
        </div>
        <DialogTitle className="font-display text-lg leading-snug">
          <Copy c={titles[step]} />
        </DialogTitle>
        <DialogDescription className="sr-only">
          Quick setup for your centre
        </DialogDescription>
        {step === "timings" && (
          <p className="-mt-2 text-xs text-muted-foreground">
            {QS_COPY.timingsHint.en}
          </p>
        )}
        {body[step]}
        <div className="mt-2 flex gap-2">
          {prev && (
            <Button
              variant="ghost"
              className="h-12"
              onClick={() => go(prev)}
              disabled={busy}
            >
              Back
            </Button>
          )}
          <Button
            className="h-12 flex-1"
            onClick={() => void onContinue()}
            disabled={
              busy || otherInvalid || (step === "students" && students === null)
            }
          >
            {busy ? "Saving…" : continueLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
