import { describe, expect, it } from "vitest";
import { generateRecallQueueCardsFromSession } from "@/domain/recallQueueGenerator";
import { OrbitStudySession } from "@/lib/types";

describe("recallQueueGenerator", () => {
  it("generates D+1/D+3/D+7 cards with all card types", () => {
    const now = new Date("2026-03-02T12:00:00+09:00").getTime();
    const session: OrbitStudySession = {
      id: "os_1",
      targetLanguage: "English",
      packet: {
        targetLanguage: "English",
        level: "초급",
        videoTitle: "video",
        videoUrl: "https://youtube.com/watch?v=1",
        clipStart: "00:10",
        clipEnd: "00:30",
        oneLineSummaryKr: "회의에서 버그를 논의함",
        keyExpressions: ["on my way", "hotfix"],
        conversationGoal: "3분 대화",
        correctionMode: "light",
        storyboardNeeded: true,
      },
      packetText: "[ORBIT_SESSION]",
      status: "reviewed",
      review: {
        strengths: ["흐름 유지"],
        repeatedErrors: [
          { original: "I am go", natural: "I am going", reason: "시제" },
        ],
        takeawayExpressions: ["on my way"],
        nextSessionDrills: ["Could you clarify?"],
        scenes: ["회의 장면"],
        createdAt: now,
      },
      storyboard: {
        scenes: [
          {
            id: "scene1",
            title: "스탠드업",
            description: "버그 공유",
            coreSentence: "We need a hotfix.",
            imagePrompt: "office",
            recallQuestion: "왜 hotfix?",
          },
        ],
        createdAt: now,
      },
      createdAt: now,
      updatedAt: now,
    };

    const cards = generateRecallQueueCardsFromSession(session, now);
    expect(cards.length).toBe(12);
    const dayOffsets = new Set(cards.map((card) => card.dayOffset));
    expect(dayOffsets.has(1)).toBe(true);
    expect(dayOffsets.has(3)).toBe(true);
    expect(dayOffsets.has(7)).toBe(true);
    const cardTypes = new Set(cards.map((card) => card.cardType));
    expect(cardTypes.has("image_speak")).toBe(true);
    expect(cardTypes.has("ko_hint_speak")).toBe(true);
    expect(cardTypes.has("role_switch")).toBe(true);
    expect(cardTypes.has("fill_blank")).toBe(true);
  });
});
