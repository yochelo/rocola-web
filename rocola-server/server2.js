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





// 🔹 Servir archivos estáticos (front)
app.use(express.static(__dirname));

// 🔹 Ruta raíz (si alguien entra a / o /index.html)
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});


server.listen(PORT, () =>
  console.log(`🎧 Servidor Rocola + WebSocket activo en http://localhost:${PORT}`)
);
