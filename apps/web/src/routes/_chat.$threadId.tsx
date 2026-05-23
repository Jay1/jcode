// FILE: _chat.$threadId.tsx
// Purpose: Resolves the active thread route into either a single chat surface or a persisted split view.
// Layer: Route container
// Depends on: ChatView, splitViewStore, splitView.logic, ChatPaneDropOverlay, and pane-scoped browser/diff panels

import { createFileRoute } from "@tanstack/react-router";

import { validateChatThreadRouteSearch } from "./-chat-thread.logic";
import { ChatThreadRouteView } from "./-chat-thread.view";

export const Route = createFileRoute("/_chat/$threadId")({
  validateSearch: validateChatThreadRouteSearch,
  component: ChatThreadRouteView,
});
