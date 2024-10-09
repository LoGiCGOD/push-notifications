const NOTIFICATION_SECRET = 'wsfh345359gij';

self.addEventListener("push", function (event) {
  event.waitUntil(handlePushEvent(event));
});

async function handlePushEvent(event) {
  console.log("Push event received", event);

  let notificationData = {};

  try {
    const payload = event.data.json();
    notificationData = payload;

    const { title, body, signature } = notificationData.notification;

    // Verify the notification signature
    const verified = await verifySignature({ title, body }, signature);

    if (!verified) {
      throw new Error('Invalid notification signature');
    }

    console.log("Notification signature verified");

    // Send the notification data to the main thread
    self.clients.matchAll().then(clients => {
      clients.forEach(client => client.postMessage({
        type: 'NOTIFICATION_RECEIVED',
        title,
        body,
      }));
    });

    // We don't show the notification via browser's notification API
  } catch (e) {
    console.error("Error processing notification data:", e);
    return;
  }
}

// Function to verify the notification signature
async function verifySignature(data, signature) {
  const encoder = new TextEncoder();
  const secretKey = await self.crypto.subtle.importKey(
    "raw",
    encoder.encode(NOTIFICATION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const dataToVerify = encoder.encode(JSON.stringify(data));
  const signatureBuffer = hexToArrayBuffer(signature);

  return await self.crypto.subtle.verify(
    "HMAC",
    secretKey,
    signatureBuffer,
    dataToVerify
  );
}

// Helper function to convert hex string to ArrayBuffer
function hexToArrayBuffer(hexString) {
  const bytes = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < hexString.length; i += 2) {
    bytes[i / 2] = parseInt(hexString.substr(i, 2), 16);
  }
  return bytes.buffer;
}
