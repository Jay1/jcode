// FILE: MentionChipIcon.tsx
// Purpose: React icon renderer for file/folder mention chips.
// Layer: UI shared component

import { inferEntryKindFromPath } from "~/file-icons";
import { PlugIcon } from "~/lib/icons";
import { COMPOSER_INLINE_MENTION_CHIP_ICON_CLASS_NAME } from "../composerInlineChip";
import { FolderClosed } from "../FolderClosed";
import { FileEntryIcon } from "./FileEntryIcon";
import type { MentionChipKind } from "./MentionChipIcon.dom";

export type { MentionChipKind } from "./MentionChipIcon.dom";

export function MentionChipIcon(props: {
  path: string;
  theme: "light" | "dark";
  kind?: MentionChipKind;
}) {
  if (props.kind === "plugin" || props.path.startsWith("plugin://")) {
    return <PlugIcon className={COMPOSER_INLINE_MENTION_CHIP_ICON_CLASS_NAME} />;
  }
  const kind = inferEntryKindFromPath(props.path);
  if (kind === "directory") {
    return <FolderClosed className={COMPOSER_INLINE_MENTION_CHIP_ICON_CLASS_NAME} />;
  }
  // Delegate file rendering to FileEntryIcon so we inherit the onError
  // fallback that swaps to the Lucide FileIcon if the Seti asset is missing.
  return (
    <FileEntryIcon
      pathValue={props.path}
      kind={kind}
      theme={props.theme}
      className={COMPOSER_INLINE_MENTION_CHIP_ICON_CLASS_NAME}
    />
  );
}
