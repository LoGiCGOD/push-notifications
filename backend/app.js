import express from "express";
import bodyParser from "body-parser";
import { NotificationHubsClient } from "@azure/notification-hubs";
import crypto from 'crypto';
import cors from 'cors';

const app = express();
const port = 7000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

const connectionString =
  "Endpoint=sb://xipperNotificationHub.servicebus.windows.net/;SharedAccessKeyName=DefaultFullSharedAccessSignature;SharedAccessKey=HBPC3PYJg//P7X14m2K/g2aB6EQCSV0O5qS03xKFHwI=";
const hubName = "xipperHub";
const hubClient = new NotificationHubsClient(connectionString, hubName);

const NOTIFICATION_SECRET = 'wsfh345359gij';

app.get("/api/notifications/publicKey", (req, res) => {
  const vapidPublicKey =
    "BDyQAB49XbQihLOHXjVh8FIlkzSQpxgA4-VNDlXppJ1_sT5U9YkWeXGFfTBzNJDcVcT3kBIgA0VMBJ_GwdOuOZs";
  res.send(vapidPublicKey);
});

app.post("/api/notifications/register", async (req, res) => {
  const { installationId, endpoint, p256dh, auth, expirationTime } = req.body;

  const installation = {
    installationId: installationId,
    platform: "browser",
    pushChannel: {
      endpoint: endpoint,
      p256dh: p256dh,
      auth: auth,
      expirationTime: expirationTime || null,
    },
    tags: [installationId],
  };

  try {
    console.log("Registering installation:", JSON.stringify(installation, null, 2));
    await hubClient.createOrUpdateInstallation(installation);
    res.status(200).send({ message: "Registration successful", installationId: installation.installationId });
  } catch (err) {
    console.error("Error registering installation:", err.message);
    res.status(500).send({ error: `Error registering installation: ${err.message}` });
  }
});

app.get("/api/notifications/status", async (req, res) => {
  try {
    const dummyInstallation = {
      installationId: "dummy-" + Date.now(),
      platform: "browser",
      pushChannel: {
        endpoint: "http://dummy.com",
        p256dh: "dummy-p256dh",
        auth: "dummy-auth",
      },
    };

    await hubClient.createOrUpdateInstallation(dummyInstallation);
    res.status(200).send({ status: "connected" });
    await hubClient.deleteInstallation(dummyInstallation.installationId);
  } catch (err) {
    console.error("Error checking hub status:", err);
    res.status(500).send({ status: "disconnected", error: err.message });
  }
});

app.post("/api/notifications/send", async (req, res) => {
  const { title, body,installationId } = req.body;

  const signature = crypto
    .createHmac('sha256', NOTIFICATION_SECRET)
    .update(JSON.stringify({ title, body }))
    .digest('hex');

  const payload = {
    notification: {
      title: title,
      body: body,
      signature: signature,
    },
  };

  const notification = {
    platform: "browser",
    body: JSON.stringify(payload),
    contentType: "application/json;charset=utf-8",
    headers: {
      TTL: "3600",
    },
  };

  const options = {
    tags: [installationId],  // Use the tag for targeting
  };
  try {

    console.log("Sending notification payload:", payload);
    console.log("Using installationId:", installationId);
    console.log("Notification options:", options);

    console.log("Sending notification payload:", payload);
    await hubClient.sendNotification(notification,options);
    res.status(200).send("Notification sent");
  } catch (err) {
    console.error("Error sending notification:", err.message);
    res.status(500).send({ error: `Error sending notification: ${err.message}` });
  }
});

app.get("/api/notifications/verify/:installationId", async (req, res) => {
  const { installationId } = req.params;

  try {
    const installation = await hubClient.getInstallation(installationId);
    if (installation) {
      res.status(200).json({ status: "exists", installation });
    } else {
      res.status(404).json({ status: "not found" });
    }
  } catch (err) {
    console.error("Error verifying installation ID:", err.message);
    res.status(500).json({ status: "error", error: err.message });
  }
});


app.post("/api/notifications/delete", async (req, res) => {
  const { installationId } = req.body;

  if (!installationId) {
      return res.status(400).send({ error: "Installation ID is required" });
  }

  try {
  
      await hubClient.deleteInstallation(installationId);
      console.log(`Deleted installation with ID: ${installationId}`);
      
      res.status(200).send({ message: `Installation ID ${installationId} deleted successfully` });
  } catch (err) {
      console.error("Error deleting installation:", err.message);
      res.status(500).send({ error: `Error deleting installation: ${err.message}` });
  }
});


app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
