import express from "express";
import path from "path";
import net from "net";
import { createServer as createViteServer } from "vite";

const PORT = 3000;
const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Basic health check
app.get("/api/health", (req, res) => {
  res.json({ success: true, status: "online", timestamp: new Date().toISOString() });
});

// LAN Printer raw TCP socket proxy
app.post("/api/print-lan", (req, res) => {
  const { ip, port, bytes } = req.body;
  if (!ip) {
    return res.status(400).json({ error: "Missing printer IP address" });
  }
  const portNum = parseInt(port) || 9100;
  const dataBuffer = Buffer.from(bytes || []);

  const client = new net.Socket();
  client.setTimeout(5000); // 5 seconds timeout

  client.connect(portNum, ip, () => {
    client.write(dataBuffer, () => {
      client.end();
      res.json({ success: true });
    });
  });

  client.on("error", (err) => {
    client.destroy();
    if (!res.headersSent) {
      res.status(500).json({ error: `LAN connection failed: ${err.message}` });
    }
  });

  client.on("timeout", () => {
    client.destroy();
    if (!res.headersSent) {
      res.status(500).json({ error: "LAN printer connection timed out" });
    }
  });
});

// LAN Printer connection test ping endpoint
app.post("/api/print-lan-test", (req, res) => {
  const { ip, port } = req.body;
  if (!ip) {
    return res.status(400).json({ error: "Missing printer IP address" });
  }
  const portNum = parseInt(port) || 9100;

  const client = new net.Socket();
  client.setTimeout(2500); // Fast 2.5s check for iPad UI responsiveness

  client.connect(portNum, ip, () => {
    client.end();
    res.json({ success: true });
  });

  client.on("error", (err) => {
    client.destroy();
    if (!res.headersSent) {
      res.json({ success: false, error: err.message });
    }
  });

  client.on("timeout", () => {
    client.destroy();
    if (!res.headersSent) {
      res.json({ success: false, error: "Timeout" });
    }
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`RK Bill Desk Express static server running on port ${PORT}`);
  });
}

startServer();
