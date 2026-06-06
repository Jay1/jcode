export const PROJECT_HEADER_ICON_SIZE_CLASS = "size-[18px]";

export function getProjectHeaderIconClassName(): string {
  return "sidebar-project-header-icon relative inline-flex size-5 shrink-0 items-center justify-center text-[var(--app-chat-heading,var(--color-text-foreground-secondary))]";
}
