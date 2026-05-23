import { createFileRoute } from "@tanstack/react-router";

import { ChatRouteLayout } from "./-chat.view";

export const Route = createFileRoute("/_chat")({
  component: ChatRouteLayout,
});
