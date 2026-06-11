import { describe, expect, it } from "vitest";

import { scrubOpenClawGatewayDiagnostic } from "./openclawGatewayClient";

describe("scrubOpenClawGatewayDiagnostic", () => {
  it("redacts auth tokens, credentials, query strings, and fragments", () => {
    const scrubbed = scrubOpenClawGatewayDiagnostic(
      "gateway rejected token=must-not-leak password=also-secret Bearer bearer-secret at https://user:pass@gateway.example.test/path?token=query-secret#fragment",
    );

    expect(scrubbed).toBe(
      "gateway rejected token=<redacted> password=<redacted> Bearer <redacted> at https://gateway.example.test/path",
    );
    expect(scrubbed).not.toContain("must-not-leak");
    expect(scrubbed).not.toContain("also-secret");
    expect(scrubbed).not.toContain("bearer-secret");
    expect(scrubbed).not.toContain("user:pass");
    expect(scrubbed).not.toContain("query-secret");
  });
});
