import { resolveRemotePairingTarget } from "./remotePairingTarget";
import {
  fetchRemoteEnvironmentDescriptor,
  bootstrapRemoteBearerSession,
  isRemoteAuthHttpError,
  resolveRemoteWebSocketConnectionUrl,
} from "./remoteAuthApi";
import {
  clearSavedConnectionSecret,
  readActiveSavedConnectionProfileId,
  readSavedConnectionProfile,
  readSavedConnectionSecret,
  setActiveSavedConnectionProfileId,
  upsertSavedConnectionProfile,
  writeSavedConnectionSecret,
  type SavedConnectionProfile,
} from "./savedConnections";

export interface AddSavedConnectionInput {
  readonly pairingUrl?: string;
  readonly host?: string;
  readonly pairingCode?: string;
  readonly label?: string;
  readonly now?: () => Date;
}

function formatTimestamp(now: (() => Date) | undefined): string {
  return (now?.() ?? new Date()).toISOString();
}

export async function addSavedConnectionFromPairing(
  input: AddSavedConnectionInput,
): Promise<SavedConnectionProfile> {
  const target = resolveRemotePairingTarget(input);
  const [descriptor, session] = await Promise.all([
    fetchRemoteEnvironmentDescriptor({ httpBaseUrl: target.httpBaseUrl }),
    bootstrapRemoteBearerSession({
      httpBaseUrl: target.httpBaseUrl,
      credential: target.pairingCode,
    }),
  ]);
  const existing = readSavedConnectionProfile(descriptor.environmentId);
  const now = formatTimestamp(input.now);
  const profile: SavedConnectionProfile = {
    id: descriptor.environmentId,
    label: input.label?.trim() || descriptor.label,
    httpBaseUrl: target.httpBaseUrl,
    wsBaseUrl: target.wsBaseUrl,
    createdAt: existing?.createdAt ?? now,
    lastConnectedAt: now,
    role: session.role,
  };

  upsertSavedConnectionProfile(profile);
  writeSavedConnectionSecret(profile.id, session.sessionToken);
  setActiveSavedConnectionProfileId(profile.id);
  return profile;
}

export async function getActiveSavedConnectionWebSocketUrl(): Promise<string | null> {
  const activeProfileId = readActiveSavedConnectionProfileId();
  if (!activeProfileId) return null;

  const profile = readSavedConnectionProfile(activeProfileId);
  const bearerToken = readSavedConnectionSecret(activeProfileId);
  if (!profile || !bearerToken) return null;

  try {
    return await resolveRemoteWebSocketConnectionUrl({
      httpBaseUrl: profile.httpBaseUrl,
      wsBaseUrl: profile.wsBaseUrl,
      bearerToken,
    });
  } catch (error) {
    if (isRemoteAuthHttpError(error) && error.status === 401) {
      clearSavedConnectionSecret(profile.id);
      throw new Error("Saved connection credential expired. Pair this backend again.", {
        cause: error,
      });
    }
    throw error;
  }
}
