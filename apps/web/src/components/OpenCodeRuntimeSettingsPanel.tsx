import type { OpenCodeRuntimeHealth, ProviderRuntimeBootstrapSnapshot } from "@jcode/contracts";
import { useCallback, useEffect, useState } from "react";

import { DownloadIcon, Loader2Icon, RefreshCwIcon, WrenchIcon } from "../lib/icons";
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

function bootstrapStatusClassName(state: ProviderRuntimeBootstrapSnapshot["state"]): string {
  switch (state) {
    case "ready":
      return "text-emerald-500";
    case "installing":
    case "starting":
      return "text-amber-500";
    case "error":
      return "text-destructive";
    case "notInstalled":
    case "unsupported":
      return "text-muted-foreground";
  }
}

export function OpenCodeRuntimeSettingsPanel() {
  const [health, setHealth] = useState<OpenCodeRuntimeHealth | null>(null);
  const [bootstrapStatus, setBootstrapStatus] = useState<ProviderRuntimeBootstrapSnapshot | null>(
    null,
  );
  const [isChecking, setIsChecking] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [bootstrapAction, setBootstrapAction] = useState<"install" | "repair" | null>(null);

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

  const checkBootstrapStatus = useCallback(async () => {
    try {
      const result = await ensureNativeApi().provider.getRuntimeBootstrapStatus({
        provider: "opencode",
      });
      setBootstrapStatus(result);
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "OpenCode runtime bootstrap status failed",
        description: (error as Error).message,
      });
    }
  }, []);

  useEffect(() => {
    void Promise.all([checkRuntime(false), checkBootstrapStatus()]);
  }, [checkBootstrapStatus, checkRuntime]);

  const installRuntime = useCallback(async () => {
    setIsBootstrapping(true);
    setBootstrapAction("install");
    try {
      const result = await ensureNativeApi().provider.bootstrapRuntime({ provider: "opencode" });
      setBootstrapStatus(result);
      await checkRuntime(true);
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "OpenCode runtime install failed",
        description: (error as Error).message,
      });
    } finally {
      setIsBootstrapping(false);
      setBootstrapAction(null);
    }
  }, [checkRuntime]);

  const repairRuntime = useCallback(async () => {
    setIsBootstrapping(true);
    setBootstrapAction("repair");
    try {
      const result = await ensureNativeApi().provider.repairRuntime({ provider: "opencode" });
      setBootstrapStatus(result);
      await checkRuntime(true);
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "OpenCode runtime repair failed",
        description: (error as Error).message,
      });
    } finally {
      setIsBootstrapping(false);
      setBootstrapAction(null);
    }
  }, [checkRuntime]);

  const status = health?.status ?? "unknown";
  const bootstrapMessage = bootstrapStatus?.message ?? null;

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
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {bootstrapStatus?.state === "notInstalled" ? (
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={isBootstrapping}
              onClick={() => void installRuntime()}
            >
              {bootstrapAction === "install" ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <DownloadIcon className="size-3.5" />
              )}
              Install OpenCode runtime
            </Button>
          ) : null}
          {bootstrapStatus?.state === "error" ? (
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={isBootstrapping}
              onClick={() => void repairRuntime()}
            >
              {bootstrapAction === "repair" ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <WrenchIcon className="size-3.5" />
              )}
              Repair runtime
            </Button>
          ) : null}
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
      </div>

      {bootstrapStatus ? (
        <div className="mt-3 border-t border-border/70 pt-3 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className={bootstrapStatusClassName(bootstrapStatus.state)}>
              Bootstrap: {bootstrapStatus.state}
            </span>
            {bootstrapStatus.serviceName ? <span>{bootstrapStatus.serviceName}</span> : null}
          </div>
          {bootstrapMessage ? <div className="mt-1">{bootstrapMessage}</div> : null}
        </div>
      ) : null}

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
              <span
                className={statusClassName(
                  mismatch.severity === "blocking" ? "unreachable" : "degraded",
                )}
              >
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
