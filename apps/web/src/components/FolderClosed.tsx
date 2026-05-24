// FILE: FolderClosed.tsx
// Purpose: Shared closed-folder glyph used by the sidebar and sidebar command palette.
// Exports: FolderClosed

import type { SVGProps } from "react";

export function FolderClosed(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M9.13 3.75H4.75C3.65 3.75 2.75 4.65 2.75 5.75V17.25C2.75 18.35 3.65 19.25 4.75 19.25H19.25C20.35 19.25 21.25 18.35 21.25 17.25V7.75C21.25 6.65 20.35 5.75 19.25 5.75H12.81C12.29 5.75 11.79 5.55 11.42 5.18L10.53 4.32C10.15 3.95 9.65 3.75 9.13 3.75Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2.75 12.75V11.75C2.75 10.65 3.65 9.75 4.75 9.75H19.25C20.35 9.75 21.25 10.65 21.25 11.75V12.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
