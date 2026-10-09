import { describe, expect, it } from "vitest";
import {
  fadeOnly,
  motionTransition,
  project,
  rubberband,
  springDefault,
  springMomentum,
  springSnappy,
} from "./motion";

describe("motion springs", () => {
  it("defaults to a critically damped spring (no overshoot)", () => {
    expect(springDefault).toMatchObject({
      type: "spring",
      bounce: 0,
      duration: 0.4,
    });
    expect(springSnappy).toMatchObject({
      type: "spring",
      bounce: 0,
      duration: 0.3,
    });
  });

  it("reserves bounce for momentum-driven gestures", () => {
    expect(springMomentum.bounce).toBeGreaterThan(0);
    expect(springMomentum.bounce).toBeLessThan(0.3);
  });

  it("falls back to a short fade when motion is reduced", () => {
    expect(motionTransition(true)).toEqual(fadeOnly);
    expect(motionTransition(false)).toEqual(springDefault);
  });
});

describe("momentum projection", () => {
  it("projects further for a faster flick (Apple exponential decay)", () => {
    const slow = project(200);
    const fast = project(800);
    expect(fast).toBeGreaterThan(slow);
    expect(project(0)).toBe(0);
  });

  it("rubber-bands less than the raw overshoot", () => {
    const raw = 120;
    const resisted = rubberband(raw, 320);
    expect(Math.abs(resisted)).toBeLessThan(Math.abs(raw));
    expect(rubberband(0, 320)).toBe(0);
  });
});
