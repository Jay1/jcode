import * as FS from "node:fs";
import * as Path from "node:path";

interface SecretDocument {
  readonly version: 1;
  readonly secrets: Record<string, string>;
}

function isValidSecretId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 512;
}

function isValidSecret(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function parseDocument(value: string): SecretDocument {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("secrets" in parsed) ||
      typeof parsed.secrets !== "object" ||
      parsed.secrets === null
    ) {
      return { version: 1, secrets: {} };
    }
    return {
      version: 1,
      secrets: Object.fromEntries(
        Object.entries(parsed.secrets).filter(
          ([key, secret]) => isValidSecretId(key) && isValidSecret(secret),
        ),
      ),
    };
  } catch {
    return { version: 1, secrets: {} };
  }
}

export class DesktopConnectionSecretStore {
  readonly filePath: string;

  constructor(stateDir: string) {
    this.filePath = Path.join(stateDir, "connection-secrets.json");
  }

  read(profileId: unknown): string | null {
    if (!isValidSecretId(profileId)) return null;
    const document = this.readDocument();
    return document.secrets[profileId] ?? null;
  }

  write(input: unknown): boolean {
    if (typeof input !== "object" || input === null) {
      return false;
    }
    const record = input as { readonly profileId?: unknown; readonly secret?: unknown };
    if (!isValidSecretId(record.profileId) || !isValidSecret(record.secret)) return false;

    const document = this.readDocument();
    this.writeDocument({
      version: 1,
      secrets: {
        ...document.secrets,
        [record.profileId]: record.secret,
      },
    });
    return true;
  }

  remove(profileId: unknown): void {
    if (!isValidSecretId(profileId)) return;
    const document = this.readDocument();
    const { [profileId]: _removed, ...secrets } = document.secrets;
    this.writeDocument({ version: 1, secrets });
  }

  private readDocument(): SecretDocument {
    try {
      return parseDocument(FS.readFileSync(this.filePath, "utf8"));
    } catch {
      return { version: 1, secrets: {} };
    }
  }

  private writeDocument(document: SecretDocument): void {
    FS.mkdirSync(Path.dirname(this.filePath), { recursive: true });
    FS.writeFileSync(this.filePath, JSON.stringify(document), { mode: 0o600 });
    try {
      FS.chmodSync(this.filePath, 0o600);
    } catch {
      // Best effort on platforms that do not support POSIX permissions.
    }
  }
}
