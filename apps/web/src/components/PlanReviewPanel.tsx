import { memo, useCallback, useRef, useState } from "react";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Textarea } from "./ui/textarea";
import { XIcon, MessageCircleIcon, SquarePenIcon, Trash2, CheckIcon } from "~/lib/icons";
import ChatMarkdown from "./ChatMarkdown";
import {
  buildPlanReviewComposerMarkdown,
  type PlanAnnotation,
} from "../planReview";

interface PlanReviewPanelProps {
  planTitle: string | null;
  planMarkdown: string;
  cwd: string | undefined;
  annotations: PlanAnnotation[];
  onAddAnnotation: (comment: string, quote: string | null) => void;
  onUpdateAnnotation: (id: string, comment: string, quote: string | null) => void;
  onDeleteAnnotation: (id: string) => void;
  onDone: (composerMarkdown: string) => void;
  onClose: () => void;
}

export const PlanReviewPanel = memo(function PlanReviewPanel({
  planTitle,
  planMarkdown,
  cwd,
  annotations,
  onAddAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onDone,
  onClose,
}: PlanReviewPanelProps) {
  const [quote, setQuote] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editComment, setEditComment] = useState("");
  const [editQuote, setEditQuote] = useState<string | null>(null);
  const planRef = useRef<HTMLDivElement>(null);

  const handleSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const text = selection.toString().trim();
    if (text.length > 0 && text.length < 2000) {
      setQuote(text);
    }
  }, []);

  const handleAdd = useCallback(() => {
    if (comment.trim().length === 0) return;
    onAddAnnotation(comment, quote);
    setComment("");
    setQuote(null);
  }, [comment, quote, onAddAnnotation]);

  const handleStartEdit = useCallback((annotation: PlanAnnotation) => {
    setEditingId(annotation.id);
    setEditComment(annotation.comment);
    setEditQuote(annotation.quote);
  }, []);

  const handleSaveEdit = useCallback(
    (id: string) => {
      if (editComment.trim().length === 0) return;
      onUpdateAnnotation(id, editComment, editQuote);
      setEditingId(null);
    },
    [editComment, editQuote, onUpdateAnnotation],
  );

  const handleDone = useCallback(() => {
    const md = buildPlanReviewComposerMarkdown(planTitle, annotations);
    onDone(md);
  }, [planTitle, annotations, onDone]);

  return (
    <div className="flex h-full w-[400px] shrink-0 flex-col border-l border-border/70 bg-card/50">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/60 px-3">
        <div className="flex items-center gap-2">
          <MessageCircleIcon className="size-4 text-[var(--color-accent-blue)]" />
          <span className="text-sm font-medium">Review</span>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={handleDone} className="text-xs">
            Done
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={onClose}
            aria-label="Close review panel"
            className="text-muted-foreground/50 hover:text-foreground/70"
          >
            <XIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-3 space-y-4">
          <div
            ref={planRef}
            className="rounded-lg border border-border/60 bg-card/40 p-3"
            onMouseUp={handleSelection}
          >
            <p className="mb-2 text-[10px] font-semibold tracking-widest text-muted-foreground/40 uppercase">
              Plan
            </p>
            <ChatMarkdown text={planMarkdown} cwd={cwd} isStreaming={false} />
          </div>

          {quote ? (
            <div className="rounded-lg border border-[var(--color-accent-blue)]/30 bg-[var(--color-accent-blue)]/5 p-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold tracking-widest text-[var(--color-accent-blue)] uppercase">
                  Selected
                </span>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => setQuote(null)}
                  aria-label="Clear selection"
                  className="text-muted-foreground/50 hover:text-foreground/70"
                >
                  <XIcon className="size-3" />
                </Button>
              </div>
              <blockquote className="text-[11px] text-muted-foreground/80 border-l-2 border-[var(--color-accent-blue)]/30 pl-2">
                {quote}
              </blockquote>
            </div>
          ) : null}

          <div className="space-y-2">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={quote ? "Add a comment about the selected quote..." : "Add a general comment..."}
              className="min-h-[80px] text-[13px] resize-none"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={handleAdd}
              disabled={comment.trim().length === 0}
              className="w-full text-xs"
            >
              Add Comment
            </Button>
          </div>

          {annotations.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold tracking-widest text-muted-foreground/40 uppercase">
                Comments ({annotations.length})
              </p>
              {annotations.map((annotation) => (
                <div
                  key={annotation.id}
                  className="rounded-lg border border-border/60 bg-card/40 p-2.5 space-y-1.5"
                >
                  {editingId === annotation.id ? (
                    <>
                      {editQuote ? (
                        <blockquote className="text-[11px] text-muted-foreground/80 border-l-2 border-border/60 pl-2">
                          {editQuote}
                        </blockquote>
                      ) : null}
                      <Textarea
                        value={editComment}
                        onChange={(e) => setEditComment(e.target.value)}
                        className="min-h-[60px] text-[13px] resize-none"
                      />
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => handleSaveEdit(annotation.id)}
                          aria-label="Save"
                        >
                          <CheckIcon className="size-3" />
                        </Button>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                          aria-label="Cancel"
                        >
                          <XIcon className="size-3" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      {annotation.quote ? (
                        <blockquote className="text-[11px] text-muted-foreground/80 border-l-2 border-border/60 pl-2">
                          {annotation.quote}
                        </blockquote>
                      ) : null}
                      <p className="text-[13px] leading-relaxed">{annotation.comment}</p>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => handleStartEdit(annotation)}
                          aria-label="Edit"
                          className="text-muted-foreground/50 hover:text-foreground/70"
                        >
                          <SquarePenIcon className="size-3" />
                        </Button>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => onDeleteAnnotation(annotation.id)}
                          aria-label="Delete"
                          className="text-muted-foreground/50 hover:text-foreground/70"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
});
