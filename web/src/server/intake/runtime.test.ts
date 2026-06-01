import { describe, expect, it } from "vitest";

import type { ExtractionProvider } from "@/server/providers";

import { hasConfiguredExtractionProvider, selectExtractionProvider } from "./runtime";

const sandboxProvider: ExtractionProvider = {
  providerName: "sandbox",
  async extractVoicemailDetails() {
    return null;
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
