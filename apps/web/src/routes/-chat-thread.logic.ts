import { parseDiffRouteSearch } from "../diffRouteSearch";

export const validateChatThreadRouteSearch = (search: Record<string, unknown>) =>
  parseDiffRouteSearch(search);
