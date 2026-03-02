import { OrbitStudySession, SessionReviewRepeatedError, WeeklyPatternReport } from "@/lib/types";

const CATEGORY_LABELS: Record<string, string> = {
  article: "관사/한정사",
  tense: "시제",
  auxiliary: "조동사",
  ja_particle: "일본어 조사",
  literal_or_awkward: "직역/어색한 표현",
  other: "기타 반복 오류",
};

const dedupe = (values: string[]): string[] => {
  const set = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) continue;
    if (set.has(normalized)) continue;
    set.add(normalized);
    result.push(normalized);
  }
  return result;
};

const toDateKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const mondayStart = (value: Date): Date => {
  const date = new Date(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

const classifyError = (error: SessionReviewRepeatedError): keyof typeof CATEGORY_LABELS => {
  const text = `${error.original} ${error.natural} ${error.reason}`.toLowerCase();

  if (/(\bthe\b|\ba\b|\ban\b|article|관사)/.test(text)) return "article";
  if (/(tense|시제|현재완료|과거|future|will\b|\bed\b)/.test(text)) return "tense";
  if (/(조동사|auxiliary|\bcan\b|\bcould\b|\bwould\b|\bshould\b|\bmust\b|\bmight\b)/.test(text)) return "auxiliary";
  if (/(조사|は|が|を|に|で|へ|と|から|まで)/.test(text)) return "ja_particle";
  if (/(직역|어색|awkward|unnatural|literal)/.test(text)) return "literal_or_awkward";
  return "other";
};

const defaultScenarios = ["버그 원인 설명", "PR 변경사항 설명", "회의 요약 공유", "일정/상태 업데이트", "일상 잡담"];

const defaultVideoTypesByLanguage = (language: string): string[] => {
  const lower = language.toLowerCase();
  if (lower.includes("japan") || lower === "ja" || lower === "jp") {
    return ["개발 브이로그 일본어", "기술 인터뷰 일본어", "업무 대화 일본어"];
  }
  return ["개발자 인터뷰 영어", "테크 토크 영어", "업무 커뮤니케이션 영어"];
};

export function buildWeeklyPrompt(report: Pick<WeeklyPatternReport, "topErrorPatterns" | "strengths" | "recommendedExpressions" | "recommendedScenarios" | "recommendedVideoTypes">): string {
  return [
    "WEEKLY",
    "아래 요약을 바탕으로 다음 7일 미니 커리큘럼을 더 구체화해줘.",
    `- 반복 패턴 3개: ${report.topErrorPatterns.join(", ")}`,
    `- 유지할 강점 2개: ${report.strengths.join(", ")}`,
    `- 다음 주 목표 표현: ${report.recommendedExpressions.join(", ")}`,
    `- 추천 시나리오: ${report.recommendedScenarios.join(", ")}`,
    `- 추천 영상 유형: ${report.recommendedVideoTypes.join(", ")}`,
  ].join("\n");
}

export function analyzeWeeklyPatterns(input: {
  sessions: OrbitStudySession[];
  language: string;
  from?: Date;
  to?: Date;
  now?: number;
}): WeeklyPatternReport {
  const now = input.now || Date.now();
  const to = input.to ? new Date(input.to) : new Date(now);
  const from = input.from ? new Date(input.from) : (() => {
    const d = new Date(to);
    d.setDate(d.getDate() - 6);
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  const filtered = input.sessions.filter((session) => {
    if (!session.review) return false;
    if (session.targetLanguage !== input.language) return false;
    return session.createdAt >= from.getTime() && session.createdAt <= to.getTime();
  });

  const categoryCount = new Map<string, number>();
  const strengthsAll: string[] = [];
  const expressionsAll: string[] = [];

  for (const session of filtered) {
    const review = session.review;
    if (!review) continue;

    for (const error of review.repeatedErrors) {
      const category = classifyError(error);
      categoryCount.set(category, (categoryCount.get(category) || 0) + 1);
    }

    strengthsAll.push(...review.strengths);
    expressionsAll.push(...review.takeawayExpressions);
  }

  const topErrorPatterns = [...categoryCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => CATEGORY_LABELS[key] || CATEGORY_LABELS.other);

  const strengths = dedupe(strengthsAll).slice(0, 2);
  const recommendedExpressions = dedupe(expressionsAll).slice(0, 10);

  const recommendedScenarios = dedupe([
    ...defaultScenarios,
    ...(topErrorPatterns.includes("직역/어색한 표현") ? ["같은 내용 자연스럽게 바꿔 말하기"] : []),
    ...(topErrorPatterns.includes("시제") ? ["어제/오늘/내일 상황 비교 설명"] : []),
  ]).slice(0, 5);

  const recommendedVideoTypes = defaultVideoTypesByLanguage(input.language).slice(0, 3);
  const safeTopPatterns = topErrorPatterns.length > 0 ? topErrorPatterns : ["이번 주 반복 오류 데이터 부족"];
  const safeStrengths = strengths.length > 0 ? strengths : ["대화 지속력", "요점 전달"];

  const weekStart = mondayStart(to);
  const weekKey = `${toDateKey(weekStart)}_${input.language.toLowerCase()}`;

  const reportBase = {
    topErrorPatterns: safeTopPatterns,
    strengths: safeStrengths,
    recommendedExpressions,
    recommendedScenarios,
    recommendedVideoTypes,
  };

  return {
    id: weekKey,
    weekKey,
    language: input.language,
    fromDate: toDateKey(from),
    toDate: toDateKey(to),
    ...reportBase,
    weeklyPrompt: buildWeeklyPrompt(reportBase),
    createdAt: now,
    updatedAt: now,
  };
}
