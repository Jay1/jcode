import {
  DEFAULT_MODEL_BY_PROVIDER,
  type ModelSelection,
  type ProviderKind,
  type ProviderWithDefaultModel,
  type ServerSettings,
  type ServerSettingsPatch,
} from "@jcode/contracts";
import { deepMerge, type DeepPartial } from "./Struct";

function shouldReplaceTextGenerationModelSelection(
  patch: ServerSettingsPatch["textGenerationModelSelection"] | undefined,
): boolean {
  return Boolean(patch && (patch.provider !== undefined || patch.model !== undefined));
}

function providerHasDefaultModel(provider: ProviderKind): provider is ProviderWithDefaultModel {
  return provider !== "openclaw" && provider !== "pi";
}

function sanitizeOpenClawGatewayUrl(value: string | undefined): string | undefined {
  if (value === undefined || value.trim().length === 0) {
    return value;
  }
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    const withoutQueryOrFragment = trimmed.split(/[?#]/, 1)[0] ?? "";
    return withoutQueryOrFragment.replace(/^([a-zA-Z][a-zA-Z\d+.-]*:\/\/)([^/@\s]+@)(.*)$/, "$1$3");
  }
}

function normalizeTextGenerationSelection(selection: ModelSelection): ModelSelection {
  if (providerHasDefaultModel(selection.provider)) {
    return selection;
  }
  return { provider: "codex", model: DEFAULT_MODEL_BY_PROVIDER.codex };
}

function stripOpenClawServerMetadata(patch: ServerSettingsPatch): ServerSettingsPatch {
  const openclaw = patch.providers?.openclaw;
  if (openclaw === undefined || (!("hasSecret" in openclaw) && !("paired" in openclaw))) {
    return patch;
  }

  const openclawRecord = openclaw as Record<string, unknown>;
  const { hasSecret: _hasSecret, paired: _paired, ...clientOpenClaw } = openclawRecord;
  return {
    ...patch,
    providers: {
      ...patch.providers,
      openclaw: clientOpenClaw,
    },
  } as ServerSettingsPatch;
}

export function applyServerSettingsPatch(
  current: ServerSettings,
  patch: ServerSettingsPatch,
): ServerSettings {
  const sanitizedPatch = stripOpenClawServerMetadata(patch);
  const selectionPatch = sanitizedPatch.textGenerationModelSelection;
  const merged = deepMerge(current, sanitizedPatch as DeepPartial<ServerSettings>);
  const sanitizedOpenClawGatewayUrl = merged.providers.openclaw.gatewayUrl
    ? (sanitizeOpenClawGatewayUrl(merged.providers.openclaw.gatewayUrl) ?? "")
    : merged.providers.openclaw.gatewayUrl;
  const next = {
    ...merged,
    providers: {
      ...merged.providers,
      openclaw: {
        ...merged.providers.openclaw,
        gatewayUrl: sanitizedOpenClawGatewayUrl,
      },
    },
  };
  if (!selectionPatch) {
    return {
      ...next,
      textGenerationModelSelection: normalizeTextGenerationSelection(
        next.textGenerationModelSelection,
      ),
    };
  }

  const provider = selectionPatch.provider ?? current.textGenerationModelSelection.provider;
  const model =
    selectionPatch.model ??
    (selectionPatch.provider &&
    providerHasDefaultModel(selectionPatch.provider) &&
    selectionPatch.provider !== current.textGenerationModelSelection.provider
      ? DEFAULT_MODEL_BY_PROVIDER[selectionPatch.provider]
      : current.textGenerationModelSelection.model);
  const options = shouldReplaceTextGenerationModelSelection(selectionPatch)
    ? selectionPatch.options
    : (selectionPatch.options ?? current.textGenerationModelSelection.options);

  return {
    ...next,
    textGenerationModelSelection: normalizeTextGenerationSelection({
      provider,
      model,
      ...(options !== undefined ? { options } : {}),
    } as ModelSelection),
  };
}
