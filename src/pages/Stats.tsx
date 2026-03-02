import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import PageShell from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getRecentSessionSummary, getSettings, getWeeklyPatternReport } from "@/lib/storage";
import { SessionLog } from "@/lib/types";
import { computeStrandRatio, normalizeStrandSeconds, StrandKey } from "@/domain/sessionAnalytics";
import { toast } from "sonner";

const STRAND_META: Array<{ key: StrandKey; label: string }> = [
  { key: "input", label: "입력" },
  { key: "output", label: "출력" },
  { key: "form", label: "형태 교정" },
  { key: "fluency", label: "유창성" },
];

const pct = (v: number) => `${Math.round(v * 100)}%`;

const Stats: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [totalSavedCount, setTotalSavedCount] = useState(0);
  const [strandSeconds, setStrandSeconds] = useState(normalizeStrandSeconds());
  const [weeklyReport, setWeeklyReport] = useState<Awaited<ReturnType<typeof getWeeklyPatternReport>> | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const settings = getSettings();
      const targetLanguage = settings.targetLanguage.toLowerCase().includes("ja") ? "Japanese" : "English";
      const [summary, weekly] = await Promise.all([getRecentSessionSummary(7), getWeeklyPatternReport({ language: targetLanguage })]);
      setLogs(summary.logs);
      setTotalMinutes(summary.totalMinutes);
      setTotalSavedCount(summary.totalSavedCount);
      setStrandSeconds(summary.strandSeconds);
      setWeeklyReport(weekly);
      setLoading(false);
    };

    void load();
  }, []);

  const ratios = useMemo(() => computeStrandRatio(strandSeconds), [strandSeconds]);
  const weakStrands = useMemo(
    () => STRAND_META.filter((item) => ratios[item.key] > 0 && ratios[item.key] < 0.15),
    [ratios]
  );

  return (
    <>
      <PageShell title="학습 통계" showBack onBack={() => navigate("/settings")}>
        {loading ? (
          <div className="text-center py-16 text-sm text-muted-foreground">로딩 중...</div>
        ) : logs.length === 0 ? (
          <div className="ui-island rounded-[16px] border p-6 text-center">
            <p className="font-medium">최근 7일 학습 기록이 없습니다</p>
            <p className="text-sm text-muted-foreground mt-1">학습을 시작하면 4 strands 균형을 보여줍니다.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/home")}>학습 시작하기</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <section className="ui-island rounded-[16px] border p-4">
              <p className="text-xs text-muted-foreground">최근 7일 요약</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-[10px] bg-secondary/65 p-3">
                  <p className="text-[11px] text-muted-foreground">학습 시간</p>
                  <p className="mt-1 font-semibold">{totalMinutes}분</p>
                </div>
                <div className="rounded-[10px] bg-secondary/65 p-3">
                  <p className="text-[11px] text-muted-foreground">저장 표현</p>
                  <p className="mt-1 font-semibold">{totalSavedCount}개</p>
                </div>
              </div>
            </section>

            <section className="ui-island rounded-[16px] border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">4 Strands 비율</h3>
                {weakStrands.length > 0 && <Badge variant="destructive">주의 필요</Badge>}
              </div>

              {STRAND_META.map((item) => {
                const ratio = ratios[item.key];
                const under = ratio > 0 && ratio < 0.15;
                return (
                  <div key={item.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className={under ? "text-destructive font-medium" : "text-foreground"}>{pct(ratio)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary">
                      <div
                        className={under ? "h-2 rounded-full bg-destructive" : "h-2 rounded-full bg-primary"}
                        style={{ width: `${Math.max(4, ratio * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              {weakStrands.length > 0 && (
                <div className="rounded-[10px] bg-destructive/10 p-3 text-xs text-destructive">
                  {weakStrands.map((item) => item.label).join(", ")} 비중이 15% 미만입니다. 다음 학습에서 해당 활동을 보강하세요.
                </div>
              )}
            </section>

            <section className="ui-island rounded-[16px] border p-4">
              <h3 className="text-sm font-semibold">일자별 로그</h3>
              <div className="mt-2 space-y-2">
                {logs
                  .slice()
                  .reverse()
                  .map((log) => (
                    <div key={log.date} className="rounded-[10px] bg-secondary/65 p-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{log.date}</span>
                        <span>{log.minutes}분</span>
                      </div>
                      <p className="text-muted-foreground mt-1">저장 {log.savedCount}개 · 노티싱 {log.noticingEvents || 0}회 · 루프 {log.fluencyLoops || 0}회</p>
                    </div>
                  ))}
              </div>
            </section>

            {weeklyReport && (
              <section className="ui-island rounded-[16px] border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">주간 패턴</h3>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard
                        .writeText(weeklyReport.weeklyPrompt)
                        .then(() => toast.success("WEEKLY 프롬프트 복사됨"))
                        .catch(() => toast.error("복사에 실패했습니다."));
                    }}
                  >
                    WEEKLY 프롬프트 복사
                  </Button>
                </div>

                <div className="rounded-[10px] bg-secondary/65 p-3">
                  <p className="text-[11px] text-muted-foreground">반복 오류 패턴</p>
                  <p className="mt-1 text-sm">{weeklyReport.topErrorPatterns.join(" · ") || "(데이터 없음)"}</p>
                </div>
                <div className="rounded-[10px] bg-secondary/65 p-3">
                  <p className="text-[11px] text-muted-foreground">유지할 강점</p>
                  <p className="mt-1 text-sm">{weeklyReport.strengths.join(" · ") || "(데이터 없음)"}</p>
                </div>
                <div className="rounded-[10px] bg-secondary/65 p-3">
                  <p className="text-[11px] text-muted-foreground">다음 주 추천</p>
                  <p className="mt-1 text-xs text-muted-foreground">시나리오: {weeklyReport.recommendedScenarios.join(", ") || "(없음)"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">영상 유형: {weeklyReport.recommendedVideoTypes.join(", ") || "(없음)"}</p>
                </div>
              </section>
            )}
          </div>
        )}
      </PageShell>
      <BottomNav />
    </>
  );
};

export default Stats;
