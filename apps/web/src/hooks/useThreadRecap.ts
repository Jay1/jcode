import { useCallback, useRef, useState } from "react";

import type { ThreadRecap as ThreadRecapType, ThreadId } from "@jcode/contracts";
import type { NativeApi } from "@jcode/contracts";

import { deriveThreadRecapSource } from "@jcode/shared/threadRecapSource";

import type { ChatMessage } from "../types";

interface ThreadForRecap {
  id: ThreadId;
  title: string;
  messages: ChatMessage[];
  activities: ReadonlyArray<{
    kind: string;
    summary: string;
    createdAt: string;
  }>;
  recap?: ThreadRecapType | null | undefined;
}

export interface UseThreadRecapResult {
  recap: string | null;
  generateRecap: () => Promise<string | null>;
  isGenerating: boolean;
  error: string | null;
}

export function useThreadRecap(
  thread: ThreadForRecap | null | undefined,
  nativeApi: NativeApi | null | undefined,
): UseThreadRecapResult {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedRecap, setGeneratedRecap] = useState<string | null>(null);

  const generationIdRef = useRef(0);

  const recap = generatedRecap ?? thread?.recap?.text ?? null;

  const generateRecap = useCallback(async (): Promise<string | null> => {
    if (!thread || !nativeApi) {
      return null;
    }

    const generationId = ++generationIdRef.current;
    setIsGenerating(true);
    setError(null);

    try {
      const source = deriveThreadRecapSource({
        messages: thread.messages.map((m) => ({
          id: m.id,
          role: m.role,
          text: m.text,
        })),
        activities: thread.activities.map((a) => ({
          kind: a.kind,
          summary: a.summary,
          createdAt: a.createdAt,
        })),
        title: thread.title,
        previousCoveredMessageId: thread.recap?.coveredMessageId ?? null,
      });

      if (!source.hasNewMaterial) {
        setIsGenerating(false);
        return thread.recap?.text ?? null;
      }

      const result = await nativeApi.server.generateThreadRecap({
        threadId: thread.id as import("@jcode/contracts").ThreadId,
        previousRecap: thread.recap?.text ?? undefined,
        newMaterial: source.newMaterial,
        currentState: source.currentState || undefined,
      });

      if (generationId !== generationIdRef.current) {
        return null;
      }

      setGeneratedRecap(result.recap);
      setIsGenerating(false);
      return result.recap;
    } catch (err) {
      if (generationId !== generationIdRef.current) {
        return null;
      }
      const message = err instanceof Error ? err.message : "Failed to generate recap";
      setError(message);
      setIsGenerating(false);
      return null;
    }
  }, [thread, nativeApi]);

  return { recap, generateRecap, isGenerating, error };
}
