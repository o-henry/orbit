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
