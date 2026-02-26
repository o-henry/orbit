import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getClips,
  getDueCards,
  getMemoryItems,
  getSrsCards,
  getStorageStatus,
  saveMemoryItem,
  saveSrsCard,
} from "@/lib/storage";
import { scheduleNextReview, SrsRating } from "@/domain/srsScheduler";
import { Clip, MemoryItem, SrsCard } from "@/lib/types";
import BottomNav from "@/components/BottomNav";
import PageShell from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { CircleAlert, CirclePlay } from "lucide-react";
import YouTubePlayer from "@/components/YouTubePlayer";
import ExternalAiAskBar from "@/components/ai/ExternalAiAskBar";
import { formatTime } from "@/domain/time";
import { trackSessionEvent, trackStepCompletion } from "@/lib/sessionTracker";

interface ReviewItem {
  card: SrsCard;
  memory: MemoryItem;
  clip?: Clip;
}

const getCardDueTime = (card: SrsCard): number =>
  Number.isFinite(card.dueAt) ? (card.dueAt as number) : new Date(`${card.dueDate}T00:00:00`).getTime();

const todayDateKey = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatKoreanDuration = (seconds: number): string => {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;

  if (h > 0) {
    return `${h}시간 ${m}분 ${s}초`;
  }

  if (m > 0) {
    return `${m}분 ${s}초`;
  }

  return `${s}초`;
};

const SrsPage: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editUserText, setEditUserText] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [playbackNonce, setPlaybackNonce] = useState(0);
  const [showPlayer, setShowPlayer] = useState(false);
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [totalCards, setTotalCards] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async (withLoading = false) => {
    if (withLoading) {
      setLoading(true);
    }

    const [status, dueCards, allCards, memories, clips] = await Promise.all([
      getStorageStatus(),
      getDueCards(),
      getSrsCards(),
      getMemoryItems(),
      getClips(),
    ]);

    setMigrationRequired(status.migrationRequired);
    setTotalCards(allCards.length);

    const memoryMap = new Map(memories.map((memory) => [memory.id, memory]));
    const clipMap = new Map(clips.map((clip) => [clip.id, clip]));

    const queue: ReviewItem[] = dueCards
      .map((card) => {
        const memory = memoryMap.get(card.memoryId);
        if (!memory) return null;
        return {
          card,
          memory,
          clip: clipMap.get(memory.ref.clipId),
        };
      })
      .filter((item): item is ReviewItem => Boolean(item))
      .sort((a, b) => getCardDueTime(a.card) - getCardDueTime(b.card));

    setItems(queue);
    setCurrentIdx(0);
    setFlipped(false);
    setShowPlayer(false);
    if (withLoading) {
      setLoading(false);
    }
    return queue;
  }, []);

  useEffect(() => {
    void loadData(true);
  }, [loadData]);

  useEffect(() => {
    if (loading || migrationRequired || items.length > 0) return;
    const pollId = window.setInterval(() => {
      void loadData(false);
    }, 5000);
    return () => window.clearInterval(pollId);
  }, [items.length, loading, migrationRequired, loadData]);

  const currentItem = items[currentIdx];

  const handleRate = useCallback(
    async (rating: SrsRating) => {
      if (!currentItem) return;

      const updated = {
        ...currentItem.card,
        ...scheduleNextReview(currentItem.card, rating, todayDateKey()),
      };

      await saveSrsCard(updated);
      void trackSessionEvent({ type: "srs_rate", seconds: 12, turns: 1 });
      void trackStepCompletion({ D: true });

      const nextQueue = await loadData(false);
      if (nextQueue.length === 0) {
        toast.success("현재 시점 복습 완료");
      }
    },
    [currentItem, loadData]
  );

  const handleSaveEdit = async () => {
    if (!currentItem) return;

    const normalizedUserText = editUserText.trim();
    const normalizedNotes = editNotes.trim() || normalizedUserText || "(메모 없음)";

    const updatedMemory: MemoryItem = {
      ...currentItem.memory,
      notes: normalizedNotes,
      ...(normalizedUserText ? { userText: normalizedUserText } : { userText: undefined }),
      updatedAt: Date.now(),
    };

    await saveMemoryItem(updatedMemory);
    void trackSessionEvent({ type: "ai_feedback", seconds: 15, turns: 1 });
    const next = [...items];
    next[currentIdx] = { ...currentItem, memory: updatedMemory };
    setItems(next);
    setEditing(false);
    toast.success("카드 메모 수정됨");
  };

  const blockedContent = (
    <div className="ui-island ui-card-border p-6 text-center mt-4">
      <CircleAlert className="w-8 h-8 text-warning mx-auto mb-2" />
      <p className="font-medium">데이터 초기화가 필요합니다</p>
      <p className="text-sm text-muted-foreground mt-1">구버전 데이터가 감지되어 복습 기능이 잠겨 있습니다.</p>
      <Button className="mt-4" onClick={() => navigate("/settings")}>
        설정에서 초기화하기
      </Button>
    </div>
  );

  const askText = useMemo(() => {
    if (!currentItem) return "";
    return (currentItem.memory.userText || currentItem.memory.notes || "").trim();
  }, [currentItem]);

  if (loading) {
    return (
      <>
        <PageShell title="복습">
          <div className="text-center py-16 text-sm text-muted-foreground">로딩 중...</div>
        </PageShell>
        <BottomNav />
      </>
    );
  }

  if (migrationRequired) {
    return (
      <>
        <PageShell title="복습">{blockedContent}</PageShell>
        <BottomNav />
      </>
    );
  }

  if (items.length === 0) {
    return (
      <>
        <PageShell title="복습">
          <div className="text-center py-16">
            <p className="mb-1 font-ko-bold font-medium">오늘 복습할 카드가 없습니다</p>
            <p className="mb-2 font-ko-bold text-sm text-muted-foreground">총 {totalCards}개 카드 관리 중</p>
            <Button variant="outline" className="bg-gray-400" onClick={() => navigate("/settings/memo")}>표현 모음으로 이동</Button>
          </div>
        </PageShell>
        <BottomNav />
      </>
    );
  }

  return (
    <>
      <PageShell title={`복습 ${currentIdx + 1}/${items.length}`}>
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentItem.card.id + (flipped ? "-back" : "-front")}
              initial={{ rotateY: 90, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              exit={{ rotateY: -90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {editing ? (
                <div className="ui-island ui-card-border rounded-[var(--radius-lg)] p-6 space-y-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">표현</label>
                    <Textarea value={editUserText} onChange={(e) => setEditUserText(e.target.value)} rows={3} />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground">메모 / 번역</label>
                    <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} />
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setEditing(false)}>취소</Button>
                    <Button className="flex-1" onClick={handleSaveEdit}>저장</Button>
                  </div>
                </div>
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  className="ui-island ui-card-border relative w-full rounded-[var(--radius-lg)] bg-card/95 p-8 min-h-[220px] flex flex-col items-center justify-center text-center cursor-pointer transition-colors hover:bg-card"
                  onClick={() => setFlipped((prev) => !prev)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setFlipped((prev) => !prev);
                    }
                  }}
                >
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setEditUserText(currentItem.memory.userText || "");
                      setEditNotes(currentItem.memory.notes || "");
                      setEditing(true);
                    }}
                    className="absolute right-3 top-3 inline-flex items-center rounded-[var(--radius)] bg-secondary px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    수정
                  </button>
                  {!flipped ? (
                    <>
                      <p className="text-xs text-muted-foreground mb-3">탭하여 뒤집기</p>
                      <p className="text-lg font-semibold whitespace-pre-wrap">{currentItem.memory.userText || "텍스트 없음"}</p>
                      <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{currentItem.memory.notes || ""}</p>
                      {!currentItem.memory.userText && (
                        <p className="text-xs text-warning mt-2">텍스트 없음: 학습에서 들은 문장을 추가하면 더 좋아요.</p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground mb-2">참조 구간</p>
                      <p className="text-sm font-medium mb-1 whitespace-pre-wrap">
                        {currentItem.memory.userText || currentItem.memory.notes || "(텍스트 없음)"}
                      </p>
                      <p className="font-semibold">
                        {formatKoreanDuration(currentItem.memory.ref.startSec)} - {formatKoreanDuration(currentItem.memory.ref.endSec)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        ({formatTime(currentItem.memory.ref.startSec)} - {formatTime(currentItem.memory.ref.endSec)})
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">구간 재생으로 실제 음성을 확인하세요.</p>
                    </>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {flipped && !editing && (
            <div className="w-full space-y-4">
              <Button
                variant="outline"
                className="w-full h-11"
                onClick={() => {
                  setPlaybackNonce((prev) => prev + 1);
                  setShowPlayer(true);
                }}
              >
                <CirclePlay className="w-4 h-4 mr-1" /> 구간 재생
              </Button>

              {showPlayer && currentItem.clip && (
                <div className="ui-island p-0">
                  <YouTubePlayer
                    key={`${currentItem.card.id}-${playbackNonce}`}
                    videoId={currentItem.memory.ref.videoId || currentItem.clip.videoId}
                    startSec={currentItem.memory.ref.startSec}
                    endSec={currentItem.memory.ref.endSec}
                    loop
                    autoplay
                  />
                </div>
              )}

              <ExternalAiAskBar
                refData={currentItem.memory.ref}
                youtubeUrl={currentItem.clip?.youtubeUrl || `https://www.youtube.com/watch?v=${currentItem.memory.ref.videoId}`}
                userText={askText}
                notes={currentItem.memory.notes}
                className="w-full px-0"
              />

              <div className="grid w-full grid-cols-3 gap-3">
                <Button
                  variant="outline"
                  className="h-12 border-transparent bg-[#c85b5b] text-white hover:bg-[#b14c4c]"
                  onClick={() => handleRate("hard")}
                >
                  어려움
                </Button>
                <Button
                  variant="outline"
                  className="h-12 border-transparent bg-[#5d6978] text-white hover:bg-[#4f5a68]"
                  onClick={() => handleRate("good")}
                >
                  보통
                </Button>
                <Button
                  variant="outline"
                  className="h-12 border-transparent bg-[#4f9460] text-white hover:bg-[#428052]"
                  onClick={() => handleRate("easy")}
                >
                  쉬움
                </Button>
              </div>
            </div>
          )}
        </div>
      </PageShell>
      <BottomNav />
    </>
  );
};

export default SrsPage;
