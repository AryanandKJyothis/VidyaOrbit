import { requireRazorpayEnv } from "@/lib/razorpay-env";

const RZ_BASE = "https://api.razorpay.com/v1";

/** Basic Authorization header for Razorpay REST requests (server-side only). */
function authHeader(): string {
  const { keyId, keySecret } = requireRazorpayEnv();
  const encoded = btoa(`${keyId}:${keySecret}`);
  return `Basic ${encoded}`;
}

export async function razorpayFetch<T>(
  path: string,
  init?: RequestInit & { parseJson?: true },
): Promise<T> {
  const url = `${RZ_BASE}${path}`;
  const options = {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
      ...(init?.headers ?? {}),
    },
  };

  let retries = 3;
  let delay = 1000;

  while (retries > 0) {
    const res = await fetch(url, options);
    const text = await res.text();

    if (!res.ok) {
      if ((res.status === 429 || res.status >= 500) && retries > 1) {
        retries--;
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // exponential backoff
        continue;
      }
      throw new Error(`Razorpay HTTP ${res.status}: ${text.slice(0, 280)}`);
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error("Razorpay returned invalid JSON");
    }
  }
  throw new Error("Razorpay fetch failed unexpectedly");
}

export type RzCustomerCreate = {
  id: string;
};

export async function rzCreateCustomer(params: {
  email: string;
  name: string;
  ownerId: string;
}) {
  return razorpayFetch<RzCustomerCreate>("/customers", {
    method: "POST",
    body: JSON.stringify({
      email: params.email,
      name: params.name.slice(0, 120),
      fail_existing: 0,
      notes: { owner_id: params.ownerId },
    }),
  });
}

export type RzSubscriptionSnapshot = {
  id: string;
  status?: string;
  short_url?: string | null;
  customer_id?: string | null;
  plan_id?: string;
  notes?: Record<string, unknown> | null;
  current_end?: number | null;
};

export type RzSubscriptionCreate = RzSubscriptionSnapshot;

export type RzPlanSnapshot = {
  id: string;
  item?: { active?: boolean };
};

export async function rzCreateSubscription(params: {
  plan_id: string;
  customer_id: string;
  ownerId: string;
  plan_code: string;
}) {
  return razorpayFetch<RzSubscriptionCreate>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      plan_id: params.plan_id,
      customer_notify: 1,
      quantity: 1,
      customer_id: params.customer_id,
      total_count: 240,
      notes: {
        owner_id: params.ownerId,
        plan_code: params.plan_code,
      },
    }),
  });
}

export async function rzGetSubscription(subscriptionId: string) {
  return razorpayFetch<RzSubscriptionSnapshot>(
    `/subscriptions/${subscriptionId}`,
    {
      method: "GET",
    },
  );
}

export async function rzGetPlan(planId: string) {
  return razorpayFetch<RzPlanSnapshot>(`/plans/${planId}`, { method: "GET" });
}
export async function rzCancelSubscription(
  subscriptionId: string,
): Promise<void> {
  await razorpayFetch(`/subscriptions/${subscriptionId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ cancel_at_cycle_end: 0 }),
  });
}
