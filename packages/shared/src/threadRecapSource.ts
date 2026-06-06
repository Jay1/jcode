// Adapted from Synara threadRecap.ts (commit ff69476)

import type { OrchestrationMessage, OrchestrationThreadActivity } from "@jcode/contracts";

const MAX_RECAP_MESSAGES = 6;
const MAX_DELTA_MESSAGES = 4;
const MAX_MESSAGE_CHARS = 600;
const MAX_ACTIVITY_CHARS = 140;
const MAX_MATERIAL_CHARS = 4_000;
const MAX_STATE_CHARS = 1_500;
const MAX_RECAP_CHARS = 240;
const PREFERRED_RECAP_MIN = 150;
const PREFERRED_RECAP_MAX = 190;

export interface ThreadRecapSource {
  readonly hasNewMaterial: boolean;
  readonly latestMessageId: string | null;
  readonly newMaterial: string;
  readonly currentState: string;
}

export interface DeriveThreadRecapSourceInput {
  readonly messages: ReadonlyArray<Pick<OrchestrationMessage, "id" | "role" | "text">>;
  readonly activities: ReadonlyArray<
    Pick<OrchestrationThreadActivity, "kind" | "summary" | "createdAt">
  >;
  readonly title: string;
  readonly previousCoveredMessageId?: string | null;
}

export interface BuildThreadRecapPromptInput {
  readonly previousRecap?: string;
  readonly newMaterial: string;
  readonly currentState?: string;
}

function isUserFacing(msg: Pick<OrchestrationMessage, "id" | "role" | "text">): boolean {
  return msg.role === "user" || msg.role === "assistant";
}

function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return value.slice(0, max - 1) + "…";
}

export function deriveThreadRecapSource(input: DeriveThreadRecapSourceInput): ThreadRecapSource {
  const { messages, activities, previousCoveredMessageId } = input;

  const userFacing = messages.filter(isUserFacing);

  let slice: ReadonlyArray<Pick<OrchestrationMessage, "id" | "role" | "text">>;

  if (!previousCoveredMessageId) {
    slice = userFacing.slice(-MAX_RECAP_MESSAGES);
  } else {
    // Delta recap — take messages after the covered ID.
    const coveredIdx = userFacing.findIndex((m) => m.id === previousCoveredMessageId);
    if (coveredIdx === -1) {
      slice = userFacing.slice(-MAX_DELTA_MESSAGES);
    } else {
      slice = userFacing.slice(coveredIdx + 1, coveredIdx + 1 + MAX_DELTA_MESSAGES);
    }
  }

  const lines = slice.map((m) => `[${m.role}] ${truncate(m.text, MAX_MESSAGE_CHARS)}`);
  let newMaterial = lines.join("\n");
  if (newMaterial.length > MAX_MATERIAL_CHARS) {
    newMaterial = newMaterial.slice(0, MAX_MATERIAL_CHARS) + "…";
  }

  const recentActivities = activities.slice(-4).map((a) => truncate(a.summary, MAX_ACTIVITY_CHARS));
  let currentState = recentActivities.join("\n");
  if (currentState.length > MAX_STATE_CHARS) {
    currentState = currentState.slice(0, MAX_STATE_CHARS) + "…";
  }

  const latestMessageId = slice.length > 0 ? slice[slice.length - 1]!.id : null;

  return {
    hasNewMaterial: newMaterial.length > 0,
    latestMessageId,
    newMaterial,
    currentState,
  };
}

const RECAP_PREFIX_RE = /^recap\s*:\s*/i;

export function sanitizeThreadRecap(raw: string, previousRecap?: string): string {
  let cleaned = raw.replace(RECAP_PREFIX_RE, "").replace(/\s+/g, " ").trim();

  if (!cleaned && previousRecap) {
    cleaned = previousRecap.trim();
  }

  if (!cleaned) {
    return "No meaningful recap yet.";
  }

  if (cleaned.length > MAX_RECAP_CHARS) {
    cleaned = cleaned.slice(0, MAX_RECAP_CHARS - 3) + "...";
  }

  return cleaned;
}

export function buildThreadRecapPrompt(input: BuildThreadRecapPromptInput): { prompt: string } {
  const parts: string[] = [];

  parts.push(
    "You are a JCode thread recap generator. Your job is to produce a concise summary of what is happening in a coding session thread.",
  );
  parts.push(
    `The recap MUST be a single paragraph, ${PREFERRED_RECAP_MIN}-${PREFERRED_RECAP_MAX} characters long.`,
  );
  parts.push("Start with the current work area or task. Include the likely next step at the end.");
  parts.push("Do not use markdown, headers, bullet points, or quotation marks. Plain text only.");
  parts.push('Do not start with "The user" or "The assistant". Write as a factual status update.');

  if (input.previousRecap) {
    parts.push(`Previous recap: ${input.previousRecap}`);
  }

  if (input.currentState) {
    parts.push(`Current state: ${input.currentState}`);
  }

  parts.push(`New material:\n${input.newMaterial}`);

  return { prompt: parts.join("\n\n") };
}
