import { describe, expect, it } from "vitest";
import { parseReviewOutput, parseStoryboardOutput, parseWeeklyOutput } from "@/domain/sessionStructuredParser";

describe("sessionStructuredParser", () => {
  it("parses REVIEW sections", () => {
    const raw = [
      "1. 오늘 잘한 점 2개",
      "- 흐름을 끊지 않고 대화함",
      "- 핵심 표현 재사용",
      "2. 반복 오류 3개",
      "- 내가 한 말: I am go",
      "- 더 자연스러운 말: I am going",
      "- 왜 중요한지: 진행형 정확도",
      "3. 오늘 가져갈 표현 5개",
      "- on my way",
      "4. 다음 세션에서 일부러 써볼 문장 3개",
      "- Could you clarify that?",
      "5. 오늘의 장면 3개",
      "- 회의에서 일정 조율",
    ].join("\n");

    const parsed = parseReviewOutput(raw);
    expect(parsed.data).toBeTruthy();
    expect(parsed.data?.repeatedErrors).toHaveLength(1);
    expect(parsed.data?.takeawayExpressions[0]).toContain("on my way");
  });

  it("returns error when REVIEW required sections are missing", () => {
    const parsed = parseReviewOutput("1. 오늘 잘한 점\n- 잘함");
    expect(parsed.data).toBeNull();
    expect(parsed.error).toContain("누락");
  });

  it("parses STORYBOARD with mixed labels", () => {
    const raw = [
      "장면 제목: 아침 스탠드업",
      "장면 설명: 버그 상황 공유",
      "핵심 문장: We need a hotfix.",
      "이미지 프롬프트: office standup, laptop, whiteboard",
      "회상 질문: 왜 hotfix가 필요했지?",
      "장면 제목: PR 리뷰",
      "장면 설명: 변경사항 설명",
      "핵심 문장: Please check line 42.",
      "이미지 프롬프트: code review on monitor",
      "회상 질문: 어떤 변경을 요청했지?",
    ].join("\n");

    const parsed = parseStoryboardOutput(raw);
    expect(parsed.data).toBeTruthy();
    expect(parsed.data?.length).toBe(2);
    expect(parsed.data?.[0].title).toContain("아침");
  });

  it("parses WEEKLY sections", () => {
    const raw = [
      "1. 이번 주 핵심 패턴 3개",
      "- 시제",
      "2. 유지해야 할 강점 2개",
      "- 대화 지속",
      "3. 다음 주 목표 표현 10개",
      "- in the meantime",
      "4. 다음 주 추천 시나리오 5개",
      "- 버그 설명",
      "5. 다음 주 추천 영상 유형 3개",
      "- 개발자 인터뷰",
    ].join("\n");

    const parsed = parseWeeklyOutput(raw);
    expect(parsed.data).toBeTruthy();
    expect(parsed.data?.topErrorPatterns[0]).toBe("시제");
    expect(parsed.data?.recommendedScenarios[0]).toContain("버그");
  });
});
