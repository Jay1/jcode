import { createFileRoute } from "@tanstack/react-router";

import { SettingsRouteView } from "./-settings.view";

export const Route = createFileRoute("/_chat/settings")({
  component: SettingsRouteView,
});
