import { describe, expect, it } from "vitest";

import type { AutoReplyProvider, ExtractionProvider, SmsProvider } from "@/server/providers";

import {
  hasConfiguredExtractionProvider,
  selectAutoReplyProvider,
  selectExtractionProvider,
  selectSmsProvider
} from "./runtime";

const sandboxProvider: ExtractionProvider = {
  providerName: "sandbox",
  async extractVoicemailDetails() {
    return null;
  }
};

const sandboxSmsProvider: SmsProvider = {
  providerName: "sandbox",
  async sendMessage() {
    return {
      provider: "sandbox",
      status: "logged",
      action: "sms.send.logged_only",
      networkCallsMade: false
    };
  },
  async recordInboundMessage() {
    return {
      provider: "sandbox",
      status: "logged",
      action: "sms.inbound.logged_only",
      networkCallsMade: false
    };
  }
};

const sandboxAutoReplyProvider: AutoReplyProvider = {
  providerName: "sandbox",
  async generateMissedCallReply() {
    return {
      provider: "sandbox",
      status: "logged",
      action: "ai.auto_reply.logged_only",
      networkCallsMade: false,
      body: null
    };
  }
};

describe("intake runtime extraction provider selection", () => {
  it("selects OpenAI when explicitly configured", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      EXTRACTION_PROVIDER: "openai",
      OPENAI_API_KEY: "openai-test-key"
    };
    const config = {
      aiExtractionEnabled: true,
      anthropicConfigured: false,
      openAiConfigured: true
    };

    const provider = selectExtractionProvider(config, sandboxProvider, env);

    expect(provider.providerName).toBe("openai");
    expect(hasConfiguredExtractionProvider(config, env)).toBe(true);
  });

  it("prefers Anthropic when no extraction provider is configured and both keys exist", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      ANTHROPIC_API_KEY: "anthropic-test-key",
      OPENAI_API_KEY: "openai-test-key"
    };
    const config = {
      aiExtractionEnabled: true,
      anthropicConfigured: true,
      openAiConfigured: true
    };

    const provider = selectExtractionProvider(config, sandboxProvider, env);

    expect(provider.providerName).toBe("anthropic");
  });

  it("uses the sandbox provider when AI extraction is disabled even if OpenAI is configured", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      EXTRACTION_PROVIDER: "openai",
      OPENAI_API_KEY: "openai-test-key"
    };
    const config = {
      aiExtractionEnabled: false,
      anthropicConfigured: false,
      openAiConfigured: true
    };

    const provider = selectExtractionProvider(config, sandboxProvider, env);

    expect(provider.providerName).toBe("sandbox");
    expect(hasConfiguredExtractionProvider(config, env)).toBe(false);
  });
});

describe("intake runtime auto-reply provider selection", () => {
  it("selects OpenAI auto replies when explicitly configured", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      EXTRACTION_PROVIDER: "openai",
      OPENAI_API_KEY: "openai-test-key"
    };
    const config = {
      aiExtractionEnabled: true,
      anthropicConfigured: false,
      openAiConfigured: true
    };

    const provider = selectAutoReplyProvider(config, sandboxAutoReplyProvider, env);

    expect(provider.providerName).toBe("openai");
  });

  it("keeps auto replies on the sandbox provider when AI is disabled", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      EXTRACTION_PROVIDER: "openai",
      OPENAI_API_KEY: "openai-test-key"
    };
    const config = {
      aiExtractionEnabled: false,
      anthropicConfigured: false,
      openAiConfigured: true
    };

    const provider = selectAutoReplyProvider(config, sandboxAutoReplyProvider, env);

    expect(provider).toBe(sandboxAutoReplyProvider);
  });
});

describe("intake runtime SMS provider selection", () => {
  it("uses the sandbox provider when real message sending is disabled", () => {
    const provider = selectSmsProvider(
      { twilioConfigured: true, realMessageSendingEnabled: false },
      sandboxSmsProvider,
      {
        NODE_ENV: "test",
        TWILIO_ACCOUNT_SID: "AC_TEST",
        TWILIO_AUTH_TOKEN: "twilio-token",
        BUSINESS_PHONE: "+13105550199"
      }
    );

    expect(provider).toBe(sandboxSmsProvider);
  });

  it("uses the sandbox provider when Twilio credentials are missing", () => {
    const provider = selectSmsProvider(
      { twilioConfigured: false, realMessageSendingEnabled: true },
      sandboxSmsProvider,
      {
        NODE_ENV: "test",
        BUSINESS_PHONE: "+13105550199"
      }
    );

    expect(provider).toBe(sandboxSmsProvider);
  });

  it("selects Twilio when real sending and credentials are configured with BUSINESS_PHONE fallback", () => {
    const provider = selectSmsProvider(
      { twilioConfigured: true, realMessageSendingEnabled: true },
      sandboxSmsProvider,
      {
        NODE_ENV: "test",
        TWILIO_ACCOUNT_SID: "AC_TEST",
        TWILIO_AUTH_TOKEN: "twilio-token",
        BUSINESS_PHONE: "+13105550199"
      }
    );

    expect(provider.providerName).toBe("twilio");
    expect((provider as unknown as { input: { fromNumber?: string } }).input.fromNumber).toBe(
      "+13105550199"
    );
  });
});
