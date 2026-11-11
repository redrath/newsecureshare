import { fileapi } from "./fileapi";

export const getMyEncryptionKeys = async () =>
  (await fileapi.get("/e2ee/keys/me/")).data;

export const saveMyEncryptionKeys = async (publicKeyPem, protectedPrivateKey) =>
  (await fileapi.post("/e2ee/keys/me/", {
    public_key_pem: publicKeyPem,
    protected_private_key: protectedPrivateKey,
  })).data;

export const getRecipientPublicKey = async (email) =>
  (await fileapi.get(`/e2ee/keys/${encodeURIComponent(email)}/`)).data;

export const getE2EEFiles = async () =>
  (await fileapi.get("/e2ee/files/")).data.files;

export const uploadE2EEFile = async (file, encrypted) =>
  (await fileapi.post("/e2ee/files/", {
    filename: file.name,
    ciphertext: encrypted.ciphertext,
    iv: encrypted.iv,
    encrypted_key: encrypted.encryptedKey,
    content_type: encrypted.contentType,
    original_size: encrypted.originalSize,
  })).data;

export const getE2EEFile = async (id) => {
  const { data } = await fileapi.get(`/e2ee/files/${id}/`);

  return {
    ...data,
    encryptedKey: data.encrypted_key,
  };
};

export const shareE2EEFile = async (id, recipientEmail, encryptedKey) =>
  (await fileapi.post(`/e2ee/files/${id}/share/`, {
    recipient_email: recipientEmail,
    encrypted_key: encryptedKey,
  })).data;
