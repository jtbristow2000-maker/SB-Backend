import { describe, expect, it } from "vitest";

import { OpenAIAutoReplyProvider, buildAutoReplyPrompt } from "./autoReply";
import type { AutoReplyInput } from "./types";

const baseInput: AutoReplyInput = {
  businessId: "business_1",
  businessName: "Detail Test Co",
  customerName: "Shaw",
  transcript: "Hi, this is Shaw. I need a full detail Saturday.",
  callerSummary: "Shaw wants a full detail Saturday.",
  requestedDatetime: "Saturday",
  serviceRequested: "full detail",
  priceLabel: "$120-$180",
  openSlots: ["Sat Jun 13, 10:00 AM", "Sat Jun 13, 2:00 PM"],
  level: 3,
  tone: { formality: 2, warmth: 4 },
  customNote: "Ask about monthly maintenance.",
  signOff: "Mike"
};

describe("OpenAIAutoReplyProvider", () => {
  it("posts the missed-call reply prompt and parses the generated SMS body", async () => {
    const calls: Array<{ input: Parameters<typeof fetch>[0]; init?: Parameters<typeof fetch>[1] }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ input, init });

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  "Hey Shaw, sorry we missed you. A full detail usually runs $120-$180. We have Sat at 10 or 2. - Mike"
              }
            }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    };
    const provider = new OpenAIAutoReplyProvider({
      apiKey: "openai-test-key",
      model: "test-reply-model",
      timeoutMs: 1000,
      fetchImpl
    });

    const result = await provider.generateMissedCallReply(baseInput);

    expect(result).toMatchObject({
      provider: "openai",
      status: "completed",
      action: "ai.auto_reply.completed",
      networkCallsMade: true,
      body:
        "Hey Shaw, sorry we missed you. A full detail usually runs $120-$180. We have Sat at 10 or 2. - Mike"
    });
    expect(calls).toHaveLength(1);
    expect(String(calls[0].input)).toBe("https://api.openai.com/v1/chat/completions");
    expect(new Headers(calls[0].init?.headers).get("authorization")).toBe(
      "Bearer openai-test-key"
    );

    const body = JSON.parse(String(calls[0].init?.body)) as {
      model: string;
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.model).toBe("test-reply-model");
    expect(body.messages.at(-1)?.content).toContain("Reply level: 3");
    expect(body.messages.at(-1)?.content).toContain("Price label: $120-$180");
  });

  it("omits service, price, and slots from level 1 prompts", () => {
    const prompt = buildAutoReplyPrompt({
      ...baseInput,
      level: 1,
      serviceRequested: null,
      priceLabel: null,
      openSlots: []
    });

    expect(prompt).toContain("Include service details: no");
    expect(prompt).toContain("Service requested: do not mention");
    expect(prompt).toContain("Include price: no");
    expect(prompt).toContain("Open times: do not mention");
  });
});
