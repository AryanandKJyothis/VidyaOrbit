import { describe, expect, it } from "vitest";
import { callerCanBillForCentre } from "./billing-workspace";

const OWNER = "owner-1";
const MANAGER = "manager-9";
const STAFF = "staff-3";

describe("callerCanBillForCentre", () => {
  it("lets the centre owner bill even without a membership row", () => {
    expect(
      callerCanBillForCentre({
        userId: OWNER,
        centreOwnerId: OWNER,
        membershipRole: null,
      }),
    ).toBe(true);
  });

  it("lets a manager bill for the centre they belong to", () => {
    expect(
      callerCanBillForCentre({
        userId: MANAGER,
        centreOwnerId: OWNER,
        membershipRole: "manager",
      }),
    ).toBe(true);
  });

  it("blocks staff and strangers", () => {
    expect(
      callerCanBillForCentre({
        userId: STAFF,
        centreOwnerId: OWNER,
        membershipRole: "staff",
      }),
    ).toBe(false);
    expect(
      callerCanBillForCentre({
        userId: "stranger",
        centreOwnerId: OWNER,
        membershipRole: null,
      }),
    ).toBe(false);
  });
});
