import sodium from "libsodium-wrappers";

function getSecret(): string {
  const secret = process.env.OLYM_SECRET;

  if (!secret) {
    throw new Error("OLYM_SECRET is required to encrypt service credentials");
  }

  return secret;
}

async function getEncryptionKey(): Promise<Uint8Array> {
  await sodium.ready;
  return sodium.crypto_generichash(
    sodium.crypto_secretbox_KEYBYTES,
    getSecret(),
    null,
  );
}

export async function encryptCredential(value: string): Promise<string> {
  await sodium.ready;
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const ciphertext = sodium.crypto_secretbox_easy(
    value,
    nonce,
    await getEncryptionKey(),
  );
  const payload = new Uint8Array(nonce.length + ciphertext.length);
  payload.set(nonce);
  payload.set(ciphertext, nonce.length);

  return sodium.to_base64(payload, sodium.base64_variants.URLSAFE_NO_PADDING);
}

export async function decryptCredential(value: string): Promise<string> {
  await sodium.ready;
  const payload = sodium.from_base64(
    value,
    sodium.base64_variants.URLSAFE_NO_PADDING,
  );
  const nonce = payload.slice(0, sodium.crypto_secretbox_NONCEBYTES);
  const ciphertext = payload.slice(sodium.crypto_secretbox_NONCEBYTES);

  if (nonce.length !== sodium.crypto_secretbox_NONCEBYTES) {
    throw new Error("Invalid encrypted service credential");
  }

  return sodium.to_string(
    sodium.crypto_secretbox_open_easy(
      ciphertext,
      nonce,
      await getEncryptionKey(),
    ),
  );
}
