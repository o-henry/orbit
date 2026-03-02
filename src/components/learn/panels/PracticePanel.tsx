import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import ExternalAiAskBar from "@/components/ai/ExternalAiAskBar";
import { useLearnState } from "@/pages/learn/LearnStateContext";
import { formatTime } from "@/domain/time";
import { cn } from "@/lib/utils";
import { parseAiResponse } from "@/domain/aiResponseParser";
import { trackSessionEvent } from "@/lib/sessionTracker";
import { createOrbitSessionPacket, getSettings } from "@/lib/storage";
import { buildOrbitSessionPacketText, createOrbitSessionPacket as buildOrbitPacket, defaultConversationGoal } from "@/domain/orbitSessionPacket";
import { toast } from "sonner";

const PracticePanel: React.FC = () => {
  const {
    clip,
    currentRef,
    heardSentence,
    notes,
    comprehensionRating,
    aiFeedbackDraft,
    saveError,
    savedItems,
    setNotes,
    rateComprehension,
    setAiFeedbackDraft,
    handleSaveMemory,
    selectSavedMemory,
  } = useLearnState();
  const [aiResponseRaw, setAiResponseRaw] = useState("");
  const [aiParseError, setAiParseError] = useState<string | null>(null);
  const [oneLineSummary, setOneLineSummary] = useState("");
  const [keyExpressionText, setKeyExpressionText] = useState("");
  const [conversationGoal, setConversationGoal] = useState("");
  const [storyboardNeeded, setStoryboardNeeded] = useState(true);
  const [latestPacketText, setLatestPacketText] = useState("");
  const [latestSessionId, setLatestSessionId] = useState<string | null>(null);

  const handleParseAiResponse = () => {
    const parsed = parseAiResponse(aiResponseRaw);
    if (!parsed.feedback) {
      setAiParseError(parsed.error || "AI 응답 파싱에 실패했습니다.");
      return;
    }

    setAiFeedbackDraft(parsed.feedback);
    setAiParseError(null);
    void trackSessionEvent({ type: "ai_feedback", seconds: 15, turns: 1 });
  };

  const keyExpressions = keyExpressionText
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);

  const buildPacketDraft = () => {
    const settings = getSettings();
    return buildOrbitPacket({
      settings,
      videoTitle: clip.title || `YouTube Clip (${clip.videoId})`,
      videoUrl: clip.youtubeUrl || `https://www.youtube.com/watch?v=${clip.videoId}`,
      startSec: currentRef.startSec,
      endSec: currentRef.endSec,
      oneLineSummaryKr: oneLineSummary,
      keyExpressions,
      conversationGoal: conversationGoal || defaultConversationGoal(settings.targetLanguage),
      storyboardNeeded,
      notes,
      clipId: clip.id,
      videoId: clip.videoId,
    });
  };

  const handleCopyPacket = async () => {
    const packet = buildPacketDraft();
    if (!packet.oneLineSummaryKr.trim()) {
      toast.error("한 줄 요약을 입력해주세요.");
      return;
    }
    const packetText = buildOrbitSessionPacketText(packet);
    try {
      await navigator.clipboard.writeText(packetText);
      setLatestPacketText(packetText);
      toast.success("학습 패킷이 복사되었습니다.");
    } catch {
      toast.error("패킷 복사에 실패했습니다.");
    }
  };

  const handleSavePacketSession = async () => {
    const packet = buildPacketDraft();
    if (!packet.oneLineSummaryKr.trim()) {
      toast.error("한 줄 요약을 입력해주세요.");
      return;
    }

    const session = await createOrbitSessionPacket(packet);
    setLatestPacketText(session.packetText);
    setLatestSessionId(session.id);
    toast.success("세션 패킷 저장 완료");
  };

  const handleOpenProject = () => {
    const settings = getSettings();
    const isJapanese = buildPacketDraft().targetLanguage.toLowerCase().includes("japan");
    const targetUrl = isJapanese ? settings.chatgptProjectUrlJa : settings.chatgptProjectUrlEn;
    if (!targetUrl) {
      toast.error("설정에서 언어별 ChatGPT Project URL을 먼저 저장해주세요.");
      return;
    }

    window.open(targetUrl, "_blank", "noopener,noreferrer");
  };

  const scenarioTemplates = [
    { label: "버그 설명", goal: "오늘 해결한 버그의 원인과 재현 과정을 목표 언어로 설명하기" },
    { label: "PR 설명", goal: "오늘 PR의 변경점과 리뷰 포인트를 목표 언어로 설명하기" },
    { label: "회의 요약", goal: "오늘 회의 핵심 내용과 액션 아이템을 목표 언어로 요약하기" },
    { label: "일정 공유", goal: "이번 주 일정/리스크/우선순위를 목표 언어로 공유하기" },
  ];

  if (!clip || !currentRef) return null;

  return (
    <div className="w-full space-y-3">
      <div className="w-full space-y-3">
        <div className="learning-topic-divider" aria-hidden />
        <section className="learning-card learning-card-no-x w-full space-y-3 h-full">
          <h3 className="text-sm font-semibold">표현 익히기</h3>
          <p className="text-xs text-muted-foreground">AI 피드백을 거친 뒤 복습 리스트에 저장하세요.</p>

          <div className="rounded-[var(--radius-sm)] border border-border/80 bg-secondary/55 p-3">
            <p className="text-[11px] font-medium text-muted-foreground">선택된 표현</p>
            <p
              className={cn(
                "mt-1 text-sm break-words",
                heardSentence.trim() ? "font-jp text-foreground" : "font-ko-bold text-muted-foreground"
              )}
            >
              {heardSentence || "자막에서 학습할 표현을 선택하세요."}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground">이 구간 이해도 (1~5)</p>
            <div className="grid grid-cols-5 gap-1">
              {[1, 2, 3, 4, 5].map((score) => (
                <Button
                  key={score}
                  type="button"
                  size="sm"
                  variant={comprehensionRating === score ? "default" : "outline"}
                  className="h-8 px-0"
                  onClick={() => void rateComprehension(score)}
                >
                  {score}
                </Button>
              ))}
            </div>
          </div>

          <Textarea
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="의미를 입력하세요 (선택)"
          />

          {saveError && <div className="text-xs text-destructive">{saveError}</div>}

          <Button className="w-full h-11" onClick={() => void handleSaveMemory()} disabled={!heardSentence.trim()}>
            복습 리스트(SRS)에 저장
          </Button>
        </section>

        <div className="learning-topic-divider" aria-hidden />
        <section className="learning-card learning-card-no-x w-full space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">학습 패킷</h3>
            {latestSessionId && <Badge variant="secondary">세션 저장됨</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">[ORBIT_SESSION] 패킷을 생성해 ChatGPT Project로 전달합니다.</p>

          <Textarea
            rows={2}
            value={oneLineSummary}
            onChange={(event) => setOneLineSummary(event.target.value)}
            placeholder="one_line_summary_kr: 내가 이해한 장면 한 줄"
          />
          <Textarea
            rows={3}
            value={keyExpressionText}
            onChange={(event) => setKeyExpressionText(event.target.value)}
            placeholder={"key_expressions (최대 3개, 줄바꿈으로 입력)\n- 표현1\n- 표현2\n- 표현3"}
          />
          <Textarea
            rows={2}
            value={conversationGoal}
            onChange={(event) => setConversationGoal(event.target.value)}
            placeholder="conversation_goal (비우면 기본값 사용)"
          />

          <div className="grid grid-cols-2 gap-2">
            {scenarioTemplates.map((item) => (
              <Button key={item.label} type="button" size="sm" variant="outline" onClick={() => setConversationGoal(item.goal)}>
                {item.label}
              </Button>
            ))}
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={storyboardNeeded}
              onChange={(event) => setStoryboardNeeded(event.target.checked)}
            />
            storyboard_needed
          </label>

          <div className="grid grid-cols-3 gap-2">
            <Button type="button" variant="outline" onClick={() => void handleCopyPacket()}>
              패킷 복사
            </Button>
            <Button type="button" variant="outline" onClick={handleOpenProject}>
              Project 열기
            </Button>
            <Button type="button" onClick={() => void handleSavePacketSession()}>
              세션 저장
            </Button>
          </div>

          {latestPacketText && (
            <div className="rounded-[var(--radius-sm)] bg-secondary/60 p-2">
              <p className="mb-1 text-[11px] text-muted-foreground">최근 생성 패킷</p>
              <pre className="max-h-36 overflow-auto whitespace-pre-wrap text-[11px]">{latestPacketText}</pre>
            </div>
          )}
        </section>

        <div className="learning-topic-divider" aria-hidden />
        <ExternalAiAskBar
          className="w-full h-full px-0"
          refData={currentRef}
          youtubeUrl={clip.youtubeUrl || `https://www.youtube.com/watch?v=${clip.videoId}`}
          userText={heardSentence}
          notes={notes}
          actionMode="split"
          showPromptPreview
        />

        <section className="learning-card learning-card-no-x w-full space-y-2">
          <h3 className="text-sm font-semibold">AI 답변 붙여넣기</h3>
          <p className="text-xs text-muted-foreground">교정문/바꿔말하기/드릴을 구조화해 카드에 함께 저장합니다.</p>
          <Textarea
            rows={4}
            value={aiResponseRaw}
            onChange={(event) => setAiResponseRaw(event.target.value)}
            placeholder="외부 AI 답변을 그대로 붙여넣으세요"
          />
          {aiParseError && <p className="text-xs text-destructive">{aiParseError}</p>}
          {aiFeedbackDraft && (
            <div className="rounded-[var(--radius-sm)] bg-secondary/65 p-2 text-xs text-muted-foreground">
              <p>교정문: {aiFeedbackDraft.correction ? "있음" : "없음"}</p>
              <p>바꿔말하기: {aiFeedbackDraft.paraphrases?.length || 0}개</p>
              <p>드릴: {aiFeedbackDraft.drills?.length || 0}개</p>
            </div>
          )}
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={handleParseAiResponse} disabled={!aiResponseRaw.trim()}>
              파싱해서 저장
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setAiResponseRaw("");
                setAiParseError(null);
                setAiFeedbackDraft(null);
              }}
            >
              초기화
            </Button>
          </div>
        </section>
      </div>

      <div className="learning-topic-divider" aria-hidden />
      <section className="learning-card learning-card-no-x w-full space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">저장된 표현</h3>
          <Badge variant="secondary">{savedItems.length}개</Badge>
        </div>

        {savedItems.length === 0 ? (
          <div className="rounded-[var(--radius-sm)] bg-secondary/70 p-4 text-xs text-muted-foreground">아직 저장된 표현이 없습니다.</div>
        ) : (
          savedItems.slice(0, 8).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectSavedMemory(item)}
              className={cn("w-full rounded-[var(--radius-sm)] bg-secondary/70 p-3 text-left transition-colors hover:bg-secondary")}
            >
              <p className="line-clamp-2 text-sm font-medium">{item.userText || item.notes || "(텍스트 없음)"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatTime(item.ref.startSec)} - {formatTime(item.ref.endSec)}
              </p>
            </button>
          ))
        )}
      </section>

    </div>
  );
};

export default PracticePanel;
