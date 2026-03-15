export async function encryptText(text: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  // Generate a random AES-GCM key
  const key = await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );

  // Generate a random Initialization Vector
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // Encrypt the data
  const encryptedData = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    data
  );

  // Export the key so we can send it to the server
  const exportedKey = await window.crypto.subtle.exportKey("raw", key);

  // Convert ArrayBuffers to Base64 strings for easy transport
  const encryptedBase64 = arrayBufferToBase64(encryptedData);
  const ivBase64 = arrayBufferToBase64(iv);
  const keyBase64 = arrayBufferToBase64(exportedKey);

  return {
    encryptedData: encryptedBase64,
    iv: ivBase64,
    key: keyBase64,
  };
}

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}
