

import { db, iniciarSesion, cerrarSesion, alCambiarSesion } from "./firebase-init.js";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const cardsPendientes = document.getElementById("cardsPendientes");
const cardsListos = document.getElementById("cardsListos");
const cardsEntregados = document.getElementById("cardsEntregados");
const emptyPendientes = document.getElementById("emptyPendientes");
const emptyListos = document.getElementById("emptyListos");
const emptyEntregados = document.getElementById("emptyEntregados");
const countPendientes = document.getElementById("countPendientes");
const countListos = document.getElementById("countListos");
const countEntregados = document.getElementById("countEntregados");
const totalDinero = document.getElementById("totalDinero");

const loginScreen = document.getElementById("loginScreen");
const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginError = document.getElementById("loginError");
const board = document.getElementById("board");
const logoutBtn = document.getElementById("logoutBtn");

// Guarda la función para "dejar de escuchar" Firestore. La necesitamos
// para cortar la conexión cuando alguien cierra sesión.
let detenerEscucha = null;

// Guardamos los pedidos más recientes vistos, así podemos "refrescar"
// el texto de hace cuánto llegaron sin esperar un cambio nuevo en la base.
let ultimosPedidos = [];
let idsConocidos = new Set();

function formatPrice(n) {
  return n.toLocaleString("es-CO");
}

// El texto de la nota lo escribe el cliente, así que antes de meterlo en el
// HTML hay que "escaparlo": cambiar <, >, & etc. por su versión segura.
// Si no hiciéramos esto, alguien podría escribir código en la nota y que
// se ejecute en tu pantalla de pedidos.
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}

// Convierte un timestamp de Firestore en "hace 2 min"
function haceCuanto(timestamp) {
  if (!timestamp) return "justo ahora";
  const segundos = Math.floor((Date.now() - timestamp.toDate().getTime()) / 1000);
  if (segundos < 60) return "hace instantes";
  const minutos = Math.floor(segundos / 60);
  return `hace ${minutos} min`;
}

function crearTarjeta(pedido) {
  const card = document.createElement("article");
  card.className = "order-card";
  if (pedido.estado === "entregado") card.classList.add("is-entregado");
  if (!idsConocidos.has(pedido.id)) {
    card.classList.add("is-new");
    setTimeout(() => card.classList.remove("is-new"), 4000);
  }

  const itemsHtml = pedido.items
    .map((it) => `<li><span><span class="item-qty">${it.qty}×</span>${it.name}</span><span>$${formatPrice(it.subtotal)}</span></li>`)
    .join("");

  const notaHtml = pedido.nota
    ? `<p class="order-note">📝 ${escapeHtml(pedido.nota)}</p>`
    : "";

  let accion = "";
  if (pedido.estado === "pendiente") {
    accion = `<button class="order-action to-listo" data-id="${pedido.id}" data-next="listo">✅ Marcar como listo</button>`;
  } else if (pedido.estado === "listo") {
    accion = `<button class="order-action to-entregado" data-id="${pedido.id}" data-next="entregado">📦 Marcar como entregado</button>`;
  }
  // Si ya está "entregado" no hay botón: es un estado final, solo queda como registro.

  card.innerHTML = `
    <div class="order-card-head">
      <span class="order-num">Orden #${pedido.orderNumber}</span>
      <span class="order-time">${haceCuanto(pedido.creadoEn)}</span>
    </div>
    <ul class="order-items">${itemsHtml}</ul>
    ${notaHtml}
    <p class="order-total">Total: <strong>$${formatPrice(pedido.total)}</strong></p>
    ${accion}
  `;
  return card;
}

function render() {
  const pendientes = ultimosPedidos.filter((p) => p.estado === "pendiente");
  const listos = ultimosPedidos.filter((p) => p.estado === "listo");
  const entregados = ultimosPedidos.filter((p) => p.estado === "entregado");

  countPendientes.textContent = pendientes.length;
  countListos.textContent = listos.length;
  countEntregados.textContent = entregados.length;

  const recaudadoHoy = entregados.reduce((suma, p) => suma + p.total, 0);
  totalDinero.textContent = `$${formatPrice(recaudadoHoy)}`;

  cardsPendientes.innerHTML = "";
  emptyPendientes.style.display = pendientes.length ? "none" : "block";
  cardsPendientes.appendChild(emptyPendientes);
  pendientes.forEach((p) => cardsPendientes.appendChild(crearTarjeta(p)));

  cardsListos.innerHTML = "";
  emptyListos.style.display = listos.length ? "none" : "block";
  cardsListos.appendChild(emptyListos);
  listos.forEach((p) => cardsListos.appendChild(crearTarjeta(p)));

  cardsEntregados.innerHTML = "";
  emptyEntregados.style.display = entregados.length ? "none" : "block";
  cardsEntregados.appendChild(emptyEntregados);
  // Los más recién entregados arriba, para no tener que scrollear todo el día.
  [...entregados].reverse().forEach((p) => cardsEntregados.appendChild(crearTarjeta(p)));

  idsConocidos = new Set(ultimosPedidos.map((p) => p.id));
}

// Empieza a escuchar la colección "pedidos" en tiempo real.
// Solo se llama cuando sabemos que hay sesión iniciada.
function empezarAEscuchar() {
  // Medianoche de hoy, hora local del navegador.
  const inicioDelDia = new Date();
  inicioDelDia.setHours(0, 0, 0, 0);

  const pedidosQuery = query(
    collection(db, "pedidos"),
    where("creadoEn", ">=", inicioDelDia),
    orderBy("creadoEn", "asc")
  );

  detenerEscucha = onSnapshot(pedidosQuery, (snapshot) => {
    ultimosPedidos = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    render();
  });
}

// Refresca el "hace X min" cada 30s, aunque no llegue ningún pedido nuevo.
setInterval(render, 30000);

// Un solo listener por columna (delegación de eventos) para los botones
// de "marcar como listo" / "marcar como entregado".
function manejarClick(e) {
  const btn = e.target.closest(".order-action");
  if (!btn) return;
  const { id, next } = btn.dataset;
  updateDoc(doc(db, "pedidos", id), { estado: next }).catch((err) => {
    console.error("No se pudo actualizar el pedido:", err);
    alert("No se pudo actualizar el pedido. Probá de nuevo.");
  });
}

cardsPendientes.addEventListener("click", manejarClick);
cardsListos.addEventListener("click", manejarClick);

// ---------- LOGIN ----------
// alCambiarSesion se dispara apenas carga la página (para ver si ya
// había una sesión activa) y de nuevo cada vez que alguien entra o sale.
alCambiarSesion((user) => {
  if (user) {
    // Hay sesión: mostramos el tablero y prendemos la escucha de Firestore.
    loginScreen.hidden = true;
    board.hidden = false;
    logoutBtn.hidden = false;
    if (!detenerEscucha) empezarAEscuchar();
  } else {
    // No hay sesión: mostramos el login y apagamos la escucha
    // (si la dejáramos prendida, Firestore rechazaría los datos
    // por las reglas de seguridad y solo ensuciaría la consola).
    loginScreen.hidden = false;
    board.hidden = true;
    logoutBtn.hidden = true;
    if (detenerEscucha) {
      detenerEscucha();
      detenerEscucha = null;
    }
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.hidden = true;
  try {
    await iniciarSesion(loginEmail.value.trim(), loginPassword.value);
    loginForm.reset();
  } catch (err) {
    console.error(err);
    loginError.textContent = "Correo o contraseña incorrectos.";
    loginError.hidden = false;
  }
});

logoutBtn.addEventListener("click", () => cerrarSesion());
