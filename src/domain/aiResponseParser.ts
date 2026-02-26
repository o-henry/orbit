export interface ParsedAiFeedback {
  correction?: string;
  paraphrases?: string[];
  drills?: string[];
  source: "external-paste";
}

export interface ParseAiResponseResult {
  feedback: ParsedAiFeedback | null;
  error?: string;
}

const normalizeLine = (line: string): string =>
  line
    .replace(/^[-*•\d.)\s]+/, "")
    .trim();

const isHeader = (line: string, candidates: string[]): boolean => {
  const normalized = line.toLowerCase();
  return candidates.some((candidate) => normalized.includes(candidate));
};

export function parseAiResponse(raw: string): ParseAiResponseResult {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized) {
    return {
      feedback: null,
      error: "붙여넣은 AI 답변이 비어 있습니다.",
    };
  }

  const lines = normalized
    .split("\n")
    .map((line) => normalizeLine(line))
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      feedback: null,
      error: "분석 가능한 텍스트를 찾지 못했습니다.",
    };
  }

  const paraphrases: string[] = [];
  const drills: string[] = [];
  let correction = "";
  let mode: "correction" | "paraphrases" | "drills" | "none" = "none";

  for (const line of lines) {
    if (isHeader(line, ["교정", "correction", "수정"] as string[])) {
      mode = "correction";
      continue;
    }

    if (isHeader(line, ["바꿔말", "paraphrase", "대체 표현", "표현"] as string[])) {
      mode = "paraphrases";
      continue;
    }

    if (isHeader(line, ["드릴", "훈련", "drill", "연습"] as string[])) {
      mode = "drills";
      continue;
    }

    if (mode === "correction" && !correction) {
      correction = line;
      continue;
    }

    if (mode === "paraphrases") {
      paraphrases.push(line);
      continue;
    }

    if (mode === "drills") {
      drills.push(line);
      continue;
    }
  }

  if (!correction) {
    correction = lines[0] || "";
  }

  if (paraphrases.length === 0) {
    paraphrases.push(...lines.slice(1, 3));
  }

  if (drills.length === 0 && lines.length > 3) {
    drills.push(...lines.slice(3, 6));
  }

  const feedback: ParsedAiFeedback = {
    source: "external-paste",
    ...(correction ? { correction } : {}),
    ...(paraphrases.length > 0 ? { paraphrases: paraphrases.slice(0, 5) } : {}),
    ...(drills.length > 0 ? { drills: drills.slice(0, 5) } : {}),
  };

  const hasContent = Boolean(feedback.correction || feedback.paraphrases?.length || feedback.drills?.length);
  if (!hasContent) {
    return {
      feedback: null,
      error: "교정/바꿔말하기/드릴 정보를 찾지 못했습니다.",
    };
  }

  return { feedback };
}
