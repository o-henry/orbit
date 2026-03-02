import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getClips, saveClip, deleteClip, getStorageStatus } from "@/lib/storage";
import { extractVideoId, fetchYouTubeOEmbed } from "@/lib/youtube";
import { Clip } from "@/lib/types";
import BottomNav from "@/components/BottomNav";
import PageShell from "@/components/PageShell";
import { Plus, ArrowUpRight, Trash, CircleAlert, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { resolveFitBand } from "@/domain/comprehension";

const FIT_LABEL: Record<"too_easy" | "fit" | "too_hard", string> = {
  too_easy: "너무 쉬움",
  fit: "적정",
  too_hard: "도전",
};

const Library: React.FC = () => {
  const navigate = useNavigate();
  const [clips, setClips] = useState<Clip[]>([]);
  const [url, setUrl] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [loading, setLoading] = useState(true);
  const [migrationRequired, setMigrationRequired] = useState(false);

  const loadLibrary = async () => {
    setLoading(true);
    const [status, list] = await Promise.all([getStorageStatus(), getClips()]);
    setMigrationRequired(status.migrationRequired);
    setClips(list);
    setLoading(false);
  };

  useEffect(() => {
    loadLibrary();
  }, []);

  const handleAdd = async () => {
    const videoId = extractVideoId(url.trim());
    if (!videoId) {
      toast.error("유효한 유튜브 URL을 입력해주세요");
      return;
    }

    if (clips.some((c) => c.videoId === videoId)) {
      toast.error("이미 추가된 클립입니다");
      return;
    }

    const meta = await fetchYouTubeOEmbed(url.trim());

    const baseClip: Clip = {
      id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      youtubeUrl: url.trim(),
      videoId,
      title: meta?.title || `YouTube 클립 (${videoId})`,
      channel: meta?.channel,
      level: "beginner",
      captionsAvailable: true,
      addedAt: new Date().toISOString(),
      embeddable: true,
      fitBand: "fit",
      comprehensionAvg: 3,
    };

    try {
      await saveClip(baseClip);
      setClips((prev) => [...prev, baseClip]);
      setUrl("");
      setShowInput(false);
      toast.success("클립이 추가되었습니다");
    } catch (error) {
      console.error(error);
      toast.error("클립 저장에 실패했습니다");
    }
  };

  const handleDelete = async (id: string) => {
    await deleteClip(id);
    setClips((prev) => prev.filter((c) => c.id !== id));
    toast.success("클립이 삭제되었습니다");
  };

  const blockedContent = (
    <div className="ui-island p-5 text-center mt-4">
      <CircleAlert className="w-8 h-8 text-warning mx-auto mb-2" />
      <p className="font-medium">로컬 데이터 초기화가 필요합니다</p>
      <p className="text-sm text-muted-foreground mt-1">구버전 데이터가 감지되어 라이브러리를 잠시 사용할 수 없습니다.</p>
      <Button className="mt-4" onClick={() => navigate("/settings")}>설정에서 초기화하기</Button>
    </div>
  );

  return (
    <>
      <PageShell
        title="라이브러리"
        rightAction={
          !migrationRequired ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowInput(!showInput)}
              className="h-10 w-10 rounded-[12px] border-border/85 bg-secondary p-0 shadow-[0_6px_14px_-10px_rgba(8,11,20,0.45)] hover:bg-muted"
              aria-label="클립 추가"
            >
              <Plus className="h-5 w-5" />
            </Button>
          ) : undefined
        }
      >
        <section className="font-ko-bold">
          <div className="mb-3 rounded-[10px] border border-border/80 bg-secondary/55 p-3 text-[11px] text-muted-foreground">
            Orbit는 YouTube 공식 임베드만 사용합니다. 타인 영상 transcript 자동 수집, 오디오 추출, 다운로드 기능은 제공하지 않습니다.
          </div>
          {migrationRequired ? (
            blockedContent
          ) : (
            <>
            {showInput && (
              <div className="ui-island rounded-[18px] p-4 mb-4 animate-slide-up space-y-2">
                <label className="text-sm font-medium block">유튜브 URL 추가</label>
                <div className="flex gap-2">
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className="flex-1"
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  />
                  <Button onClick={handleAdd}>추가</Button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="text-center py-16 text-sm text-muted-foreground">로딩 중...</div>
            ) : clips.length === 0 ? (
              <div className="text-center py-16">
                <p className="font-medium mb-1">아직 클립이 없어요</p>
                <p className="text-sm text-muted-foreground mb-4">유튜브 URL을 추가해 학습을 시작하세요</p>
                <Button variant="outline" onClick={() => setShowInput(true)}>
                  <Plus className="w-4 h-4 mr-1" /> 클립 추가
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {clips.map((clip, idx) => {
                  const cardIndex = idx + 1;
                  const learnHref = `/learn/${clip.id}?mode=subtitle`;
                  const fitBand = clip.fitBand || resolveFitBand(clip.comprehensionAvg);

                  return (
                    <article key={clip.id} className="overflow-hidden rounded-[16px] border border-border/80 bg-card p-4 shadow-[0_10px_26px_-18px_rgba(8,11,20,0.36)]">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-[10px] border border-border/85 bg-secondary text-[11px] font-semibold">
                            YT
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/85 bg-secondary text-foreground hover:bg-muted"
                              onClick={() => void navigate(learnHref)}
                              aria-label="학습 바로가기"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                            <a
                              href={`https://www.youtube.com/watch?v=${clip.videoId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/85 bg-secondary text-foreground hover:bg-muted"
                              aria-label="유튜브 바로가기"
                            >
                              <ArrowUpRight className="h-4 w-4" />
                            </a>
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/85 bg-secondary text-muted-foreground hover:text-destructive hover:bg-muted"
                              onClick={() => void handleDelete(clip.id)}
                              aria-label="삭제"
                            >
                              <Trash className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-3">
                          <div className="min-w-0">
                            <h3 className="line-clamp-2 font-ko-bold text-[14px] leading-[1.2] font-medium text-foreground">{clip.title || `YouTube 클립 (${clip.videoId})`}</h3>
                            <p className="mt-2 text-xs font-ko-bold text-muted-foreground line-clamp-1">{clip.channel || "채널 정보 없음"}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">난이도 적합도: {FIT_LABEL[fitBand]}</p>
                            <p className="mt-3 text-[11px] text-muted-foreground">Open app ↗</p>
                          </div>
                          <p className="text-[44px] leading-none tracking-tight text-foreground font-ko-bold">{String(cardIndex).padStart(2, "0")}</p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
          )}
        </section>
      </PageShell>
      <BottomNav />
    </>
  );
};

export default Library;
