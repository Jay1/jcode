import { AuthHttpRoutes } from "@jcode/contracts";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";

import { APP_DISPLAY_NAME } from "../branding";
import { addSavedConnectionFromPairing } from "../connection/savedConnectionManager";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toastManager } from "../components/ui/toast";
import { Loader2Icon } from "../lib/icons";
import { getPairingTokenFromUrl, stripPairingTokenFromUrl } from "../pairingUrl";

export const Route = createFileRoute("/pair")({
  component: PairRoute,
});

async function bootstrapSameOrigin(credential: string): Promise<void> {
  const response = await fetch(AuthHttpRoutes.bootstrap.pathname, {
    method: AuthHttpRoutes.bootstrap.method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      readonly error?: unknown;
    } | null;
    throw new Error(
      typeof payload?.error === "string"
        ? payload.error
        : `Pairing failed with status ${response.status}.`,
    );
  }
}

function hasRemoteHost(url: string): boolean {
  try {
    return new URL(url).searchParams.has("host");
  } catch {
    return false;
  }
}

export function PairRoute() {
  const initialCredential = useMemo(() => getPairingTokenFromUrl(window.location.href) ?? "", []);
  const [credential, setCredential] = useState(initialCredential);
  const [status, setStatus] = useState<"idle" | "pairing" | "paired" | "error">(
    initialCredential ? "pairing" : "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const submitPairing = useCallback(async (value: string) => {
    const nextCredential = value.trim();
    if (!nextCredential) return;
    setStatus("pairing");
    setError(null);
    try {
      if (hasRemoteHost(window.location.href)) {
        await addSavedConnectionFromPairing({ pairingUrl: window.location.href });
        window.history.replaceState(
          null,
          "",
          stripPairingTokenFromUrl(window.location.href).toString(),
        );
        toastManager.add({ type: "success", title: "Remote backend paired" });
        window.location.assign("/");
        return;
      }

      await bootstrapSameOrigin(nextCredential);
      window.history.replaceState(
        null,
        "",
        stripPairingTokenFromUrl(window.location.href).toString(),
      );
      setStatus("paired");
      toastManager.add({ type: "success", title: "Client paired" });
      window.location.assign("/");
    } catch (caught) {
      setError((caught as Error).message);
      setStatus("error");
    }
  }, []);

  const hasSubmittedRef = useRef(false);
  if (initialCredential && !hasSubmittedRef.current) {
    hasSubmittedRef.current = true;
    void submitPairing(initialCredential);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-md space-y-5 rounded-lg border border-border/70 p-6">
        <div>
          <h1 className="text-xl font-semibold">{APP_DISPLAY_NAME} pairing</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the pairing code from Connections to authorize this browser.
          </p>
        </div>

        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submitPairing(credential);
          }}
        >
          <Input
            value={credential}
            onChange={(event) => setCredential(event.target.value)}
            placeholder="Pairing code"
            autoComplete="one-time-code"
            autoFocus
          />
          <Button type="submit" className="w-full" disabled={status === "pairing"}>
            {status === "pairing" ? <Loader2Icon className="mr-2 size-4 animate-spin" /> : null}
            Pair client
          </Button>
        </form>

        {status === "paired" ? (
          <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-300">
            Pairing complete.
          </div>
        ) : null}
        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}
      </div>
    </main>
  );
}
