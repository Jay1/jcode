export type ShellStreamEventDisposition = "buffer" | "ignore" | "apply";

export function classifyShellStreamEvent(
  shellSnapshotSequence: number,
  eventSequence: number,
): ShellStreamEventDisposition {
  if (shellSnapshotSequence < 0) {
    return "buffer";
  }
  return eventSequence > shellSnapshotSequence ? "apply" : "ignore";
}
