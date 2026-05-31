import { describe, expect, it } from "vitest";

import { createSandboxProviders, type SandboxProviderLog } from "./sandbox";

describe("BACKEND-04 sandbox providers", () => {
  it("logs SMS actions without sending messages", async () => {
    const logs: SandboxProviderLog[] = [];
    const providers = createSandboxProviders((entry) => logs.push(entry));

    const result = await providers.sms.sendMessage({
      businessId: "business_1",
      to: "+15551234567",
      body: "Sandbox only"
    });

    expect(result).toMatchObject({
      provider: "sandbox",
      status: "logged",
      networkCallsMade: false
    });
    expect(logs[0].action).toBe("sms.send.logged_only");
  });

  it("logs call, transcription, and storage actions without network calls", async () => {
    const logs: SandboxProviderLog[] = [];
    const providers = createSandboxProviders((entry) => logs.push(entry));

    const call = await providers.calls.recordIncomingCall({
      businessId: "business_1",
      from: "+15551234567",
      to: "+15557654321"
    });
    const transcription = await providers.transcription.transcribeRecording({
      businessId: "business_1",
      recordingUrl: "https://example.test/recording"
    });
    const storage = await providers.storage.saveObject({
      businessId: "business_1",
      key: "recordings/test.wav"
    });

    expect(call.networkCallsMade).toBe(false);
    expect(transcription.transcript).toBeNull();
    expect(transcription.networkCallsMade).toBe(false);
    expect(storage.storageUrl).toBe("sandbox://storage/business_1/recordings/test.wav");
    expect(storage.networkCallsMade).toBe(false);
    expect(logs.map((entry) => entry.action)).toEqual([
      "call.incoming.logged_only",
      "transcription.logged_only",
      "storage.save.logged_only"
    ]);
  });

  it("builds safe Dial TwiML without provider network calls", () => {
    const providers = createSandboxProviders();

    const twiml = providers.calls.buildDialTwiml({
      ownerPhoneE164: "+12133734253",
      actionUrl: "/api/webhooks/twilio/voice/status",
      timeoutSeconds: 18
    });

    expect(twiml).toContain("<Response>");
    expect(twiml).toContain('<Dial timeout="18" action="/api/webhooks/twilio/voice/status">+12133734253</Dial>');
  });
});
