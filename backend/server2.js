// ---------- Dependencias (CommonJS)
const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

// node-fetch v3 es ESM: wrapper dinámico para CommonJS
const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));

// ---------- App & Server
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = 5000;

// ---------- Middlewares
app.use(cors());
app.use(express.json());

// ---------- Servir frontend
const FRONTEND_PATH = path.join(__dirname, "../frontend");
app.use(express.static(FRONTEND_PATH));
app.get("/", (_req, res) => res.sendFile(path.join(FRONTEND_PATH, "index.html")));

// ---------- Playlist (archivo local)
const PLAYLIST_PATH = path.join(__dirname, "playlist.json");
function readPlaylist() {
  try { return JSON.parse(fs.readFileSync(PLAYLIST_PATH, "utf-8") || "[]"); }
  catch { return []; }
}
function writePlaylist(data) { fs.writeFileSync(PLAYLIST_PATH, JSON.stringify(data, null, 2), "utf-8"); }

app.get("/playlist", (_req, res) => res.json(readPlaylist()));

app.post("/agregar", (req, res) => {
  console.log("📩 POST /agregar ejecutado. Body:", req.body);

  // Acepta tanto id como link, para compatibilidad con el front
  const { id, titulo, duracion, link } = req.body || {};

  // Si no viene el id, lo derivamos del link (después del v=)
  const videoId = id || (link ? link.split("v=")[1] : null);
  if (!videoId || !titulo) {
    console.log("⚠️ Faltan campos en body:", req.body);
    return res.status(400).json({ error: "Faltan campos" });
  }

  const list = readPlaylist();

  // Evitar duplicados
  if (list.some(v => v.id === videoId)) {
    console.log("⚠️ Video ya existe en la lista:", videoId);
    return res.json({ ok: false, msg: "Ya estaba en la lista" });
  }

  const nueva = {
    id: videoId,
    titulo,
    duracion: duracion || null,
    link: link || `https://www.youtube.com/watch?v=${videoId}`,
    reproducida: false,
    enReproduccion: false,
    ts: Date.now()
  };

  list.push(nueva);
  writePlaylist(list);
  io.emit("playlist_actualizada", list);

  console.log("✅ Canción agregada:", nueva.titulo);
  res.json({ ok: true, total: list.length });
});


app.post("/limpiar", (_req, res) => {
  writePlaylist([]);
  io.emit("playlist_actualizada", []);
  res.json({ ok: true });
});

// ---------- Socket.IO
io.on("connection", (socket) => {
  console.log("🟢 Cliente conectado");

  // 📀 Envía la lista actual al conectarse
  socket.emit("playlist_actualizada", readPlaylist());

  // 💬 Chat del muro (Maestro e Invitado)
  socket.on("nuevo_mensaje", (msg) => {
    console.log("💬 Mensaje recibido:", msg);
    io.emit("mensaje_recibido", msg); // reenviarlo a todos
  });

  // 🎵 Sincronización de reproducción (Maestro → Invitados)
  socket.on("cancion_en_reproduccion", (data) => {
    console.log("🎧 Reproducción actualizada");
    io.emit("playlist_actualizada", data.lista);
  });

  socket.on("disconnect", () => {
    console.log("🔴 Cliente desconectado");
  });
});


// ---------- Búsqueda con youtube-sr
const ytsr = require("youtube-sr").default;

app.get("/search", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.status(400).json({ error: "Falta parámetro q" });

    const results = await ytsr.search(q, { limit: 10, safeSearch: false });
    const videos = results.map(v => ({
      id: v.id,
      titulo: v.title,
      duracion: v.durationFormatted,
      thumbnail: v.thumbnail?.url,
      url: v.url
    }));

    res.json(videos);
  } catch (err) {
    console.error("❌ Error en búsqueda:", err);
    res.status(500).json({ error: "Error interno en búsqueda" });
  }
});

const os = require("os");

app.get("/local-ip", (req, res) => {
  const nets = os.networkInterfaces();
  let localIP = "localhost";
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        localIP = net.address;
      }
    }
  }
  res.json({ ip: localIP });
});


// ---------- Arranque
server.listen(PORT, () => {
  console.log(`🎧 Servidor Rocola + WebSocket activo en http://localhost:${PORT}`);
});
