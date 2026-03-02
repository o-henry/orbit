import React, { useEffect, useMemo, useState } from "react";
import BottomNav from "@/components/BottomNav";
import PageShell from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  completeRecallCard,
  generateRecallQueue,
  getSettings,
  getWeeklyPatternReport,
  listOrbitSessions,
  listRecallQueue,
  saveSessionReview,
  saveSessionStoryboard,
  saveWeeklyPatternReport,
} from "@/lib/storage";
import { OrbitStudySession, StoryboardScene } from "@/lib/types";
import { parseReviewOutput, parseStoryboardOutput, parseWeeklyOutput } from "@/domain/sessionStructuredParser";
import { toast } from "sonner";

const targetLanguageLabel = (targetLanguageCode: string): string => {
  const code = targetLanguageCode.trim().toLowerCase();
  if (code === "ja" || code === "jp" || code.includes("japan")) return "Japanese";
  return "English";
};

const SessionsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<OrbitStudySession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [reviewRaw, setReviewRaw] = useState("");
  const [storyboardRaw, setStoryboardRaw] = useState("");
  const [weeklyRaw, setWeeklyRaw] = useState("");
  const [recallDueOnly, setRecallDueOnly] = useState(true);
  const [recallItems, setRecallItems] = useState<Awaited<ReturnType<typeof listRecallQueue>>>([]);

  const language = useMemo(() => {
    const settings = getSettings();
    return targetLanguageLabel(settings.targetLanguage);
  }, []);

  const reloadSessions = async () => {
    const loaded = await listOrbitSessions({ language });
    setSessions(loaded);
    setSelectedSessionId((prev) => prev || loaded[0]?.id || null);
  };

  const reloadRecall = async () => {
    const loaded = await listRecallQueue({ dueOnly: recallDueOnly, language });
    setRecallItems(loaded);
  };

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) || null,
    [sessions, selectedSessionId]
  );

  const selectedSessionRecall = useMemo(() => {
    if (!selectedSession) return [];
    return recallItems.filter((item) => item.sessionId === selectedSession.id);
  }, [recallItems, selectedSession]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([reloadSessions(), reloadRecall()]);
      setLoading(false);
    };

    void load();
  }, []);

  useEffect(() => {
    void reloadRecall();
  }, [recallDueOnly]);

  const handleSaveReview = async () => {
    if (!selectedSession) return;
    const parsed = parseReviewOutput(reviewRaw);
    if (!parsed.data) {
      toast.error(parsed.error || "REVIEW 파싱에 실패했습니다.");
      return;
    }

    const saved = await saveSessionReview(selectedSession.id, parsed.data);
    if (!saved) {
      toast.error("세션을 찾을 수 없습니다.");
      return;
    }

    toast.success("REVIEW 저장 완료");
    await reloadSessions();
  };

  const handleSaveStoryboard = async () => {
    if (!selectedSession) return;
    const parsed = parseStoryboardOutput(storyboardRaw);
    if (!parsed.data) {
      toast.error(parsed.error || "STORYBOARD 파싱에 실패했습니다.");
      return;
    }

    const saved = await saveSessionStoryboard(selectedSession.id, {
      scenes: parsed.data,
      raw: storyboardRaw,
      createdAt: Date.now(),
    });

    if (!saved) {
      toast.error("세션을 찾을 수 없습니다.");
      return;
    }

    toast.success("STORYBOARD 저장 완료");
    await reloadSessions();
  };

  const handleSaveSceneImageUrl = async (sceneId: string, imageUrl: string) => {
    if (!selectedSession?.storyboard) return;

    const nextScenes: StoryboardScene[] = selectedSession.storyboard.scenes.map((scene) =>
      scene.id === sceneId ? { ...scene, imageUrl } : scene
    );

    await saveSessionStoryboard(selectedSession.id, {
      ...selectedSession.storyboard,
      scenes: nextScenes,
    });

    await reloadSessions();
  };

  const handleGenerateRecallQueue = async () => {
    if (!selectedSession) return;
    const created = await generateRecallQueue(selectedSession.id);
    toast.success(`회상 카드 ${created.length}개 생성`);
    await Promise.all([reloadSessions(), reloadRecall()]);
  };

  const handleCompleteRecall = async (cardId: string) => {
    await completeRecallCard(cardId);
    await reloadRecall();
  };

  const handleGenerateWeekly = async () => {
    const report = await getWeeklyPatternReport({ language });
    setWeeklyRaw([
      "1. 이번 주 핵심 패턴 3개",
      ...report.topErrorPatterns.map((item) => `- ${item}`),
      "2. 유지해야 할 강점 2개",
      ...report.strengths.map((item) => `- ${item}`),
      "3. 다음 주 목표 표현 10개",
      ...report.recommendedExpressions.map((item) => `- ${item}`),
      "4. 다음 주 추천 시나리오 5개",
      ...report.recommendedScenarios.map((item) => `- ${item}`),
      "5. 다음 주 추천 영상 유형 3개",
      ...report.recommendedVideoTypes.map((item) => `- ${item}`),
    ].join("\n"));
    toast.success("주간 패턴 리포트 생성 완료");
  };

  const handleSaveWeekly = async () => {
    const parsed = parseWeeklyOutput(weeklyRaw);
    if (!parsed.data) {
      toast.error(parsed.error || "WEEKLY 파싱에 실패했습니다.");
      return;
    }

    const current = await getWeeklyPatternReport({ language });
    const next = {
      ...current,
      ...parsed.data,
      weeklyPrompt: [
        "WEEKLY",
        `- 반복 패턴 3개: ${parsed.data.topErrorPatterns.join(", ")}`,
        `- 유지할 강점 2개: ${parsed.data.strengths.join(", ")}`,
        `- 다음 주 목표 표현: ${parsed.data.recommendedExpressions.join(", ")}`,
        `- 추천 시나리오: ${parsed.data.recommendedScenarios.join(", ")}`,
        `- 추천 영상 유형: ${parsed.data.recommendedVideoTypes.join(", ")}`,
      ].join("\n"),
      raw: weeklyRaw,
      updatedAt: Date.now(),
    };

    await saveWeeklyPatternReport(next);
    toast.success("WEEKLY 저장 완료");
  };

  if (loading) {
    return (
      <>
        <PageShell title="세션 허브">
          <div className="text-center py-16 text-sm text-muted-foreground">로딩 중...</div>
        </PageShell>
        <BottomNav />
      </>
    );
  }

  return (
    <>
      <PageShell title="세션 허브">
        <div className="space-y-4">
          <section className="ui-island rounded-[16px] border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">최근 세션</h3>
              <Badge variant="secondary">{sessions.length}개</Badge>
            </div>
            {sessions.length === 0 ? (
              <p className="text-xs text-muted-foreground">저장된 세션이 없습니다. 학습 화면에서 패킷을 먼저 생성하세요.</p>
            ) : (
              <div className="space-y-2">
                {sessions.slice(0, 8).map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    className={`w-full rounded-[10px] border px-3 py-2 text-left ${selectedSessionId === session.id ? "border-primary bg-primary/10" : "border-border/80 bg-secondary/55"}`}
                    onClick={() => setSelectedSessionId(session.id)}
                  >
                    <p className="text-sm font-medium">{session.packet.videoTitle}</p>
                    <p className="text-xs text-muted-foreground">{session.packet.clipStart} - {session.packet.clipEnd} · {session.status}</p>
                  </button>
                ))}
              </div>
            )}
          </section>

          {selectedSession && (
            <>
              <section className="ui-island rounded-[16px] border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">세션 패킷</h3>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedSession.packetText)
                        .then(() => toast.success("패킷 복사됨"))
                        .catch(() => toast.error("패킷 복사 실패"));
                    }}
                  >
                    복사
                  </Button>
                </div>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-[10px] bg-secondary/60 p-2 text-[11px]">
                  {selectedSession.packetText}
                </pre>
              </section>

              <section className="ui-island rounded-[16px] border p-4 space-y-2">
                <h3 className="text-sm font-semibold">REVIEW 저장</h3>
                <Textarea
                  rows={8}
                  value={reviewRaw}
                  onChange={(event) => setReviewRaw(event.target.value)}
                  placeholder="ChatGPT REVIEW 결과를 붙여넣으세요"
                />
                <Button type="button" onClick={() => void handleSaveReview()} disabled={!reviewRaw.trim()}>
                  REVIEW 파싱/저장
                </Button>
              </section>

              <section className="ui-island rounded-[16px] border p-4 space-y-2">
                <h3 className="text-sm font-semibold">STORYBOARD 저장</h3>
                <Textarea
                  rows={8}
                  value={storyboardRaw}
                  onChange={(event) => setStoryboardRaw(event.target.value)}
                  placeholder="ChatGPT STORYBOARD 결과를 붙여넣으세요"
                />
                <Button type="button" onClick={() => void handleSaveStoryboard()} disabled={!storyboardRaw.trim()}>
                  STORYBOARD 파싱/저장
                </Button>

                {selectedSession.storyboard?.scenes?.length ? (
                  <div className="space-y-2 pt-2">
                    {selectedSession.storyboard.scenes.map((scene) => (
                      <div key={scene.id} className="rounded-[10px] bg-secondary/55 p-2">
                        <p className="text-xs font-medium">{scene.title}</p>
                        <input
                          className="mt-2 w-full rounded-[8px] border border-border/80 bg-background px-2 py-1 text-xs"
                          value={scene.imageUrl || ""}
                          placeholder="이미지 URL"
                          onChange={(event) => void handleSaveSceneImageUrl(scene.id, event.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>

              <section className="ui-island rounded-[16px] border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">RECALL 큐</h3>
                  <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <input type="checkbox" checked={recallDueOnly} onChange={(event) => setRecallDueOnly(event.target.checked)} />
                    due only
                  </label>
                </div>
                <Button type="button" variant="outline" onClick={() => void handleGenerateRecallQueue()}>
                  D+1/3/7 카드 생성
                </Button>
                <div className="space-y-2">
                  {selectedSessionRecall.length === 0 ? (
                    <p className="text-xs text-muted-foreground">표시할 회상 카드가 없습니다.</p>
                  ) : (
                    selectedSessionRecall.map((card) => (
                      <div key={card.id} className="rounded-[10px] border border-border/80 bg-secondary/45 p-2">
                        <p className="text-xs text-muted-foreground">D+{card.dayOffset} · {card.cardType} · {card.status}</p>
                        <p className="text-sm">{card.prompt}</p>
                        {card.status === "pending" && (
                          <Button type="button" size="sm" className="mt-2" onClick={() => void handleCompleteRecall(card.id)}>
                            완료 처리
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          )}

          <section className="ui-island rounded-[16px] border p-4 space-y-2">
            <h3 className="text-sm font-semibold">WEEKLY</h3>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={() => void handleGenerateWeekly()}>
                자동 생성
              </Button>
              <Button type="button" onClick={() => void handleSaveWeekly()} disabled={!weeklyRaw.trim()}>
                파싱/저장
              </Button>
            </div>
            <Textarea
              rows={10}
              value={weeklyRaw}
              onChange={(event) => setWeeklyRaw(event.target.value)}
              placeholder="WEEKLY 결과를 붙여넣으세요"
            />
          </section>
        </div>
      </PageShell>
      <BottomNav />
    </>
  );
};

export default SessionsPage;
