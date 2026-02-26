import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getClipById, getStorageStatus } from "@/lib/storage";
import { Clip, SegmentRef } from "@/lib/types";
import PageShell from "@/components/PageShell";
import YouTubePlayer from "@/components/YouTubePlayer";
import AudioRecorder from "@/components/AudioRecorder";
import ExternalAiAskBar from "@/components/ai/ExternalAiAskBar";
import { Button } from "@/components/ui/button";
import { CircleAlert, CirclePlay, Check } from "lucide-react";
import { formatTime } from "@/domain/time";
import { cn } from "@/lib/utils";
import { trackSessionEvent, trackStepCompletion } from "@/lib/sessionTracker";
import { parseAiResponse, ParsedAiFeedback } from "@/domain/aiResponseParser";

const shadowingStateKey = (clipId: string, startSec: number, endSec: number) => `dlb:shadowing:state:${clipId}:${startSec}:${endSec}`;
const shadowingAudioKey = (clipId: string, startSec: number, endSec: number) => `dlb:shadowing:audio:${clipId}:${startSec}:${endSec}`;
const SHADOWING_TITLE = "듣고 따라 말하기";

const CHECKLIST = [
  { id: "pronunciation", label: "발음 타깃 1개 집중" },
  { id: "stress", label: "강세/리듬 맞추기" },
  { id: "linking", label: "연결발음 확인" },
] as const;

interface StoredShadowingState {
  checked: string[];
}

interface StoredAudioPayload {
  name: string;
  type: string;
  dataUrl: string;
}

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const dataUrlToFile = async (payload: StoredAudioPayload): Promise<File> => {
  const response = await fetch(payload.dataUrl);
  const blob = await response.blob();
  return new File([blob], payload.name, { type: payload.type });
};

const Shadowing: React.FC = () => {
  const { clipId } = useParams<{ clipId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [clip, setClip] = useState<Clip | null>(null);
  const [loading, setLoading] = useState(true);
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [recordedAudioFile, setRecordedAudioFile] = useState<File | null>(null);
  const [audioHydrated, setAudioHydrated] = useState(false);
  const [playbackNonce, setPlaybackNonce] = useState(0);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loopCycles, setLoopCycles] = useState(0);
  const [aiResponseRaw, setAiResponseRaw] = useState("");
  const [parsedFeedback, setParsedFeedback] = useState<ParsedAiFeedback | null>(null);
  const [aiParseError, setAiParseError] = useState<string | null>(null);

  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const startSec = Math.max(0, Math.floor(Number(queryParams.get("start")) || 0));
  const endSec = Math.max(startSec + 2, Math.floor(Number(queryParams.get("end")) || startSec + 10));
  const practiceText = (queryParams.get("text") || "").trim();

  useEffect(() => {
    setLoopCycles(0);
  }, [clipId, startSec, endSec]);

  useEffect(() => {
    const load = async () => {
      if (!clipId) return;
      setLoading(true);
      const [status, found] = await Promise.all([getStorageStatus(), getClipById(clipId)]);
      setMigrationRequired(status.migrationRequired);
      setClip(found || null);
      setLoading(false);
    };

    load();
  }, [clipId]);

  useEffect(() => {
    if (!clipId) return;
    let disposed = false;
    setAudioHydrated(false);

    const stateRaw = localStorage.getItem(shadowingStateKey(clipId, startSec, endSec));
    if (stateRaw) {
      try {
        const parsed = JSON.parse(stateRaw) as StoredShadowingState;
        setChecked(new Set(parsed.checked || []));
      } catch {
        setChecked(new Set());
      }
    } else {
      setChecked(new Set());
    }

    const audioRaw = localStorage.getItem(shadowingAudioKey(clipId, startSec, endSec));
    if (!audioRaw) {
      setRecordedAudioFile(null);
      setAudioHydrated(true);
      return;
    }

    const restoreAudio = async () => {
      try {
        const payload = JSON.parse(audioRaw) as StoredAudioPayload;
        const restoredFile = await dataUrlToFile(payload);
        if (!disposed) {
          setRecordedAudioFile(restoredFile);
        }
      } catch {
        if (!disposed) {
          setRecordedAudioFile(null);
        }
      } finally {
        if (!disposed) {
          setAudioHydrated(true);
        }
      }
    };

    void restoreAudio();

    return () => {
      disposed = true;
    };
  }, [clipId, startSec, endSec]);

  useEffect(() => {
    if (!clipId) return;
    const payload: StoredShadowingState = {
      checked: Array.from(checked),
    };
    localStorage.setItem(shadowingStateKey(clipId, startSec, endSec), JSON.stringify(payload));
  }, [checked, clipId, startSec, endSec]);

  useEffect(() => {
    if (!clipId) return;
    if (!audioHydrated) return;

    const persistAudio = async () => {
      if (!recordedAudioFile) {
        localStorage.removeItem(shadowingAudioKey(clipId, startSec, endSec));
        return;
      }

      try {
        const dataUrl = await readFileAsDataUrl(recordedAudioFile);
        const payload: StoredAudioPayload = {
          name: recordedAudioFile.name,
          type: recordedAudioFile.type,
          dataUrl,
        };
        localStorage.setItem(shadowingAudioKey(clipId, startSec, endSec), JSON.stringify(payload));
      } catch {
        // Ignore persistence failures and keep runtime state.
      }
    };

    void persistAudio();
  }, [recordedAudioFile, clipId, startSec, endSec, audioHydrated]);

  const refData: SegmentRef | null = useMemo(() => {
    if (!clip) return null;
    return {
      clipId: clip.id,
      videoId: clip.videoId,
      startSec,
      endSec,
      createdAt: Date.now(),
    };
  }, [clip, startSec, endSec]);

  const toggleChecklist = (id: string) => {
    const next = new Set(checked);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setChecked(next);
  };

  const handleRecordingChange = (file: File | null) => {
    setRecordedAudioFile(file);
    if (!file) return;
    void trackSessionEvent({ type: "shadowing_record", seconds: 20 });
    void trackStepCompletion({ C: true });
  };

  const goToSrs = () => {
    navigate("/srs");
  };

  const handleParseAiResponse = () => {
    const parsed = parseAiResponse(aiResponseRaw);
    if (!parsed.feedback) {
      setAiParseError(parsed.error || "AI 응답 파싱에 실패했습니다.");
      return;
    }

    setParsedFeedback(parsed.feedback);
    setAiParseError(null);
  };

  const handleLoopCycle = (cycleCount: number) => {
    setLoopCycles(cycleCount);
    void trackSessionEvent({ type: "loop_cycle", seconds: 10, loopCount: 1 });
    if (cycleCount === 3) {
      void trackStepCompletion({ C: true });
    }
  };

  if (loading) {
    return (
      <PageShell title={SHADOWING_TITLE} showBack onBack={() => navigate(-1)} noBottomNav>
        <div className="text-center py-16 text-sm text-muted-foreground">로딩 중...</div>
      </PageShell>
    );
  }

  if (migrationRequired) {
    return (
      <PageShell title={SHADOWING_TITLE} showBack onBack={() => navigate(-1)} noBottomNav>
        <div className="ui-island p-6 text-center mt-4">
          <CircleAlert className="w-8 h-8 text-warning mx-auto mb-2" />
          <p className="font-medium">데이터 초기화가 필요합니다</p>
          <p className="text-sm text-muted-foreground mt-1">구버전 데이터가 감지되어 듣고 따라 말하기 기능을 잠시 사용할 수 없습니다.</p>
          <Button className="mt-4" onClick={() => navigate("/settings")}>설정에서 초기화하기</Button>
        </div>
      </PageShell>
    );
  }

  if (!clip || !refData) {
    return (
      <PageShell title={SHADOWING_TITLE} showBack onBack={() => navigate(-1)} noBottomNav>
        <div className="text-center py-16">
          <p className="text-muted-foreground">클립을 찾을 수 없습니다</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/library")}>라이브러리로 이동</Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title={SHADOWING_TITLE} showBack onBack={() => navigate(-1)} noBottomNav>
      <div className="w-full space-y-4">
        <div className="ui-island ui-card-border w-full p-3">
          <p className="text-xs text-muted-foreground">현재 연습 구간</p>
          <p className="text-sm font-medium">{formatTime(startSec)} - {formatTime(endSec)}</p>
        </div>

        <div className="w-full">
          <YouTubePlayer
            key={`${clip.id}-${playbackNonce}`}
            videoId={clip.videoId}
            startSec={startSec}
            endSec={endSec}
            loop
            autoplay={playbackNonce > 0}
            className="w-full"
            onLoopCycle={handleLoopCycle}
          />
        </div>
        <div className="rounded-[var(--radius-sm)] bg-secondary/60 px-3 py-2 text-[11px] text-muted-foreground">
          연속 루프 {loopCycles}/3
          {loopCycles >= 3 ? " · 유창성 루프 완료" : ""}
        </div>

        <div className="ui-island w-full py-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">녹음 비교</h3>
            <Button type="button" size="sm" variant="outline" onClick={() => setPlaybackNonce((prev) => prev + 1)}>
              <CirclePlay className="w-4 h-4 mr-1" /> 원음 다시재생
            </Button>
          </div>

          <AudioRecorder value={recordedAudioFile} onRecordingChange={handleRecordingChange} />
        </div>

        <div className="ui-island w-full py-4 space-y-3">
          <h3 className="text-sm font-semibold">연습 문장</h3>
          <div className="rounded-[var(--radius-sm)] border border-border/80 bg-secondary/55 p-3">
            <p className="text-sm leading-relaxed break-words">
              {practiceText || "선택된 연습 문장이 없습니다. 학습 페이지에서 구간을 선택한 뒤 이동해주세요."}
            </p>
          </div>
        </div>

        <div className="ui-island w-full py-4 space-y-2">
          <h3 className="text-sm font-semibold">체크리스트</h3>
          {CHECKLIST.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => toggleChecklist(item.id)}
              className={cn(
                "flex w-full items-center justify-between rounded-[4px] border border-border/80 px-3 py-2 text-left text-xs transition-colors",
                checked.has(item.id) ? "bg-primary/10 border-primary/45" : "bg-secondary/60 hover:bg-secondary"
              )}
            >
              <span>{item.label}</span>
              <span
                className={cn(
                  "inline-flex h-5 w-5 items-center justify-center rounded-full border",
                  checked.has(item.id) ? "border-primary bg-primary text-primary-foreground" : "border-border/80 bg-card"
                )}
                aria-hidden
              >
                <Check className={cn("h-3.5 w-3.5", checked.has(item.id) ? "opacity-100" : "opacity-0")} />
              </span>
            </button>
          ))}
        </div>

        <ExternalAiAskBar
          className="w-full px-0"
          refData={refData}
          youtubeUrl={clip.youtubeUrl || `https://www.youtube.com/watch?v=${clip.videoId}`}
          userText={practiceText}
          recordedAudioFile={recordedAudioFile}
          notes={
            parsedFeedback?.correction
              ? `듣고 따라 말하기 체크리스트 완료: ${checked.size}/${CHECKLIST.length}\nAI 교정 요약: ${parsedFeedback.correction}`
              : `듣고 따라 말하기 체크리스트 완료: ${checked.size}/${CHECKLIST.length}`
          }
          promptMode="shadowing-pronunciation"
        />

        <div className="ui-island w-full py-4 space-y-2">
          <h3 className="text-sm font-semibold">AI 답변 붙여넣기 (선택)</h3>
          <p className="text-xs text-muted-foreground">발음 교정 답변을 구조화해 요약으로 재사용할 수 있습니다.</p>
          <textarea
            className="min-h-[90px] w-full rounded-[var(--radius-sm)] border border-border/80 bg-secondary/55 p-2 text-xs"
            value={aiResponseRaw}
            onChange={(event) => setAiResponseRaw(event.target.value)}
            placeholder="외부 AI의 발음 교정 답변을 붙여넣으세요"
          />
          {aiParseError && <p className="text-xs text-destructive">{aiParseError}</p>}
          {parsedFeedback && (
            <p className="text-xs text-muted-foreground">
              교정문 {parsedFeedback.correction ? "1개" : "0개"} · 드릴 {parsedFeedback.drills?.length || 0}개 감지
            </p>
          )}
          <Button type="button" size="sm" variant="outline" onClick={handleParseAiResponse} disabled={!aiResponseRaw.trim()}>
            파싱 적용
          </Button>
        </div>

        <div className="grid w-full grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={() => navigate(`/learn/${clip.id}?start=${startSec}&end=${endSec}&mode=subtitle`)}>
            이전(학습)
          </Button>
          <Button type="button" onClick={goToSrs}>
            다음(복습으로)
          </Button>
        </div>
      </div>
    </PageShell>
  );
};

export default Shadowing;
