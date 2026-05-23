import { createFileRoute } from "@tanstack/react-router";

import { PairRoute } from "./-pair.view";

export const Route = createFileRoute("/pair")({
  component: PairRoute,
});
