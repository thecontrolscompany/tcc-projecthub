import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getSecret() {
  const secret = process.env.AI_CONNECTIONS_ENCRYPTION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error("AI connection encryption secret is not configured.");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptAiApiKey(value) {
  const secret = String(value || "").trim();
  if (!secret) return "";

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getSecret(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptAiApiKey(payload) {
  const raw = String(payload || "").trim();
  if (!raw) return "";

  const [ivPart, authTagPart, encryptedPart] = raw.split(".");
  if (!ivPart || !authTagPart || !encryptedPart) {
    throw new Error("Invalid encrypted AI key payload.");
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getSecret(),
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(authTagPart, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function getKeyHint(value) {
  const secret = String(value || "").trim();
  if (!secret) return "";
  return secret.length <= 4 ? secret : `••••${secret.slice(-4)}`;
}
