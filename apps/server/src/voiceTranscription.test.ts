// FILE: voiceTranscription.test.ts
// Purpose: Verifies ChatGPT-session voice transcription behavior without contacting OpenAI.
// Layer: Server test
// Exports: Vitest cases
// Depends on: voiceTranscription utility and mocked fetch responses.

import type { ServerVoiceTranscriptionInput } from "@jcode/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  transcribeVoiceWithChatGptSession,
  VoiceTranscriptionAuthExpiredError,
} from "./voiceTranscription";

const WAV_BASE64 = Buffer.from("RIFF0000WAVE", "ascii").toString("base64");

const baseRequest: ServerVoiceTranscriptionInput = {
  provider: "codex",
  cwd: "/tmp/project",
  mimeType: "audio/wav",
  sampleRateHz: 24_000,
  durationMs: 1_000,
  audioBase64: WAV_BASE64,
};

describe("transcribeVoiceWithChatGptSession", () => {
  it("uses the ChatGPT transcription backend", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ text: "hello" }), { status: 200 }),
    ) as unknown as typeof fetch;

    await transcribeVoiceWithChatGptSession({
      request: baseRequest,
      resolveAuth: async () => ({ token: "chatgpt-token" }),
      fetchImpl,
    });

    const [url, init] = vi.mocked(fetchImpl).mock.calls[0]!;
    expect(url).toBe("https://chatgpt.com/backend-api/transcribe");
    if (!init) throw new Error("Expected fetch init.");
    expect((init.body as FormData).get("model")).toBeNull();
  });

  it("refreshes the ChatGPT session once when the upload is unauthorized", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ text: "hello" }), { status: 200 }));
    const resolveAuth = vi.fn(async (refreshToken: boolean) => ({
      token: refreshToken ? "fresh-chatgpt-token" : "stale-chatgpt-token",
    }));

    await transcribeVoiceWithChatGptSession({
      request: baseRequest,
      resolveAuth,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(resolveAuth).toHaveBeenNthCalledWith(1, false);
    expect(resolveAuth).toHaveBeenNthCalledWith(2, true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("marks rejected ChatGPT auth after refresh as auth-expired", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockResolvedValueOnce(new Response("{}", { status: 403 }));

    await expect(
      transcribeVoiceWithChatGptSession({
        request: baseRequest,
        resolveAuth: async (refreshToken) => ({
          token: refreshToken ? "fresh-chatgpt-token" : "stale-chatgpt-token",
        }),
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ code: "auth-expired" });
  });

  it("marks missing ChatGPT auth tokens as auth-expired", async () => {
    await expect(
      transcribeVoiceWithChatGptSession({
        request: baseRequest,
        resolveAuth: async () => {
          throw new VoiceTranscriptionAuthExpiredError("No ChatGPT session token is available.");
        },
        fetchImpl: vi.fn() as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ code: "auth-expired" });
  });
});
