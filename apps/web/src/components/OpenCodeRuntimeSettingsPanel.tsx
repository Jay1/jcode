import type {
  ManagedSidecarDiagnostics,
  ManagedSidecarHealthCheck,
  OpenCodeRuntimeHealth,
  ProviderRuntimeBootstrapSnapshot,
} from "@jcode/contracts";
import { useCallback, useEffect, useState } from "react";

import { DownloadIcon, HammerIcon, Loader2Icon, RefreshCwIcon, WrenchIcon } from "../lib/icons";
import { cn } from "../lib/utils";
import { ensureNativeApi } from "../nativeApi";
import { Button } from "./ui/button";
import { toastManager } from "./ui/toast";

type SidecarAction = "health" | "repair" | "diagnostics";

interface SidecarFeedback {
  readonly status: "success" | "failed";
  readonly message: string;
}

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

function sidecarStatusClassName(status: ManagedSidecarHealthCheck["status"]): string {
  switch (status) {
    case "healthy":
      return "text-emerald-500";
    case "degraded":
    case "not_running":
    case "repairing":
      return "text-amber-500";
    case "unhealthy":
      return "text-destructive";
  }
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

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function downloadManagedSidecarDiagnostics(diagnostics: ManagedSidecarDiagnostics): void {
  const payload = JSON.stringify(diagnostics, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const objectUrl = URL.createObjectURL(blob);
  const generatedAt = diagnostics.generatedAt.replace(/[:.]/g, "-");

  try {
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `jcode-managed-sidecar-diagnostics-${generatedAt}.json`;
    link.rel = "noopener";
    link.click();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function OpenCodeRuntimeSettingsPanel() {
  const [health, setHealth] = useState<OpenCodeRuntimeHealth | null>(null);
  const [sidecarHealth, setSidecarHealth] = useState<ManagedSidecarHealthCheck | null>(null);
  const [sidecarFeedback, setSidecarFeedback] = useState<SidecarFeedback | null>(null);
  const [sidecarPendingAction, setSidecarPendingAction] = useState<SidecarAction | null>(null);
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
        description: errorMessage(error, "The runtime health check failed."),
      });
    } finally {
      setIsChecking(false);
    }
  }, []);

  const checkSidecarHealth = useCallback(async () => {
    setSidecarPendingAction("health");
    setSidecarFeedback(null);
    try {
      const result = await ensureNativeApi().provider.getManagedSidecarHealth();
      setSidecarHealth(result);
      setSidecarFeedback({ status: "success", message: `Sidecar: ${result.status}` });
    } catch (error) {
      const message = `Sidecar health check failed: ${errorMessage(
        error,
        "The managed sidecar health check failed.",
      )}`;
      setSidecarFeedback({ status: "failed", message });
      toastManager.add({
        type: "error",
        title: "Sidecar health check failed",
        description: errorMessage(error, "The managed sidecar health check failed."),
      });
    } finally {
      setSidecarPendingAction(null);
    }
  }, []);

  const repairSidecar = useCallback(async () => {
    setSidecarPendingAction("repair");
    setSidecarFeedback(null);
    try {
      const result = await ensureNativeApi().provider.repairManagedSidecar({
        forceRedownload: false,
      });
      setSidecarHealth(result.health);
      setSidecarFeedback({
        status: result.success ? "success" : "failed",
        message: result.success
          ? "Repair succeeded"
          : `Repair failed${result.error ? `: ${result.error}` : ""}`,
      });
    } catch (error) {
      const message = `Repair failed: ${errorMessage(error, "The managed sidecar repair failed.")}`;
      setSidecarFeedback({ status: "failed", message });
      toastManager.add({
        type: "error",
        title: "Sidecar repair failed",
        description: errorMessage(error, "The managed sidecar repair failed."),
      });
    } finally {
      setSidecarPendingAction(null);
    }
  }, []);

  const exportSidecarDiagnostics = useCallback(async () => {
    setSidecarPendingAction("diagnostics");
    setSidecarFeedback(null);
    try {
      const diagnostics = await ensureNativeApi().provider.exportManagedSidecarDiagnostics();
      downloadManagedSidecarDiagnostics(diagnostics);
      setSidecarHealth(diagnostics.health);
      setSidecarFeedback({ status: "success", message: "Diagnostics exported" });
    } catch (error) {
      const message = `Diagnostics export failed: ${errorMessage(
        error,
        "The managed sidecar diagnostics export failed.",
      )}`;
      setSidecarFeedback({ status: "failed", message });
      toastManager.add({
        type: "error",
        title: "Diagnostics export failed",
        description: errorMessage(error, "The managed sidecar diagnostics export failed."),
      });
    } finally {
      setSidecarPendingAction(null);
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
        description: errorMessage(error, "The OpenCode runtime bootstrap status check failed."),
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
        description: errorMessage(error, "The OpenCode runtime install failed."),
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
        description: errorMessage(error, "The OpenCode runtime repair failed."),
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
          <div>Profile ID: {health.profileId}</div>
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

      <div className="mt-3 space-y-3 border-t border-border/70 pt-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="text-sm font-medium text-foreground">Managed sidecar</div>
            <div className="text-xs text-muted-foreground">
              Check, repair, or export diagnostics for the managed OpenCode sidecar.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={sidecarPendingAction !== null}
              onClick={() => void checkSidecarHealth()}
            >
              {sidecarPendingAction === "health" ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <RefreshCwIcon className="size-3.5" />
              )}
              Check sidecar health
            </Button>
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={sidecarPendingAction !== null}
              onClick={() => void repairSidecar()}
            >
              {sidecarPendingAction === "repair" ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <HammerIcon className="size-3.5" />
              )}
              Repair sidecar
            </Button>
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={sidecarPendingAction !== null}
              onClick={() => void exportSidecarDiagnostics()}
            >
              {sidecarPendingAction === "diagnostics" ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <DownloadIcon className="size-3.5" />
              )}
              Export diagnostics
            </Button>
          </div>
        </div>

        {sidecarFeedback ? (
          <p
            role={sidecarFeedback.status === "failed" ? "alert" : "status"}
            aria-live="polite"
            className={cn(
              "rounded-xl border px-3 py-2 text-xs",
              sidecarFeedback.status === "failed"
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-border bg-background/70 text-muted-foreground",
            )}
          >
            {sidecarFeedback.message}
          </p>
        ) : null}

        {sidecarHealth ? (
          <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
            <div>
              Sidecar:{" "}
              <span className={sidecarStatusClassName(sidecarHealth.status)}>
                {sidecarHealth.status}
              </span>
            </div>
            <div>State: {sidecarHealth.sidecarState}</div>
            <div>{sidecarHealth.serverReachable ? "Server reachable" : "Server unreachable"}</div>
            <div>{sidecarHealth.binaryValid ? "Binary valid" : "Binary invalid"}</div>
            {sidecarHealth.serverUrl ? (
              <div className="break-all font-mono text-[11px] sm:col-span-2">
                {sidecarHealth.serverUrl}
              </div>
            ) : null}
            {sidecarHealth.error ? (
              <div className="text-destructive sm:col-span-2">Error: {sidecarHealth.error}</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
