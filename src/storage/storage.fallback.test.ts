import { beforeEach, describe, expect, it, vi } from "vitest";

describe("storage fallback and migration detection", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("persists clips through localStorage-backed repo", async () => {
    const clipRepo = await import("@/storage/clipRepo");

    await clipRepo.upsert({
      id: "clip-1",
      youtubeUrl: "https://youtu.be/dQw4w9WgXcQ",
      videoId: "dQw4w9WgXcQ",
      title: "test",
      durationSec: 30,
      captionsAvailable: "unknown",
    });

    const clips = await clipRepo.getAll();
    expect(clips).toHaveLength(1);
    expect(clips[0].id).toBe("clip-1");
  });

  it("marks migrationRequired when legacy keys exist", async () => {
    localStorage.setItem(
      "lingoplay_clips",
      JSON.stringify([{ id: "legacy-clip", sentences: [{ id: "s1", text: "legacy" }] }])
    );

    const metaRepo = await import("@/storage/metaRepo");
    const status = await metaRepo.getStorageStatus();

    expect(status.migrationRequired).toBe(true);
  });

  it("persists orbit session and recall queue in fallback mode", async () => {
    const storage = await import("@/lib/storage");

    const session = await storage.createOrbitSessionPacket({
      targetLanguage: "English",
      level: "초급",
      videoTitle: "video",
      videoUrl: "https://youtube.com/watch?v=1",
      clipStart: "00:10",
      clipEnd: "00:20",
      oneLineSummaryKr: "요약",
      keyExpressions: ["on my way"],
      conversationGoal: "대화",
      correctionMode: "light",
      storyboardNeeded: false,
    });

    const listed = await storage.listOrbitSessions({ language: "English" });
    expect(listed.length).toBeGreaterThan(0);
    expect(listed[0].id).toBe(session.id);

    const cards = await storage.generateRecallQueue(session.id);
    expect(cards.length).toBeGreaterThan(0);
  });
});
