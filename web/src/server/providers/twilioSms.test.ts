import { describe, expect, it, vi } from "vitest";

import { TwilioSmsProvider } from "./twilioSms";

describe("TwilioSmsProvider", () => {
  it("posts to the Twilio Messages API with basic auth and a form body", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ sid: "SM123" }), { status: 201 }));
    const provider = new TwilioSmsProvider({
      accountSid: "AC_test",
      authToken: "tok_test",
      fromNumber: "+14150000000",
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    const result = await provider.sendMessage({ businessId: "b1", to: "+13105551234", body: "hello there" });

    expect(result.status).toBe("completed");
    expect(result.networkCallsMade).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url)).toContain("/Accounts/AC_test/Messages.json");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Basic ${Buffer.from("AC_test:tok_test").toString("base64")}`);
    const body = String(init.body);
    expect(body).toContain("To=%2B13105551234");
    expect(body).toContain("From=%2B14150000000");
    expect(body).toContain("Body=hello+there");
  });

  it("throws when Twilio responds with an error status", async () => {
    const fetchImpl = vi.fn(async () => new Response("bad request", { status: 400 }));
    const provider = new TwilioSmsProvider({
      accountSid: "AC_test",
      authToken: "tok_test",
      fromNumber: "+14150000000",
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    await expect(provider.sendMessage({ businessId: "b1", to: "+1", body: "x" })).rejects.toThrow(/Twilio SMS send failed/);
  });

  it("prefers a per-message from number over the configured default", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 201 }));
    const provider = new TwilioSmsProvider({
      accountSid: "AC_test",
      authToken: "tok_test",
      fromNumber: "+14150000000",
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    await provider.sendMessage({ businessId: "b1", to: "+13105551234", from: "+19998887777", body: "hi" });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(init.body)).toContain("From=%2B19998887777");
  });
});
