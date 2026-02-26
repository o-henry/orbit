import { describe, expect, it } from "vitest";
import {
  computeStrandRatio,
  eventToSessionDelta,
  mergeSessionLogAnalytics,
  mergeStrandSeconds,
} from "@/domain/sessionAnalytics";
import { SessionLog } from "@/lib/types";

describe("eventToSessionDelta", () => {
  it("maps input events to input strand", () => {
    const delta = eventToSessionDelta({ type: "segment_play", seconds: 30 });
    expect(delta.strandSeconds.input).toBe(30);
    expect(delta.strandSeconds.output).toBe(0);
  });

  it("maps loop events to fluency with default counters", () => {
    const delta = eventToSessionDelta({ type: "loop_cycle" });
    expect(delta.strandSeconds.fluency).toBeGreaterThan(0);
    expect(delta.fluencyLoops).toBe(1);
  });

  it("maps noticing event to form and noticing count", () => {
    const delta = eventToSessionDelta({ type: "noticing_mark", seconds: 7 });
    expect(delta.strandSeconds.form).toBe(7);
    expect(delta.noticingEvents).toBe(1);
  });
});

describe("mergeStrandSeconds", () => {
  it("sums strand values safely", () => {
    const merged = mergeStrandSeconds({ input: 12, output: 1 }, { input: 8, fluency: 5 });
    expect(merged).toEqual({ input: 20, output: 1, form: 0, fluency: 5 });
  });
});

describe("mergeSessionLogAnalytics", () => {
  it("merges optional analytics fields", () => {
    const base: SessionLog = {
      date: "2026-02-26",
      minutes: 10,
      savedCount: 1,
      strandSeconds: { input: 20, output: 5, form: 3, fluency: 2 },
      interactionTurns: 2,
      noticingEvents: 1,
      fluencyLoops: 1,
    };

    const merged = mergeSessionLogAnalytics(base, {
      strandSeconds: { input: 5, output: 0, form: 2, fluency: 8 },
      interactionTurns: 1,
      noticingEvents: 2,
      fluencyLoops: 3,
    });

    expect(merged).toEqual({
      strandSeconds: { input: 25, output: 5, form: 5, fluency: 10 },
      interactionTurns: 3,
      noticingEvents: 3,
      fluencyLoops: 4,
    });
  });
});

describe("computeStrandRatio", () => {
  it("returns 0 ratio if no strand seconds", () => {
    expect(computeStrandRatio()).toEqual({ input: 0, output: 0, form: 0, fluency: 0 });
  });

  it("computes normalized ratio", () => {
    const ratio = computeStrandRatio({ input: 20, output: 20, form: 10, fluency: 50 });
    expect(ratio.input).toBe(0.2);
    expect(ratio.output).toBe(0.2);
    expect(ratio.form).toBe(0.1);
    expect(ratio.fluency).toBe(0.5);
  });
});
