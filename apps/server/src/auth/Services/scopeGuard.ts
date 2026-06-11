import type { AuthCapabilityScope } from "@jcode/contracts";
import { Effect } from "effect";

import type { AuthenticatedSession } from "./ServerAuth";
import { AuthError } from "./ServerAuth";

/**
 * Check whether an authenticated session has a specific capability scope.
 *
 * Owner sessions bypass the check (they implicitly hold all scopes).
 * Client sessions must have the scope in their explicit scope list.
 */
export const requireScope = (
  session: AuthenticatedSession,
  scope: AuthCapabilityScope,
): Effect.Effect<AuthenticatedSession, AuthError> =>
  Effect.suspend(() => {
    if (session.role === "owner") return Effect.succeed(session);

    const scopes = session.scopes;
    if (scopes === undefined || !scopes.includes(scope)) {
      return Effect.fail(
        new AuthError({
          message: `Missing required scope: ${scope}`,
          status: 403,
        }),
      );
    }

    return Effect.succeed(session);
  });

/**
 * Check whether an authenticated session has ANY of the given capability scopes.
 *
 * Owner sessions bypass the check.
 * Client sessions must have at least one of the listed scopes.
 */
export const requireAnyScope = (
  session: AuthenticatedSession,
  scopes: ReadonlyArray<AuthCapabilityScope>,
): Effect.Effect<AuthenticatedSession, AuthError> =>
  Effect.suspend(() => {
    if (session.role === "owner") return Effect.succeed(session);

    const sessionScopes = session.scopes;
    if (sessionScopes === undefined) {
      return Effect.fail(
        new AuthError({
          message: `Missing required scope: any of [${scopes.join(", ")}]`,
          status: 403,
        }),
      );
    }

    const hasAny = scopes.some((s) => sessionScopes.includes(s));
    if (!hasAny) {
      return Effect.fail(
        new AuthError({
          message: `Missing required scope: any of [${scopes.join(", ")}]`,
          status: 403,
        }),
      );
    }

    return Effect.succeed(session);
  });
