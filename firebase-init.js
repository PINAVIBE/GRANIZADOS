/* =========================================================
   firebase-init.js
   Conexión con Firebase. Un solo lugar con la config y la
   conexión a Firestore, para que script.js solo se preocupe
   del carrito, no de cómo se guardan los datos.

   Como usamos HTML plano (sin npm/Vite/Webpack), importamos
   el SDK de Firebase directo desde su CDN oficial con módulos
   de JavaScript (ESM) — funciona en cualquier navegador moderno.
   ========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// Tu configuración real del proyecto en Firebase.
const firebaseConfig = {
  apiKey: "AIzaSyBL9PgQEnxu3hJzD5u8poqE4VBwN4QeofQ",
  authDomain: "granizados-db0b7.firebaseapp.com",
  projectId: "granizados-db0b7",
  storageBucket: "granizados-db0b7.firebasestorage.app",
  messagingSenderId: "198988219639",
  appId: "1:198988219639:web:f241adb70e5b8c16b0bff2",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Guarda un pedido nuevo en la colección "pedidos".
// Cualquier página (el menú del cliente, la pantalla del puesto)
// puede importar esta función si necesita crear pedidos.
export async function guardarPedido(pedido) {
  const ref = await addDoc(collection(db, "pedidos"), {
    ...pedido,
    estado: "pendiente",
    creadoEn: serverTimestamp(),
  });
  return ref.id;
}
