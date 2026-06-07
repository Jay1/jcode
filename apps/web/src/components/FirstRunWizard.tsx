import type {
  FirstRunWizardData,
  ProviderDiscoveryKind,
  ProviderScanResult,
} from "@jcode/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { CheckIcon, Loader2Icon, TriangleAlertIcon, XIcon } from "../lib/icons";
import { ensureNativeApi } from "../nativeApi";
import { Button } from "./ui/button";

const FIRST_RUN_QUERY_KEY = ["server", "firstRunWizard"] as const;

const PROVIDER_DISPLAY_NAMES: Record<ProviderDiscoveryKind, string> = {
  codex: "Codex",
  claudeAgent: "Claude",
  cursor: "Cursor",
  gemini: "Gemini",
  kilo: "Kilo",
  opencode: "OpenCode",
  pi: "Pi",
};

function statusBadge(status: ProviderScanResult["status"]) {
  switch (status) {
    case "ready":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <CheckIcon className="size-3.5" />
          Ready
        </span>
      );
    case "needs-config":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
          <TriangleAlertIcon className="size-3.5" />
          Needs config
        </span>
      );
    case "not-installed":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <XIcon className="size-3.5" />
          Not installed
        </span>
      );
  }
}

function ProviderCard({
  result,
  selected,
  onSelect,
}: {
  result: ProviderScanResult;
  selected: boolean;
  onSelect: (provider: ProviderDiscoveryKind) => void;
}) {
  const isSelectable = result.status === "ready" || result.status === "needs-config";
  return (
    <button
      type="button"
      disabled={!isSelectable}
      onClick={() => onSelect(result.provider)}
      className={[
        "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : isSelectable
            ? "border-border hover:border-primary/50 hover:bg-muted/50"
            : "cursor-not-allowed border-border/50 bg-muted/30 opacity-60",
      ].join(" ")}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">
          {PROVIDER_DISPLAY_NAMES[result.provider]}
        </span>
        {result.version && (
          <span className="text-xs text-muted-foreground">v{result.version}</span>
        )}
      </div>
      {statusBadge(result.status)}
    </button>
  );
}

function ScanningStep() {
  return (
    <div className="flex flex-col items-center gap-4 py-12">
      <Loader2Icon className="size-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Scanning for available providers...</p>
    </div>
  );
}

function ProviderSelectionStep({
  providers,
  onComplete,
  onSkip,
}: {
  providers: ProviderScanResult[];
  onComplete: (provider: ProviderDiscoveryKind | undefined) => void;
  onSkip: () => void;
}) {
  const [selected, setSelected] = useState<ProviderDiscoveryKind | null>(null);
  const readyProviders = providers.filter((p) => p.status === "ready");

  const handleSelect = useCallback(
    (provider: ProviderDiscoveryKind) => {
      setSelected(provider === selected ? null : provider);
    },
    [selected],
  );

  const handleConfirm = useCallback(() => {
    onComplete(selected ?? undefined);
  }, [selected, onComplete]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg font-semibold text-foreground">Choose a provider</h2>
        <p className="text-sm text-muted-foreground">
          {readyProviders.length > 0
            ? `${readyProviders.length} provider${readyProviders.length !== 1 ? "s" : ""} ready to use. Select one to get started.`
            : "No providers are fully configured yet. You can skip and configure later."}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {providers.map((result) => (
          <ProviderCard
            key={result.provider}
            result={result}
            selected={selected === result.provider}
            onSelect={handleSelect}
          />
        ))}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onSkip}>
          Skip for now
        </Button>
        <Button size="sm" disabled={!selected} onClick={handleConfirm}>
          Continue
        </Button>
      </div>
    </div>
  );
}

function CompleteStep() {
  return (
    <div className="flex flex-col items-center gap-3 py-8">
      <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
        <CheckIcon className="size-6 text-emerald-600 dark:text-emerald-400" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">You&apos;re all set!</h2>
      <p className="text-sm text-muted-foreground">JCode is ready to go.</p>
    </div>
  );
}

export function FirstRunWizard() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: FIRST_RUN_QUERY_KEY,
    queryFn: async () => {
      const api = ensureNativeApi();
      return api.server.getFirstRunWizardData();
    },
    staleTime: 0,
  });

  const completeMutation = useMutation({
    mutationFn: async (provider: ProviderDiscoveryKind | undefined) => {
      const api = ensureNativeApi();
      return api.server.completeFirstRunWizard(
        provider ? { provider } : {},
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: FIRST_RUN_QUERY_KEY });
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <ScanningStep />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 py-12">
          <TriangleAlertIcon className="size-8 text-amber-500" />
          <p className="text-sm text-destructive">
            Failed to load provider scan: {(error as Error).message}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              void queryClient.refetchQueries({ queryKey: FIRST_RUN_QUERY_KEY })
            }
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const wizardData: FirstRunWizardData | undefined = data;

  if (!wizardData) return null;

  if (wizardData.state.completed || wizardData.currentStep === "complete") {
    return (
      <div className="flex h-full items-center justify-center">
        <CompleteStep />
      </div>
    );
  }

  if (wizardData.currentStep === "scanning") {
    return (
      <div className="flex h-full items-center justify-center">
        <ScanningStep />
      </div>
    );
  }

  const handleComplete = (provider: ProviderDiscoveryKind | undefined) => {
    completeMutation.mutate(provider);
  };

  const handleSkip = () => {
    completeMutation.mutate(undefined);
  };

  return (
    <div className="flex h-full items-center justify-center">
      <div className="mx-auto w-full max-w-md px-6">
        <div className="mb-8 flex flex-col items-center gap-2">
          <h1 className="text-xl font-bold text-foreground">Welcome to JCode</h1>
          <p className="text-center text-sm text-muted-foreground">
            Let&apos;s find a coding agent to get you started.
          </p>
        </div>
        <ProviderSelectionStep
          providers={wizardData.scanResults.providers}
          onComplete={handleComplete}
          onSkip={handleSkip}
        />
      </div>
    </div>
  );
}
