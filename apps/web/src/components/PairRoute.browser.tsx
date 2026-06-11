import "../index.css";

import { page } from "vitest/browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

const redirectAfterPairingMock = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    createFileRoute: () => (config: unknown) => config,
  };
});

describe("PairRoute", () => {
  beforeEach(() => {
    redirectAfterPairingMock.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ authenticated: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
    document.body.innerHTML = "";
  });

  it("submits a manually entered pairing code to the current backend", async () => {
    window.history.replaceState(null, "", "/pair");
    const { PairRoute } = await import("../routes/pair");

    const screen = await render(<PairRoute redirectAfterPairing={redirectAfterPairingMock} />);

    await page.getByPlaceholder("Pairing code").fill("MANUAL-CODE");
    await page.getByRole("button", { name: "Pair client" }).click();

    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/auth/bootstrap",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ credential: "MANUAL-CODE" }),
        }),
      );
      expect(redirectAfterPairingMock).toHaveBeenCalledTimes(1);
    });

    await screen.unmount();
  });

  it("auto-submits hash tokens and strips them from the address bar", async () => {
    window.history.replaceState(null, "", "/pair#token=AUTO-CODE");
    const { PairRoute } = await import("../routes/pair");

    const screen = await render(<PairRoute redirectAfterPairing={redirectAfterPairingMock} />);

    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/auth/bootstrap",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ credential: "AUTO-CODE" }),
        }),
      );
      expect(window.location.hash).toBe("");
      expect(redirectAfterPairingMock).toHaveBeenCalledTimes(1);
    });

    await screen.unmount();
  });
});
