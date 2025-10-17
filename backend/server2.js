const express = require("express");
const fs = require("fs");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 5055;
const PLAYLIST_FILE = "./playlist.json";

app.use(cors());
app.use(express.json());

// Crea el archivo si no existe
if (!fs.existsSync(PLAYLIST_FILE)) fs.writeFileSync(PLAYLIST_FILE, "[]");

// === GET /playlist ===
app.get("/playlist", (req, res) => {
  console.log("📡 GET /playlist ejecutado");
  const data = fs.readFileSync(PLAYLIST_FILE, "utf8");
  res.json(JSON.parse(data));
});

// === POST /playlist ===
app.post("/playlist", (req, res) => {
  console.log("📩 POST /playlist ejecutado");
  const nueva = req.body;
  const lista = JSON.parse(fs.readFileSync(PLAYLIST_FILE, "utf8"));
  const existe = lista.some(c => c.link === nueva.link);
  if (!existe) {
    lista.push(nueva);
    fs.writeFileSync(PLAYLIST_FILE, JSON.stringify(lista, null, 2));

    // 🚀 Notificar a todos los conectados
    io.emit("playlist_actualizada", lista);
  }

  res.json({ ok: true });
});

// === DELETE /playlist ===
app.delete("/playlist", (req, res) => {
  console.log("🗑 DELETE /playlist ejecutado");
  fs.writeFileSync(PLAYLIST_FILE, "[]");
  io.emit("playlist_actualizada", []); // 🔔 Notifica lista vacía
  res.json({ ok: true });
});

// === WebSocket ===
io.on("connection", socket => {
  console.log("🟢 Cliente conectado");

  const lista = JSON.parse(fs.readFileSync(PLAYLIST_FILE, "utf8"));
  socket.emit("playlist_actualizada", lista);

  socket.on("nuevo_mensaje", (msg) => {
    console.log("💬 Mensaje recibido:", msg);
    io.emit("mensaje_recibido", msg); // reenvía a todos (incluido el que lo envió)
  });

  socket.on("disconnect", () => {
    console.log("🔴 Cliente desconectado");
  });
});


// === Servir el frontend ===
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRONTEND_PATH = path.join(__dirname, "../frontend");
app.use(express.static(FRONTEND_PATH));

app.get("/", (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, "index.html"));
});

// ... tus rutas /playlist GET, POST, DELETE, etc.

// === 🔍 Buscador de videos usando mirrors públicos de YouTube ===
app.get("/search", async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: "Falta parámetro ?q=" });

  // Mirrors públicos (orden de prioridad)
  const mirrors = [
    `https://yt.artemislena.eu/api/v1/search?q=${encodeURIComponent(query)}`,
    `https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(query)}`,
    `https://pipedapi.syncpundit.com/search?q=${encodeURIComponent(query)}`
  ];

  for (const url of mirrors) {
    try {
      console.log(`🛰️ Intentando: ${url}`);
      const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!response.ok) throw new Error(`Mirror no respondió (${response.status})`);
      const data = await response.json();

      // Filtra solo videos
      const videos = data
        .filter(v => v.type === "video")
        .slice(0, 20)
        .map(v => ({
          title: v.title,
          url: `https://www.youtube.com/watch?v=${v.videoId}`,
          thumbnail: v.thumbnail || v.thumbnailUrl,
          duration: v.lengthSeconds || v.duration,
          author: v.author || v.uploaderName
        }));

      if (videos.length > 0) {
        console.log(`✅ Resultados obtenidos de: ${url}`);
        return res.json(videos);
      }

    } catch (err) {
      console.warn(`⚠️ Error con ${url}: ${err.message}`);
      // intenta con el siguiente mirror
    }
  }

  // Si todos fallan
  res.status(502).json({ error: "No se pudo obtener resultados desde ningún mirror" });
});


// 🧩 Server listen (mantener al final)
server.listen(PORT, () => {
  console.log(`🎧 Servidor Rocola + WebSocket activo en http://localhost:${PORT}`);
});
