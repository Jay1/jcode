/**
 * OpenClawAdapter - OpenClaw gateway implementation of the generic provider adapter contract.
 *
 * This service owns JCode's OpenClaw gateway session mapping and emits canonical
 * provider runtime events. The initial adapter is intentionally text-only.
 *
 * @module OpenClawAdapter
 */
import { ServiceMap } from "effect";

import type { ProviderAdapterError } from "../Errors.ts";
import type { ProviderAdapterShape } from "./ProviderAdapter.ts";

export interface OpenClawAdapterShape extends ProviderAdapterShape<ProviderAdapterError> {
  readonly provider: "openclaw";
}

export class OpenClawAdapter extends ServiceMap.Service<OpenClawAdapter, OpenClawAdapterShape>()(
  "jcode/provider/Services/OpenClawAdapter",
) {}
