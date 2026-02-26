import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TranscriptLine, parseUserProvidedTranscript } from "@/domain/transcript";
import { formatTime } from "@/domain/time";
import { cn } from "@/lib/utils";
import { doesTextMatchNoticingFocus, normalizeNoticingFocus } from "@/domain/noticing";

const HAS_KO_REGEX = /[가-힣ㄱ-ㅎㅏ-ㅣ]/;
const HAS_JP_REGEX = /[ぁ-ゟ゠-ヿ㐀-䶿一-鿿]/;
const HAS_EN_REGEX = /[A-Za-z]/;
const FONT_CLASS_BY_SCRIPT = {
  ko: "font-ko-bold",
  jp: "font-jp",
  en: "font-en",
} as const;

interface TranscriptPanelProps {
  lines: TranscriptLine[];
  persistEnabled: boolean;
  onLinesChange: (lines: TranscriptLine[]) => void;
  onSelectionChange: (text: string) => void;
  displayMode?: "none" | "subtitle" | "slash";
  onLineActivate?: (line: TranscriptLine) => void;
  onRangeActivate?: (lines: TranscriptLine[]) => void;
  noticingFocus?: string;
}

const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  lines,
  persistEnabled,
  onLinesChange,
  onSelectionChange,
  displayMode = "subtitle",
  onLineActivate,
  onRangeActivate,
  noticingFocus,
}) => {
  const [rawInput, setRawInput] = useState("");
  const [pasteOpen, setPasteOpen] = useState(lines.length === 0);
  const [anchorIndex, setAnchorIndex] = useState<number | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  const selectionContainerRef = useRef<HTMLDivElement>(null);
  const hasLines = useMemo(() => lines.length > 0, [lines]);
  const normalizedFocus = useMemo(() => normalizeNoticingFocus(noticingFocus || ""), [noticingFocus]);
  const matchedLineIndexSet = useMemo(() => {
    if (!normalizedFocus) return new Set<number>();
    const matched = new Set<number>();
    lines.forEach((line, index) => {
      if (doesTextMatchNoticingFocus(line.text, normalizedFocus)) {
        matched.add(index);
      }
    });
    return matched;
  }, [lines, normalizedFocus]);
  const parsePreview = useMemo(
    () =>
      parseUserProvidedTranscript(rawInput, {
        autoDetectTimestamps: true,
        mergeConsecutiveLines: true,
      }),
    [rawInput]
  );

  useEffect(() => {
    if (lines.length > 0) {
      setPasteOpen(false);
    }
  }, [lines.length]);

  const resetSelection = () => {
    setAnchorIndex(null);
    setSelectedIndices(new Set());
    onSelectionChange("");
  };

  const handleCleanPaste = () => {
    if (!rawInput.trim()) return;
    onLinesChange(parsePreview.lines);
    setRawInput(parsePreview.cleanedInput);
    setPasteOpen(false);
    resetSelection();
  };

  const handleFileUpload = async (file: File) => {
    const text = await file.text();
    const parsed = parseUserProvidedTranscript(text, {
      autoDetectTimestamps: true,
      mergeConsecutiveLines: true,
    });
    onLinesChange(parsed.lines);
    setRawInput(parsed.cleanedInput || text);
    setPasteOpen(false);
    resetSelection();
  };

  const applyAutoParse = (sourceText: string) => {
    const parsed = parseUserProvidedTranscript(sourceText, {
      autoDetectTimestamps: true,
      mergeConsecutiveLines: true,
    });

    onLinesChange(parsed.lines);
    setRawInput(parsed.cleanedInput || sourceText);
    setPasteOpen(false);
    resetSelection();
  };

  const updateSelectionFromDom = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      return;
    }

    const range = selection.getRangeAt(0);
    if (!selectionContainerRef.current?.contains(range.commonAncestorContainer)) {
      return;
    }

    onSelectionChange(selection.toString().trim());
  };

  const handleLineClick = (index: number, event: React.MouseEvent) => {
    const line = lines[index];
    if (!line) return;

    if (event.shiftKey && anchorIndex !== null) {
      const from = Math.min(anchorIndex, index);
      const to = Math.max(anchorIndex, index);
      const rangeIndices = new Set<number>();
      const selected = lines.slice(from, to + 1);

      for (let i = from; i <= to; i += 1) {
        rangeIndices.add(i);
      }

      setSelectedIndices(rangeIndices);
      const joined = selected.map((item) => item.text).join(" ").trim();
      onSelectionChange(joined);
      onRangeActivate?.(selected);
      return;
    }

    setAnchorIndex(index);
    setSelectedIndices(new Set([index]));
    onSelectionChange(line.text.trim());
    onLineActivate?.(line);
  };

  const renderLineText = (text: string) => {
    if (displayMode === "none") return "···";
    if (displayMode === "slash") {
      return text
        .split(/\s+/)
        .filter(Boolean)
        .join(" / ");
    }
    return text;
  };

  const getCharScript = (char: string): keyof typeof FONT_CLASS_BY_SCRIPT | null => {
    if (HAS_KO_REGEX.test(char)) return "ko";
    if (HAS_JP_REGEX.test(char)) return "jp";
    if (HAS_EN_REGEX.test(char)) return "en";
    return null;
  };

  const renderStyledLineText = (text: string) => {
    const rendered = renderLineText(text);
    const segments: Array<{ value: string; className: string }> = [];
    let currentClass = FONT_CLASS_BY_SCRIPT.ko;
    let buffer = "";

    for (const char of rendered) {
      const script = getCharScript(char);
      const nextClass = script ? FONT_CLASS_BY_SCRIPT[script] : currentClass;
      if (!buffer) {
        currentClass = nextClass;
        buffer = char;
        continue;
      }
      if (nextClass !== currentClass) {
        segments.push({ value: buffer, className: currentClass });
        buffer = char;
        currentClass = nextClass;
        continue;
      }
      buffer += char;
    }

    if (buffer) {
      segments.push({ value: buffer, className: currentClass });
    }

    return segments.map((segment, index) => (
      <span
        key={`${index}-${segment.className}`}
        className={segment.className}
        style={segment.className === "font-en" ? { fontFamily: '"DM Mono", "Menlo", "Consolas", monospace' } : undefined}
      >
        {segment.value}
      </span>
    ));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[var(--radius-sm)] bg-secondary/65 p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-xs font-medium">자막 텍스트 (클릭: 한 줄 선택 / Shift+클릭: 범위 선택)</p>
          <div className="flex items-center gap-2">
            {lines.length > 0 && !pasteOpen && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setPasteOpen(true)}
                className="bg-secondary/75 hover:bg-secondary"
              >
                자막 다시 붙여넣기
              </Button>
            )}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mb-2">
          선택한 텍스트는 아래 저장 섹션으로 보낼 수 있습니다. {persistEnabled ? "붙여넣은 자막은 이 기기에 계속 저장됩니다." : ""}
        </p>
        {normalizedFocus && (
          <p className="text-[11px] text-muted-foreground mb-2">
            포커스 <span className="font-medium text-foreground">{normalizedFocus}</span> · 매칭 {matchedLineIndexSet.size}개
          </p>
        )}

        <div ref={selectionContainerRef} onMouseUp={updateSelectionFromDom} className="space-y-2 max-h-72 overflow-auto pr-1 scrollbar-none">
          {lines.length === 0 ? (
            <div className="rounded-[var(--radius)] bg-card/70 px-3 py-4">
              <p className="text-xs text-muted-foreground">아직 자막 텍스트가 없습니다.</p>
              <p className="mt-2 text-[11px] text-muted-foreground">아래 붙여넣기 박스에 YouTube 스크립트나 SRT/VTT 파일을 추가하면 바로 학습 구간을 선택할 수 있습니다.</p>
            </div>
          ) : (
            lines.map((line, index) => {
              const selected = selectedIndices.has(index);
              const matchedByFocus = matchedLineIndexSet.has(index);
              return (
                <button
                  key={line.id}
                  type="button"
                  onClick={(event) => handleLineClick(index, event)}
                  className={cn(
                    "w-full text-left rounded-[var(--radius)] bg-card p-2 transition-colors",
                    selected ? "bg-primary/10 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.45)]" : "hover:bg-secondary",
                    matchedByFocus && !selected ? "shadow-[inset_0_0_0_1px_hsl(var(--warning)/0.45)]" : ""
                  )}
                >
                  <div className="text-[10px] text-muted-foreground mb-1">
                    {line.startSec !== undefined ? formatTime(line.startSec) : "--:--"}
                    {line.endSec !== undefined ? ` ~ ${formatTime(line.endSec)}` : ""}
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words select-text">{renderStyledLineText(line.text)}</p>
                </button>
              );
            })
          )}
        </div>
      </div>

      {pasteOpen ? (
        <section className="rounded-[var(--radius-sm)] bg-card/70 space-y-3 backdrop-blur-md">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold">사용자 제공 자막 붙여넣기</p>
              <p className="text-[10px] text-muted-foreground">YouTube 스크립트, SRT, VTT 텍스트를 넣으면 자동으로 정리해서 적용합니다.</p>
            </div>
            {lines.length > 0 && (
              <Button type="button" size="sm" variant="secondary" className="bg-secondary/90 hover:bg-secondary" onClick={() => setPasteOpen(false)}>
                닫기
              </Button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-[var(--radius)] bg-secondary/70 p-2 text-center">
              <p className="text-[10px] text-muted-foreground">감지 라인</p>
              <p className="text-xs font-semibold">{parsePreview.lines.length}</p>
            </div>
            <div className="rounded-[var(--radius)] bg-secondary/70 p-2 text-center">
              <p className="text-[10px] text-muted-foreground">타임코드</p>
              <p className="text-xs font-semibold">{parsePreview.detectedTimecodeCount}</p>
            </div>
            <div className="rounded-[var(--radius)] bg-secondary/70 p-2 text-center">
              <p className="text-[10px] text-muted-foreground">저장</p>
              <p className="text-xs font-semibold">{persistEnabled ? "ON" : "OFF"}</p>
            </div>
          </div>

          <Textarea
            rows={6}
            value={rawInput}
            className="bg-white/75 text-xs placeholder:text-[10px]"
            onChange={(e) => setRawInput(e.target.value)}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData("text");
              if (!pasted.trim()) return;
              e.preventDefault();
              applyAutoParse(pasted);
            }}
            placeholder={"예시)\n00:12 hello everyone\n00:15 today we'll...\n\n타임코드가 없어도 텍스트만 붙여넣으면 자동으로 줄 단위 정리합니다."}
          />

          {rawInput.trim() && (
            <div className="rounded-[var(--radius)] bg-muted/85 p-2 text-[11px] text-muted-foreground">
              {parsePreview.detectedTimecodeCount > 0
                ? `타임코드 ${parsePreview.detectedTimecodeCount}개가 감지되었습니다`
                : "타임코드가 없어도 텍스트 기준으로 저장됩니다"}
              {parsePreview.detectedTimecodeCount > 0 && (
                <p className="mt-1">감지한 타임코드를 기준으로 줄 분리와 구간 정렬이 적용됩니다.</p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={handleCleanPaste} disabled={!rawInput.trim()}>
              자막 적용하기
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRawInput("")}
              disabled={!rawInput.trim()}
            >
              입력 비우기
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onLinesChange([]);
                setPasteOpen(true);
                resetSelection();
                setRawInput("");
              }}
              disabled={!hasLines}
            >
              현재 자막 삭제
            </Button>
          </div>

          <div className="rounded-[var(--radius)] border border-white/55 bg-white/55 p-2">
            <label className="inline-flex">
              <input
                type="file"
                accept=".srt,.vtt,.txt,text/plain"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  handleFileUpload(file);
                  e.currentTarget.value = "";
                }}
              />
              <span className="inline-flex items-center rounded-[var(--radius)] bg-secondary px-3 py-1.5 text-xs cursor-pointer hover:bg-secondary/80">
                SRT/VTT/TXT 파일 불러오기
              </span>
            </label>
          </div>

          <p className="text-[11px] text-muted-foreground">
            붙여넣기 즉시 자동 인식이 동작하며, 저장된 자막은 기기 로컬에 유지됩니다.
          </p>
        </section>
      ) : (
        <section className="rounded-[var(--radius-sm)] border border-white/55 bg-secondary/45 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-medium">사용자 제공 자막 편집기</p>
              <p className="text-[11px] text-muted-foreground">새 자막을 붙여넣거나 파일로 다시 불러올 수 있습니다.</p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => setPasteOpen(true)}>
              열기
            </Button>
          </div>
        </section>
      )}
    </div>
  );
};

export default TranscriptPanel;
