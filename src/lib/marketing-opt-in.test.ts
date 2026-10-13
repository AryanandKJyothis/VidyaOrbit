import { describe, expect, it } from "vitest";
import {
  hasMarketingChoice,
  isGoogleAuthUser,
  marketingOptInMetadata,
  readMarketingOptIn,
  shouldAskMarketingInSetup,
} from "./marketing-opt-in";

describe("marketing opt-in metadata", () => {
  it("records consent and a timestamp whether the box is ticked or not", () => {
    const at = new Date("2026-10-13T12:00:00.000Z");
    expect(marketingOptInMetadata(true, at)).toEqual({
      marketing_opt_in: true,
      marketing_opt_in_at: "2026-10-13T12:00:00.000Z",
    });
    expect(marketingOptInMetadata(false, at)).toEqual({
      marketing_opt_in: false,
      marketing_opt_in_at: "2026-10-13T12:00:00.000Z",
    });
  });

  it("treats missing metadata as unanswered, not opted out", () => {
    expect(hasMarketingChoice(undefined)).toBe(false);
    expect(hasMarketingChoice({})).toBe(false);
    expect(readMarketingOptIn({})).toBeNull();
    expect(hasMarketingChoice({ marketing_opt_in: false })).toBe(true);
    expect(hasMarketingChoice({ marketing_opt_in: "true" })).toBe(true);
    expect(
      readMarketingOptIn({
        marketing_opt_in: true,
        marketing_opt_in_at: "2026-10-13T12:00:00.000Z",
      }),
    ).toEqual({
      optedIn: true,
      at: "2026-10-13T12:00:00.000Z",
    });
  });

  it("asks inside setup only after Google OAuth when there is no recorded choice", () => {
    expect(
      shouldAskMarketingInSetup({ isGoogleUser: true, hasChoice: false }),
    ).toBe(true);
    expect(
      shouldAskMarketingInSetup({ isGoogleUser: true, hasChoice: true }),
    ).toBe(false);
    expect(
      shouldAskMarketingInSetup({ isGoogleUser: false, hasChoice: false }),
    ).toBe(false);
  });

  it("detects Google auth users from provider metadata", () => {
    expect(isGoogleAuthUser({ app_metadata: { provider: "google" } })).toBe(
      true,
    );
    expect(isGoogleAuthUser({ app_metadata: { providers: ["google"] } })).toBe(
      true,
    );
    expect(isGoogleAuthUser({ identities: [{ provider: "google" }] })).toBe(
      true,
    );
    expect(isGoogleAuthUser({ app_metadata: { provider: "email" } })).toBe(
      false,
    );
  });
});
