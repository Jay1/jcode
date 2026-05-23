import { createFileRoute } from "@tanstack/react-router";

import { WorkspaceRouteView } from "./-workspace-detail.view";

export const Route = createFileRoute("/_chat/workspace/$workspaceId")({
  component: WorkspaceRouteView,
});
