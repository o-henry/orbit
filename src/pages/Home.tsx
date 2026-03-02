import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DEFAULT_SETTINGS, getClips, getDueCards, getSettings } from "@/lib/storage";
import { Clip } from "@/lib/types";
import BottomNav from "@/components/BottomNav";
import PageShell from "@/components/PageShell";
import { resolveFitBand, sortClipsByFitPriority } from "@/domain/comprehension";

const FIT_LABEL: Record<"too_easy" | "fit" | "too_hard", string> = {
  too_easy: "너무 쉬움",
  fit: "적정 난이도",
  too_hard: "도전 난이도",
};

const JA_CHUNK_REGEX = /[\u3040-\u30FF\u31F0-\u31FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u3005\u3006\u30FC]+|[^\u3040-\u30FF\u31F0-\u31FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u3005\u3006\u30FC]+/g;
const HAS_JA_REGEX = /[\u3040-\u30FF\u31F0-\u31FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u3005\u3006\u30FC]/;

const renderMixedHeroTitle = (title: string) => {
  const chunks = title.match(JA_CHUNK_REGEX) ?? [title];

  return chunks.map((chunk, idx) => (
    <span key={`${chunk}-${idx}`} className={HAS_JA_REGEX.test(chunk) ? "font-jp" : "font-dm tracking-[-0.7px]"}>
      {chunk}
    </span>
  ));
};

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [clips, setClips] = useState<Clip[]>([]);
  const [dueCount, setDueCount] = useState(0);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    const load = async () => {
      setSettings(getSettings());
      const [nextClips, due] = await Promise.all([
        getClips(),
        getDueCards(),
      ]);

      setClips(nextClips);
      setDueCount(due.length);
    };

    load();
  }, []);

  const todayClip = sortClipsByFitPriority(clips)[0];
  const todayClipFitBand = todayClip ? (todayClip.fitBand || resolveFitBand(todayClip.comprehensionAvg)) : "fit";

  return (
    <>
      <PageShell>
        <div className="pt-2">
          <button
            onClick={() => navigate("/srs")}
            className="ui-island-strong relative mb-6 min-h-[84px] w-full overflow-hidden border border-white/18 bg-primary p-5 text-start text-primary-foreground shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)]"
          >
            <div className="pointer-events-none absolute -left-8 -top-8 h-24 w-24 rounded-full bg-white/22 blur-xl" />
            <div className="pointer-events-none absolute right-4 top-2 h-14 w-14 rounded-2xl bg-accent/35 blur-[1px]" />
            <div className="pointer-events-none absolute bottom-0 right-10 h-20 w-20 rounded-full bg-white/14 blur-lg" />
            <div className="relative z-10 flex items-center justify-between gap-3">
              <div className="font-dm">
                <div className="text-base font-ko-bold font-medium">복습 카드 {dueCount}개</div>
                <div className="text-xs opacity-85">{dueCount > 0 ? "지금 복습 시작" : "오늘은 복습 카드가 없습니다"}</div>
              </div>
              <span className="ui-chip border border-white/20 bg-black/30 px-5 py-2.5 font-dm text-[13px] font-medium text-white/90 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[2px]">
                REVIEW
              </span>
            </div>
          </button>

          <button
            onClick={() => navigate("/sessions")}
            className="ui-island relative mb-6 min-h-[72px] w-full overflow-hidden border border-border/80 bg-card p-4 text-start shadow-[0_10px_24px_-18px_rgba(8,11,20,0.36)]"
          >
            <div className="relative z-10 flex items-center justify-between gap-3">
              <div className="font-dm">
                <div className="text-sm font-ko-bold font-medium">세션 허브</div>
                <div className="text-xs text-muted-foreground">REVIEW · STORYBOARD · RECALL · WEEKLY</div>
              </div>
              <span className="ui-chip border border-border/80 bg-secondary px-3 py-1.5 font-dm text-[11px] text-foreground">
                OPEN
              </span>
            </div>
          </button>

          <h2 className="mb-3 text-lg font-medium font-ko-bold"></h2>
          {todayClip ? (
            <section className="ui-island-strong overflow-hidden font-ko-bold">
              <div className="relative h-44 overflow-hidden bg-primary p-5">
                <div className="absolute -left-8 -top-10 h-28 w-28 rounded-full bg-white/35 blur-xl" />
                <div className="absolute right-5 top-4 h-16 w-16 rounded-2xl bg-accent/70" />
                <div className="absolute right-12 bottom-6 h-24 w-24 rounded-full bg-white/20 backdrop-blur-sm" />
                <div className="relative z-10 flex h-full items-end">
                  <div className="text-primary-foreground">
                    <p className="text-xs font-medium tracking-[0.14em] opacity-90">듣고 반복하기</p>
                    <h3 className="mt-2 line-clamp-2 max-w-[220px] text-xl font-medium leading-tight">
                      {renderMixedHeroTitle(todayClip.title || `YouTube Clip (${todayClip.videoId})`)}
                    </h3>
                  </div>
                </div>
              </div>
                <div className="space-y-4 p-4">
                  <p className="text-xs text-muted-foreground font-en">{todayClip.channel || settings.targetLanguage.toUpperCase()}</p>
                  <div className="inline-flex rounded-[10px] border border-border/80 bg-secondary px-2 py-1 text-[11px] text-muted-foreground">
                    {FIT_LABEL[todayClipFitBand]}
                  </div>
                  <div className="rounded-[var(--radius-sm)] bg-secondary/75 p-3">
                    <p className="text-xs text-muted-foreground">
                      구간 반복, 표현 익히기, AI 질문, SRS 복습 순서로 학습합니다.
                  </p>
                </div>
                <Button className="w-full h-11 font-ko-bold" onClick={() => navigate(`/learn/${todayClip.id}`)}>
                  학습 시작하기
                </Button>
              </div>
            </section>
          ) : (
            <div className="ui-island text-center p-8">
              <p className="font-ko-bold font-medium mb-1">첫 클립을 추가해보세요</p>
              <p className="font-ko-bold text-sm text-muted-foreground mb-4">유튜브 클립을 추가하면 바로 학습을 시작할 수 있어요.</p>
              <Button variant="outline" onClick={() => navigate("/library")}>
                라이브러리로 이동
              </Button>
            </div>
          )}
        </div>
      </PageShell>
      <BottomNav />
    </>
  );
};

export default HomePage;
