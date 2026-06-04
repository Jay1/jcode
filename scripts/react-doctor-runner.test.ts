import { assert, describe, it } from "@effect/vitest";

import {
  buildReactDoctorInvocation,
  validateReactDoctorInvocation,
} from "./react-doctor-runner.ts";

describe("react-doctor runner", () => {
  it("builds the full scan with resource-limiting defaults", () => {
    const invocation = buildReactDoctorInvocation({ mode: "full", passthroughArgs: [] });

    assert.equal(invocation.command, "react-doctor");
    assert.deepStrictEqual(invocation.args, [
      "apps/web",
      "--yes",
      "--no-parallel",
      "--no-score",
      "--no-dead-code",
      "--fail-on",
      "none",
    ]);
    assert.equal(invocation.env.REACT_DOCTOR_PARALLEL, "0");
    assert.equal(invocation.maxRssMb, 1536);
    assert.equal(invocation.memoryGuardSupported, process.platform === "linux");
    assert.equal(invocation.env.CI, "1");
    assert.equal(invocation.env.NO_COLOR, "1");
    assert.equal(invocation.env.FORCE_COLOR, "0");
  });

  it("builds the changed-file scan with the same safety defaults", () => {
    const invocation = buildReactDoctorInvocation({ mode: "changed", passthroughArgs: [] });

    assert.deepStrictEqual(invocation.args, [
      "apps/web",
      "--yes",
      "--no-parallel",
      "--no-score",
      "--no-dead-code",
      "--diff",
      "HEAD",
      "--fail-on",
      "warning",
    ]);
  });

  it("lets callers pass extra React Doctor arguments after the safe defaults", () => {
    const invocation = buildReactDoctorInvocation({
      mode: "full",
      passthroughArgs: ["--json", "--json-compact"],
    });

    assert.deepStrictEqual(invocation.args.slice(-2), ["--json", "--json-compact"]);
  });

  it("allows changed-file scans by default", () => {
    const invocation = buildReactDoctorInvocation({ mode: "changed", passthroughArgs: [] });

    assert.deepStrictEqual(validateReactDoctorInvocation(invocation, {}), { ok: true });
  });

  it("blocks full scans unless explicitly allowed", () => {
    const invocation = buildReactDoctorInvocation({ mode: "full", passthroughArgs: [] });
    const result = validateReactDoctorInvocation(invocation, {});

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /full React Doctor scans are disabled/i);
    }
  });

  it("allows full scans with an explicit environment opt-in", () => {
    const invocation = buildReactDoctorInvocation({ mode: "full", passthroughArgs: [] });

    assert.deepStrictEqual(
      validateReactDoctorInvocation(invocation, { JCODE_REACT_DOCTOR_ALLOW_FULL: "1" }),
      { ok: true },
    );
  });
});
