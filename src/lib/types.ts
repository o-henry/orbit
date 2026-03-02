export interface Clip {
  id: string;
  youtubeUrl: string;
  videoId: string;
  title?: string;
  channel?: string;
  unsplashImageUrl?: string;
  unsplashQuery?: string;
  unsplashPhotoId?: string;
  unsplashAuthorName?: string;
  unsplashAuthorLink?: string;
  durationSec?: number;
  level?: "beginner" | "intermediate" | "advanced" | string;
  tags?: string[];
  captionsAvailable?: boolean | "unknown";
  addedAt?: string;
  embeddable?: boolean;
  fitBand?: "too_easy" | "fit" | "too_hard";
  comprehensionAvg?: number;
}

export interface SegmentRef {
  clipId: string;
  videoId: string;
  startSec: number;
  endSec: number;
  label?: string;
  createdAt: number;
}

export interface MemoryItem {
  id: string;
  ref: SegmentRef;
  notes: string;
  userText?: string;
  meaningKo?: string;
  heardWords?: string[];
  topic?: "news" | "daily" | "docu" | "interview" | "lecture" | "other";
  confidence?: 1 | 2 | 3 | 4 | 5;
  supportingNotes?: Array<{
    kind: "summary" | "translation" | "hint";
    text: string;
    createdAt: number;
  }>;
  cloze?: {
    hint: string;
    blanksMeta?: {
      len: number;
    };
  };
  noticingFocus?: string;
  noticedExamples?: string[];
  aiFeedback?: {
    correction?: string;
    paraphrases?: string[];
    drills?: string[];
    source: "external-paste";
  };
  createdAt: number;
  updatedAt: number;
}

export interface SrsCard {
  id: string;
  memoryId: string;
  ease: number;
  intervalDays: number;
  dueDate: string;
  dueAt?: number;
  lastReviewedAt?: number;
}

export interface SessionLog {
  date: string;
  minutes: number;
  stepsCompleted?: {
    A?: boolean;
    B?: boolean;
    C?: boolean;
    D?: boolean;
  };
  savedCount: number;
  strandSeconds?: {
    input: number;
    output: number;
    form: number;
    fluency: number;
  };
  interactionTurns?: number;
  noticingEvents?: number;
  fluencyLoops?: number;
}

export interface UserSettings {
  language: string;
  targetLanguage: string;
  learnerLevel: "입문" | "초급" | "중급" | "고급";
  userAge: number;
  userGender: "남" | "여" | "기타" | "비공개";
  chatgptProjectUrlEn: string;
  chatgptProjectUrlJa: string;
  defaultCorrectionMode: "light" | "normal";
  goal: string;
  dailyMinutes: number;
  mode: "beginner" | "intermediate" | "advanced";
  darkMode: boolean;
  setupComplete: boolean;
}

export interface OrbitSessionPacket {
  targetLanguage: string;
  level: string;
  videoTitle: string;
  videoUrl: string;
  clipStart: string;
  clipEnd: string;
  oneLineSummaryKr: string;
  keyExpressions: string[];
  conversationGoal: string;
  correctionMode: "light" | "normal";
  storyboardNeeded: boolean;
  notes?: string;
  clipId?: string;
  videoId?: string;
  startSec?: number;
  endSec?: number;
}

export interface SessionReviewRepeatedError {
  original: string;
  natural: string;
  reason: string;
  category?: string;
}

export interface SessionReview {
  strengths: string[];
  repeatedErrors: SessionReviewRepeatedError[];
  takeawayExpressions: string[];
  nextSessionDrills: string[];
  scenes: string[];
  raw?: string;
  createdAt: number;
}

export interface StoryboardScene {
  id: string;
  title: string;
  description: string;
  coreSentence: string;
  imagePrompt: string;
  recallQuestion: string;
  imageUrl?: string;
}

export interface SessionStoryboard {
  scenes: StoryboardScene[];
  raw?: string;
  createdAt: number;
}

export type OrbitSessionStatus = "packet_ready" | "reviewed" | "storyboarded" | "queued";

export interface OrbitStudySession {
  id: string;
  targetLanguage: string;
  packet: OrbitSessionPacket;
  packetText: string;
  status: OrbitSessionStatus;
  review?: SessionReview;
  storyboard?: SessionStoryboard;
  recallQueueGeneratedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export type RecallCardType = "image_speak" | "ko_hint_speak" | "role_switch" | "fill_blank";

export interface RecallQueueCard {
  id: string;
  sessionId: string;
  language: string;
  dayOffset: 1 | 3 | 7;
  cardType: RecallCardType;
  prompt: string;
  hint?: string;
  answer: string;
  dueAt: number;
  status: "pending" | "completed";
  completedAt?: number;
  source: "review" | "storyboard";
  createdAt: number;
}

export interface WeeklyPatternReport {
  id: string;
  weekKey: string;
  language: string;
  fromDate: string;
  toDate: string;
  topErrorPatterns: string[];
  strengths: string[];
  recommendedExpressions: string[];
  recommendedScenarios: string[];
  recommendedVideoTypes: string[];
  weeklyPrompt: string;
  raw?: string;
  createdAt: number;
  updatedAt: number;
}

export type LearningStep = "B" | "C";

export const STEP_INFO: Record<LearningStep, { label: string; description: string; minutes: number; icon: string }> = {
  B: { label: "구간·메모", description: "참조 기반 표현 저장", minutes: 10, icon: "🗂️" },
  C: { label: "듣고 따라 말하기", description: "따라 말하기 연습", minutes: 7, icon: "🎙️" },
};
