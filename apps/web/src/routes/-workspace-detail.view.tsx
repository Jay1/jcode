import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect } from "react";

import WorkspaceView from "~/components/WorkspaceView";
import { useWorkspaceStore } from "~/workspaceStore";

export function WorkspaceRouteView() {
  const navigate = useNavigate();
  const { workspaceId } = useParams({ from: "/_chat/workspace/$workspaceId" });
  const workspace = useWorkspaceStore((state) =>
    state.workspacePages.find((entry) => entry.id === workspaceId),
  );
  const fallbackWorkspaceId = useWorkspaceStore((state) => state.workspacePages[0]?.id ?? null);

  useEffect(() => {
    if (workspace || !fallbackWorkspaceId) {
      return;
    }
    void navigate({
      to: "/workspace/$workspaceId",
      params: { workspaceId: fallbackWorkspaceId },
      replace: true,
    });
  }, [fallbackWorkspaceId, navigate, workspace]);

  if (!workspace) {
    return null;
  }

  return <WorkspaceView workspaceId={workspace.id} />;
}
