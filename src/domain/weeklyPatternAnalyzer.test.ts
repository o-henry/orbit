import { describe, expect, it } from "vitest";
import { analyzeWeeklyPatterns } from "@/domain/weeklyPatternAnalyzer";
import { OrbitStudySession } from "@/lib/types";

const makeSession = (id: string, createdAt: number, language = "English"): OrbitStudySession => ({
  id,
  targetLanguage: language,
  packet: {
    targetLanguage: language,
    level: "초급",
    videoTitle: "video",
    videoUrl: "https://youtube.com/watch?v=1",
    clipStart: "00:00",
    clipEnd: "00:20",
    oneLineSummaryKr: "요약",
    keyExpressions: ["on my way"],
    conversationGoal: "대화",
    correctionMode: "light",
    storyboardNeeded: false,
  },
  packetText: "[ORBIT_SESSION]",
  status: "reviewed",
  review: {
    strengths: ["흐름 유지", "재진술"],
    repeatedErrors: [
      { original: "I am go", natural: "I am going", reason: "시제" },
      { original: "the information", natural: "information", reason: "관사" },
      { original: "직역 표현", natural: "자연스러운 표현", reason: "직역" },
    ],
    takeawayExpressions: ["on my way", "in the meantime"],
    nextSessionDrills: ["Could you clarify?"],
    scenes: ["장면"],
    createdAt,
  },
  createdAt,
  updatedAt: createdAt,
});

describe("weeklyPatternAnalyzer", () => {
  it("builds top patterns and recommendations", () => {
    const now = new Date("2026-03-02T10:00:00+09:00").getTime();
    const sessions = [makeSession("s1", now - 86400000), makeSession("s2", now - 2 * 86400000)];

    const report = analyzeWeeklyPatterns({
      sessions,
      language: "English",
      now,
    });

    expect(report.topErrorPatterns.length).toBeGreaterThan(0);
    expect(report.strengths.length).toBeGreaterThan(0);
    expect(report.recommendedExpressions.length).toBeGreaterThan(0);
    expect(report.weeklyPrompt).toContain("WEEKLY");
  });
});
