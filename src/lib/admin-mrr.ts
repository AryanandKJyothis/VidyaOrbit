/**
 * Founder-admin MRR and mapping helpers.
 * List prices must match TIER_CONFIGS in billing-pricing.ts and the
 * admin_platform_overview SQL (paise). Annual MRR is round(annual / 12).
 */

export type AdminPlanCode = "free" | "starter" | "growth" | "pro";
export type AdminBillingCycle = "monthly" | "annual";

export const ADMIN_LIST_PRICE_PAISE = {
  starter: { monthly: 49900, annual: 499900 },
  growth: { monthly: 99900, annual: 1000000 },
  pro: { monthly: 249900, annual: 2500000 },
} as const;

export function annualMrrPaise(annualPaise: number): number {
  return Math.round(annualPaise / 12);
}

export function isPayingCentre(args: {
  plan: string | null | undefined;
  status: string | null | undefined;
  expiryDate: string | null | undefined;
  now?: Date;
}): boolean {
  const plan = args.plan ?? "free";
  const status = args.status ?? "active";
  if (plan === "free") return false;
  if (status !== "active") return false;
  if (args.expiryDate) {
    const exp = new Date(args.expiryDate).getTime();
    if (Number.isFinite(exp) && exp <= (args.now ?? new Date()).getTime()) {
      return false;
    }
  }
  return true;
}

export function mrrPaiseForCentre(args: {
  plan: string | null | undefined;
  status: string | null | undefined;
  expiryDate: string | null | undefined;
  cycle: AdminBillingCycle | string | null | undefined;
  now?: Date;
}): number {
  if (!isPayingCentre(args)) return 0;
  const plan = args.plan as Exclude<AdminPlanCode, "free">;
  const prices = ADMIN_LIST_PRICE_PAISE[plan];
  if (!prices) return 0;
  if (args.cycle === "annual") return annualMrrPaise(prices.annual);
  return prices.monthly;
}

export function sumMrrPaise(
  centres: Array<{
    plan: string | null | undefined;
    status: string | null | undefined;
    expiryDate: string | null | undefined;
    cycle: AdminBillingCycle | string | null | undefined;
  }>,
  now?: Date,
): number {
  return centres.reduce((sum, c) => sum + mrrPaiseForCentre({ ...c, now }), 0);
}

export function paiseToRupees(paise: number | null | undefined): number {
  const n = Number(paise ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n / 100);
}

/** Platform-admin owners (`user_roles.role = 'admin'`) and their rows. */
export type FounderCentreFact = {
  ownerId: string;
  platformAdmin: boolean;
  plan: string | null;
  status: string | null;
  expiryDate: string | null;
  cycle: string | null;
  createdAt: string;
  lastActiveAt?: string | null;
  studentCount?: number;
};

export type FounderUserFact = {
  id: string;
  platformAdmin: boolean;
  createdAt: string;
  lastSignInAt: string | null;
};

export type FounderPaymentFact = {
  ownerId: string;
  platformAdminOwner: boolean;
  amountPaise: number;
  status: string;
  keyMode: string;
  paidAt: string | null;
  needsReview?: boolean;
};

export type FounderAlertFact = {
  ownerId: string;
  platformAdminOwner: boolean;
  kind: string;
};

export function withoutPlatformAdmins<T extends { platformAdmin: boolean }>(
  rows: T[],
): T[] {
  return rows.filter((row) => !row.platformAdmin);
}

export function withoutAdminOwned<
  T extends { ownerId: string; platformAdminOwner?: boolean },
>(rows: T[], adminOwnerIds?: Iterable<string>): T[] {
  if (adminOwnerIds) {
    const admins = new Set(adminOwnerIds);
    return rows.filter((row) => !admins.has(row.ownerId));
  }
  return rows.filter((row) => !row.platformAdminOwner);
}

function inUtcDay(iso: string, day: string): boolean {
  const t = new Date(iso).getTime();
  const start = Date.parse(`${day}T00:00:00.000Z`);
  return Number.isFinite(t) && t >= start && t < start + 86_400_000;
}

function withinPastDays(iso: string | null, days: number, now: Date): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t > now.getTime() - days * 86_400_000;
}

/**
 * Founder-admin overview after dropping platform-admin accounts and the
 * centres / payments they own. Must match admin_platform_overview SQL.
 */
export function founderOverviewFromFacts(
  args: {
    centres: FounderCentreFact[];
    users: FounderUserFact[];
    payments: FounderPaymentFact[];
    alerts?: FounderAlertFact[];
    trendDays?: string[];
  },
  now: Date = new Date(),
): Pick<
  AdminOverview,
  | "centres"
  | "users"
  | "active_users_7d"
  | "active_users_30d"
  | "signups_7d"
  | "signups_30d"
  | "centre_signups_7d"
  | "centre_signups_30d"
  | "signup_trend"
  | "mrr_paise"
  | "revenue_30d_paise"
  | "trials"
  | "paying"
> & { alerts: number; recent_activity: number } {
  const centres = withoutPlatformAdmins(args.centres);
  const users = withoutPlatformAdmins(args.users);
  const payments = withoutAdminOwned(args.payments);
  const alerts = withoutAdminOwned(args.alerts ?? []);
  const trendDays = args.trendDays ?? [];
  return {
    centres: centres.length,
    users: users.length,
    active_users_7d: users.filter((u) => withinPastDays(u.lastSignInAt, 7, now))
      .length,
    active_users_30d: users.filter((u) =>
      withinPastDays(u.lastSignInAt, 30, now),
    ).length,
    signups_7d: users.filter((u) => withinPastDays(u.createdAt, 7, now)).length,
    signups_30d: users.filter((u) => withinPastDays(u.createdAt, 30, now))
      .length,
    centre_signups_7d: centres.filter((c) =>
      withinPastDays(c.createdAt, 7, now),
    ).length,
    centre_signups_30d: centres.filter((c) =>
      withinPastDays(c.createdAt, 30, now),
    ).length,
    signup_trend: trendDays.map((day) => ({
      day,
      users: users.filter((u) => inUtcDay(u.createdAt, day)).length,
      centres: centres.filter((c) => inUtcDay(c.createdAt, day)).length,
    })),
    mrr_paise: sumMrrPaise(centres, now),
    revenue_30d_paise: payments
      .filter(
        (p) =>
          p.status === "paid" &&
          p.keyMode === "live" &&
          withinPastDays(p.paidAt, 30, now),
      )
      .reduce((sum, p) => sum + p.amountPaise, 0),
    trials: centres.filter((c) => c.status === "trialing").length,
    paying: centres.filter((c) => isPayingCentre({ ...c, now })).length,
    alerts: alerts.length,
    recent_activity: centres.filter((c) =>
      withinPastDays(c.lastActiveAt ?? null, 7, now),
    ).length,
  };
}

const FORBIDDEN_ADMIN_KEYS = [
  "token",
  "raw_body",
  "signature",
  "rawBody",
] as const;

export function stripForbiddenAdminFields<T extends Record<string, unknown>>(
  raw: T,
): Omit<T, (typeof FORBIDDEN_ADMIN_KEYS)[number]> {
  const out = { ...raw };
  for (const key of FORBIDDEN_ADMIN_KEYS) {
    delete out[key];
  }
  return out;
}

export type AdminCentreRow = {
  owner_id: string;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string | null;
  owner_email: string | null;
  owner_last_sign_in_at: string | null;
  member_emails: string[];
  staff_count: number;
  member_count: number;
  plan: string | null;
  status: string | null;
  start_date: string | null;
  expiry_date: string | null;
  plan_price: number | null;
  setup_fee_paid: boolean;
  student_count: number;
  plan_limit: number;
  days_until_expiry: number | null;
  last_active_at: string | null;
  last_active_source: string | null;
  attendance_30d: number;
  payments_30d: number;
  students_30d: number;
  batches_30d: number;
  top_feature_30d: string | null;
  last_payment_at: string | null;
  last_payment_amount_paise: number | null;
  last_payment_tier: string | null;
  last_payment_cycle: string | null;
  needs_review_count: number;
};

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function asNumber(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((e): e is string => typeof e === "string" && e.length > 0);
}

export function mapCentreRow(raw: unknown): AdminCentreRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = stripForbiddenAdminFields(raw as Record<string, unknown>);
  const ownerId = asString(r.owner_id);
  const name = asString(r.name);
  if (!ownerId || !name) return null;
  return {
    owner_id: ownerId,
    name,
    contact_email: asString(r.contact_email),
    contact_phone: asString(r.contact_phone),
    created_at: asString(r.created_at),
    owner_email: asString(r.owner_email),
    owner_last_sign_in_at: asString(r.owner_last_sign_in_at),
    member_emails: asStringArray(r.member_emails),
    staff_count: asNumber(r.staff_count),
    member_count: asNumber(r.member_count),
    plan: asString(r.plan),
    status: asString(r.status),
    start_date: asString(r.start_date),
    expiry_date: asString(r.expiry_date),
    plan_price: r.plan_price == null ? null : asNumber(r.plan_price),
    setup_fee_paid: Boolean(r.setup_fee_paid),
    student_count: asNumber(r.student_count),
    plan_limit: asNumber(r.plan_limit, 25),
    days_until_expiry:
      r.days_until_expiry == null ? null : asNumber(r.days_until_expiry),
    last_active_at: (() => {
      const ts = asString(r.last_active_at);
      if (!ts) return null;
      const ms = new Date(ts).getTime();
      return Number.isFinite(ms) && ms > 0 ? ts : null;
    })(),
    last_active_source: asString(r.last_active_source),
    attendance_30d: asNumber(r.attendance_30d),
    payments_30d: asNumber(r.payments_30d),
    students_30d: asNumber(r.students_30d),
    batches_30d: asNumber(r.batches_30d),
    top_feature_30d: asString(r.top_feature_30d),
    last_payment_at: asString(r.last_payment_at),
    last_payment_amount_paise:
      r.last_payment_amount_paise == null
        ? null
        : asNumber(r.last_payment_amount_paise),
    last_payment_tier: asString(r.last_payment_tier),
    last_payment_cycle: asString(r.last_payment_cycle),
    needs_review_count: asNumber(r.needs_review_count),
  };
}

export type AdminUserCentre = {
  owner_id: string;
  name: string;
  role: string;
  is_own: boolean;
};

export type AdminUserRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  joining_team: boolean;
  platform_admin: boolean;
  owns_centre: boolean;
  orphan: boolean;
  centres: AdminUserCentre[];
};

export function mapUserCentre(raw: unknown): AdminUserCentre | null {
  if (!raw || typeof raw !== "object") return null;
  const r = stripForbiddenAdminFields(raw as Record<string, unknown>);
  const ownerId = asString(r.owner_id);
  if (!ownerId) return null;
  return {
    owner_id: ownerId,
    name: asString(r.name) ?? "Workspace",
    role: asString(r.role) ?? "staff",
    is_own: Boolean(r.is_own),
  };
}

export function mapUserRow(raw: unknown): AdminUserRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = stripForbiddenAdminFields(raw as Record<string, unknown>);
  const userId = asString(r.user_id);
  if (!userId) return null;
  const centres = Array.isArray(r.centres)
    ? r.centres.map(mapUserCentre).filter((c): c is AdminUserCentre => !!c)
    : [];
  return {
    user_id: userId,
    email: asString(r.email),
    full_name: asString(r.full_name),
    phone: asString(r.phone),
    created_at: asString(r.created_at),
    last_sign_in_at: asString(r.last_sign_in_at),
    email_confirmed_at: asString(r.email_confirmed_at),
    joining_team: Boolean(r.joining_team),
    platform_admin: Boolean(r.platform_admin),
    owns_centre: Boolean(r.owns_centre),
    orphan: Boolean(r.orphan),
    centres,
  };
}

/** Platform admins (`user_roles.role = 'admin'`) are omitted from founder metrics. */
export function isPlatformAdminRow(row: { platform_admin?: boolean }): boolean {
  return row.platform_admin === true;
}

export function excludePlatformAdminRows<
  T extends { platform_admin?: boolean },
>(rows: T[]): T[] {
  return rows.filter((row) => !isPlatformAdminRow(row));
}

export type AdminPaymentRow = {
  id: string;
  owner_id: string;
  centre_name: string | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  intent: string | null;
  amount_paise: number;
  currency: string;
  status: string;
  tier: string | null;
  cycle: string | null;
  key_mode: string | null;
  created_at: string | null;
  paid_at: string | null;
  activated_at: string | null;
  needs_review: boolean;
  review_reason: string | null;
};

export function mapPaymentRow(raw: unknown): AdminPaymentRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = stripForbiddenAdminFields(raw as Record<string, unknown>);
  const id = asString(r.id);
  const ownerId = asString(r.owner_id);
  if (!id || !ownerId) return null;
  return {
    id,
    owner_id: ownerId,
    centre_name: asString(r.centre_name),
    razorpay_order_id: asString(r.razorpay_order_id),
    razorpay_payment_id: asString(r.razorpay_payment_id),
    intent: asString(r.intent),
    amount_paise: asNumber(r.amount_paise),
    currency: asString(r.currency) ?? "INR",
    status: asString(r.status) ?? "created",
    tier: asString(r.tier),
    cycle: asString(r.cycle),
    key_mode: asString(r.key_mode),
    created_at: asString(r.created_at),
    paid_at: asString(r.paid_at),
    activated_at: asString(r.activated_at),
    needs_review: Boolean(r.needs_review),
    review_reason: asString(r.review_reason),
  };
}

export type AdminAlert = {
  kind: string;
  severity: "info" | "warning" | "danger";
  title: string;
  detail: string | null;
  owner_id: string | null;
  name: string | null;
  href: string;
};

export function mapAlert(raw: unknown): AdminAlert | null {
  if (!raw || typeof raw !== "object") return null;
  const r = stripForbiddenAdminFields(raw as Record<string, unknown>);
  const kind = asString(r.kind);
  const title = asString(r.title);
  if (!kind || !title) return null;
  const severity =
    r.severity === "danger" || r.severity === "warning" || r.severity === "info"
      ? r.severity
      : "info";
  return {
    kind,
    severity,
    title,
    detail: asString(r.detail),
    owner_id: asString(r.owner_id),
    name: asString(r.name),
    href: asString(r.href) ?? "/admin/alerts",
  };
}

export type AdminSignupPoint = { day: string; users: number; centres: number };

export type AdminPlanMix = { plan: string; count: number };

export type AdminOverview = {
  centres: number;
  users: number;
  active_users_7d: number;
  active_users_30d: number;
  signups_7d: number;
  signups_30d: number;
  centre_signups_7d: number;
  centre_signups_30d: number;
  signup_trend: AdminSignupPoint[];
  mrr_paise: number;
  revenue_30d_paise: number;
  plan_mix: AdminPlanMix[];
  trials: number;
  trials_ending_7d: number;
  expiring_7d: number;
  expiring_30d: number;
  over_limit: number;
  needs_review: number;
  webhook_errors: number;
  paying: number;
};

export function mapOverview(raw: unknown): AdminOverview {
  const empty: AdminOverview = {
    centres: 0,
    users: 0,
    active_users_7d: 0,
    active_users_30d: 0,
    signups_7d: 0,
    signups_30d: 0,
    centre_signups_7d: 0,
    centre_signups_30d: 0,
    signup_trend: [],
    mrr_paise: 0,
    revenue_30d_paise: 0,
    plan_mix: [],
    trials: 0,
    trials_ending_7d: 0,
    expiring_7d: 0,
    expiring_30d: 0,
    over_limit: 0,
    needs_review: 0,
    webhook_errors: 0,
    paying: 0,
  };
  if (!raw || typeof raw !== "object") return empty;
  const r = stripForbiddenAdminFields(raw as Record<string, unknown>);
  const trend = Array.isArray(r.signup_trend)
    ? r.signup_trend
        .map((p) => {
          if (!p || typeof p !== "object") return null;
          const row = p as Record<string, unknown>;
          const day = asString(row.day);
          if (!day) return null;
          return {
            day,
            users: asNumber(row.users),
            centres: asNumber(row.centres),
          };
        })
        .filter((p): p is AdminSignupPoint => !!p)
    : [];
  const mix = Array.isArray(r.plan_mix)
    ? r.plan_mix
        .map((p) => {
          if (!p || typeof p !== "object") return null;
          const row = p as Record<string, unknown>;
          const plan = asString(row.plan);
          if (!plan) return null;
          return { plan, count: asNumber(row.count) };
        })
        .filter((p): p is AdminPlanMix => !!p)
    : [];
  return {
    centres: asNumber(r.centres),
    users: asNumber(r.users),
    active_users_7d: asNumber(r.active_users_7d),
    active_users_30d: asNumber(r.active_users_30d),
    signups_7d: asNumber(r.signups_7d),
    signups_30d: asNumber(r.signups_30d),
    centre_signups_7d: asNumber(r.centre_signups_7d),
    centre_signups_30d: asNumber(r.centre_signups_30d),
    signup_trend: trend,
    mrr_paise: asNumber(r.mrr_paise),
    revenue_30d_paise: asNumber(r.revenue_30d_paise),
    plan_mix: mix,
    trials: asNumber(r.trials),
    trials_ending_7d: asNumber(r.trials_ending_7d),
    expiring_7d: asNumber(r.expiring_7d),
    expiring_30d: asNumber(r.expiring_30d),
    over_limit: asNumber(r.over_limit),
    needs_review: asNumber(r.needs_review),
    webhook_errors: asNumber(r.webhook_errors),
    paying: asNumber(r.paying),
  };
}

export type AdminPaged<T> = { total: number; rows: T[] };

export function mapPaged<T>(
  raw: unknown,
  mapRow: (row: unknown) => T | null,
): AdminPaged<T> {
  if (!raw || typeof raw !== "object") return { total: 0, rows: [] };
  const r = raw as Record<string, unknown>;
  const rows = Array.isArray(r.rows)
    ? r.rows.map(mapRow).filter((row): row is T => row != null)
    : [];
  return { total: asNumber(r.total), rows };
}

export function excludePlatformAdminsFromPage<
  T extends { platform_admin?: boolean },
>(page: AdminPaged<T>): AdminPaged<T> {
  const rows = excludePlatformAdminRows(page.rows);
  const dropped = page.rows.length - rows.length;
  return { total: Math.max(0, page.total - dropped), rows };
}
