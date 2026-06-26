

import { guardarPedido } from "./firebase-init.js";

// 1) LOS DATOS DEL MENÚ
// Cada sabor ya no tiene un solo precio: tiene una lista de tamaños,
// cada uno con su propio precio.
const MENU = [
  {
    id: "cereza", name: "Cereza", desc: "El clásico de toda la vida", flavor: "cereza",
    sizes: [
      { id: "pequeno", label: "Pequeño", price: 2500 },
      { id: "mediano", label: "Mediano", price: 3000 },
      { id: "grande", label: "Grande", price: 3800 },
    ],
  },
  {
    id: "mango", name: "Mango", desc: "Dulce y tropical", flavor: "mango",
    sizes: [
      { id: "pequeno", label: "Pequeño", price: 2500 },
      { id: "mediano", label: "Mediano", price: 3000 },
      { id: "grande", label: "Grande", price: 3800 },
    ],
  },
  {
    id: "limon", name: "Limón", desc: "Refrescante, el más pedido", flavor: "limon",
    sizes: [
      { id: "pequeno", label: "Pequeño", price: 2000 },
      { id: "mediano", label: "Mediano", price: 2500 },
      { id: "grande", label: "Grande", price: 3300 },
    ],
  },
  {
    id: "mora", name: "Mora azul", desc: "Intenso y frutal", flavor: "mora",
    sizes: [
      { id: "pequeno", label: "Pequeño", price: 2500 },
      { id: "mediano", label: "Mediano", price: 3000 },
      { id: "grande", label: "Grande", price: 3800 },
    ],
  },
  {
    id: "tamarindo", name: "Tamarindo", desc: "Agridulce, para valientes", flavor: "tamarindo",
    sizes: [
      { id: "pequeno", label: "Pequeño", price: 3000 },
      { id: "mediano", label: "Mediano", price: 3500 },
      { id: "grande", label: "Grande", price: 4300 },
    ],
  },
];

// Los extras son los mismos sin importar el sabor.
const EXTRAS = [
  { id: "leche", name: "Leche condensada", price: 500 },
  { id: "gomitas", name: "Gomitas", price: 700 },
  { id: "tapioca", name: "Bolitas de tapioca", price: 900 },
  { id: "chamoy", name: "Chamoy", price: 600 },
];

// Tus llaves Bre-B (el sistema de transferencias inmediatas de Colombia).
// Reemplazá estos valores por tus llaves reales, las que registraste
// desde la app de Nequi / Bancolombia.
const LLAVES_PAGO = {
  nequi: "@NEQUITUCLAVE",       // ej: @NEQUIJUA678
  bancolombia: "0000000000",    // tu llave Bancolombia Negocios (10 dígitos, empieza en 00)
};

// 2) EL ESTADO DEL CARRITO
// Antes era { idSabor: cantidad }. Ahora cada "combo" (sabor + tamaño +
// extras elegidos) es su propia línea, porque dos pedidos de Cereza con
// tamaños distintos no pueden compartir cantidad ni precio.
// cart = { comboKey: { flavorId, sizeId, extraIds: [...], qty } }
let cart = {};

// Qué método de pago eligió el cliente: "efectivo", "nequi" o "bancolombia".
let metodoPagoSeleccionado = "efectivo";

// Estado temporal mientras el cliente está eligiendo tamaño/extras
// para un sabor (antes de tocar "Agregar").
let sheetFlavorId = null;
let selectedSizeId = null;
let selectedExtraIds = new Set();

// 3) REFERENCIAS A ELEMENTOS DEL DOM
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
const orderNoteEl = document.getElementById("orderNote");
const paymentOptionsEl = document.getElementById("paymentOptions");
const paymentLlaveBoxEl = document.getElementById("paymentLlaveBox");
const confirmationEl = document.getElementById("orderConfirmation");
const orderNumberEl = document.getElementById("orderNumber");
const newOrderBtn = document.getElementById("newOrder");

const sizeOverlay = document.getElementById("sizeOverlay");
const sizeSheet = document.getElementById("sizeSheet");
const sizeSheetTitle = document.getElementById("sizeSheetTitle");
const sizeOptionsEl = document.getElementById("sizeOptions");
const extraOptionsEl = document.getElementById("extraOptions");
const closeSizeSheetBtn = document.getElementById("closeSizeSheet");
const addToCartBtn = document.getElementById("addToCartBtn");

function formatPrice(n) {
  return n.toLocaleString("es-CO");
}

function findFlavor(id) {
  return MENU.find((m) => m.id === id);
}

// 4) PINTAR EL MENÚ
function renderMenu(filter = "all") {
  menuEl.innerHTML = "";

  MENU.forEach((item) => {
    const card = document.createElement("article");
    card.className = "flavor-card";
    card.style.setProperty("--card-color", `var(--${item.flavor})`);
    if (filter !== "all" && filter !== item.flavor) {
      card.classList.add("hidden");
    }

    const desdePrecio = item.sizes[0].price;

    card.innerHTML = `
      <div class="stripe"></div>
      <div class="info">
        <span class="name">${item.name}</span>
        <span class="desc">${item.desc}</span>
        <span class="price">Desde $${formatPrice(desdePrecio)}</span>
      </div>
      <button class="add-btn" data-id="${item.id}" aria-label="Elegir tamaño y extras de ${item.name}">+</button>
    `;
    menuEl.appendChild(card);
  });
}

// 5) HOJA DE TAMAÑO Y EXTRAS
// Se abre al tocar "+" en un sabor. El cliente elige tamaño (uno solo)
// y extras (varios), y recién ahí se agrega al carrito.
function openSizeSheet(flavorId) {
  const flavor = findFlavor(flavorId);
  sheetFlavorId = flavorId;
  selectedSizeId = flavor.sizes[1].id; // mediano por defecto
  selectedExtraIds = new Set();

  sizeSheet.style.setProperty("--chip-color", `var(--${flavor.flavor})`);
  renderSizeSheet();

  sizeSheet.classList.add("open");
  sizeOverlay.classList.add("open");
  sizeSheet.setAttribute("aria-hidden", "false");
}

function closeSizeSheet() {
  sizeSheet.classList.remove("open");
  sizeOverlay.classList.remove("open");
  sizeSheet.setAttribute("aria-hidden", "true");
}

// Vuelve a dibujar la hoja completa según lo que esté seleccionado ahora.
// Se llama cada vez que el cliente toca un tamaño o un extra distinto.
function renderSizeSheet() {
  const flavor = findFlavor(sheetFlavorId);
  sizeSheetTitle.textContent = flavor.name;

  sizeOptionsEl.innerHTML = flavor.sizes.map((size) => `
    <button type="button" class="size-chip ${size.id === selectedSizeId ? "selected" : ""}" data-size="${size.id}">
      ${size.label}
      <span class="chip-price">$${formatPrice(size.price)}</span>
    </button>
  `).join("");

  extraOptionsEl.innerHTML = EXTRAS.map((extra) => `
    <label class="extra-row">
      <input type="checkbox" data-extra="${extra.id}" ${selectedExtraIds.has(extra.id) ? "checked" : ""}>
      <span class="extra-name">${extra.name}</span>
      <span class="extra-price">+$${formatPrice(extra.price)}</span>
    </label>
  `).join("");

  const size = flavor.sizes.find((s) => s.id === selectedSizeId);
  const extrasTotal = [...selectedExtraIds].reduce((sum, id) => sum + EXTRAS.find((e) => e.id === id).price, 0);
  addToCartBtn.textContent = `Agregar — $${formatPrice(size.price + extrasTotal)}`;
}

// 6) AGREGAR EL COMBO ELEGIDO AL CARRITO
function addCurrentComboToCart() {
  // sorted() para que "leche+gomitas" y "gomitas+leche" sean la misma clave
  const extrasKey = [...selectedExtraIds].sort().join("+");
  const comboKey = `${sheetFlavorId}__${selectedSizeId}__${extrasKey}`;

  if (cart[comboKey]) {
    cart[comboKey].qty += 1;
  } else {
    cart[comboKey] = {
      flavorId: sheetFlavorId,
      sizeId: selectedSizeId,
      extraIds: [...selectedExtraIds],
      qty: 1,
    };
  }
  closeSizeSheet();
  renderCart();
}

function changeQty(comboKey, delta) {
  cart[comboKey].qty += delta;
  if (cart[comboKey].qty <= 0) delete cart[comboKey];
  renderCart();
}

// 7) CALCULAR TOTALES
// A partir de cada combo del carrito, reconstruimos sabor, tamaño y
// extras para poder mostrar el detalle y calcular el precio real.
function getCartItems() {
  return Object.entries(cart).map(([comboKey, entry]) => {
    const flavor = findFlavor(entry.flavorId);
    const size = flavor.sizes.find((s) => s.id === entry.sizeId);
    const extras = entry.extraIds.map((id) => EXTRAS.find((e) => e.id === id));
    const unitPrice = size.price + extras.reduce((sum, e) => sum + e.price, 0);

    return {
      comboKey,
      flavor,
      qty: entry.qty,
      displayName: `${flavor.name} (${size.label})`,
      extrasLabel: extras.map((e) => e.name).join(", "),
      unitPrice,
      subtotal: unitPrice * entry.qty,
    };
  });
}

function getCartTotal(items) {
  return items.reduce((sum, item) => sum + item.subtotal, 0);
}

function getCartCount(items) {
  return items.reduce((sum, item) => sum + item.qty, 0);
}

// 8.5) MÉTODO DE PAGO
// Pinta los 3 botones (Efectivo/Nequi/Bancolombia) y, si el elegido es
// una transferencia, muestra la llave Bre-B correspondiente con el
// total actualizado para que el cliente la copie.
function renderPaymentOptions() {
  const items = getCartItems();
  const total = getCartTotal(items);

  paymentOptionsEl.innerHTML = `
    <button type="button" class="pay-chip ${metodoPagoSeleccionado === "efectivo" ? "selected" : ""}" data-method="efectivo">💵 Efectivo</button>
    <button type="button" class="pay-chip ${metodoPagoSeleccionado === "nequi" ? "selected" : ""}" data-method="nequi">📱 Nequi</button>
    <button type="button" class="pay-chip ${metodoPagoSeleccionado === "bancolombia" ? "selected" : ""}" data-method="bancolombia">🏦 Bancolombia</button>
  `;

  if (metodoPagoSeleccionado === "efectivo") {
    paymentLlaveBoxEl.hidden = true;
    return;
  }

  const llave = LLAVES_PAGO[metodoPagoSeleccionado];
  const nombreMetodo = metodoPagoSeleccionado === "nequi" ? "Nequi" : "Bancolombia";
  paymentLlaveBoxEl.hidden = false;
  paymentLlaveBoxEl.innerHTML = `
    Envía <strong>$${formatPrice(total)}</strong> por Bre-B a esta llave de ${nombreMetodo}:
    <span class="llave-value">${llave}</span>
    Buscá "Bre-B" en tu app y confirmá el pedido después de transferir.
  `;
}
function renderCart() {
  const items = getCartItems();
  const total = getCartTotal(items);
  const count = getCartCount(items);

  cartCountEl.textContent = count;
  cartTotalEl.textContent = formatPrice(total);
  cartToggle.classList.toggle("empty", count === 0);

  cartTotalFullEl.textContent = formatPrice(total);
  confirmOrderBtn.disabled = count === 0;
  renderPaymentOptions();

  if (items.length === 0) {
    cartItemsEl.innerHTML = "";
    cartItemsEl.appendChild(cartEmptyMsg);
    return;
  }

  cartItemsEl.innerHTML = items.map((item) => `
    <li class="cart-row" style="--row-color: var(--${item.flavor.flavor})">
      <span class="swatch"></span>
      <div class="row-info">
        <span class="row-name">${item.displayName}</span>
        ${item.extrasLabel ? `<span class="row-extra">+ ${item.extrasLabel}</span>` : ""}
      </div>
      <div class="qty-control">
        <button data-action="dec" data-id="${item.comboKey}" aria-label="Quitar uno">−</button>
        <span>${item.qty}</span>
        <button data-action="inc" data-id="${item.comboKey}" aria-label="Agregar uno">+</button>
      </div>
      <span class="row-price">$${formatPrice(item.subtotal)}</span>
    </li>
  `).join("");
}

// 9) ABRIR / CERRAR EL PANEL DEL CARRITO
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

// 10) CONFIRMAR PEDIDO
// El nombre que guardamos ya incluye el tamaño y los extras en texto,
// así la pantalla de pedidos (pedidos.js) no necesita ningún cambio:
// para ella sigue siendo solo "nombre + cantidad + precio".
async function confirmOrder() {
  const items = getCartItems();
  const total = getCartTotal(items);
  const orderNumber = Math.floor(100 + Math.random() * 900);
  const nota = orderNoteEl.value.trim(); // queda en "" si no escribió nada

  confirmOrderBtn.disabled = true;
  confirmOrderBtn.textContent = "Enviando...";

  try {
    await guardarPedido({
      orderNumber,
      items: items.map((item) => ({
        id: item.comboKey,
        name: item.extrasLabel ? `${item.displayName} + ${item.extrasLabel}` : item.displayName,
        qty: item.qty,
        price: item.unitPrice,
        subtotal: item.subtotal,
      })),
      total,
      nota,
      metodoPago: metodoPagoSeleccionado,
      // Si pagó en efectivo, se paga al recoger: no hay nada que "verificar".
      // Si fue Nequi/Bancolombia, queda pendiente hasta que el puesto
      // chequee en su propia app que la plata llegó.
      pagoConfirmado: metodoPagoSeleccionado === "efectivo",
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
  orderNoteEl.value = "";
  metodoPagoSeleccionado = "efectivo";
  renderCart();
  confirmOrderBtn.textContent = "Confirmar pedido";
}

function startNewOrder() {
  confirmationEl.hidden = true;
}

// 11) CONECTAR TODO CON EVENTOS
menuEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".add-btn");
  if (btn) openSizeSheet(btn.dataset.id);
});

sizeOptionsEl.addEventListener("click", (e) => {
  const chip = e.target.closest(".size-chip");
  if (!chip) return;
  selectedSizeId = chip.dataset.size;
  renderSizeSheet();
});

extraOptionsEl.addEventListener("change", (e) => {
  const input = e.target.closest("input[data-extra]");
  if (!input) return;
  if (input.checked) selectedExtraIds.add(input.dataset.extra);
  else selectedExtraIds.delete(input.dataset.extra);
  renderSizeSheet();
});

addToCartBtn.addEventListener("click", addCurrentComboToCart);
closeSizeSheetBtn.addEventListener("click", closeSizeSheet);
sizeOverlay.addEventListener("click", closeSizeSheet);

cartItemsEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const delta = btn.dataset.action === "inc" ? 1 : -1;
  changeQty(btn.dataset.id, delta);
});

paymentOptionsEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".pay-chip");
  if (!btn) return;
  metodoPagoSeleccionado = btn.dataset.method;
  renderPaymentOptions();
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

// 12) PRIMER PINTADO AL CARGAR LA PÁGINA
renderMenu();
renderCart();
