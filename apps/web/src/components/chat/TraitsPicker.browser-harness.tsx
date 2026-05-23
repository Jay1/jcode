import { type ModelSelection, type ProviderModelDescriptor, type ThreadId } from "@jcode/contracts";
import { useCallback } from "react";

import {
  useComposerDraftStore,
  useComposerThreadDraft,
  useEffectiveComposerModelState,
} from "../../composerDraftStore";
import { TraitsPicker } from "./TraitsPicker";

export function ClaudeTraitsPickerHarness(props: {
  threadId: ThreadId;
  model: string;
  fallbackModelSelection: ModelSelection | null;
}) {
  const prompt = useComposerThreadDraft(props.threadId).prompt;
  const setPrompt = useComposerDraftStore((store) => store.setPrompt);
  const { modelOptions, selectedModel } = useEffectiveComposerModelState({
    threadId: props.threadId,
    selectedProvider: "claudeAgent",
    threadModelSelection: props.fallbackModelSelection,
    projectModelSelection: null,
    customModelsByProvider: {
      codex: [],
      claudeAgent: [],
      cursor: [],
      gemini: [],
      kilo: [],
      opencode: [],
      pi: [],
    },
  });
  const handlePromptChange = useCallback(
    (nextPrompt: string) => {
      setPrompt(props.threadId, nextPrompt);
    },
    [props.threadId, setPrompt],
  );

  return (
    <TraitsPicker
      provider="claudeAgent"
      threadId={props.threadId}
      model={selectedModel ?? props.model}
      prompt={prompt}
      modelOptions={modelOptions?.claudeAgent}
      onPromptChange={handlePromptChange}
    />
  );
}

export function OpenCodeTraitsPickerHarness(props: {
  threadId: ThreadId;
  model: string;
  runtimeModel?: ProviderModelDescriptor;
  fallbackModelSelection: ModelSelection | null;
}) {
  const prompt = useComposerThreadDraft(props.threadId).prompt;
  const setPrompt = useComposerDraftStore((store) => store.setPrompt);
  const { modelOptions, selectedModel } = useEffectiveComposerModelState({
    threadId: props.threadId,
    selectedProvider: "opencode",
    threadModelSelection: props.fallbackModelSelection,
    projectModelSelection: null,
    customModelsByProvider: {
      codex: [],
      claudeAgent: [],
      cursor: [],
      gemini: [],
      kilo: [],
      opencode: [],
      pi: [],
    },
  });
  const handlePromptChange = useCallback(
    (nextPrompt: string) => {
      setPrompt(props.threadId, nextPrompt);
    },
    [props.threadId, setPrompt],
  );

  return (
    <TraitsPicker
      provider="opencode"
      threadId={props.threadId}
      model={selectedModel ?? props.model}
      runtimeModel={props.runtimeModel}
      prompt={prompt}
      modelOptions={modelOptions?.opencode}
      onPromptChange={handlePromptChange}
    />
  );
}
