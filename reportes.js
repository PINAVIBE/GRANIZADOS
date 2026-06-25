/* =========================================================
   reportes.js — historial de ventas
   A diferencia de pedidos.js (que escucha en vivo con onSnapshot),
   acá usamos getDocs: traemos los datos UNA vez por cada botón de
   rango que se toca, porque un reporte no necesita actualizarse
   solo segundo a segundo.
   ========================================================= */

import { db, iniciarSesion, cerrarSesion, alCambiarSesion } from "./firebase-init.js";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const loginScreen = document.getElementById("loginScreen");
const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginError = document.getElementById("loginError");
const logoutBtn = document.getElementById("logoutBtn");

const reportesMain = document.getElementById("reportesMain");
const rangeButtons = document.getElementById("rangeButtons");
const statTotal = document.getElementById("statTotal");
const statCount = document.getElementById("statCount");
const statAvg = document.getElementById("statAvg");
const topFlavorsList = document.getElementById("topFlavorsList");
const ordersTable = document.getElementById("ordersTable");

let rangoActual = "hoy";

function formatPrice(n) {
  return n.toLocaleString("es-CO");
}

// Mismo motivo que en pedidos.js: el contenido de un pedido (nota,
// nombres) lo escribió un cliente, así que lo escapamos antes de
// insertarlo como HTML.
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}

// Calcula desde qué fecha hay que mirar, según el botón elegido.
// "todo" devuelve null (sin filtro de fecha).
function calcularInicio(rango) {
  const hoy = new Date();

  if (rango === "hoy") {
    const inicio = new Date();
    inicio.setHours(0, 0, 0, 0);
    return inicio;
  }

  if (rango === "semana") {
    const inicio = new Date();
    const diaSemana = inicio.getDay(); // 0 = domingo, 1 = lunes...
    const diasDesdeElLunes = diaSemana === 0 ? 6 : diaSemana - 1;
    inicio.setDate(inicio.getDate() - diasDesdeElLunes);
    inicio.setHours(0, 0, 0, 0);
    return inicio;
  }

  if (rango === "mes") {
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    inicio.setHours(0, 0, 0, 0);
    return inicio;
  }

  return null; // "todo"
}

// Trae de Firestore los pedidos entregados del período elegido.
async function cargarReporte(rango) {
  rangoActual = rango;
  document.querySelectorAll(".range-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.range === rango);
  });

  topFlavorsList.innerHTML = `<p class="empty-msg-reportes">Cargando...</p>`;
  ordersTable.innerHTML = "";

  const inicio = calcularInicio(rango);
  const filtros = [where("estado", "==", "entregado")];
  if (inicio) filtros.push(where("creadoEn", ">=", inicio));

  const pedidosQuery = query(
    collection(db, "pedidos"),
    ...filtros,
    orderBy("creadoEn", "desc")
  );

  let pedidos = [];
  try {
    const snapshot = await getDocs(pedidosQuery);
    pedidos = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("No se pudo cargar el reporte:", err);
    topFlavorsList.innerHTML = `<p class="empty-msg-reportes">No se pudo cargar. Si la consola muestra un link para "crear índice", hacé clic ahí una vez y volvé a intentar.</p>`;
    return;
  }

  renderReporte(pedidos);
}

function renderReporte(pedidos) {
  // ---- Totales generales ----
  const total = pedidos.reduce((suma, p) => suma + p.total, 0);
  const cantidad = pedidos.length;
  const promedio = cantidad ? Math.round(total / cantidad) : 0;

  statTotal.textContent = `$${formatPrice(total)}`;
  statCount.textContent = cantidad;
  statAvg.textContent = `$${formatPrice(promedio)}`;

  // ---- Ranking de sabores ----
  // El nombre guardado es algo como "Cereza (Grande) + Leche condensada".
  // Para agrupar por sabor sin importar tamaño/extras, nos quedamos con
  // lo que hay antes del primer paréntesis.
  const sabores = {};
  pedidos.forEach((p) => {
    (p.items || []).forEach((it) => {
      const base = it.name.split(" (")[0].trim();
      if (!sabores[base]) sabores[base] = { qty: 0, revenue: 0 };
      sabores[base].qty += it.qty;
      sabores[base].revenue += it.subtotal;
    });
  });

  const ranking = Object.entries(sabores).sort((a, b) => b[1].qty - a[1].qty);

  if (ranking.length === 0) {
    topFlavorsList.innerHTML = `<p class="empty-msg-reportes">No hay ventas en este período</p>`;
  } else {
    const maxQty = ranking[0][1].qty;
    topFlavorsList.innerHTML = ranking.map(([nombre, datos]) => `
      <div class="flavor-bar-row">
        <span class="flavor-bar-name">${escapeHtml(nombre)}</span>
        <div class="flavor-bar-track">
          <div class="flavor-bar-fill" style="width:${(datos.qty / maxQty) * 100}%"></div>
        </div>
        <span class="flavor-bar-count">${datos.qty} uds · $${formatPrice(datos.revenue)}</span>
      </div>
    `).join("");
  }

  // ---- Tabla con cada pedido ----
  if (pedidos.length === 0) {
    ordersTable.innerHTML = `<p class="empty-msg-reportes">No hay pedidos entregados en este período</p>`;
    return;
  }

  ordersTable.innerHTML = `
    <table class="orders-table">
      <thead>
        <tr><th>Orden</th><th>Fecha</th><th>Detalle</th><th>Total</th></tr>
      </thead>
      <tbody>
        ${pedidos.map((p) => `
          <tr>
            <td>#${p.orderNumber}</td>
            <td>${p.creadoEn ? p.creadoEn.toDate().toLocaleString("es-CO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
            <td class="od-items">${(p.items || []).map((it) => `${it.qty}× ${escapeHtml(it.name)}`).join(", ")}</td>
            <td>$${formatPrice(p.total)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

// ---------- LOGIN (mismo patrón que pedidos.js) ----------
alCambiarSesion((user) => {
  if (user) {
    loginScreen.hidden = true;
    reportesMain.hidden = false;
    logoutBtn.hidden = false;
    cargarReporte(rangoActual);
  } else {
    loginScreen.hidden = false;
    reportesMain.hidden = true;
    logoutBtn.hidden = true;
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

rangeButtons.addEventListener("click", (e) => {
  const btn = e.target.closest(".range-btn");
  if (!btn) return;
  cargarReporte(btn.dataset.range);
});
