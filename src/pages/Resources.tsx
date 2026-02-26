import React, { useEffect, useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import PageShell from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { LEARNING_RESOURCE_DOC, LearningResourceSection, ResourceLanguage } from "@/data/learningResources";
import { DEFAULT_SETTINGS, getClips, getSettings } from "@/lib/storage";

const LEVELS: Array<LearningResourceSection["level"]> = ["입문", "초급", "중급", "고급"];
const KO_CHUNK_REGEX = /[\u3131-\u318E\uAC00-\uD7A3]+|[^\u3131-\u318E\uAC00-\uD7A3]+/g;
const HAS_KO_REGEX = /[\u3131-\u318E\uAC00-\uD7A3]/;

const targetLanguageToResourceLanguage = (value: string): ResourceLanguage => {
  const code = value.trim().toLowerCase();
  return code === "ja" || code === "jp" ? "japanese" : "english";
};

const renderTitleByLanguage = (title: string) => {
  const chunks = title.match(KO_CHUNK_REGEX) ?? [title];

  return chunks.map((chunk, idx) => (
    <span key={`${chunk}-${idx}`} className={HAS_KO_REGEX.test(chunk) ? "font-ko-bold" : "font-dm tracking-[-1px]"}>
      {chunk}
    </span>
  ));
};

const nextLevel = (
  current: LearningResourceSection["level"],
  direction: "up" | "down"
): LearningResourceSection["level"] => {
  const idx = LEVELS.indexOf(current);
  if (idx < 0) return current;
  if (direction === "up") return LEVELS[Math.min(LEVELS.length - 1, idx + 1)];
  return LEVELS[Math.max(0, idx - 1)];
};

const ResourcesPage: React.FC = () => {
  const [language, setLanguage] = useState<ResourceLanguage>(() => targetLanguageToResourceLanguage(DEFAULT_SETTINGS.targetLanguage));
  const [level, setLevel] = useState<LearningResourceSection["level"]>(() => {
    return LEVELS.includes(DEFAULT_SETTINGS.learnerLevel) ? DEFAULT_SETTINGS.learnerLevel : "초급";
  });
  const [fitHint, setFitHint] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      const settings = getSettings();
      const initialLanguage = targetLanguageToResourceLanguage(settings.targetLanguage);
      const initialLevel = LEVELS.includes(settings.learnerLevel) ? settings.learnerLevel : "초급";
      setLanguage(initialLanguage);
      setLevel(initialLevel);

      const clips = await getClips();
      const tooHardCount = clips.filter((clip) => clip.fitBand === "too_hard").length;
      const tooEasyCount = clips.filter((clip) => clip.fitBand === "too_easy").length;
      const fitCount = clips.filter((clip) => clip.fitBand === "fit").length;

      if (tooHardCount > Math.max(tooEasyCount, fitCount)) {
        setLevel(nextLevel(initialLevel, "down"));
        setFitHint("최근 학습 기록 기준으로 난이도를 한 단계 낮춰 추천합니다.");
        return;
      }

      if (tooEasyCount > Math.max(tooHardCount, fitCount)) {
        setLevel(nextLevel(initialLevel, "up"));
        setFitHint("최근 학습 기록 기준으로 난이도를 한 단계 높여 추천합니다.");
        return;
      }

      setFitHint("");
    };

    void load();
  }, []);

  const currentSection = useMemo(
    () => LEARNING_RESOURCE_DOC.sections.find((section) => section.language === language && section.level === level),
    [language, level]
  );
  const languageLabel = language === "japanese" ? "일본어" : "영어";
  const languageShort = language === "japanese" ? "JP" : "EN";

  return (
    <>
      <PageShell title="추천 리소스" titleClassName="font-ko-bold">
        <div className="ui-island rounded-[16px] p-4 space-y-4 font-ko-bold">
          <div className="space-y-2">
            <p className="text-sm font-medium">언어와 레벨을 선택하세요</p>
            <p className="text-xs text-muted-foreground">필요한 난이도만 빠르게 선택해서 바로 학습 리소스를 확인하세요.</p>
            {fitHint && <p className="text-xs text-primary">{fitHint}</p>}
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-[var(--radius)] bg-secondary/70 p-1">
            <Button type="button" size="sm" variant={language === "japanese" ? "default" : "ghost"} onClick={() => setLanguage("japanese")}>
              일본어
            </Button>
            <Button type="button" size="sm" variant={language === "english" ? "default" : "ghost"} onClick={() => setLanguage("english")}>
              영어
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 rounded-[var(--radius)] bg-secondary/70 p-1">
            {LEVELS.map((entry) => (
              <Button key={entry} type="button" size="sm" variant={level === entry ? "default" : "ghost"} onClick={() => setLevel(entry)}>
                {entry}
              </Button>
            ))}
          </div>
        </div>

        {currentSection ? (
          <div className="mt-4 space-y-4">
            <div className="ui-island rounded-[10px] p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{languageLabel} · {currentSection.level}</span>
                <span className="rounded-[10px] bg-secondary px-2 py-1 text-xs font-medium">{currentSection.cefr}</span>
              </div>
            </div>
            <div className="space-y-3">
              {currentSection.videos.map((video, idx) => {
                const query = encodeURIComponent(`${video.title} ${video.channel}`);
                const searchUrl = `https://www.youtube.com/results?search_query=${query}`;

                return (
                  <article
                    key={`${video.title}-${idx}`}
                    className="overflow-hidden rounded-[16px] border border-border/80 bg-card p-4 shadow-[0_10px_26px_-18px_rgba(8,11,20,0.36)]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-[10px] border border-border/85 bg-secondary text-[11px] font-semibold">
                        {languageShort}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] text-muted-foreground">Open app</span>
                        <a
                          href={searchUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/85 bg-secondary text-foreground transition-colors hover:bg-muted"
                          aria-label={`${video.title} 열기`}
                        >
                          <ArrowUpRight className="h-4 w-4" />
                        </a>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-3 text-[14px] leading-[1.35] font-medium text-foreground">{renderTitleByLanguage(video.title)}</p>
                        <p className="mt-2 font-en text-xs text-muted-foreground">{video.channel}</p>
                        <div className="mt-3 inline-flex items-center rounded-[10px] border border-border/85 bg-secondary px-2 py-1 text-[11px] font-medium">
                          {currentSection.level}
                        </div>
                      </div>
                      <p className="text-[44px] leading-none tracking-tight text-foreground font-ko-bold">{String(idx + 1).padStart(2, "0")}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-[var(--radius)] bg-card p-4 text-sm text-muted-foreground font-ko-bold">해당 레벨 데이터가 없습니다.</div>
        )}
      </PageShell>
      <BottomNav />
    </>
  );
};

export default ResourcesPage;
