
// === DETECCIÓN DE IP DEL MAESTRO DESDE EL QR ===
const params = new URLSearchParams(window.location.search);
const ipParam = params.get("maestro");

if (ipParam) {
  // Si el link venía con ?maestro=http://192.168.x.x:5000
  window.ipMaestro = ipParam;
  console.log("🎯 IP del Maestro detectada:", window.ipMaestro);
}

// === CONFIGURACIÓN DE CONEXIÓN ===
// En modo Maestro, el backend corre local en su PC (localhost:5000)
// En modo Invitado, se setea window.ipMaestro al escanear el QR

let API_BASE;

if (window.ipMaestro) {
  // Invitado: IP del Maestro obtenida desde QR
  API_BASE = window.ipMaestro;
} else {
  // Maestro (modo local)
  API_BASE = "http://localhost:5000";
}

// === Socket.IO ===
const socket = io(API_BASE);



// 🔔 Cuando el backend emite "playlist_actualizada"
socket.on("playlist_actualizada", (nuevaLista) => {
  listaCanciones = nuevaLista;
  renderLista();
});


let listaCanciones = [];

// Mostrar módulos
function mostrarModulo(nombre) {
  // Oculta todos los módulos
  document.querySelectorAll(".mod").forEach(m => m.classList.remove("active"));
  
  // Muestra el módulo elegido
  document.getElementById(`mod-${nombre}`).classList.add("active");

  // Mostrar u ocultar header/footer
  const topbar = document.querySelector(".banner-rocola");
  const footer = document.querySelector(".footer");

  if (nombre === "inicio") {
    topbar.style.display = "none";
    footer.style.display = "none";
  } else {
    topbar.style.display = "block";
    footer.style.display = "block";
  }
}


// Cambiar pestaña
function cambiarPestaña(rol, pestaña) {
  document.querySelectorAll(`#mod-${rol} .tabpane`).forEach(t => t.classList.remove("active"));
  document.getElementById(`tab-${rol}-${pestaña}`).classList.add("active");
  document.querySelectorAll(`#mod-${rol} .tab`).forEach(t => t.classList.remove("active"));
  event.target.classList.add("active");
}

// Renderizar lista
// Renderizar lista
function renderLista() {
  const maestro = document.getElementById("lista-maestro");
  const invitado = document.getElementById("lista-invitado");
  maestro.innerHTML = "";
  invitado.innerHTML = "";

  listaCanciones.forEach((c, i) => {
    // --- Elemento para Maestro ---
    const liM = document.createElement("li");
    let color = "#fff";
    let fontSize = "1rem";
    let emoji = "⏳";

    if (c.enReproduccion) {
      color = "#00ff00";
      fontSize = "1.25rem";
      emoji = "🎵";
    } else if (c.reproducida) {
      color = "#888";
      emoji = "✓";
    }

    liM.textContent = `${emoji} ${c.titulo}`;
    liM.style.color = color;
    liM.style.fontSize = fontSize;
    liM.style.padding = "4px 0";
    liM.style.userSelect = "none";
    liM.style.cursor = "pointer";

    // 👇 Click: maestro marca canción y notifica a todos
    liM.onclick = () => {
      // 1️⃣ Actualiza estados internos
      listaCanciones.forEach((c, j) => {
        c.reproducida = j < i;
        c.enReproduccion = j === i;
      });

      // 2️⃣ Enviar actualización al backend
      socket.emit("cancion_en_reproduccion", {
        lista: listaCanciones
      });

      // 3️⃣ Refrescar vista local
      renderLista();

      // 4️⃣ Abrir la canción en YouTube (si el maestro está en PC o móvil)
      if (c.id) {
        window.open(`https://www.youtube.com/watch?v=${c.id}`, "_blank");
      }
    };

    maestro.appendChild(liM);

    // --- Elemento para Invitado ---
    const liI = liM.cloneNode(true);
    liI.style.cursor = "default"; // los invitados no pueden controlar
    invitado.appendChild(liI);
  });
}

// === ▶️ Reproducir la canción i-ésima ===
function reproducirCancion(index) {
  const seleccionada = listaCanciones[index];
  if (!seleccionada || !seleccionada.link) return;

  // 🔄 estados tipo Kotlin: todo antes = reproducido, actual = enReproduccion
  listaCanciones.forEach((c, i) => {
    c.reproducida = i < index;
    c.enReproduccion = i === index;
  });

  renderLista();

  // 🎬 Abre YouTube (en Android suele ofrecer abrir la app oficial)
  window.open(seleccionada.link, "_blank");
}



// Agregar canción
function agregarCancion() {
  const input = document.getElementById("titulo-o-link");
  const titulo = input.value.trim();
  if (!titulo) return alert("Ingresá un título o link válido");
  listaCanciones.push({ titulo });
  input.value = "";
  renderLista();
}

// Limpiar lista
function limpiarLista() {
  if (confirm("¿Seguro que querés limpiar la lista?")) {
    listaCanciones = [];
    renderLista();
  }
}

// Refrescar
function forzarRefresh() {
  renderLista();
}
  async function buscarVideosLocal() {
    const q = document.getElementById("yt-busqueda").value.trim();
    if (!q) return alert("Escribí algo para buscar 🎵");
    document.getElementById("yt-info").textContent = "Buscando...";

    try {
      const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();


      if (!data.length) {
        document.getElementById("yt-info").textContent = "No se encontraron resultados.";
        return;
      }

      // 🟢 Convertimos el formato para renderResultados()
      const videos = data.map(v => ({
        id: v.id,                      // viene del proxy
        titulo: v.titulo || v.title || "Sin título"
      }));

      // 🎬 Mostramos en pantalla
      renderResultados(videos);

      // Limpiamos mensaje
      document.getElementById("yt-info").textContent = `✅ ${videos.length} resultados para '${q}'`;

    } catch (err) {
      console.error("Error buscando videos:", err);
      document.getElementById("yt-info").textContent = "Error al buscar videos 😕";
    }
  }


function reproducir(id) {
  const iframe = document.getElementById("yt-iframe");
  iframe.src = `https://www.youtube.com/embed/${id}`;
}

function agregarDesdeLista(link, titulo) {
  listaCanciones.push({ titulo, link });
  guardarEnStorage();
  renderLista();
  cambiarPestaña("maestro", "lista");
}

let player = document.getElementById("previewPlayer");
let bloqueoAgregar = false; // 👈 evita doble toque rápido
/*
function mostrarOpciones(el) {
  // Cierra cualquier otro activo
  document.querySelectorAll(".resultado").forEach(r => {
    if (r !== el) r.classList.remove("activo");
  });

  // Alterna el estado del actual
  el.classList.toggle("activo");
}
*/
function previewCancion(e, btn) {
  e.stopPropagation();
  const videoId = btn.closest(".resultado").dataset.id;
  const url = `https://www.youtube.com/embed/${videoId}?autoplay=1`;

  player.src = url;

  // Marca visual del botón activo
  document.querySelectorAll(".btn.preview").forEach(b => b.classList.remove("tocado"));
  btn.classList.add("tocado");
}

function agregarCancion(e, btn) {
  e.stopPropagation();

  if (bloqueoAgregar) return; // 👈 evita doble toque

  bloqueoAgregar = true;
  btn.classList.add("tocado");

  const card = btn.closest(".resultado");
  card.classList.remove("activo");

  // Simulación: agregado exitoso
  card.style.background = "rgba(40, 167, 69, 0.4)"; // verde translúcido
  card.innerHTML += `<div class="tilde">✅</div>`;

  // 🔒 Bloqueo temporal de 1 segundo
  setTimeout(() => {
    bloqueoAgregar = false;
    card.querySelector(".tilde")?.remove();
    card.style.background = "#1a1a1a";
    btn.classList.remove("tocado");
  }, 1000);
}
// === 🔹 Generador dinámico de resultados ===
function renderResultados(videos) {
  const contenedor = document.getElementById("resultados");
  contenedor.innerHTML = "";

  videos.forEach(video => {
    const div = document.createElement("div");
    div.className = "resultado";
    div.dataset.id = video.id;
    div.innerHTML = `
      <img src="https://img.youtube.com/vi/${video.id}/0.jpg" alt="">
      <p>${video.titulo}</p>
      <div class="opciones">
        <button class="btn agregar" onclick="agregarDesdeResultados(event, this)">Agregar</button>
        <button class="btn preview" onclick="previewCancion(event, this)">Preview</button>
      </div>
    `;
    div.onclick = () => mostrarOpciones(div);
    contenedor.appendChild(div);
  });
}

// === 🔹 Mostrar botones Agregar / Preview ===
let resultadoActivo = null;

function mostrarOpciones(div) {
  // Si hay otro abierto, lo cierra
  if (resultadoActivo && resultadoActivo !== div) {
    resultadoActivo.classList.remove("activo");
  }
  // Alterna el actual
  div.classList.toggle("activo");
  resultadoActivo = div.classList.contains("activo") ? div : null;
}

// === 🔹 Preview dinámico ===
function previewCancion(event, btn) {
  event.stopPropagation();
  const id = btn.closest(".resultado").dataset.id;
  const iframe = document.getElementById("previewPlayer");
  iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`;
}

// === ➕ Agregar desde los resultados de búsqueda (overlay) ===
// 🧑‍🎤 Agregar desde resultados (Maestro)
async function agregarDesdeResultados(event, btn) {
  event.stopPropagation();
  if (btn.disabled) return;

  const card = btn.closest(".resultado");
  const videoId = card.dataset.id;
  const titulo = card.querySelector("p").textContent;
  const link = `https://www.youtube.com/watch?v=${videoId}`;

  const nueva = { titulo, link, reproducida: false, enReproduccion: false };

  try {
    // 💾 Enviamos la canción al backend local (mock Firebase)
    await fetch(`${API_BASE}/agregar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nueva)
    });

    // 🔄 Actualizamos la lista local desde el servidor
    await actualizarListaDesdeServidor();

    // ✅ Feedback visual en el botón
    btn.textContent = "✔ Agregada";
    btn.disabled = true;
    btn.style.background = "rgba(0,200,0,0.4)";
  } catch (err) {
    console.error("Error agregando canción (Maestro):", err);
  }
}


//-------------------MODO INVITADO----------------------------------------

function compartirLink(link, titulo) {
  if (navigator.share) {
    // 🌍 Móviles y navegadores compatibles
    navigator.share({
      title: titulo,
      text: "Escuchate este tema 🎶",
      url: link
    }).catch(err => console.warn("No se pudo compartir:", err));
  } else {
    // 💻 Escritorio: copia el link al portapapeles
    navigator.clipboard.writeText(link)
      .then(() => alert("🔗 Link copiado al portapapeles"))
      .catch(() => alert("Copialo manualmente:\n" + link));
  }
}


async function buscarVideosLocalInvitado() {
  const q = document.getElementById("yt-busqueda-invitado").value.trim();
  if (!q) return alert("Escribí algo para buscar 🎵");
  document.getElementById("yt-info-invitado").textContent = "Buscando...";

  try {
    const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();


    if (!data.length) {
      document.getElementById("yt-info-invitado").textContent = "No se encontraron resultados.";
      return;
    }

    const videos = data.map(v => ({
      id: v.id,
      titulo: v.titulo || v.title || "Sin título"

    }));

    renderResultadosInvitado(videos);
    document.getElementById("yt-info-invitado").textContent = `✅ ${videos.length} resultados para '${q}'`;
  } catch (err) {
    console.error("Error buscando videos (Invitado):", err);
    document.getElementById("yt-info-invitado").textContent = "Error al buscar videos 😕";
  }
}

// === 🎬 Render para Invitado ===
function renderResultadosInvitado(videos) {
  const contenedor = document.getElementById("resultados-invitado");
  contenedor.innerHTML = "";

  videos.forEach(video => {
    const div = document.createElement("div");
    div.className = "resultado";
    div.dataset.id = video.id;
    div.innerHTML = `
      <img src="https://img.youtube.com/vi/${video.id}/0.jpg" alt="">
      <p>${video.titulo}</p>
      <div class="opciones">
        <button class="btn agregar" onclick="agregarCancionInvitado(event, this)">Agregar</button>
        <button class="btn preview" onclick="previewCancionInvitado(event, this)">Preview</button>
      </div>
    `;
    div.onclick = () => mostrarOpciones(div);
    contenedor.appendChild(div);
  });
}

// 🎧 Preview del Invitado
function previewCancionInvitado(event, btn) {
  event.stopPropagation();
  const id = btn.closest(".resultado").dataset.id;
  const iframe = document.getElementById("previewPlayerInvitado");
  iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`;
}

// 🎧 Agregar desde resultados (Invitado)
async function agregarCancionInvitado(event, btn) {
  event.stopPropagation();
  if (btn.disabled) return;

  const card = btn.closest(".resultado");
  const videoId = card.dataset.id;
  const titulo = card.querySelector("p").textContent;
  const link = `https://www.youtube.com/watch?v=${videoId}`;

  const nueva = { titulo, link, reproducida: false, enReproduccion: false };

  try {
    // 💾 Enviamos la canción al backend local (mock Firebase)
    await fetch(`${API_BASE}/agregar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nueva)
    });

    // 🔄 Actualizamos la lista desde el servidor
    await actualizarListaDesdeServidor();

    // ✅ Feedback visual
    btn.textContent = "✔ Agregada";
    btn.disabled = true;
    btn.style.background = "rgba(0,200,0,0.4)";
  } catch (err) {
    console.error("Error agregando canción:", err);
  }
}

async function actualizarListaDesdeServidor() {
  try {
    const res = await fetch(`${API_BASE}/playlist`);
    listaCanciones = await res.json();
    renderLista();
  } catch (err) {
    console.error("Error actualizando lista:", err);
  }
}


// Al cargar, ocultar el header y footer en la pantalla de inicio
window.addEventListener("DOMContentLoaded", () => {
  document.querySelector(".banner-rocola").style.display = "none";
  document.querySelector(".footer").style.display = "none";
});

window.addEventListener("load", () => {
  const fondo = document.querySelector("#mod-inicio .fondo");
  
  // Espera a que la imagen esté completamente cargada
  if (fondo.complete) desplazar();
  else fondo.addEventListener("load", desplazar);

  function desplazar() {
    const rect = fondo.getBoundingClientRect();
    const scrollY = window.scrollY + rect.height - window.innerHeight;
    // 👆 calcula la posición exacta del final visible de la imagen

    setTimeout(() => {
      window.scrollTo({
        top: scrollY,
        behavior: "smooth"
      });
    }, 1200); // espera un poco para que se vea la animación inicial
  }
});

const mensajes = [];

// === 💬 Enviar mensaje (funciona para maestro e invitado)
function enviarMensaje(rol = "maestro") {
  const nombreInput = document.getElementById(`nombre-usuario-${rol}`);
  const colorInput  = document.getElementById(`color-usuario-${rol}`);
  const mensajeInput = document.getElementById(`nuevo-mensaje-${rol}`);
  const lista = document.getElementById(`lista-mensajes-${rol}`);

  if (!mensajeInput || !lista) {
    console.warn("⚠️ No se encontraron los elementos para el rol:", rol);
    return;
  }

  const nombre = nombreInput?.value.trim() || "🕵️‍♂️ Anónimo";
  const color  = colorInput?.value || "#00ffe6";
  const texto  = mensajeInput.value.trim();
  if (!texto) return;

  const msg = { nombre, color, texto, rol };

  // 🚀 Enviamos al servidor (que lo reenviará a todos)
  socket.emit("nuevo_mensaje", msg);

  mensajeInput.value = "";
  mensajeInput.focus();
}



// === 🪄 Renderizador de mensajes (tanto recibidos como propios)
socket.on("mensaje_recibido", msg => renderMensaje(msg));

function renderMensaje({ nombre, color, texto }) {
  ["maestro", "invitado"].forEach(rol => {
    const lista = document.getElementById(`lista-mensajes-${rol}`);
    if (!lista) return;
    const div = document.createElement("div");
    div.className = "mensaje-card";
    div.innerHTML = `<strong style="color:${color}">${nombre}</strong><span>${texto}</span>`;
    lista.appendChild(div);
    lista.scrollTop = lista.scrollHeight;
  });
}



function cambiarPestaña(rol, pestaña, el = null) {
  // Oculta todas las pestañas del módulo actual
  document.querySelectorAll(`#mod-${rol} .tabpane`).forEach(t => t.classList.remove("active"));

  // Muestra la pestaña seleccionada
  const tab = document.getElementById(`tab-${rol}-${pestaña}`);
  if (tab) tab.classList.add("active");

  // Actualiza la pestaña activa en la barra de navegación
  document.querySelectorAll(`#mod-${rol} .tab`).forEach(t => t.classList.remove("active"));
  if (el) el.classList.add("active");

  // 🔄 Si se cambia a la pestaña "mensajes", inicializa el nombre
  if (pestaña === "mensajes") {
    setTimeout(activarNombreMuro, 150);
  }
}
// === 💾 CONTROL DE NOMBRE DE USUARIO ===

// 🧩 Muestra o inicializa el nombre en el Muro
function activarNombreMuro() {
  const contenedor = document.querySelector("#nombre-container");
  if (!contenedor) return; // aún no existe en DOM

  const nombreGuardado = localStorage.getItem("nombreUsuario");

  if (nombreGuardado) {
    contenedor.innerHTML = `
      <div id="nombre-mostrado">📣 Posteás como <strong>${nombreGuardado}</strong></div>
      <button id="btn-cambiar-nombre" onclick="cambiarNombre()">Cambiar nombre</button>
    `;
  } else {
    contenedor.innerHTML = `
      <input id="nombre-usuario" type="text" placeholder="Tu nombre o emoji 😎" maxlength="30">
    `;
    const input = contenedor.querySelector("#nombre-usuario");
    input.focus();

    input.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        const nombre = input.value.trim() || "🕵️‍♂️ Anónimo";
        localStorage.setItem("nombreUsuario", nombre);
        activarNombreMuro(); // re-renderiza
      }
    });
  }
}

// 🧩 Permite cambiar el nombre
function cambiarNombre() {
  localStorage.removeItem("nombreUsuario");
  activarNombreMuro();
}

// 🧠 Detecta cuando abrís la pestaña de Muro
function vincularEventosDePestañas() {
  const botones = document.querySelectorAll(".tab");
  botones.forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.textContent.includes("Muro")) {
        // espera un toque a que se muestre la pestaña y renderiza
        setTimeout(activarNombreMuro, 150);
      }
    });
  });
}

// 🪄 Inicializa al cargar la página
window.addEventListener("load", () => {
  vincularEventosDePestañas();
  // Si ya estás en Muro al inicio
  setTimeout(activarNombreMuro, 400);
});

async function limpiarLista() {
  const seguro = confirm("⚠️ ¿Estás seguro de borrar **todas las canciones** de la lista?");
  if (!seguro) return;

  try {
    await fetch(`${API_BASE}/playlist`, { method: "DELETE" });

    listaCanciones = [];
    renderLista();

    alert("🧹 Lista vaciada correctamente");
  } catch (err) {
    console.error("Error al limpiar la lista:", err);
    alert("❌ No se pudo limpiar la lista");
  }
}

function mostrarConfirmacion() {
  const modal = document.getElementById("confirmModal");
  modal.style.display = "flex";

  const yesBtn = document.getElementById("confirmYes");
  const noBtn = document.getElementById("confirmNo");

  // Evita acumular listeners cada vez que se abre
  yesBtn.onclick = async () => {
    modal.style.display = "none";
    try {
      await fetch(`${API_BASE}/playlist`, { method: "DELETE" });
      listaCanciones = [];
      renderLista();
      alert("🧹 Lista vaciada correctamente");
    } catch (err) {
      console.error("Error al limpiar la lista:", err);
      alert("❌ No se pudo limpiar la lista");
    }
  };

  noBtn.onclick = () => {
    modal.style.display = "none";
  };
}

function generarQR(rol, url) {
  const contenedor = document.getElementById(`qr-${rol}`);
  if (!contenedor) return;

  const size = 180;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(url)}&size=${size}x${size}`;

  contenedor.innerHTML = `<img src="${qrUrl}" alt="QR ${rol}" width="${size}" height="${size}" />`;
}

// Generar QR cuando se entra en la pestaña QR
function cambiarPestaña(rol, pestaña, el = null) {
  document.querySelectorAll(`#mod-${rol} .tabpane`).forEach(t => t.classList.remove("active"));
  document.querySelectorAll(`#mod-${rol} .tab`).forEach(t => t.classList.remove("active"));
  document.getElementById(`tab-${rol}-${pestaña}`)?.classList.add("active");
  if (el) el.classList.add("active");

      if (pestaña === "qr") {
      // 🛰️ Pedimos al backend local la IP del Maestro
  fetch(`${API_BASE}/local-ip`)
    .then(res => res.json())
    .then(data => {
      const ip = data.ip;

      // 🌐 URL del backend local del Maestro
      const urlLocal = `http://${ip}:5000`;

      // 🧭 URL del frontend público (Render) — ¡usá tu dominio correcto!
      const urlFrontend = `https://rocola-web.onrender.com/?maestro=${encodeURIComponent(urlLocal)}`;

      // 🧩 Genera el QR que apunta al frontend HTTPS (Render)
      generarQR(rol, urlFrontend);

      // 👇 Muestra solo la IP local para copiar y compartir
      const linkEl = document.getElementById(`qr-link-${rol}`);
      if (linkEl) linkEl.textContent = urlLocal;

      // Guarda ambas URLs
      window.linkQRactual = urlFrontend;
      window.linkLocalVisible = urlLocal;
    })
    .catch(() => {
      const fallback = "http://127.0.0.1:5000";
      const fallbackFrontend = `https://rocola-web.onrender.com/?maestro=${encodeURIComponent(fallback)}`;

      generarQR(rol, fallbackFrontend);
      const linkEl = document.getElementById(`qr-link-${rol}`);
      if (linkEl) linkEl.textContent = fallback;
      window.linkQRactual = fallbackFrontend;
      window.linkLocalVisible = fallback;
    });

  }


  if (pestaña === "mensajes") {
    setTimeout(activarNombreMuro, 150);
  }
}

// 🧩 Generador de QR (usa la API gratuita de qrserver)
function generarQR(rol, url) {
  const contenedor = document.getElementById(`qr-${rol}`);
  if (!contenedor) return;
  const size = 180;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(url)}&size=${size}x${size}`;
  contenedor.innerHTML = `<img src="${qrUrl}" alt="QR ${rol}" width="${size}" height="${size}" />`;
}


// 📋 Copiar link al portapapeles con un toast
function copiarLinkQR(url) {
  if (!navigator.clipboard) {
    alert("Copialo manualmente:\n" + url);
    return;
  }

  navigator.clipboard.writeText(url)
    .then(() => mostrarToast("🔗 Link copiado al portapapeles"))
    .catch(err => {
      console.error("Error al copiar:", err);
      alert("❌ No se pudo copiar el link");
    });
}

// ✨ Toast visual para feedback
function mostrarToast(mensaje) {
  const toast = document.createElement("div");
  toast.textContent = mensaje;
  toast.className = "toast-copiado";
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("visible"), 50);
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 600);
  }, 2200);
}

// 🚨 Captura y muestra errores directamente en pantalla (modo debug móvil)
window.addEventListener("error", (event) => {
  alert("⚠️ Error: " + event.message);
});
window.addEventListener("unhandledrejection", (event) => {
  alert("⚠️ Promesa rechazada: " + event.reason);
});
