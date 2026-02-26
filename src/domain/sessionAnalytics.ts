import { SessionLog } from "@/lib/types";

export type StrandKey = "input" | "output" | "form" | "fluency";

export interface StrandSeconds {
  input: number;
  output: number;
  form: number;
  fluency: number;
}

export interface SessionAnalyticsDelta {
  minutes: number;
  savedCount: number;
  strandSeconds: StrandSeconds;
  interactionTurns: number;
  noticingEvents: number;
  fluencyLoops: number;
}

export type SessionAnalyticsEventType =
  | "segment_play"
  | "segment_nav"
  | "transcript_activate"
  | "shadowing_record"
  | "ai_feedback"
  | "srs_rate"
  | "loop_cycle"
  | "noticing_mark";

export interface SessionAnalyticsEvent {
  type: SessionAnalyticsEventType;
  seconds?: number;
  turns?: number;
  noticingCount?: number;
  loopCount?: number;
}

const EVENT_STRAND_MAP: Record<SessionAnalyticsEventType, StrandKey> = {
  segment_play: "input",
  segment_nav: "input",
  transcript_activate: "input",
  shadowing_record: "output",
  ai_feedback: "form",
  srs_rate: "fluency",
  loop_cycle: "fluency",
  noticing_mark: "form",
};

const DEFAULT_EVENT_SECONDS: Partial<Record<SessionAnalyticsEventType, number>> = {
  segment_play: 10,
  segment_nav: 5,
  transcript_activate: 8,
  shadowing_record: 20,
  ai_feedback: 15,
  srs_rate: 12,
  loop_cycle: 10,
  noticing_mark: 6,
};

export const createEmptyStrandSeconds = (): StrandSeconds => ({
  input: 0,
  output: 0,
  form: 0,
  fluency: 0,
});

export const createEmptySessionAnalyticsDelta = (): SessionAnalyticsDelta => ({
  minutes: 0,
  savedCount: 0,
  strandSeconds: createEmptyStrandSeconds(),
  interactionTurns: 0,
  noticingEvents: 0,
  fluencyLoops: 0,
});

export const normalizeStrandSeconds = (value?: Partial<StrandSeconds> | null): StrandSeconds => ({
  input: Math.max(0, Math.floor(Number(value?.input) || 0)),
  output: Math.max(0, Math.floor(Number(value?.output) || 0)),
  form: Math.max(0, Math.floor(Number(value?.form) || 0)),
  fluency: Math.max(0, Math.floor(Number(value?.fluency) || 0)),
});

export const mergeStrandSeconds = (base?: Partial<StrandSeconds>, next?: Partial<StrandSeconds>): StrandSeconds => {
  const normalizedBase = normalizeStrandSeconds(base);
  const normalizedNext = normalizeStrandSeconds(next);

  return {
    input: normalizedBase.input + normalizedNext.input,
    output: normalizedBase.output + normalizedNext.output,
    form: normalizedBase.form + normalizedNext.form,
    fluency: normalizedBase.fluency + normalizedNext.fluency,
  };
};

export const eventToSessionDelta = (event: SessionAnalyticsEvent): SessionAnalyticsDelta => {
  const strand = EVENT_STRAND_MAP[event.type];
  const seconds = Math.max(0, Math.floor(event.seconds ?? DEFAULT_EVENT_SECONDS[event.type] ?? 0));
  const strandSeconds = createEmptyStrandSeconds();
  strandSeconds[strand] = seconds;

  return {
    minutes: Math.floor(seconds / 60),
    savedCount: 0,
    strandSeconds,
    interactionTurns: Math.max(0, Math.floor(event.turns || 0)),
    noticingEvents: Math.max(0, Math.floor(event.noticingCount || (event.type === "noticing_mark" ? 1 : 0))),
    fluencyLoops: Math.max(0, Math.floor(event.loopCount || (event.type === "loop_cycle" ? 1 : 0))),
  };
};

export const mergeSessionLogAnalytics = (base: SessionLog, next: Partial<SessionLog>): Pick<SessionLog, "strandSeconds" | "interactionTurns" | "noticingEvents" | "fluencyLoops"> => ({
  strandSeconds: mergeStrandSeconds(base.strandSeconds, next.strandSeconds),
  interactionTurns: (base.interactionTurns || 0) + (next.interactionTurns || 0),
  noticingEvents: (base.noticingEvents || 0) + (next.noticingEvents || 0),
  fluencyLoops: (base.fluencyLoops || 0) + (next.fluencyLoops || 0),
});

export const computeStrandRatio = (strandSeconds?: Partial<StrandSeconds>): Record<StrandKey, number> => {
  const normalized = normalizeStrandSeconds(strandSeconds);
  const total = normalized.input + normalized.output + normalized.form + normalized.fluency;
  if (total <= 0) {
    return {
      input: 0,
      output: 0,
      form: 0,
      fluency: 0,
    };
  }

  return {
    input: normalized.input / total,
    output: normalized.output / total,
    form: normalized.form / total,
    fluency: normalized.fluency / total,
  };
};
