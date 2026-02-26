import React, { useState, useEffect } from "react";
import { clearAllData, getSettings, updateSettings, getStorageStatus } from "@/lib/storage";
import { useNavigate } from "react-router-dom";
import { UserSettings } from "@/lib/types";
import BottomNav from "@/components/BottomNav";
import PageShell from "@/components/PageShell";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";

const LANGUAGE_OPTIONS = [
  { code: "en", label: "영어 (English)" },
  { code: "ja", label: "일본어 (Japanese)" },
] as const;

const LEVEL_OPTIONS = ["입문", "초급", "중급", "고급"] as const;

const languageLabel = (code: string) => LANGUAGE_OPTIONS.find((option) => option.code === code)?.label || code.toUpperCase();

const modeForLevel = (level: UserSettings["learnerLevel"]): UserSettings["mode"] =>
  level === "고급" ? "advanced" : level === "중급" ? "intermediate" : "beginner";

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState<UserSettings["targetLanguage"]>("en");
  const [learnerLevel, setLearnerLevel] = useState<UserSettings["learnerLevel"]>("초급");
  const [migrationRequired, setMigrationRequired] = useState(false);

  useEffect(() => {
    const settings = getSettings();
    setDarkMode(settings.darkMode);
    setTargetLanguage(settings.targetLanguage);
    setLearnerLevel(settings.learnerLevel);

    getStorageStatus().then((status) => {
      setMigrationRequired(status.migrationRequired);
    });
  }, []);

  const toggleDark = (val: boolean) => {
    setDarkMode(val);
    updateSettings({ darkMode: val });
    document.documentElement.classList.toggle("dark", val);
  };

  const handleTargetLanguageChange = (nextLanguage: UserSettings["targetLanguage"]) => {
    setTargetLanguage(nextLanguage);
    updateSettings({ targetLanguage: nextLanguage });
    toast.success(`학습 언어 변경: ${languageLabel(nextLanguage)}`);
  };

  const handleLearnerLevelChange = (nextLevel: UserSettings["learnerLevel"]) => {
    setLearnerLevel(nextLevel);
    updateSettings({ learnerLevel: nextLevel, mode: modeForLevel(nextLevel) });
    toast.success(`학습 난이도 변경: ${nextLevel}`);
  };

  const handleClearData = async () => {
    if (!window.confirm("저장한 표현, 복습 카드, 자막, 설정이 이 기기에서 모두 삭제됩니다. 계속하시겠습니까?")) {
      return;
    }

    await clearAllData();
    toast.success("데이터가 초기화되었습니다");
    window.location.href = "/library";
  };

  return (
    <>
      <PageShell title="설정">
        <div className="space-y-3">
          {migrationRequired && (
            <div className="ui-island border-warning/30 bg-warning/10 p-4 shadow-[var(--island-shadow)]">
              <div>
                <div className="font-medium text-sm">구버전 데이터 감지됨</div>
                <div className="text-xs text-muted-foreground mt-1">Learn/SRS/Library를 사용하려면 아래에서 로컬 데이터를 초기화하세요.</div>
              </div>
            </div>
          )}

            <div className="ui-island ui-card-border rounded-[16px] p-4 shadow-[var(--island-shadow)] flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">다크 모드</div>
              <div className="text-xs text-muted-foreground">어두운 화면 테마</div>
            </div>
            <Switch checked={darkMode} onCheckedChange={toggleDark} />
          </div>

          <div className="ui-island ui-card-border rounded-[16px] p-4 shadow-[var(--island-shadow)] space-y-4">
            <div>
              <div className="font-medium text-sm">학습 언어</div>
              <div className="text-xs text-muted-foreground">현재: {languageLabel(targetLanguage)}</div>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {LANGUAGE_OPTIONS.map((option) => (
                <button
                  key={option.code}
                  type="button"
                  onClick={() => handleTargetLanguageChange(option.code)}
                  className={cn(
                    "w-full rounded-[4px] border border-border/85 bg-secondary px-3 py-2 text-left text-sm transition-colors",
                    targetLanguage === option.code ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ui-island ui-card-border rounded-[16px] p-4 shadow-[var(--island-shadow)] space-y-4">
            <div>
              <div className="font-medium text-sm">학습 난이도(레벨)</div>
              <div className="text-xs text-muted-foreground">현재: {learnerLevel}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {LEVEL_OPTIONS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => handleLearnerLevelChange(level)}
                  className={cn(
                    "rounded-[4px] border border-border/85 bg-secondary px-3 py-2 text-sm transition-colors",
                    learnerLevel === level ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {level}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">변경한 언어/레벨은 AI 질문 프롬프트 생성에 즉시 적용됩니다.</p>
          </div>

          <div className="ui-island ui-card-border overflow-hidden rounded-[16px] p-4 shadow-[var(--island-shadow)]">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-[10px] border border-border/85 bg-secondary text-[11px] font-semibold">
                MEM
              </span>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-3">
              <p className="text-sm font-medium">표현 모음</p>
              <p className="mt-1 text-xs text-muted-foreground">저장된 문장과 메모 목록으로 이동합니다.</p>
            </div>
            <Button variant="outline" className="mt-3 w-full justify-center" onClick={() => navigate("/settings/memo")}>표현 모음으로 이동</Button>
          </div>

          <div className="ui-island ui-card-border overflow-hidden rounded-[16px] p-4 shadow-[var(--island-shadow)]">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-[10px] border border-border/85 bg-secondary text-[11px] font-semibold">
                STAT
              </span>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-3">
              <p className="text-sm font-medium">학습 통계</p>
              <p className="mt-1 text-xs text-muted-foreground">최근 7일 4 strands 균형과 학습량을 확인합니다.</p>
            </div>
            <Button variant="outline" className="mt-3 w-full justify-center" onClick={() => navigate("/stats")}>통계 보기</Button>
          </div>

          <div className="ui-island ui-card-border rounded-[16px] p-4 shadow-[var(--island-shadow)]">
            <div className="font-medium text-sm mb-3">PWA 안내</div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• 유튜브 영상 재생은 인터넷 연결이 필요합니다</p>
              <p>• 홈 화면에 추가하면 앱처럼 사용할 수 있습니다</p>
            </div>
          </div>

          <div className="ui-island ui-card-border rounded-[16px] p-4 shadow-[var(--island-shadow)]">
            <div className="mb-3">
              <div className="font-medium text-sm">데이터 초기화</div>
              <div className="text-xs text-muted-foreground">이 기기에 저장된 학습 데이터(표현/복습/설정)를 모두 삭제합니다</div>
            </div>
            <Button variant="destructive" size="sm" onClick={handleClearData}>
              데이터 삭제
            </Button>
          </div>

          <div className="ui-island ui-card-border rounded-[16px] p-4 shadow-[var(--island-shadow)]">
            <div className="font-medium text-sm mb-2">데이터가 사라지는 경우</div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• 설정에서 &quot;데이터 삭제&quot; 버튼을 누른 경우</p>
              <p>• 브라우저/앱에서 이 사이트의 저장 데이터(쿠키/사이트 데이터)를 직접 지운 경우</p>
              <p>• 일부 브라우저의 시크릿 모드처럼 임시 저장소를 쓰는 경우</p>
            </div>
          </div>
        </div>

        <div className="text-center mt-8 text-xs text-muted-foreground"></div>
      </PageShell>
      <BottomNav />
    </>
  );
};

export default SettingsPage;
