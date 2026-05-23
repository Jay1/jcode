import { createFileRoute } from "@tanstack/react-router";

import { WorkspaceIndexRouteView } from "./-workspace-index.view";

export const Route = createFileRoute("/_chat/workspace/")({
  component: WorkspaceIndexRouteView,
});
