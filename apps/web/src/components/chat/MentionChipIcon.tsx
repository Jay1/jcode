// FILE: MentionChipIcon.tsx
// Purpose: Shared icon renderer for file/folder mention chips. Picks between
//          the outlined folder glyph and the Seti file-type icon so the
//          composer Lexical chip (DOM) and the sent-message chip (React)
//          stay in sync.
// Layer: UI shared component
// Exports: MentionChipIcon

import { memo } from "react";
import { inferEntryKindFromPath } from "~/file-icons";
import { PlugIcon } from "~/lib/icons";
import { COMPOSER_INLINE_MENTION_CHIP_ICON_CLASS_NAME } from "../composerInlineChip";
import { FolderClosed } from "../FolderClosed";
import { FileEntryIcon } from "./FileEntryIcon";
import type { MentionChipKind } from "./MentionChipIcon.logic";

export const MentionChipIcon = memo(function MentionChipIcon(props: {
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
});
