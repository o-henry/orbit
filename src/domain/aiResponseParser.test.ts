import { describe, expect, it } from "vitest";
import { parseAiResponse } from "@/domain/aiResponseParser";

describe("parseAiResponse", () => {
  it("parses sectioned Korean response", () => {
    const parsed = parseAiResponse(`\n교정\n- I am go -> I am going\n바꿔말하기\n- I am heading out\n- I am on my way\n드릴\n- Repeat 3 times\n- Say with stress\n`);

    expect(parsed.feedback?.correction).toContain("I am go");
    expect(parsed.feedback?.paraphrases?.length).toBe(2);
    expect(parsed.feedback?.drills?.length).toBe(2);
  });

  it("falls back when headers are missing", () => {
    const parsed = parseAiResponse("fix this sentence\nparaphrase one\nparaphrase two\ndrill one");
    expect(parsed.feedback?.correction).toBe("fix this sentence");
    expect(parsed.feedback?.paraphrases?.length).toBeGreaterThan(0);
  });

  it("returns error for empty input", () => {
    const parsed = parseAiResponse("   ");
    expect(parsed.feedback).toBeNull();
    expect(parsed.error).toBeTruthy();
  });
});
