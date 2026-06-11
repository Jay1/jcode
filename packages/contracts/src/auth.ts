import { Schema } from "effect";

import { AuthSessionId, NonNegativeInt, TrimmedNonEmptyString } from "./baseSchemas";

export const ServerAuthPolicy = Schema.Literals([
  "desktop-managed-local",
  "loopback-browser",
  "remote-reachable",
  "unsafe-no-auth",
]);
export type ServerAuthPolicy = typeof ServerAuthPolicy.Type;

export const ServerAuthBootstrapMethod = Schema.Literals(["desktop-bootstrap", "one-time-token"]);
export type ServerAuthBootstrapMethod = typeof ServerAuthBootstrapMethod.Type;

export const ServerAuthSessionMethod = Schema.Literals([
  "browser-session-cookie",
  "bearer-session-token",
]);
export type ServerAuthSessionMethod = typeof ServerAuthSessionMethod.Type;

export const AuthSessionRole = Schema.Literals(["owner", "client"]);
export type AuthSessionRole = typeof AuthSessionRole.Type;

export const AuthCapabilityScope = Schema.Literals([
  "thread:read",
  "approval:respond",
  "user_input:respond",
  "provider_status:read",
]);
export type AuthCapabilityScope = typeof AuthCapabilityScope.Type;

export const CapabilityResource = Schema.Struct({
  type: Schema.Literals(["project", "thread"]),
  id: TrimmedNonEmptyString,
});
export type CapabilityResource = typeof CapabilityResource.Type;

export const ServerAuthDescriptor = Schema.Struct({
  policy: ServerAuthPolicy,
  bootstrapMethods: Schema.Array(ServerAuthBootstrapMethod),
  sessionMethods: Schema.Array(ServerAuthSessionMethod),
  sessionCookieName: TrimmedNonEmptyString,
});
export type ServerAuthDescriptor = typeof ServerAuthDescriptor.Type;

export const AuthBootstrapInput = Schema.Struct({
  credential: TrimmedNonEmptyString,
});
export type AuthBootstrapInput = typeof AuthBootstrapInput.Type;

export const AuthBootstrapResult = Schema.Struct({
  authenticated: Schema.Literal(true),
  role: AuthSessionRole,
  sessionMethod: ServerAuthSessionMethod,
  expiresAt: Schema.DateTimeUtcFromString,
});
export type AuthBootstrapResult = typeof AuthBootstrapResult.Type;

export const AuthBearerBootstrapResult = Schema.Struct({
  authenticated: Schema.Literal(true),
  role: AuthSessionRole,
  sessionMethod: Schema.Literal("bearer-session-token"),
  expiresAt: Schema.DateTimeUtcFromString,
  sessionToken: TrimmedNonEmptyString,
});
export type AuthBearerBootstrapResult = typeof AuthBearerBootstrapResult.Type;

export const AuthWebSocketTokenResult = Schema.Struct({
  token: TrimmedNonEmptyString,
  expiresAt: Schema.DateTimeUtcFromString,
});
export type AuthWebSocketTokenResult = typeof AuthWebSocketTokenResult.Type;

export const AuthPairingCredentialResult = Schema.Struct({
  id: TrimmedNonEmptyString,
  credential: TrimmedNonEmptyString,
  label: Schema.optionalKey(TrimmedNonEmptyString),
  expiresAt: Schema.DateTimeUtcFromString,
});
export type AuthPairingCredentialResult = typeof AuthPairingCredentialResult.Type;

export const AuthPairingLink = Schema.Struct({
  id: TrimmedNonEmptyString,
  credential: TrimmedNonEmptyString,
  role: AuthSessionRole,
  subject: TrimmedNonEmptyString,
  label: Schema.optionalKey(TrimmedNonEmptyString),
  scopes: Schema.optionalKey(Schema.Array(AuthCapabilityScope)),
  resources: Schema.optionalKey(Schema.Array(CapabilityResource)),
  createdAt: Schema.DateTimeUtcFromString,
  expiresAt: Schema.DateTimeUtcFromString,
});
export type AuthPairingLink = typeof AuthPairingLink.Type;

export const AuthClientMetadataDeviceType = Schema.Literals([
  "desktop",
  "mobile",
  "tablet",
  "bot",
  "unknown",
]);
export type AuthClientMetadataDeviceType = typeof AuthClientMetadataDeviceType.Type;

export const AuthClientMetadata = Schema.Struct({
  label: Schema.optionalKey(TrimmedNonEmptyString),
  ipAddress: Schema.optionalKey(TrimmedNonEmptyString),
  userAgent: Schema.optionalKey(TrimmedNonEmptyString),
  deviceType: AuthClientMetadataDeviceType,
  os: Schema.optionalKey(TrimmedNonEmptyString),
  browser: Schema.optionalKey(TrimmedNonEmptyString),
});
export type AuthClientMetadata = typeof AuthClientMetadata.Type;

export const AuthClientSession = Schema.Struct({
  sessionId: AuthSessionId,
  subject: TrimmedNonEmptyString,
  role: AuthSessionRole,
  method: ServerAuthSessionMethod,
  client: AuthClientMetadata,
  issuedAt: Schema.DateTimeUtcFromString,
  expiresAt: Schema.DateTimeUtcFromString,
  lastConnectedAt: Schema.NullOr(Schema.DateTimeUtcFromString),
  connected: Schema.Boolean,
  current: Schema.Boolean,
  scopes: Schema.optionalKey(Schema.Array(AuthCapabilityScope)),
  resources: Schema.optionalKey(Schema.Array(CapabilityResource)),
});
export type AuthClientSession = typeof AuthClientSession.Type;

export const AuthAccessSnapshot = Schema.Struct({
  pairingLinks: Schema.Array(AuthPairingLink),
  clientSessions: Schema.Array(AuthClientSession),
});
export type AuthAccessSnapshot = typeof AuthAccessSnapshot.Type;

export const AuthAccessStreamRevision = NonNegativeInt;
export type AuthAccessStreamRevision = typeof AuthAccessStreamRevision.Type;

export const AuthAccessStreamEvent = Schema.Union([
  Schema.Struct({
    type: Schema.Literal("snapshot"),
    revision: AuthAccessStreamRevision,
    access: AuthAccessSnapshot,
  }),
  Schema.Struct({
    type: Schema.Literal("pairingLinkUpserted"),
    revision: AuthAccessStreamRevision,
    pairingLink: AuthPairingLink,
  }),
  Schema.Struct({
    type: Schema.Literal("pairingLinkRemoved"),
    revision: AuthAccessStreamRevision,
    id: TrimmedNonEmptyString,
  }),
  Schema.Struct({
    type: Schema.Literal("clientUpserted"),
    revision: AuthAccessStreamRevision,
    clientSession: AuthClientSession,
  }),
  Schema.Struct({
    type: Schema.Literal("clientRemoved"),
    revision: AuthAccessStreamRevision,
    sessionId: AuthSessionId,
  }),
]);
export type AuthAccessStreamEvent = typeof AuthAccessStreamEvent.Type;

export const AuthRevokePairingLinkInput = Schema.Struct({
  id: TrimmedNonEmptyString,
});
export type AuthRevokePairingLinkInput = typeof AuthRevokePairingLinkInput.Type;

export const AuthRevokeClientSessionInput = Schema.Struct({
  sessionId: AuthSessionId,
});
export type AuthRevokeClientSessionInput = typeof AuthRevokeClientSessionInput.Type;

export const AuthCreatePairingCredentialInput = Schema.Struct({
  label: Schema.optionalKey(TrimmedNonEmptyString),
  scopes: Schema.optionalKey(Schema.Array(AuthCapabilityScope)),
  resources: Schema.optionalKey(Schema.Array(CapabilityResource)),
});
export type AuthCreatePairingCredentialInput = typeof AuthCreatePairingCredentialInput.Type;

export const AuthSessionState = Schema.Struct({
  authenticated: Schema.Boolean,
  auth: ServerAuthDescriptor,
  role: Schema.optionalKey(AuthSessionRole),
  sessionMethod: Schema.optionalKey(ServerAuthSessionMethod),
  expiresAt: Schema.optionalKey(Schema.DateTimeUtcFromString),
});
export type AuthSessionState = typeof AuthSessionState.Type;

const AuthRevokedResult = Schema.Struct({
  revoked: Schema.Boolean,
});

const AuthRevokedCountResult = Schema.Struct({
  revokedCount: NonNegativeInt,
});

export const AuthHttpRoutes = {
  session: {
    method: "GET",
    pathname: "/api/auth/session",
    response: AuthSessionState,
  },
  bootstrap: {
    method: "POST",
    pathname: "/api/auth/bootstrap",
    request: AuthBootstrapInput,
    response: AuthBootstrapResult,
  },
  bootstrapBearer: {
    method: "POST",
    pathname: "/api/auth/bootstrap/bearer",
    request: AuthBootstrapInput,
    response: AuthBearerBootstrapResult,
  },
  webSocketToken: {
    method: "POST",
    pathname: "/api/auth/ws-token",
    response: AuthWebSocketTokenResult,
  },
  pairingToken: {
    method: "POST",
    pathname: "/api/auth/pairing-token",
    request: AuthCreatePairingCredentialInput,
    response: AuthPairingCredentialResult,
  },
  pairingLinks: {
    method: "GET",
    pathname: "/api/auth/pairing-links",
    response: Schema.Array(AuthPairingLink),
  },
  revokePairingLink: {
    method: "POST",
    pathname: "/api/auth/pairing-links/revoke",
    request: AuthRevokePairingLinkInput,
    response: AuthRevokedResult,
  },
  clients: {
    method: "GET",
    pathname: "/api/auth/clients",
    response: Schema.Array(AuthClientSession),
  },
  revokeClient: {
    method: "POST",
    pathname: "/api/auth/clients/revoke",
    request: AuthRevokeClientSessionInput,
    response: AuthRevokedResult,
  },
  revokeOtherClients: {
    method: "POST",
    pathname: "/api/auth/clients/revoke-others",
    response: AuthRevokedCountResult,
  },
} as const;
