// FILE: _chat.index.tsx
// Purpose: Restores the last chat route on app launch, falling back to a fresh home-chat draft.
// Layer: Routing
// Depends on: sidebar UI persistence plus shared new-chat handler for the empty-state fallback.

import { createFileRoute } from "@tanstack/react-router";
import { ChatIndexRouteView } from "./-chat-index.view";

export const Route = createFileRoute("/_chat/")({
  component: ChatIndexRouteView,
});
