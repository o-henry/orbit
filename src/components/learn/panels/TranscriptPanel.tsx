import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import TranscriptEditor from "@/components/learn/TranscriptPanel";
import { Button } from "@/components/ui/button";
import { useLearnState } from "@/pages/learn/LearnStateContext";

const TranscriptPanel: React.FC = () => {
  const navigate = useNavigate();
  const {
    clip,
    persistTranscript,
    transcriptLines,
    selectedTranscriptText,
    noticingFocus,
    showTranscriptPanel,
    setTranscriptLinesWithCache,
    setSelectedTranscriptText,
    activateTranscriptLine,
    activateTranscriptRange,
    startSec,
    effectiveEndSec,
    getShadowingTextSeed,
  } = useLearnState();

  if (!clip) return null;

  const goToShadowing = () => {
    const textSeed = getShadowingTextSeed();
    const params = new URLSearchParams({
      start: String(startSec),
      end: String(effectiveEndSec),
      ...(textSeed ? { text: textSeed } : {}),
    });
    navigate(`/shadowing/${clip.id}?${params.toString()}`);
  };

  return (
    <div className="w-full space-y-3">
      {showTranscriptPanel && (
        <section className="learning-card learning-card-no-x w-full rounded-[4px] space-y-2">
          <TranscriptEditor
            lines={transcriptLines}
            persistEnabled={persistTranscript}
            onLinesChange={setTranscriptLinesWithCache}
            onSelectionChange={setSelectedTranscriptText}
            onLineActivate={activateTranscriptLine}
            onRangeActivate={activateTranscriptRange}
            displayMode="subtitle"
            noticingFocus={noticingFocus}
          />

          <div className="rounded-[var(--radius-sm)] bg-secondary/65 p-3 space-y-2">
            <p className="text-xs font-medium">선택 텍스트</p>
            <p className="text-xs text-muted-foreground break-words">
              {selectedTranscriptText || "자막을 클릭하면 텍스트가 선택됩니다."}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full justify-between border-transparent bg-[#2f343a] text-white hover:bg-[#262b30] font-ko-bold"
            onClick={goToShadowing}
          >
            <span>듣고 따라 말하기 시작</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>
      )}
    </div>
  );
};

export default TranscriptPanel;
