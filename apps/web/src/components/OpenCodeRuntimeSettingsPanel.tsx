import type { OpenCodeRuntimeHealth } from "@jcode/contracts";
import { useCallback, useEffect, useState } from "react";

import { Loader2Icon, RefreshCwIcon } from "../lib/icons";
import { ensureNativeApi } from "../nativeApi";
import { Button } from "./ui/button";
import { toastManager } from "./ui/toast";

function statusClassName(status: OpenCodeRuntimeHealth["status"]): string {
  switch (status) {
    case "healthy":
      return "text-emerald-500";
    case "degraded":
    case "misconfigured":
      return "text-amber-500";
    case "unreachable":
      return "text-destructive";
    case "checking":
    case "unknown":
      return "text-muted-foreground";
  }
}

function capabilityLine(
  label: string,
  summary: { count: number; names?: readonly string[]; slugs?: readonly string[] } | undefined,
): string {
  if (!summary) return `${label}: not exposed`;
  return `${label}: ${summary.count}`;
}

export function OpenCodeRuntimeSettingsPanel() {
  const [health, setHealth] = useState<OpenCodeRuntimeHealth | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkRuntime = useCallback(async (forceRefresh = false) => {
    setIsChecking(true);
    try {
      const result = await ensureNativeApi().provider.getRuntimeHealth({
        provider: "opencode",
        forceRefresh,
      });
      setHealth(result);
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "OpenCode runtime check failed",
        description: (error as Error).message,
      });
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkRuntime(false);
  }, [checkRuntime]);

  const status = health?.status ?? "unknown";

  return (
    <div className="mt-4 rounded-lg border border-border/70 bg-muted/15 px-3 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="text-sm font-medium text-foreground">OpenCode runtime</div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className={statusClassName(status)}>{status}</span>
            {health ? <span>{health.profileLabel}</span> : null}
            {health ? <span>{health.mode}</span> : null}
          </div>
          {health?.serverUrl ? (
            <div className="break-all font-mono text-[11px] text-muted-foreground">
              {health.serverUrl}
            </div>
          ) : null}
        </div>
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={isChecking}
          onClick={() => void checkRuntime(true)}
        >
          {isChecking ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            <RefreshCwIcon className="size-3.5" />
          )}
          Check
        </Button>
      </div>

      {health ? (
        <div className="mt-3 grid gap-1 border-t border-border/70 pt-3 text-xs text-muted-foreground sm:grid-cols-2">
          <div>{capabilityLine("Commands", health.capabilities.commands)}</div>
          <div>{capabilityLine("Skills", health.capabilities.skills)}</div>
          <div>{capabilityLine("Plugins", health.capabilities.plugins)}</div>
          <div>{capabilityLine("Agents", health.capabilities.agents)}</div>
          <div>{capabilityLine("Models", health.capabilities.models)}</div>
          <div>Config: {health.configMode}</div>
        </div>
      ) : null}

      {health && health.mismatches.length > 0 ? (
        <div className="mt-3 space-y-1 border-t border-border/70 pt-3">
          {health.mismatches.slice(0, 5).map((mismatch) => (
            <div key={mismatch.id} className="text-xs text-muted-foreground">
              <span className={statusClassName(mismatch.severity === "blocking" ? "unreachable" : "degraded")}>
                {mismatch.severity}
              </span>
              <span> - {mismatch.message}</span>
            </div>
          ))}
          {health.mismatches.length > 5 ? (
            <div className="text-xs text-muted-foreground">
              {health.mismatches.length - 5} more mismatch
              {health.mismatches.length - 5 === 1 ? "" : "es"}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
