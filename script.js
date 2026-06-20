/* =========================================================
   GRANIZADOS EL FRESCOR — lógica del menú y el carrito
   Fase 3: el pedido ya se guarda de verdad en Firestore,
   así no se pierde y el puesto puede verlo en otra pantalla.
   ========================================================= */

import { guardarPedido } from "./firebase-init.js";

// 1) LOS DATOS DEL MENÚ
// En un sistema real esto vendría de una base de datos.
// Por ahora es un simple arreglo de objetos: nuestra "fuente de la verdad".
const MENU = [
  { id: "cereza",     name: "Cereza",          desc: "El clásico de toda la vida", price: 3000, flavor: "cereza" },
  { id: "mango",      name: "Mango",           desc: "Dulce y tropical",            price: 3000, flavor: "mango" },
  { id: "limon",      name: "Limón",           desc: "Refrescante, el más pedido",  price: 2500, flavor: "limon" },
  { id: "mora",       name: "Mora azul",       desc: "Intenso y frutal",            price: 3000, flavor: "mora" },
  { id: "tamarindo",  name: "Tamarindo",       desc: "Agridulce, para valientes",   price: 3500, flavor: "tamarindo" },
];

// 2) EL ESTADO DEL CARRITO
// Usamos un objeto { idDelProducto: cantidad }. Ej: { cereza: 2, mango: 1 }
// Es la estructura más simple posible para "qué hay en el carrito".
let cart = {};

// 3) REFERENCIAS A ELEMENTOS DEL DOM (los buscamos una sola vez)
const menuEl = document.getElementById("menu");
const filtersEl = document.getElementById("flavorFilters");
const cartToggle = document.getElementById("cartToggle");
const cartDrawer = document.getElementById("cartDrawer");
const overlay = document.getElementById("overlay");
const closeCartBtn = document.getElementById("closeCart");
const cartItemsEl = document.getElementById("cartItems");
const cartEmptyMsg = document.getElementById("cartEmptyMsg");
const cartCountEl = document.getElementById("cartCount");
const cartTotalEl = document.getElementById("cartTotal");
const cartTotalFullEl = document.getElementById("cartTotalFull");
const confirmOrderBtn = document.getElementById("confirmOrder");
const confirmationEl = document.getElementById("orderConfirmation");
const orderNumberEl = document.getElementById("orderNumber");
const newOrderBtn = document.getElementById("newOrder");

// Formatea números como pesos: 3000 -> "3.000"
function formatPrice(n) {
  return n.toLocaleString("es-CO");
}

// 4) PINTAR EL MENÚ EN PANTALLA
// Recibe un filtro ("all" o un sabor) y dibuja solo lo que corresponde.
function renderMenu(filter = "all") {
  menuEl.innerHTML = ""; // limpiamos antes de volver a pintar

  MENU.forEach((item) => {
    const card = document.createElement("article");
    card.className = "flavor-card";
    card.style.setProperty("--card-color", `var(--${item.flavor})`);
    if (filter !== "all" && filter !== item.flavor) {
      card.classList.add("hidden");
    }

    card.innerHTML = `
      <div class="stripe"></div>
      <div class="info">
        <span class="name">${item.name}</span>
        <span class="desc">${item.desc}</span>
        <span class="price">$${formatPrice(item.price)}</span>
      </div>
      <button class="add-btn" data-id="${item.id}" aria-label="Agregar ${item.name}">+</button>
    `;
    menuEl.appendChild(card);
  });
}

// 5) AGREGAR / QUITAR DEL CARRITO
function addToCart(id) {
  cart[id] = (cart[id] || 0) + 1;
  renderCart();
}

function changeQty(id, delta) {
  cart[id] = (cart[id] || 0) + delta;
  if (cart[id] <= 0) delete cart[id];
  renderCart();
}

// 6) CALCULAR TOTALES
// Object.entries(cart) convierte { cereza: 2 } en [["cereza", 2], ...]
function getCartItems() {
  return Object.entries(cart).map(([id, qty]) => {
    const product = MENU.find((m) => m.id === id);
    return { ...product, qty, subtotal: product.price * qty };
  });
}

function getCartTotal(items) {
  return items.reduce((sum, item) => sum + item.subtotal, 0);
}

function getCartCount(items) {
  return items.reduce((sum, item) => sum + item.qty, 0);
}

// 7) PINTAR EL CARRITO (lista, totales, barra inferior)
function renderCart() {
  const items = getCartItems();
  const total = getCartTotal(items);
  const count = getCartCount(items);

  // Barra inferior
  cartCountEl.textContent = count;
  cartTotalEl.textContent = formatPrice(total);
  cartToggle.classList.toggle("empty", count === 0);

  // Lista dentro del panel
  cartTotalFullEl.textContent = formatPrice(total);
  confirmOrderBtn.disabled = count === 0;

  if (items.length === 0) {
    cartItemsEl.innerHTML = "";
    cartItemsEl.appendChild(cartEmptyMsg);
    return;
  }

  cartItemsEl.innerHTML = items.map((item) => `
    <li class="cart-row" style="--row-color: var(--${item.flavor})">
      <span class="swatch"></span>
      <span class="row-name">${item.name}</span>
      <div class="qty-control">
        <button data-action="dec" data-id="${item.id}" aria-label="Quitar uno">−</button>
        <span>${item.qty}</span>
        <button data-action="inc" data-id="${item.id}" aria-label="Agregar uno">+</button>
      </div>
      <span class="row-price">$${formatPrice(item.subtotal)}</span>
    </li>
  `).join("");
}

// 8) ABRIR / CERRAR EL PANEL DEL CARRITO
function openCart() {
  cartDrawer.classList.add("open");
  overlay.classList.add("open");
  cartDrawer.setAttribute("aria-hidden", "false");
}

function closeCart() {
  cartDrawer.classList.remove("open");
  overlay.classList.remove("open");
  cartDrawer.setAttribute("aria-hidden", "true");
}

// 9) CONFIRMAR PEDIDO
// Ahora sí lo mandamos a Firestore con guardarPedido(). Es async porque
// hablar con la base de datos toma un instante; "await" espera esa respuesta
// antes de seguir, sin congelar el resto de la página.
async function confirmOrder() {
  const items = getCartItems();
  const total = getCartTotal(items);
  const orderNumber = Math.floor(100 + Math.random() * 900); // ej: 482

  confirmOrderBtn.disabled = true;
  confirmOrderBtn.textContent = "Enviando...";

  try {
    await guardarPedido({
      orderNumber,
      items: items.map(({ id, name, qty, price, subtotal }) => ({ id, name, qty, price, subtotal })),
      total,
    });
  } catch (err) {
    console.error("No se pudo guardar el pedido:", err);
    alert("No se pudo enviar el pedido. Revisá tu conexión e intentá de nuevo.");
    confirmOrderBtn.disabled = false;
    confirmOrderBtn.textContent = "Confirmar pedido";
    return;
  }

  orderNumberEl.textContent = orderNumber;
  confirmationEl.hidden = false;
  closeCart();

  cart = {};
  renderCart();
  confirmOrderBtn.textContent = "Confirmar pedido";
}

function startNewOrder() {
  confirmationEl.hidden = true;
}

// 10) CONECTAR TODO CON EVENTOS
// "Delegación de eventos": en vez de poner un listener por cada botón,
// escuchamos en el contenedor padre y miramos qué se tocó. Es más eficiente
// y sigue funcionando aunque el menú se vuelva a pintar.
menuEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".add-btn");
  if (btn) addToCart(btn.dataset.id);
});

cartItemsEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const delta = btn.dataset.action === "inc" ? 1 : -1;
  changeQty(btn.dataset.id, delta);
});

filtersEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".dot");
  if (!btn) return;
  filtersEl.querySelectorAll(".dot").forEach((d) => d.classList.remove("active"));
  btn.classList.add("active");
  renderMenu(btn.dataset.flavor);
});

cartToggle.addEventListener("click", openCart);
closeCartBtn.addEventListener("click", closeCart);
overlay.addEventListener("click", closeCart);
confirmOrderBtn.addEventListener("click", confirmOrder);
newOrderBtn.addEventListener("click", startNewOrder);

// 11) PRIMER PINTADO AL CARGAR LA PÁGINA
renderMenu();
renderCart();
