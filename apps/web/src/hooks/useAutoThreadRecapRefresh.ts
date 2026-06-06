import { useEffect, useMemo, useRef } from "react";

import type { ThreadRecap as ThreadRecapType } from "@jcode/contracts";
import { deriveThreadRecapSource } from "@jcode/shared/threadRecapSource";

import type { ChatMessage } from "../types";

const AUTO_THREAD_RECAP_REFRESH_DELAY_MS = 1_200;

interface ThreadForAutoRecapRefresh {
  id: string;
  title: string;
  messages: ChatMessage[];
  activities: ReadonlyArray<{
    kind: string;
    summary: string;
    createdAt: string;
  }>;
  recap: ThreadRecapType | null | undefined;
  session: { status?: string | null } | null | undefined;
}

export interface ShouldAutoRefreshThreadRecapInput {
  readonly hasThread: boolean;
  readonly hasNewMaterial: boolean;
  readonly isGenerating: boolean;
  readonly sessionRunning: boolean;
  readonly sourceSignature: string | null;
  readonly recapSourceSignature: string | null | undefined;
}

export function shouldAutoRefreshThreadRecap(input: ShouldAutoRefreshThreadRecapInput): boolean {
  if (!input.hasThread || input.isGenerating || input.sessionRunning || !input.hasNewMaterial) {
    return false;
  }
  return input.sourceSignature !== null && input.sourceSignature !== input.recapSourceSignature;
}

export function useAutoThreadRecapRefresh(input: {
  readonly thread: ThreadForAutoRecapRefresh | null | undefined;
  readonly isGenerating: boolean;
  readonly generateRecap: () => Promise<string | null>;
}) {
  const generateRecapRef = useRef(input.generateRecap);
  const lastRequestedSignatureRef = useRef<string | null>(null);
  generateRecapRef.current = input.generateRecap;

  const source = useMemo(() => {
    const { thread } = input;
    if (!thread) {
      return null;
    }
    return deriveThreadRecapSource({
      messages: thread.messages.map((message) => ({
        id: message.id,
        role: message.role,
        text: message.text,
      })),
      activities: thread.activities.map((activity) => ({
        kind: activity.kind,
        summary: activity.summary,
        createdAt: activity.createdAt,
      })),
      title: thread.title,
      previousCoveredMessageId: thread.recap?.coveredMessageId ?? null,
    });
  }, [input.thread]);

  const shouldRefresh = shouldAutoRefreshThreadRecap({
    hasThread: input.thread != null,
    hasNewMaterial: source?.hasNewMaterial ?? false,
    isGenerating: input.isGenerating,
    sessionRunning: input.thread?.session?.status === "running",
    sourceSignature: source?.sourceSignature ?? null,
    recapSourceSignature: input.thread?.recap?.sourceSignature,
  });

  useEffect(() => {
    const sourceSignature = source?.sourceSignature ?? null;
    if (!shouldRefresh || sourceSignature === lastRequestedSignatureRef.current) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      lastRequestedSignatureRef.current = sourceSignature;
      void generateRecapRef.current();
    }, AUTO_THREAD_RECAP_REFRESH_DELAY_MS);
    return () => window.clearTimeout(timeoutId);
  }, [shouldRefresh, source?.sourceSignature]);
}
