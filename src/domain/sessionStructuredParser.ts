import { SessionReview, SessionReviewRepeatedError, StoryboardScene, WeeklyPatternReport } from "@/lib/types";

interface ParseResult<T> {
  data: T | null;
  error?: string;
  missingSections?: string[];
}

const normalizeLines = (raw: string): string[] =>
  raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*•]\s*/, "").trim());

const afterColon = (line: string): string => {
  const idx = line.indexOf(":");
  if (idx < 0) return "";
  return line.slice(idx + 1).trim();
};

const mapReviewSection = (line: string): number | null => {
  const normalized = line.toLowerCase();
  if (/^1[.)]?/.test(normalized) || normalized.includes("잘한 점")) return 1;
  if (/^2[.)]?/.test(normalized) || normalized.includes("반복 오류")) return 2;
  if (/^3[.)]?/.test(normalized) || normalized.includes("가져갈 표현")) return 3;
  if (/^4[.)]?/.test(normalized) || normalized.includes("다음 세션") || normalized.includes("드릴")) return 4;
  if (/^5[.)]?/.test(normalized) || normalized.includes("오늘의 장면")) return 5;
  return null;
};

const mapWeeklySection = (line: string): number | null => {
  const normalized = line.toLowerCase();
  if (/^1[.)]?/.test(normalized) || normalized.includes("핵심 패턴")) return 1;
  if (/^2[.)]?/.test(normalized) || normalized.includes("강점")) return 2;
  if (/^3[.)]?/.test(normalized) || normalized.includes("목표 표현")) return 3;
  if (/^4[.)]?/.test(normalized) || normalized.includes("추천 시나리오")) return 4;
  if (/^5[.)]?/.test(normalized) || normalized.includes("추천 영상")) return 5;
  return null;
};

const mapStoryboardField = (line: string): keyof Omit<StoryboardScene, "id"> | null => {
  const normalized = line.toLowerCase();
  if (normalized.includes("장면 제목") || normalized.startsWith("title")) return "title";
  if (normalized.includes("장면 설명") || normalized.startsWith("description")) return "description";
  if (normalized.includes("핵심 문장") || normalized.startsWith("core")) return "coreSentence";
  if (normalized.includes("이미지") || normalized.includes("prompt")) return "imagePrompt";
  if (normalized.includes("회상 질문") || normalized.includes("question")) return "recallQuestion";
  if (normalized.includes("image_url") || normalized.includes("image url")) return "imageUrl";
  return null;
};

const pushPendingError = (target: SessionReviewRepeatedError[], pending: SessionReviewRepeatedError) => {
  if (pending.original || pending.natural || pending.reason) {
    target.push({
      original: pending.original || "(미입력)",
      natural: pending.natural || "(미입력)",
      reason: pending.reason || "(미입력)",
      category: pending.category,
    });
  }
};

export function parseReviewOutput(raw: string): ParseResult<SessionReview> {
  const lines = normalizeLines(raw);
  if (lines.length === 0) {
    return { data: null, error: "REVIEW 입력이 비어 있습니다." };
  }

  const strengths: string[] = [];
  const repeatedErrors: SessionReviewRepeatedError[] = [];
  const takeawayExpressions: string[] = [];
  const nextSessionDrills: string[] = [];
  const scenes: string[] = [];
  const missingSections: string[] = [];

  let section = 0;
  let pendingError: SessionReviewRepeatedError = { original: "", natural: "", reason: "" };

  for (const line of lines) {
    const mapped = mapReviewSection(line);
    if (mapped) {
      if (section === 2) {
        pushPendingError(repeatedErrors, pendingError);
        pendingError = { original: "", natural: "", reason: "" };
      }
      section = mapped;
      continue;
    }

    if (section === 1) {
      strengths.push(line);
      continue;
    }

    if (section === 2) {
      if (line.includes("내가 한 말")) {
        pushPendingError(repeatedErrors, pendingError);
        pendingError = { original: afterColon(line), natural: "", reason: "" };
        continue;
      }

      if (line.includes("더 자연")) {
        pendingError.natural = afterColon(line);
        continue;
      }

      if (line.includes("왜 중요") || line.includes("왜 중요한지") || line.includes("reason")) {
        pendingError.reason = afterColon(line);
        continue;
      }

      if (!pendingError.original) {
        pendingError.original = line;
      } else if (!pendingError.natural) {
        pendingError.natural = line;
      } else if (!pendingError.reason) {
        pendingError.reason = line;
      } else {
        pushPendingError(repeatedErrors, pendingError);
        pendingError = { original: line, natural: "", reason: "" };
      }
      continue;
    }

    if (section === 3) {
      takeawayExpressions.push(line);
      continue;
    }

    if (section === 4) {
      nextSessionDrills.push(line);
      continue;
    }

    if (section === 5) {
      scenes.push(line);
    }
  }

  if (section === 2) {
    pushPendingError(repeatedErrors, pendingError);
  }

  if (strengths.length === 0) missingSections.push("오늘 잘한 점");
  if (repeatedErrors.length === 0) missingSections.push("반복 오류");
  if (takeawayExpressions.length === 0) missingSections.push("오늘 가져갈 표현");
  if (nextSessionDrills.length === 0) missingSections.push("다음 세션 드릴");
  if (scenes.length === 0) missingSections.push("오늘의 장면");

  if (missingSections.length > 0) {
    return {
      data: null,
      error: `REVIEW 필수 섹션 누락: ${missingSections.join(", ")}`,
      missingSections,
    };
  }

  return {
    data: {
      strengths: strengths.slice(0, 5),
      repeatedErrors: repeatedErrors.slice(0, 6),
      takeawayExpressions: takeawayExpressions.slice(0, 10),
      nextSessionDrills: nextSessionDrills.slice(0, 6),
      scenes: scenes.slice(0, 6),
      raw,
      createdAt: Date.now(),
    },
  };
}

export function parseStoryboardOutput(raw: string): ParseResult<StoryboardScene[]> {
  const lines = normalizeLines(raw);
  if (lines.length === 0) {
    return { data: null, error: "STORYBOARD 입력이 비어 있습니다." };
  }

  const scenes: StoryboardScene[] = [];
  let current: Omit<StoryboardScene, "id"> = {
    title: "",
    description: "",
    coreSentence: "",
    imagePrompt: "",
    recallQuestion: "",
    imageUrl: "",
  };

  const pushScene = () => {
    if (!current.title && !current.description && !current.coreSentence && !current.imagePrompt && !current.recallQuestion) {
      return;
    }

    scenes.push({
      id: `scene_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: current.title || `장면 ${scenes.length + 1}`,
      description: current.description || "",
      coreSentence: current.coreSentence || "",
      imagePrompt: current.imagePrompt || "",
      recallQuestion: current.recallQuestion || "",
      ...(current.imageUrl ? { imageUrl: current.imageUrl } : {}),
    });
  };

  for (const line of lines) {
    if (/^장면\s*\d+/.test(line) && current.title) {
      pushScene();
      current = {
        title: line,
        description: "",
        coreSentence: "",
        imagePrompt: "",
        recallQuestion: "",
        imageUrl: "",
      };
      continue;
    }

    const field = mapStoryboardField(line);
    if (field) {
      const value = afterColon(line);
      if (field === "title" && (current.title || current.description || current.coreSentence || current.imagePrompt || current.recallQuestion)) {
        pushScene();
        current = {
          title: "",
          description: "",
          coreSentence: "",
          imagePrompt: "",
          recallQuestion: "",
          imageUrl: "",
        };
      }
      if (field === "imageUrl") {
        current.imageUrl = value;
      } else {
        current[field] = value;
      }
      continue;
    }

    if (!current.title) {
      current.title = line;
    } else if (!current.description) {
      current.description = line;
    } else if (!current.coreSentence) {
      current.coreSentence = line;
    } else if (!current.imagePrompt) {
      current.imagePrompt = line;
    } else if (!current.recallQuestion) {
      current.recallQuestion = line;
    }

    if (!current.imageUrl) {
      const matchedUrl = line.match(/https?:\/\/\S+/);
      if (matchedUrl) {
        current.imageUrl = matchedUrl[0];
      }
    }
  }

  pushScene();

  const missingScenes = scenes.filter((scene) => !scene.title || !scene.imagePrompt || !scene.recallQuestion);
  if (scenes.length === 0 || missingScenes.length > 0) {
    return {
      data: null,
      error: "STORYBOARD 필수 필드(장면 제목/이미지 프롬프트/회상 질문)가 부족합니다.",
      missingSections: ["장면 제목", "이미지 프롬프트", "회상 질문"],
    };
  }

  return { data: scenes.slice(0, 8) };
}

export function parseWeeklyOutput(raw: string): ParseResult<Pick<WeeklyPatternReport, "topErrorPatterns" | "strengths" | "recommendedExpressions" | "recommendedScenarios" | "recommendedVideoTypes">> {
  const lines = normalizeLines(raw);
  if (lines.length === 0) {
    return { data: null, error: "WEEKLY 입력이 비어 있습니다." };
  }

  const topErrorPatterns: string[] = [];
  const strengths: string[] = [];
  const recommendedExpressions: string[] = [];
  const recommendedScenarios: string[] = [];
  const recommendedVideoTypes: string[] = [];

  let section = 0;
  for (const line of lines) {
    const mapped = mapWeeklySection(line);
    if (mapped) {
      section = mapped;
      continue;
    }

    if (section === 1) topErrorPatterns.push(line);
    if (section === 2) strengths.push(line);
    if (section === 3) recommendedExpressions.push(line);
    if (section === 4) recommendedScenarios.push(line);
    if (section === 5) recommendedVideoTypes.push(line);
  }

  const missingSections: string[] = [];
  if (topErrorPatterns.length === 0) missingSections.push("핵심 패턴");
  if (strengths.length === 0) missingSections.push("강점");
  if (recommendedExpressions.length === 0) missingSections.push("목표 표현");
  if (recommendedScenarios.length === 0) missingSections.push("추천 시나리오");
  if (recommendedVideoTypes.length === 0) missingSections.push("추천 영상 유형");

  if (missingSections.length > 0) {
    return {
      data: null,
      error: `WEEKLY 필수 섹션 누락: ${missingSections.join(", ")}`,
      missingSections,
    };
  }

  return {
    data: {
      topErrorPatterns: topErrorPatterns.slice(0, 3),
      strengths: strengths.slice(0, 2),
      recommendedExpressions: recommendedExpressions.slice(0, 10),
      recommendedScenarios: recommendedScenarios.slice(0, 5),
      recommendedVideoTypes: recommendedVideoTypes.slice(0, 3),
    },
  };
}
