import type { AuthSessionRole } from "@t3tools/contracts";

export const SAVED_CONNECTIONS_STORAGE_KEY = "dpcode:saved-connections:v1";

export interface SavedConnectionProfile {
  readonly id: string;
  readonly label: string;
  readonly httpBaseUrl: string;
  readonly wsBaseUrl: string;
  readonly createdAt: string;
  readonly lastConnectedAt: string | null;
  readonly role?: AuthSessionRole;
}

interface StoredSavedConnectionProfile extends SavedConnectionProfile {
  readonly bearerToken?: string;
}

interface SavedConnectionsDocument {
  readonly version: 1;
  readonly profiles: ReadonlyArray<StoredSavedConnectionProfile>;
  readonly activeProfileId?: string | null;
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readDocument(): SavedConnectionsDocument {
  const raw = storage()?.getItem(SAVED_CONNECTIONS_STORAGE_KEY);
  if (!raw) return { version: 1, profiles: [], activeProfileId: null };

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isObject(parsed) || !Array.isArray(parsed.profiles)) {
      return { version: 1, profiles: [] };
    }
    return {
      version: 1,
      profiles: parsed.profiles.flatMap((profile) =>
        isStoredProfile(profile) ? [profile] : [],
      ),
      activeProfileId:
        typeof parsed.activeProfileId === "string" ? parsed.activeProfileId : null,
    };
  } catch {
    return { version: 1, profiles: [], activeProfileId: null };
  }
}

function writeDocument(document: SavedConnectionsDocument): void {
  storage()?.setItem(SAVED_CONNECTIONS_STORAGE_KEY, JSON.stringify(document));
}

function isStoredProfile(value: unknown): value is StoredSavedConnectionProfile {
  if (!isObject(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.label === "string" &&
    typeof value.httpBaseUrl === "string" &&
    typeof value.wsBaseUrl === "string" &&
    typeof value.createdAt === "string" &&
    (typeof value.lastConnectedAt === "string" || value.lastConnectedAt === null) &&
    (value.role === undefined || value.role === "owner" || value.role === "client") &&
    (value.bearerToken === undefined || typeof value.bearerToken === "string")
  );
}

function publicProfile(profile: StoredSavedConnectionProfile): SavedConnectionProfile {
  return {
    id: profile.id,
    label: profile.label,
    httpBaseUrl: profile.httpBaseUrl,
    wsBaseUrl: profile.wsBaseUrl,
    createdAt: profile.createdAt,
    lastConnectedAt: profile.lastConnectedAt,
    ...(profile.role ? { role: profile.role } : {}),
  };
}

export function readSavedConnectionProfiles(): ReadonlyArray<SavedConnectionProfile> {
  return readDocument().profiles.map(publicProfile);
}

export function readSavedConnectionProfile(id: string): SavedConnectionProfile | null {
  const profile = readDocument().profiles.find((candidate) => candidate.id === id);
  return profile ? publicProfile(profile) : null;
}

export function readActiveSavedConnectionProfileId(): string | null {
  const document = readDocument();
  return document.profiles.some((profile) => profile.id === document.activeProfileId)
    ? (document.activeProfileId ?? null)
    : null;
}

export function setActiveSavedConnectionProfileId(id: string | null): boolean {
  const document = readDocument();
  if (id !== null && !document.profiles.some((profile) => profile.id === id)) {
    return false;
  }
  writeDocument({
    ...document,
    activeProfileId: id,
  });
  return true;
}

export function upsertSavedConnectionProfile(profile: SavedConnectionProfile): void {
  const document = readDocument();
  const existing = document.profiles.find((candidate) => candidate.id === profile.id);
  const nextProfile: StoredSavedConnectionProfile = {
    ...profile,
    ...(existing?.bearerToken ? { bearerToken: existing.bearerToken } : {}),
  };
  writeDocument({
    version: 1,
    activeProfileId: document.activeProfileId,
    profiles: [
      ...document.profiles.filter((candidate) => candidate.id !== profile.id),
      nextProfile,
    ].toSorted((left, right) => left.label.localeCompare(right.label)),
  });
}

export function removeSavedConnectionProfile(id: string): void {
  const document = readDocument();
  writeDocument({
    version: 1,
    activeProfileId: document.activeProfileId === id ? null : document.activeProfileId,
    profiles: document.profiles.filter((candidate) => candidate.id !== id),
  });
}

export function readSavedConnectionSecret(id: string): string | null {
  return readDocument().profiles.find((candidate) => candidate.id === id)?.bearerToken ?? null;
}

export async function readSavedConnectionSecretAsync(id: string): Promise<string | null> {
  const bridgeSecret = await globalThis.window?.desktopBridge?.connectionSecrets
    ?.read(id)
    .catch(() => null);
  return bridgeSecret ?? readSavedConnectionSecret(id);
}

export function writeSavedConnectionSecret(id: string, secret: string): boolean {
  const document = readDocument();
  let found = false;
  writeDocument({
    version: 1,
    activeProfileId: document.activeProfileId,
    profiles: document.profiles.map((profile) => {
      if (profile.id !== id) return profile;
      found = true;
      return { ...profile, bearerToken: secret };
    }),
  });
  return found;
}

export async function writeSavedConnectionSecretAsync(
  id: string,
  secret: string,
): Promise<boolean> {
  const bridge = globalThis.window?.desktopBridge?.connectionSecrets;
  if (bridge) {
    return await bridge.write({ profileId: id, secret }).catch(() => false);
  }
  return writeSavedConnectionSecret(id, secret);
}

export function clearSavedConnectionSecret(id: string): void {
  const document = readDocument();
  writeDocument({
    version: 1,
    activeProfileId: document.activeProfileId,
    profiles: document.profiles.map((profile) => {
      if (profile.id !== id) return profile;
      const { bearerToken: _bearerToken, ...publicFields } = profile;
      return publicFields;
    }),
  });
}

export async function clearSavedConnectionSecretAsync(id: string): Promise<void> {
  await globalThis.window?.desktopBridge?.connectionSecrets?.remove(id).catch(() => undefined);
  clearSavedConnectionSecret(id);
}
