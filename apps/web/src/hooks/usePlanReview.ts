import { useCallback, useState } from "react";
import {
  buildPlanReviewComposerMarkdown,
  createPlanAnnotation,
  updatePlanAnnotation,
  type PlanAnnotation,
} from "../planReview";

export interface UsePlanReviewResult {
  annotations: PlanAnnotation[];
  addAnnotation: (comment: string, quote: string | null) => void;
  updateAnnotation: (id: string, comment: string, quote: string | null) => void;
  deleteAnnotation: (id: string) => void;
  resetAnnotations: () => void;
  buildComposerMarkdown: (planTitle: string | null) => string;
}

export function usePlanReview(): UsePlanReviewResult {
  const [annotations, setAnnotations] = useState<PlanAnnotation[]>([]);

  const addAnnotation = useCallback((comment: string, quote: string | null) => {
    const id = `annotation-${crypto.randomUUID()}`;
    setAnnotations((prev) => [...prev, createPlanAnnotation(id, comment, quote)]);
  }, []);

  const updateAnnotation = useCallback((id: string, comment: string, quote: string | null) => {
    setAnnotations((prev) =>
      prev.map((a) => (a.id === id ? updatePlanAnnotation(a, { comment, quote }) : a)),
    );
  }, []);

  const deleteAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const resetAnnotations = useCallback(() => {
    setAnnotations([]);
  }, []);

  const buildComposerMarkdown = useCallback(
    (planTitle: string | null) => {
      return buildPlanReviewComposerMarkdown(planTitle, annotations);
    },
    [annotations],
  );

  return {
    annotations,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    resetAnnotations,
    buildComposerMarkdown,
  };
}
