import { memo } from "react";

import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { formatCompactDiffCount, formatDiffStatAccessibleLabel } from "./DiffStatLabel.logic";

export const DiffStatLabel = memo(function DiffStatLabel(props: {
  additions: number;
  deletions: number;
  showParentheses?: boolean;
}) {
  const { additions, deletions, showParentheses = false } = props;
  const exactLabel = formatDiffStatAccessibleLabel(additions, deletions);
  const compactAdditions = `+${formatCompactDiffCount(additions)}`;
  const compactDeletions = `-${formatCompactDiffCount(deletions)}`;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span aria-label={exactLabel} className="inline align-middle" data-diff-stat-label>
            {showParentheses ? (
              <span aria-hidden="true" className="text-muted-foreground/70">
                (
              </span>
            ) : null}
            <span
              aria-hidden="true"
              className="font-chat-code inline-grid grid-cols-[4ch_4ch] gap-1 text-right tabular-nums align-middle"
              data-diff-stat-grid
            >
              <span
                aria-hidden="true"
                className="flex min-w-0 justify-end text-success"
                data-diff-stat-additions
              >
                <span
                  className="inline-block origin-right"
                  data-diff-stat-additions-glyph
                  style={compactGlyphStyle(compactAdditions)}
                >
                  {compactAdditions}
                </span>
              </span>
              <span
                aria-hidden="true"
                className="flex min-w-0 justify-end text-destructive"
                data-diff-stat-deletions
              >
                <span
                  className="inline-block origin-right"
                  data-diff-stat-deletions-glyph
                  style={compactGlyphStyle(compactDeletions)}
                >
                  {compactDeletions}
                </span>
              </span>
            </span>
            {showParentheses ? (
              <span aria-hidden="true" className="text-muted-foreground/70">
                )
              </span>
            ) : null}
          </span>
        }
      />
      <TooltipPopup side="top">{exactLabel}</TooltipPopup>
    </Tooltip>
  );
});

function compactGlyphStyle(value: string): { readonly transform: string } {
  const scale = Math.min(1, 4 / value.length);
  return { transform: `scaleX(${scale})` };
}
