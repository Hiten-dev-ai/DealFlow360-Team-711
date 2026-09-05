import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

function encryptionKey(secret) {
  if (!secret) return null;
  return createHash("sha256").update(secret).digest();
}

export function encryptSetting(value, secret) {
  const key = encryptionKey(secret);
  if (!key) throw new Error("Environment encryption is unavailable.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString("base64url"))
    .join(".");
}

export function decryptSetting(value, secret) {
  const key = encryptionKey(secret);
  if (!key || !value) return null;
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) return null;
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivValue, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

export async function resolveMailSettings(store, config, workspaceId) {
  if (!store.query) {
    return { smtpUrl: config.smtpUrl, mailFrom: config.mailFrom, source: config.smtpUrl ? "server" : "none" };
  }
  const result = await store.query(
    `SELECT smtp_url_encrypted AS "smtpUrlEncrypted",mail_from AS "mailFrom",version,updated_at AS "updatedAt"
     FROM workspace_environment_settings WHERE workspace_id=$1`,
    [workspaceId],
  );
  const row = result.rows[0];
  const workspaceSmtp = decryptSetting(
    row?.smtpUrlEncrypted,
    config.settingsEncryptionKey,
  );
  return {
    smtpUrl: workspaceSmtp ?? config.smtpUrl,
    mailFrom: row?.mailFrom || config.mailFrom,
    source: workspaceSmtp ? "workspace" : config.smtpUrl ? "server" : "none",
    version: Number(row?.version ?? 0),
    updatedAt: row?.updatedAt ?? null,
  };
}

export function smtpHost(smtpUrl) {
  return smtpConnectionDetails(smtpUrl).host;
}

export function smtpConnectionDetails(smtpUrl) {
  if (!smtpUrl) return { host: null, port: 465, username: "", secure: true, hasPassword: false };
  try {
    const parsed = new URL(smtpUrl);
    const secure = parsed.protocol === "smtps:";
    return {
      host: parsed.hostname || null,
      port: Number(parsed.port || (secure ? 465 : 587)),
      username: decodeURIComponent(parsed.username || ""),
      secure,
      hasPassword: Boolean(parsed.password),
    };
  } catch {
    return { host: null, port: 465, username: "", secure: true, hasPassword: false };
  }
}

export function buildSmtpUrl({ host, port, username, password, secure }) {
  const parsed = new URL(`${secure ? "smtps" : "smtp"}://${host}`);
  parsed.port = String(port);
  parsed.username = username;
  parsed.password = password;
  return parsed.toString();
}
