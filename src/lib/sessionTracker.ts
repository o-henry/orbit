import { saveSessionLog } from "@/lib/storage";
import { SessionLog } from "@/lib/types";
import {
  createEmptyStrandSeconds,
  eventToSessionDelta,
  SessionAnalyticsEvent,
  SessionAnalyticsDelta,
} from "@/domain/sessionAnalytics";

const todayDateKey = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const buildLogPayload = (
  delta: Partial<SessionAnalyticsDelta>,
  options?: {
    date?: string;
    stepsCompleted?: SessionLog["stepsCompleted"];
    savedCount?: number;
  }
): SessionLog => ({
  date: options?.date || todayDateKey(),
  minutes: Math.max(0, Math.floor(delta.minutes || 0)),
  savedCount: Math.max(0, Math.floor(options?.savedCount ?? delta.savedCount ?? 0)),
  stepsCompleted: options?.stepsCompleted,
  strandSeconds: delta.strandSeconds || createEmptyStrandSeconds(),
  interactionTurns: Math.max(0, Math.floor(delta.interactionTurns || 0)),
  noticingEvents: Math.max(0, Math.floor(delta.noticingEvents || 0)),
  fluencyLoops: Math.max(0, Math.floor(delta.fluencyLoops || 0)),
});

export async function trackSessionEvent(
  event: SessionAnalyticsEvent,
  options?: {
    stepsCompleted?: SessionLog["stepsCompleted"];
    savedCount?: number;
  }
): Promise<void> {
  const delta = eventToSessionDelta(event);
  await saveSessionLog(buildLogPayload(delta, options));
}

export async function trackSavedMemory(options?: {
  savedCount?: number;
  stepsCompleted?: SessionLog["stepsCompleted"];
}): Promise<void> {
  await saveSessionLog(
    buildLogPayload(
      {
        minutes: 0,
        savedCount: options?.savedCount ?? 1,
        strandSeconds: createEmptyStrandSeconds(),
        interactionTurns: 0,
        noticingEvents: 0,
        fluencyLoops: 0,
      },
      options
    )
  );
}

export async function trackStepCompletion(stepsCompleted: SessionLog["stepsCompleted"]): Promise<void> {
  await saveSessionLog(
    buildLogPayload({
      minutes: 0,
      savedCount: 0,
      strandSeconds: createEmptyStrandSeconds(),
      interactionTurns: 0,
      noticingEvents: 0,
      fluencyLoops: 0,
    }, { stepsCompleted })
  );
}
