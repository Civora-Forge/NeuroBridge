import { describe, expect, it } from "vitest";
import {
  callGeminiJson,
  extractJsonObject,
  generateScenarioContent,
  generateNpcTurn,
} from "../services/aiService";
import { NpcTurnSchema, ScenarioContentSchema } from "../types/communicationTypes";

describe("extractJsonObject", () => {
  it("parses a raw JSON object", () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it("extracts JSON wrapped in markdown fences", () => {
    const text = '```json\n{"a":1}\n```';
    expect(extractJsonObject(text)).toEqual({ a: 1 });
  });

  it("extracts JSON surrounded by prose", () => {
    const text = 'Here you go: {"a":1} thanks!';
    expect(extractJsonObject(text)).toEqual({ a: 1 });
  });

  it("returns null for invalid JSON", () => {
    expect(extractJsonObject("{oops}")).toBeNull();
    expect(extractJsonObject("no braces")).toBeNull();
    expect(extractJsonObject(null)).toBeNull();
  });
});

describe("callGeminiJson", () => {
  const schema = ScenarioContentSchema;

  it("returns ok with validated data on success", async () => {
    const scenario = {
      domain: "small_talk",
      title: "Queue chat",
      setting: "a queue",
      goal: "have a short chat",
      context: "You wait in line.",
      npc: { name: "Alex", role: "stranger", personality: "friendly" },
      openingLine: "Hello there",
      suggestedResponses: ["Hi", "Hello", "How are you?"],
      hint: "",
    };
    const fetchImpl = async () => ({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify(scenario) }] } }],
      }),
    });

    const result = await callGeminiJson("prompt", schema, { apiKey: "key", fetchImpl });
    expect(result.ok).toBe(true);
    expect(result.data.title).toBe("Queue chat");
  });

  it("returns failure when the model returns invalid JSON", async () => {
    const fetchImpl = async () => ({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "not json" }] } }],
      }),
    });
    const result = await callGeminiJson("prompt", schema, { apiKey: "key", fetchImpl });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("invalid_json");
  });

  it("returns failure when schema validation fails", async () => {
    const fetchImpl = async () => ({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"hello":"world"}' }] } }],
      }),
    });
    const result = await callGeminiJson("prompt", schema, { apiKey: "key", fetchImpl });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("schema_mismatch");
  });

  it("returns failure on HTTP error status", async () => {
    const fetchImpl = async () => ({ ok: false, status: 500 });
    const result = await callGeminiJson("prompt", schema, { apiKey: "key", fetchImpl });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("500");
  });

  it("returns failure when no api key is configured", async () => {
    const result = await callGeminiJson("prompt", schema, { apiKey: "", fetchImpl: async () => ({ ok: true, json: async () => ({}) }) });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("missing_api_key");
  });

  it("never throws on a network rejection", async () => {
    const fetchImpl = async () => {
      throw new Error("network down");
    };
    const result = await callGeminiJson("prompt", schema, { apiKey: "key", fetchImpl });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("network down");
  });
});

describe("generateScenarioContent", () => {
  it("returns null (never fabricates) when the AI is unavailable", async () => {
    const result = await generateScenarioContent({
      config: { domain: "small_talk" },
      apiKey: "key",
      fetchImpl: async () => ({ ok: false, status: 429 }),
    });
    expect(result).toBeNull();
  });

  it("returns a validated scenario when the AI responds", async () => {
    const scenario = {
      domain: "clarifying",
      title: "Meeting time",
      setting: "at work",
      goal: "confirm the meeting time",
      context: "The time was unclear.",
      npc: { name: "Sam", role: "colleague", personality: "helpful" },
      openingLine: "See you at the usual time?",
      suggestedResponses: ["Which time was that?", "Can you confirm?", "Sure, what time?"],
      hint: "",
    };
    const fetchImpl = async () => ({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify(scenario) }] } }],
      }),
    });
    const result = await generateScenarioContent({
      config: { domain: "clarifying" },
      apiKey: "key",
      fetchImpl,
    });
    expect(result).not.toBeNull();
    expect(result.domain).toBe("clarifying");
  });
});

describe("generateNpcTurn", () => {
  it("returns a valid NPC turn when the AI responds", async () => {
    const npcTurn = { line: "Sure.", followUp: "What do you think?", emotion: "friendly", done: false, hint: "" };
    const fetchImpl = async () => ({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify(npcTurn) }] } }],
      }),
    });
    const result = await generateNpcTurn({
      scenario: { title: "X", goal: "g", npc: { name: "A", role: "r", personality: "p" } },
      userTurn: "hello",
      turnIndex: 1,
      totalTurns: 4,
      apiKey: "key",
      fetchImpl,
    });
    expect(NpcTurnSchema.safeParse(result).success).toBe(true);
  });

  it("returns null when the AI output is invalid", async () => {
    const fetchImpl = async () => ({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"nope":true}' }] } }],
      }),
    });
    const result = await generateNpcTurn({ scenario: {}, userTurn: "hi", turnIndex: 1, totalTurns: 3, apiKey: "k", fetchImpl });
    expect(result).toBeNull();
  });
});
