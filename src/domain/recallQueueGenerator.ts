import { OrbitStudySession, RecallCardType, RecallQueueCard } from "@/lib/types";

const CARD_TYPES: RecallCardType[] = ["image_speak", "ko_hint_speak", "role_switch", "fill_blank"];
const DAY_OFFSETS: Array<1 | 3 | 7> = [1, 3, 7];

const clampText = (value: string, fallback: string) => value.trim() || fallback;

const maskOneKeyword = (value: string): string => {
  const tokens = value.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "(빈칸 문장 없음)";
  const targetIdx = Math.max(0, Math.floor(tokens.length / 2));
  const masked = [...tokens];
  masked[targetIdx] = "____";
  return masked.join(" ");
};

const dueAtForOffset = (baseMs: number, dayOffset: 1 | 3 | 7): number => {
  const due = new Date(baseMs);
  due.setDate(due.getDate() + dayOffset);
  due.setHours(9, 0, 0, 0);
  return due.getTime();
};

const buildCard = (input: {
  session: OrbitStudySession;
  dayOffset: 1 | 3 | 7;
  cardType: RecallCardType;
  prompt: string;
  hint?: string;
  answer: string;
  source: "review" | "storyboard";
  now: number;
}): RecallQueueCard => ({
  id: `recall_${input.session.id}_${input.dayOffset}_${input.cardType}`,
  sessionId: input.session.id,
  language: input.session.targetLanguage,
  dayOffset: input.dayOffset,
  cardType: input.cardType,
  prompt: clampText(input.prompt, "다시 말해보세요."),
  hint: input.hint,
  answer: clampText(input.answer, "(정답 없음)"),
  dueAt: dueAtForOffset(input.now, input.dayOffset),
  status: "pending",
  source: input.source,
  createdAt: input.now,
});

export function generateRecallQueueCardsFromSession(session: OrbitStudySession, now = Date.now()): RecallQueueCard[] {
  const review = session.review;
  const storyboard = session.storyboard;
  const packet = session.packet;

  const baseExpressions = review?.takeawayExpressions?.length ? review.takeawayExpressions : packet.keyExpressions;
  const expression = baseExpressions[0] || packet.conversationGoal || "오늘 표현";
  const scene = storyboard?.scenes?.[0] || null;
  const firstSceneText = review?.scenes?.[0] || packet.oneLineSummaryKr || "오늘 장면";

  const cards: RecallQueueCard[] = [];

  for (const dayOffset of DAY_OFFSETS) {
    for (const cardType of CARD_TYPES) {
      if (cardType === "image_speak") {
        cards.push(
          buildCard({
            session,
            dayOffset,
            cardType,
            prompt: scene?.title || "이미지를 떠올리고 장면을 말해보세요.",
            hint: scene?.description || firstSceneText,
            answer: scene?.coreSentence || expression,
            source: scene ? "storyboard" : "review",
            now,
          })
        );
        continue;
      }

      if (cardType === "ko_hint_speak") {
        cards.push(
          buildCard({
            session,
            dayOffset,
            cardType,
            prompt: `힌트: ${packet.oneLineSummaryKr || firstSceneText}`,
            hint: packet.keyExpressions.join(", ") || undefined,
            answer: expression,
            source: "review",
            now,
          })
        );
        continue;
      }

      if (cardType === "role_switch") {
        cards.push(
          buildCard({
            session,
            dayOffset,
            cardType,
            prompt: `역할 바꿔 말하기: ${packet.conversationGoal}`,
            hint: scene?.recallQuestion || "상대 입장에서 같은 의미를 다시 말하세요.",
            answer: review?.nextSessionDrills?.[0] || expression,
            source: "review",
            now,
          })
        );
        continue;
      }

      cards.push(
        buildCard({
          session,
          dayOffset,
          cardType,
          prompt: maskOneKeyword(expression),
          hint: "빈칸을 채워 문장을 완성해 말해보세요.",
          answer: expression,
          source: "review",
          now,
        })
      );
    }
  }

  return cards;
}
