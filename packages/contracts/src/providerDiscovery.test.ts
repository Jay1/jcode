import { assert, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { ProviderSkillDescriptor } from "./providerDiscovery";

const decodeSkillDescriptor = (
  input: unknown,
): Effect.Effect<ProviderSkillDescriptor, Schema.SchemaError, never> =>
  Schema.decodeUnknownEffect(ProviderSkillDescriptor as never)(input) as Effect.Effect<
    ProviderSkillDescriptor,
    Schema.SchemaError,
    never
  >;

it.effect("decodes legacy provider skill descriptors without source or actions", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeSkillDescriptor({
      name: "code-review",
      path: "/repo/.opencode/skill/code-review/SKILL.md",
      enabled: true,
    });

    assert.strictEqual(parsed.name, "code-review");
    assert.strictEqual(parsed.path, "/repo/.opencode/skill/code-review/SKILL.md");
    assert.strictEqual(parsed.enabled, true);
    assert.strictEqual(parsed.source, undefined);
    assert.strictEqual(parsed.actions, undefined);
  }),
);

it.effect("decodes filesystem source and available uninstall action", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeSkillDescriptor({
      name: "code-review",
      path: "/repo/.opencode/skill/code-review/SKILL.md",
      enabled: true,
      source: {
        origin: "filesystem",
        location: "/repo/.opencode/skill/code-review/SKILL.md",
      },
      actions: {
        uninstall: { available: true },
      },
    });

    assert.deepStrictEqual(parsed.source, {
      origin: "filesystem",
      location: "/repo/.opencode/skill/code-review/SKILL.md",
    });
    assert.deepStrictEqual(parsed.actions, {
      uninstall: { available: true },
    });
  }),
);

it.effect("decodes builtin source and unavailable uninstall reason", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeSkillDescriptor({
      name: "customize-opencode",
      path: "opencode://skill/customize-opencode",
      enabled: true,
      source: {
        origin: "builtin",
        location: "<built-in>",
      },
      actions: {
        uninstall: {
          available: false,
          reason: "Built-in skills cannot be uninstalled.",
        },
      },
    });

    assert.deepStrictEqual(parsed.source, {
      origin: "builtin",
      location: "<built-in>",
    });
    assert.deepStrictEqual(parsed.actions, {
      uninstall: {
        available: false,
        reason: "Built-in skills cannot be uninstalled.",
      },
    });
  }),
);
