import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatTime } from "@/domain/time";
import YouTubePlayer from "@/components/YouTubePlayer";
import { Button } from "@/components/ui/button";
import { useLearnState } from "@/pages/learn/LearnStateContext";
import { trackSessionEvent } from "@/lib/sessionTracker";

const VideoStage: React.FC = () => {
  const {
    clip,
    startSec,
    endSec,
    effectiveEndSec,
    youtubeScriptUrl,
    transcriptLines,
    shouldShowTranscriptGuide,
    showTranscriptGuide,
    requestAutoplay,
    embedDisabled,
    dismissTranscriptGuide,
    reopenTranscriptGuide,
    setEmbedDisabled,
    jumpToPrevSegment,
    jumpToNextSegment,
  } = useLearnState();
  const [loopCycles, setLoopCycles] = useState(0);

  useEffect(() => {
    setLoopCycles(0);
  }, [clip?.id, startSec, endSec, effectiveEndSec]);

  const handleLoopCycle = (cycleCount: number) => {
    setLoopCycles(cycleCount);
    void trackSessionEvent({ type: "loop_cycle", seconds: 10, loopCount: 1 });
  };

  if (!clip) return null;

  return (
    <div className="space-y-3">
      <section className="learning-video-card learning-stage-width">
        <YouTubePlayer
          videoId={clip.videoId}
          startSec={startSec}
          endSec={endSec ?? undefined}
          loop={endSec !== null}
          autoplay={requestAutoplay}
          className="rounded-[var(--learn-radius-card)]"
          onEmbedError={() => setEmbedDisabled(true)}
          onLoopCycle={handleLoopCycle}
        />
      </section>

      {embedDisabled && (
        <div className="learning-stage-width rounded-[var(--radius-sm)] bg-warning/12 p-3 text-xs">
          임베드 재생이 제한될 수 있습니다. 그래도 구간/텍스트 저장과 SRS 생성은 계속 가능합니다.
        </div>
      )}

      {transcriptLines.length === 0 && (
        <section className="learning-card learning-stage-width space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">자막 스크립트 붙여넣기</p>
            <Button type="button" size="sm" variant="outline" className="w-full sm:w-auto" asChild>
              <a href={youtubeScriptUrl} target="_blank" rel="noopener noreferrer">
                YouTube에서 스크립트 열기
              </a>
            </Button>
          </div>

          {showTranscriptGuide ? (
            <div className="rounded-[var(--radius-sm)] font-dm bg-secondary/70 p-3">
              <ol className="space-y-1 text-xs text-muted-foreground">
                <li>1. YouTube에서 영상 아래 더보기를 열고 스크립트를 표시합니다.</li>
                <li>2. 필요한 구간을 복사(Ctrl/Cmd+C)한 뒤 이 앱에 붙여넣습니다.</li>
                <li>3. 타임코드가 있으면 줄 클릭과 Shift 선택으로 구간이 자동 설정됩니다.</li>
              </ol>
              <div className="mt-2 flex justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={dismissTranscriptGuide}>
                  닫기
                </Button>
              </div>
            </div>
          ) : (
            shouldShowTranscriptGuide && (
              <div className="rounded-[var(--radius-sm)] bg-secondary/60 p-4">
                <p className="text-xs text-muted-foreground">
                  아직 자막이 등록되지 않았습니다. 먼저 왼쪽 패널에서 스크립트를 붙여넣고 안내를 다시 확인하세요.
                </p>
                <Button type="button" size="sm" variant="ghost" onClick={reopenTranscriptGuide} className="mt-2 w-full px-2 bg-gray-300 sm:w-auto">
                  안내 다시 보기
                </Button>
              </div>
            )
          )}
        </section>
      )}

      <section className="learning-stage-width">
        <div className="learning-controlbar learning-controlbar-single">
          <Button type="button" size="sm" variant="ghost" className="learning-segment-nav learning-controlbar-item text-[11px] font-ko-bold" onClick={jumpToPrevSegment}>
            <ChevronLeft className="h-3.5 w-3.5" /> 이전
          </Button>

          <div className="learning-soft-pill learning-controlbar-item h-9 px-2 text-[10px] whitespace-nowrap">
            <span className="font-medium">AB</span>
            <span className="learning-controlbar-meta text-muted-foreground">
              {formatTime(startSec)} - {formatTime(effectiveEndSec)}
            </span>
          </div>

          <Button type="button" size="sm" variant="ghost" className="learning-segment-nav learning-controlbar-item text-[11px] font-ko-bold" onClick={jumpToNextSegment}>
            다음 <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="mt-2 rounded-[var(--radius-sm)] bg-secondary/60 px-3 py-2 text-[11px] text-muted-foreground">
          연속 루프 {loopCycles}/3
          {loopCycles >= 3 ? " · 유창성 루프 완료" : ""}
        </div>
        <div className="mt-2 rounded-[var(--radius-sm)] bg-secondary/45 px-3 py-2 text-[11px] text-muted-foreground">
          정책 가드레일: 공식 임베드 재생만 지원하며 transcript 자동 수집, 오디오 추출, 다운로드는 지원하지 않습니다.
        </div>
      </section>
    </div>
  );
};

export default VideoStage;
