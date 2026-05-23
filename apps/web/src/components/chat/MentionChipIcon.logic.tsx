import { renderToStaticMarkup } from "react-dom/server";
import { getFileIconUrlForEntry, inferEntryKindFromPath } from "~/file-icons";
import { FileIcon, PlugIcon } from "~/lib/icons";
import { COMPOSER_INLINE_MENTION_CHIP_ICON_CLASS_NAME } from "../composerInlineChip";
import { FolderClosed } from "../FolderClosed";

export type MentionChipKind = "path" | "plugin";

const FOLDER_CLOSED_ICON_SVG = renderToStaticMarkup(
  <FolderClosed aria-hidden="true" className={COMPOSER_INLINE_MENTION_CHIP_ICON_CLASS_NAME} />,
);
const FILE_ICON_SVG = renderToStaticMarkup(
  <FileIcon aria-hidden="true" className={COMPOSER_INLINE_MENTION_CHIP_ICON_CLASS_NAME} />,
);
const PLUG_ICON_SVG = renderToStaticMarkup(
  <PlugIcon aria-hidden="true" className={COMPOSER_INLINE_MENTION_CHIP_ICON_CLASS_NAME} />,
);

function createStaticIconSpan(svg: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.ariaHidden = "true";
  span.className = COMPOSER_INLINE_MENTION_CHIP_ICON_CLASS_NAME;
  const svgDocument = new DOMParser().parseFromString(svg, "image/svg+xml");
  const svgElement = svgDocument.documentElement;
  if (svgElement.nodeName.toLowerCase() === "svg") {
    span.appendChild(document.importNode(svgElement, true));
  }
  return span;
}

export function createMentionChipIconElement(
  path: string,
  theme: "light" | "dark",
  kind: MentionChipKind = "path",
): HTMLElement {
  if (kind === "plugin" || path.startsWith("plugin://")) {
    return createStaticIconSpan(PLUG_ICON_SVG);
  }
  if (inferEntryKindFromPath(path) === "directory") {
    return createStaticIconSpan(FOLDER_CLOSED_ICON_SVG);
  }
  const image = document.createElement("img");
  image.alt = "";
  image.ariaHidden = "true";
  image.className = COMPOSER_INLINE_MENTION_CHIP_ICON_CLASS_NAME;
  image.loading = "lazy";
  image.src = getFileIconUrlForEntry(path, "file", theme);
  image.addEventListener(
    "error",
    () => {
      image.replaceWith(createStaticIconSpan(FILE_ICON_SVG));
    },
    { once: true },
  );
  return image;
}
