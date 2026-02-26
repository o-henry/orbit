import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  getClipById,
  getMemoryByClipId,
  getSrsCardByMemoryId,
  getStorageStatus,
  saveClip,
  saveMemoryItem,
  saveSrsCard,
} from "@/lib/storage";
import { Clip, MemoryItem, SegmentRef } from "@/lib/types";
import { getTodayDateKey } from "@/domain/srsScheduler";
import { normalizeSegmentRef } from "@/domain/refUtils";
import { TranscriptLine } from "@/domain/transcript";
import { formatTime, parseTime } from "@/domain/time";
import { getMetaValue, setMetaValue } from "@/storage/metaRepo";
import { toast } from "sonner";
import { trackSavedMemory, trackSessionEvent } from "@/lib/sessionTracker";
import { clampComprehensionRating, resolveFitBand, updateComprehensionAverage } from "@/domain/comprehension";

const TRANSCRIPT_GUIDE_DISMISSED_KEY = "dlb:transcript:guide:dismissed";
const transcriptStorageKey = (clipId: string) => `dlb:transcript:${clipId}`;
const transcriptLocalCacheKey = (clipId: string) => `dlb:transcript:cache:${clipId}`;

const MIN_LOOP_SECONDS = 2;
const DEFAULT_SEGMENT_SECONDS = 10;

type SegmentMode = "subtitle" | "time";
type SubtitleDisplayMode = "none" | "subtitle" | "slash";

const safeRange = (startSec: number, endSec: number | null): { startSec: number; endSec: number | null } => {
  const start = Math.max(0, Math.floor(startSec));
  let end = endSec === null ? null : Math.floor(endSec);

  if (end !== null && end <= start) {
    end = start + MIN_LOOP_SECONDS;
  }

  return { startSec: start, endSec: end };
};

const resolveEnd = (startSec: number, endSec: number | null): number => {
  const base = endSec ?? startSec + DEFAULT_SEGMENT_SECONDS;
  const minEnd = startSec + MIN_LOOP_SECONDS;
  return Math.max(minEnd, Math.floor(base));
};

interface LearnStateContextValue {
  loading: boolean;
  migrationRequired: boolean;
  clip: Clip | null;
  currentRef: SegmentRef | null;
  youtubeScriptUrl: string;
  persistTranscript: boolean;

  loopEnabled: boolean;
  startSec: number;
  endSec: number | null;
  effectiveEndSec: number;
  startInputRaw: string;
  endInputRaw: string;
  segmentMode: SegmentMode;
  subtitleDisplayMode: SubtitleDisplayMode;
  translationVisible: boolean;
  transcriptLines: TranscriptLine[];
  selectedTranscriptText: string;
  heardSentence: string;
  notes: string;
  confidence: 1 | 2 | 3 | 4 | 5 | undefined;
  comprehensionRating: number | undefined;
  saveError: string | null;
  embedDisabled: boolean;
  savedItems: MemoryItem[];

  shouldShowTranscriptGuide: boolean;
  showTranscriptGuide: boolean;
  showTranscriptPanel: boolean;

  setStartInputRaw: (value: string) => void;
  setEndInputRaw: (value: string) => void;
  setTranscriptLinesWithCache: (lines: TranscriptLine[]) => void;
  setSelectedTranscriptText: (text: string) => void;
  setSubtitleDisplayMode: (mode: SubtitleDisplayMode) => void;
  setTranslationVisible: (value: boolean) => void;
  setHeardSentence: (value: string) => void;
  setNotes: (value: string) => void;
  setConfidence: (value: 1 | 2 | 3 | 4 | 5 | undefined) => void;
  rateComprehension: (rating: number) => Promise<void>;
  setEmbedDisabled: (value: boolean) => void;

  applyRange: (start: number, end: number | null, options?: { requestAutoplay?: boolean }) => void;
  requestAutoplay: boolean;
  clearAutoplayFlag: () => void;

  handleStartBlur: () => void;
  handleStartFocus: () => void;
  handleEndBlur: () => void;
  handleEndFocus: () => void;
  nudgeStart: (delta: number) => void;
  nudgeEnd: (delta: number) => void;
  handleLoopToggle: (checked: boolean) => void;
  setSegmentMode: (mode: SegmentMode) => void;
  chooseCaptionsStatus: (value: true | false) => Promise<void>;

  dismissTranscriptGuide: () => void;
  reopenTranscriptGuide: () => void;
  activateTranscriptLine: (line: TranscriptLine) => void;
  activateTranscriptRange: (lines: TranscriptLine[]) => void;
  addSelectedTranscriptToHeardSentence: () => void;

  jumpToPrevSegment: () => void;
  jumpToNextSegment: () => void;

  handleSaveMemory: () => Promise<void>;
  selectSavedMemory: (item: MemoryItem) => void;
  getShadowingTextSeed: () => string;
}

const LearnStateContext = createContext<LearnStateContextValue | null>(null);

export const useLearnState = (): LearnStateContextValue => {
  const value = useContext(LearnStateContext);
  if (!value) {
    throw new Error("useLearnState must be used within LearnStateProvider");
  }
  return value;
};

interface LearnStateProviderProps {
  clipId?: string;
  children: React.ReactNode;
}

export const LearnStateProvider: React.FC<LearnStateProviderProps> = ({ clipId, children }) => {
  const location = useLocation();

  const [clip, setClip] = useState<Clip | null>(null);
  const [loading, setLoading] = useState(true);
  const [migrationRequired, setMigrationRequired] = useState(false);

  const [loopEnabled, setLoopEnabled] = useState(false);
  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState<number | null>(null);
  const [startInputRaw, setStartInputRaw] = useState("00:00");
  const [endInputRaw, setEndInputRaw] = useState("");

  const [segmentMode, setSegmentModeState] = useState<SegmentMode>("subtitle");
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([]);
  const [selectedTranscriptText, setSelectedTranscriptTextState] = useState("");

  const [heardSentence, setHeardSentence] = useState("");
  const [notes, setNotes] = useState("");
  const [confidence, setConfidence] = useState<1 | 2 | 3 | 4 | 5 | undefined>(undefined);
  const [comprehensionRating, setComprehensionRating] = useState<number | undefined>(undefined);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [embedDisabled, setEmbedDisabled] = useState(false);
  const [savedItems, setSavedItems] = useState<MemoryItem[]>([]);
  const [autoPlaySelection, setAutoPlaySelection] = useState(false);
  const [guideDismissed, setGuideDismissed] = useState(false);
  const [guideExpanded, setGuideExpanded] = useState(true);
  const [guideAutoCollapsed, setGuideAutoCollapsed] = useState(false);
  const [translationVisible, setTranslationVisible] = useState(false);
  const [subtitleDisplayMode, setSubtitleDisplayMode] = useState<SubtitleDisplayMode>("subtitle");
  const persistTranscript = true;

  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const deepLinkSegment = useMemo(() => {
    const start = Number(queryParams.get("start"));
    const end = Number(queryParams.get("end"));

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return null;
    }

    return {
      startSec: Math.max(0, Math.floor(start)),
      endSec: Math.max(2, Math.floor(end)),
    };
  }, [queryParams]);

  const requestedMode = useMemo(() => {
    const mode = (queryParams.get("mode") || "").toLowerCase();
    if (mode === "subtitle") return "subtitle" as SegmentMode;
    if (mode === "time") return "time" as SegmentMode;
    return undefined;
  }, [queryParams]);

  const setTranscriptLinesWithCache = (nextLines: TranscriptLine[]) => {
    setTranscriptLines(nextLines);
    const resolvedClipId = clipId || clip?.id;
    if (!resolvedClipId) return;
    localStorage.setItem(transcriptLocalCacheKey(resolvedClipId), JSON.stringify(nextLines));
  };

  const defaultModeForClip = (targetClip: Clip, lines: TranscriptLine[]): SegmentMode => {
    void targetClip;
    void lines;
    return "subtitle";
  };

  const syncInputs = (nextStart: number, nextEnd: number | null) => {
    setStartInputRaw(formatTime(nextStart));
    setEndInputRaw(nextEnd === null ? "" : formatTime(nextEnd));
  };

  const applyRange = (nextStart: number, nextEnd: number | null, options?: { requestAutoplay?: boolean }) => {
    const normalized = safeRange(nextStart, nextEnd);
    setStartSec(normalized.startSec);
    setEndSec(normalized.endSec);
    syncInputs(normalized.startSec, normalized.endSec);
    setAutoPlaySelection(Boolean(options?.requestAutoplay));

    if (options?.requestAutoplay) {
      const loopSeconds = resolveEnd(normalized.startSec, normalized.endSec) - normalized.startSec;
      void trackSessionEvent({ type: "segment_play", seconds: loopSeconds });
    }
  };

  const clearAutoplayFlag = () => setAutoPlaySelection(false);

  useEffect(() => {
    const loadPage = async () => {
      if (!clipId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const [status, foundClip, memories] = await Promise.all([getStorageStatus(), getClipById(clipId), getMemoryByClipId(clipId)]);

      setMigrationRequired(status.migrationRequired);
      setClip(foundClip || null);
      setComprehensionRating(foundClip?.comprehensionAvg ? clampComprehensionRating(foundClip.comprehensionAvg) : undefined);
      setSavedItems(memories.sort((a, b) => b.createdAt - a.createdAt));

      const dismissedGuide = await getMetaValue<boolean>(TRANSCRIPT_GUIDE_DISMISSED_KEY, false);
      setGuideDismissed(dismissedGuide);
      setGuideExpanded(!dismissedGuide);
      setGuideAutoCollapsed(false);

      let linesFromStorage: TranscriptLine[] = [];
      if (foundClip) {
        try {
          const parsedMeta = await getMetaValue<TranscriptLine[]>(transcriptStorageKey(foundClip.id), []);
          const metaLines = Array.isArray(parsedMeta) ? parsedMeta : [];

          let localLines: TranscriptLine[] = [];
          try {
            const rawLocal = localStorage.getItem(transcriptLocalCacheKey(foundClip.id));
            if (rawLocal) {
              const parsedLocal = JSON.parse(rawLocal);
              localLines = Array.isArray(parsedLocal) ? parsedLocal : [];
            }
          } catch {
            localLines = [];
          }

          linesFromStorage = localLines.length > metaLines.length ? localLines : metaLines;
        } catch {
          linesFromStorage = [];
        }
      }

      setTranscriptLines(linesFromStorage);
      if (foundClip?.id) {
        localStorage.setItem(transcriptLocalCacheKey(foundClip.id), JSON.stringify(linesFromStorage));
      }

      if (foundClip) {
        if (deepLinkSegment) {
          const normalized = safeRange(deepLinkSegment.startSec, deepLinkSegment.endSec);
          setStartSec(normalized.startSec);
          setEndSec(normalized.endSec);
          syncInputs(normalized.startSec, normalized.endSec);
          setLoopEnabled(true);
          setAutoPlaySelection(true);
        } else {
          setStartSec(0);
          setEndSec(null);
          syncInputs(0, null);
          setLoopEnabled(false);
        }

        if (requestedMode) {
          setSegmentModeState(requestedMode);
        } else {
          setSegmentModeState(defaultModeForClip(foundClip, linesFromStorage));
        }
      }

      setLoading(false);
    };

    void loadPage();
  }, [clipId, deepLinkSegment, requestedMode]);

  useEffect(() => {
    if (!clip?.id) return;
    if (loading) return;

    const save = async () => {
      await setMetaValue(transcriptStorageKey(clip.id), transcriptLines);
      localStorage.setItem(transcriptLocalCacheKey(clip.id), JSON.stringify(transcriptLines));
    };

    void save();
  }, [transcriptLines, clip?.id, loading]);

  useEffect(() => {
    if (guideDismissed || guideAutoCollapsed) return;
    if (transcriptLines.length > 0 && guideExpanded) {
      setGuideExpanded(false);
      setGuideAutoCollapsed(true);
    }
  }, [transcriptLines.length, guideExpanded, guideDismissed, guideAutoCollapsed]);

  const effectiveEndSec = useMemo(() => resolveEnd(startSec, endSec), [startSec, endSec]);

  const currentRef: SegmentRef | null = useMemo(() => {
    if (!clip) return null;

    return normalizeSegmentRef({
      clipId: clip.id,
      videoId: clip.videoId,
      startSec,
      endSec: effectiveEndSec,
      createdAt: Date.now(),
    });
  }, [clip, startSec, effectiveEndSec]);

  const timedLines = useMemo(
    () => transcriptLines.filter((line) => line.startSec !== undefined && line.endSec !== undefined && line.endSec > line.startSec),
    [transcriptLines]
  );

  const currentTimedIndex = useMemo(() => {
    if (timedLines.length === 0) return -1;
    for (let i = 0; i < timedLines.length; i += 1) {
      const line = timedLines[i];
      if (line.startSec === undefined || line.endSec === undefined) continue;
      if (startSec >= line.startSec && startSec < line.endSec) {
        return i;
      }
      if (line.startSec === startSec && line.endSec === effectiveEndSec) {
        return i;
      }
    }
    return -1;
  }, [timedLines, startSec, effectiveEndSec]);

  const saveMemoryAndCard = async (memory: MemoryItem) => {
    await saveMemoryItem(memory);

    const existingCard = await getSrsCardByMemoryId(memory.id);
    const dueDate = existingCard?.dueDate || getTodayDateKey();

    await saveSrsCard(
      existingCard || {
        id: existingCard?.id || `srs_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        memoryId: memory.id,
        ease: 2.3,
        intervalDays: 0,
        dueDate,
        dueAt: existingCard?.dueAt ?? Date.now(),
      }
    );

    setSavedItems((prev) => [memory, ...prev]);
    setSaveError(null);
    toast.success(`저장됨 · 다음 복습 ${dueDate}`);
  };

  const handleSaveMemory = async () => {
    if (!clip || !currentRef) return;

    const rawUserText = heardSentence.trim();
    const safeUserText = rawUserText.length > 300 ? rawUserText.slice(0, 300) : rawUserText;

    if (rawUserText.length > 300) {
      toast.warning("들은 문장이 길어 300자까지만 저장됩니다");
    }

    const cleanNotes = notes.trim();
    if (!safeUserText) {
      toast.error("자막에서 표현을 먼저 선택해주세요");
      return;
    }

    const now = Date.now();
    const memory: MemoryItem = {
      id: `mem_${now}_${Math.random().toString(36).slice(2, 7)}`,
      ref: currentRef,
      notes: cleanNotes || safeUserText,
      ...(safeUserText ? { userText: safeUserText } : {}),
      ...(confidence ? { confidence } : {}),
      createdAt: now,
      updatedAt: now,
    };

    try {
      await saveMemoryAndCard(memory);
      void trackSavedMemory({ savedCount: 1, stepsCompleted: { B: true } });
      void trackSessionEvent({ type: "ai_feedback", seconds: 12, turns: 1 });
      setHeardSentence("");
      setNotes("");
      setSelectedTranscriptTextState("");
      setConfidence(undefined);
    } catch (error) {
      console.error(error);
      const message = "저장에 실패했습니다. 다시 시도해주세요.";
      setSaveError(message);
      toast.error(message);
    }
  };

  const handleStartBlur = () => {
    const parsed = parseTime(startInputRaw);
    if (parsed === null) {
      setStartInputRaw(formatTime(startSec));
      return;
    }

    applyRange(parsed, endSec);
  };

  const handleStartFocus = () => {
    if (startInputRaw === "00:00") {
      setStartInputRaw("");
    }
  };

  const handleEndBlur = () => {
    const clean = endInputRaw.trim();
    if (!clean) {
      setEndSec(null);
      setEndInputRaw("");
      return;
    }

    const parsed = parseTime(clean);
    if (parsed === null) {
      setEndInputRaw(endSec === null ? "" : formatTime(endSec));
      return;
    }

    applyRange(startSec, parsed);
  };

  const handleEndFocus = () => {
    if (endInputRaw === "00:00") {
      setEndInputRaw("");
    }
  };

  const nudgeStart = (delta: number) => {
    applyRange(startSec + delta, endSec);
  };

  const nudgeEnd = (delta: number) => {
    const base = endSec ?? resolveEnd(startSec, endSec);
    applyRange(startSec, base + delta);
  };

  const handleLoopToggle = (checked: boolean) => {
    if (!checked) {
      setLoopEnabled(false);
      return;
    }

    const ensuredEnd = endSec ?? resolveEnd(startSec, endSec);
    applyRange(startSec, ensuredEnd);
    setLoopEnabled(true);
  };

  const chooseCaptionsStatus = async (value: true | false) => {
    void value;
  };

  const shouldShowTranscriptGuide = transcriptLines.length === 0;
  const showTranscriptGuide = shouldShowTranscriptGuide && guideExpanded;
  const showTranscriptPanel = true;

  const dismissTranscriptGuide = () => {
    setGuideDismissed(true);
    setGuideExpanded(false);
    void setMetaValue(TRANSCRIPT_GUIDE_DISMISSED_KEY, true);
  };

  const reopenTranscriptGuide = () => {
    setGuideExpanded(true);
  };

  const setSegmentMode = (mode: SegmentMode) => {
    setSegmentModeState(mode);
    if (mode === "subtitle" && !guideDismissed) {
      setGuideExpanded(true);
    }
  };

  const rateComprehension = async (rating: number) => {
    if (!clip) return;
    const safeRating = clampComprehensionRating(rating);
    const nextAverage = updateComprehensionAverage(clip.comprehensionAvg, safeRating);
    const nextBand = resolveFitBand(nextAverage);
    const updatedClip: Clip = {
      ...clip,
      comprehensionAvg: nextAverage,
      fitBand: nextBand,
    };

    setComprehensionRating(safeRating);
    setClip(updatedClip);
    try {
      await saveClip(updatedClip);
    } catch {
      toast.error("이해도 저장에 실패했습니다. 다시 시도해주세요.");
    }
  };

  const syncSelectedExpression = (text: string) => {
    const selected = text.trim();
    setSelectedTranscriptTextState(selected);
    setHeardSentence(selected);
  };

  const activateTranscriptLine = (line: TranscriptLine) => {
    syncSelectedExpression(line.text);
    void trackSessionEvent({ type: "transcript_activate", seconds: 8, noticingCount: 1 });

    if (line.startSec === undefined) return;

    const nextStart = line.startSec;
    const nextEnd = line.endSec !== undefined ? line.endSec : line.startSec + DEFAULT_SEGMENT_SECONDS;
    setLoopEnabled(true);
    applyRange(nextStart, nextEnd, { requestAutoplay: true });
  };

  const activateTranscriptRange = (lines: TranscriptLine[]) => {
    const joined = lines.map((line) => line.text).join(" ").trim();
    syncSelectedExpression(joined);
    void trackSessionEvent({ type: "transcript_activate", seconds: Math.max(8, lines.length * 3), noticingCount: 1 });

    const firstStart = lines.find((line) => line.startSec !== undefined)?.startSec;
    const lastEnd = [...lines].reverse().find((line) => line.endSec !== undefined)?.endSec;

    if (firstStart !== undefined) {
      setLoopEnabled(true);
      applyRange(firstStart, lastEnd ?? firstStart + DEFAULT_SEGMENT_SECONDS, { requestAutoplay: true });
    }
  };

  const addSelectedTranscriptToHeardSentence = () => {
    if (!selectedTranscriptText.trim()) return;
    setHeardSentence(selectedTranscriptText.trim());
  };

  const jumpToTimedIndex = (index: number) => {
    if (timedLines.length === 0) return;
    const line = timedLines[Math.max(0, Math.min(index, timedLines.length - 1))];
    if (!line || line.startSec === undefined) return;

    const nextEnd = line.endSec ?? line.startSec + DEFAULT_SEGMENT_SECONDS;
    setSelectedTranscriptTextState(line.text);
    setLoopEnabled(true);
    applyRange(line.startSec, nextEnd, { requestAutoplay: true });
  };

  const jumpBySeconds = (delta: number) => {
    const duration = effectiveEndSec - startSec;
    const nextStart = Math.max(0, startSec + delta);
    applyRange(nextStart, nextStart + duration, { requestAutoplay: true });
  };

  const jumpToPrevSegment = () => {
    void trackSessionEvent({ type: "segment_nav", seconds: 5 });
    if (timedLines.length === 0) {
      jumpBySeconds(-5);
      return;
    }

    if (currentTimedIndex > 0) {
      jumpToTimedIndex(currentTimedIndex - 1);
      return;
    }

    let fallbackIndex = 0;
    for (let i = 0; i < timedLines.length; i += 1) {
      const candidate = timedLines[i];
      if (candidate.startSec !== undefined && candidate.startSec < startSec) {
        fallbackIndex = i;
      }
    }
    jumpToTimedIndex(fallbackIndex);
  };

  const jumpToNextSegment = () => {
    void trackSessionEvent({ type: "segment_nav", seconds: 5 });
    if (timedLines.length === 0) {
      jumpBySeconds(5);
      return;
    }

    if (currentTimedIndex >= 0 && currentTimedIndex < timedLines.length - 1) {
      jumpToTimedIndex(currentTimedIndex + 1);
      return;
    }

    let fallbackIndex = timedLines.length - 1;
    for (let i = 0; i < timedLines.length; i += 1) {
      const candidate = timedLines[i];
      if (candidate.startSec !== undefined && candidate.startSec > startSec) {
        fallbackIndex = i;
        break;
      }
    }

    jumpToTimedIndex(fallbackIndex);
  };

  const selectSavedMemory = (item: MemoryItem) => {
    setLoopEnabled(true);
    applyRange(item.ref.startSec, item.ref.endSec, { requestAutoplay: true });
  };

  const getShadowingTextSeed = () => {
    const matchedSavedText = savedItems.find((item) => item.ref.startSec === startSec && item.ref.endSec === effectiveEndSec);
    return (
      heardSentence.trim() ||
      selectedTranscriptText.trim() ||
      notes.trim() ||
      matchedSavedText?.userText?.trim() ||
      matchedSavedText?.notes?.trim() ||
      ""
    );
  };

  const youtubeScriptUrl = clip ? clip.youtubeUrl || `https://www.youtube.com/watch?v=${clip.videoId}` : "";

  const value: LearnStateContextValue = {
    loading,
    migrationRequired,
    clip,
    currentRef,
    youtubeScriptUrl,
    persistTranscript,

    loopEnabled,
    startSec,
    endSec,
    effectiveEndSec,
    startInputRaw,
    endInputRaw,
    segmentMode,
    subtitleDisplayMode,
    translationVisible,
    transcriptLines,
    selectedTranscriptText,
    heardSentence,
    notes,
    confidence,
    comprehensionRating,
    saveError,
    embedDisabled,
    savedItems,

    shouldShowTranscriptGuide,
    showTranscriptGuide,
    showTranscriptPanel,

    setStartInputRaw,
    setEndInputRaw,
    setTranscriptLinesWithCache,
    setSelectedTranscriptText: syncSelectedExpression,
    setSubtitleDisplayMode,
    setTranslationVisible,
    setHeardSentence,
    setNotes,
    setConfidence,
    rateComprehension,
    setEmbedDisabled,

    applyRange,
    requestAutoplay: autoPlaySelection,
    clearAutoplayFlag,

    handleStartBlur,
    handleStartFocus,
    handleEndBlur,
    handleEndFocus,
    nudgeStart,
    nudgeEnd,
    handleLoopToggle,
    setSegmentMode,
    chooseCaptionsStatus,

    dismissTranscriptGuide,
    reopenTranscriptGuide,
    activateTranscriptLine,
    activateTranscriptRange,
    addSelectedTranscriptToHeardSentence,

    jumpToPrevSegment,
    jumpToNextSegment,

    handleSaveMemory,
    selectSavedMemory,
    getShadowingTextSeed,
  };

  return <LearnStateContext.Provider value={value}>{children}</LearnStateContext.Provider>;
};
