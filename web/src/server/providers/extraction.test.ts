import { describe, expect, it } from "vitest";

import { OpenAIExtractionProvider } from "./extraction";

describe("OpenAIExtractionProvider", () => {
  it("parses JSON chat completion output into voicemail extraction fields", async () => {
    const calls: Array<{ input: Parameters<typeof fetch>[0]; init?: Parameters<typeof fetch>[1] }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ input, init });

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  caller_name: "Shaw",
                  requested_datetime: "Saturday",
                  service_requested: "full exterior and interior detail",
                  summary: "Shaw wants a full detail on Saturday."
                })
              }
            }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    };

    const provider = new OpenAIExtractionProvider({
      apiKey: "openai-test-key",
      model: "test-openai-model",
      timeoutMs: 1000,
      fetchImpl
    });

    const result = await provider.extractVoicemailDetails({
      businessId: "business_1",
      callRecordId: "call_1",
      transcript: "Hi, this is Shaw. I need a full exterior and interior detail Saturday.",
      timezone: "America/New_York"
    });

    expect(result).toEqual({
      caller_name: "Shaw",
      requested_datetime: "Saturday",
      service_requested: "full exterior and interior detail",
      summary: "Shaw wants a full detail on Saturday."
    });
    expect(calls).toHaveLength(1);
    expect(String(calls[0].input)).toBe("https://api.openai.com/v1/chat/completions");
    expect(new Headers(calls[0].init?.headers).get("authorization")).toBe(
      "Bearer openai-test-key"
    );

    const body = JSON.parse(String(calls[0].init?.body)) as {
      model: string;
      response_format: { type: string };
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.model).toBe("test-openai-model");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages.at(-1)?.content).toContain("Voicemail transcript:");
  });
});
