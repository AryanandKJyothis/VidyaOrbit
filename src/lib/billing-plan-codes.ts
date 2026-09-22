export const SUBSCRIBE_PLAN_CODES = ["starter", "growth", "pro"] as const;
export type SubscribablePlanCode = (typeof SUBSCRIBE_PLAN_CODES)[number];

export function isSubscribablePlan(code: string): code is SubscribablePlanCode {
  return SUBSCRIBE_PLAN_CODES.includes(code as SubscribablePlanCode);
}
