import { useCallback } from "react";

import type { ThreadRecap as ThreadRecapType, ThreadId } from "@jcode/contracts";

import { useAutoThreadRecapRefresh } from "../hooks/useAutoThreadRecapRefresh";
import { useThreadRecap } from "../hooks/useThreadRecap";
import { readNativeApi } from "../nativeApi";
import type { ChatMessage } from "../types";
import { cn } from "~/lib/utils";
import { Button } from "./ui/button";

interface ThreadForRecapPanel {
  id: ThreadId;
  title: string;
  messages: ChatMessage[];
  activities: ReadonlyArray<{
    kind: string;
    summary: string;
    createdAt: string;
  }>;
  recap?: ThreadRecapType | null;
  session: { status?: string | null } | null | undefined;
}

export function ThreadRecapPanel({ thread }: { thread: ThreadForRecapPanel | null | undefined }) {
  const nativeApi = readNativeApi() ?? null;
  const { recap, generateRecap, isGenerating, error } = useThreadRecap(thread, nativeApi);
  useAutoThreadRecapRefresh({ thread, generateRecap, isGenerating });

  const handleGenerate = useCallback(() => {
    void generateRecap();
  }, [generateRecap]);

  if (!thread) return null;

  const hasRecap = recap != null && recap.length > 0;

  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-card/50 px-3 py-2">
      {hasRecap && <p className="text-xs leading-relaxed text-muted-foreground">{recap}</p>}

      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button
        variant="ghost"
        size="sm"
        className={cn("h-6 gap-1.5 text-[11px]", hasRecap && "text-muted-foreground")}
        onClick={handleGenerate}
        disabled={isGenerating}
      >
        {isGenerating ? (
          <>
            <span className="inline-block size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Generating...
          </>
        ) : hasRecap ? (
          "Refresh recap"
        ) : (
          "Generate recap"
        )}
      </Button>
    </div>
  );
}
