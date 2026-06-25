import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

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
export const auth = getAuth(app);

// Funciones de login, para que pedidos.js no tenga que conocer
// los detalles de cómo habla con Firebase Authentication.
export function iniciarSesion(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function cerrarSesion() {
  return signOut(auth);
}

// Avisa cada vez que cambia el estado de sesión (entra o sale alguien).
export function alCambiarSesion(callback) {
  return onAuthStateChanged(auth, callback);
}

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
