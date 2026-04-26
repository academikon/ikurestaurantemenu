import { db } from './firebase-config.js';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

let carrito = [];
const formatPrice = (num) => Number(num).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

const playSound = (url) => {
    const audio = new Audio(url);
    audio.play().catch(() => {}); 
};

// --- FUNCIONES DE NAVEGACIÓN (Ubicadas fuera para evitar errores de scope) ---
window.abrirCarrito = () => document.getElementById('cart-modal').classList.add('active');
window.cerrarCarrito = () => document.getElementById('cart-modal').classList.remove('active');

document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const mesa = params.get('mesa');
    if (mesa) {
        const inputNombre = document.getElementById('nombre-cliente');
        const selectTipo = document.getElementById('tipo-servicio');
        if (inputNombre && selectTipo) {
            inputNombre.value = `Mesa ${mesa}`;
            selectTipo.value = 'Local';
        }
    }

    // Carga de Menú
    onSnapshot(query(collection(db, "menu"), orderBy("nombre")), (snapshot) => {
        document.querySelectorAll('.menu-section').forEach(s => s.innerHTML = '');
        
        snapshot.docs.forEach(docSnap => {
            const d = docSnap.data();
            const id = docSnap.id;
            // Normalizamos el ID para evitar fallos por mayúsculas
            const container = document.getElementById(d.categoria.toLowerCase());
            if (!container) return;

            const card = document.createElement('div');
            card.className = 'menu-item';
            card.innerHTML = `
                <div class="dish-info" onclick="this.parentElement.classList.toggle('active')">
                    <div class="dish-text">
                        <h3>${d.nombre}</h3>
                        <p>${d.descripcion || ''}</p>
                    </div>
                    <strong class="dish-price">${formatPrice(d.precio)}</strong>
                </div>
                <div class="expand-content">
                    <div class="qty-wrapper">
                        <div class="qty-control">
                            <button onclick="window.ajustarCant('${id}', -1)" class="btn-qty">-</button>
                            <span id="cant-${id}" class="qty-num">1</span>
                            <button onclick="window.ajustarCant('${id}', 1)" class="btn-qty">+</button>
                        </div>
                    </div>
                    <button class="btn-add-cart" onclick="window.agregarAlCarrito('${d.nombre}', ${d.precio}, '${id}')">AÑADIR AL PEDIDO</button>
                </div>
            `;
            container.appendChild(card);
        });
    });
});

window.ajustarCant = (id, delta) => {
    const el = document.getElementById(`cant-${id}`);
    if (el) {
        let v = parseInt(el.innerText) + delta;
        if (v >= 1) el.innerText = v;
    }
};

window.agregarAlCarrito = (nombre, precio, id) => {
    const cantEl = document.getElementById(`cant-${id}`);
    const cant = cantEl ? parseInt(cantEl.innerText) : 1;
    carrito.push({ nombre, precio, cantidad: cant, id_prod: id });
    playSound('https://assets.mixkit.co/sfx/preview/mixkit-bubble-pop-up-alert-2358.mp3');
    actualizarCarritoUI();
};

function actualizarCarritoUI() {
    const lista = document.getElementById('cart-items-list');
    const totalEl = document.getElementById('cart-total-price');
    const badge = document.querySelector('.cart-count');
    
    if (!lista || !totalEl) return;

    lista.innerHTML = '';
    let total = 0;

    carrito.forEach((item, index) => {
        total += item.precio * item.cantidad;
        const li = document.createElement('div');
        li.className = 'cart-item';
        li.innerHTML = `
            <div>
                <strong>${item.cantidad}x ${item.nombre}</strong>
                <p>${formatPrice(item.precio * item.cantidad)}</p>
            </div>
            <button class="btn-remove-item" onclick="window.quitarDelCarrito(${index})">Eliminar</button>
        `;
        lista.appendChild(li);
    });

    totalEl.innerText = formatPrice(total);
    if (badge) badge.innerText = carrito.length;
}

window.quitarDelCarrito = (index) => {
    carrito.splice(index, 1);
    actualizarCarritoUI();
};

window.enviarPedido = async () => {
    if (carrito.length === 0) return alert("El carrito está vacío");
    
    const pedido = {
        cliente: document.getElementById('nombre-cliente').value || "Cliente",
        tipo: document.getElementById('tipo-servicio').value,
        items: carrito,
        total: carrito.reduce((sum, i) => sum + (i.precio * i.cantidad), 0),
        estado: 'recibido',
        fecha: serverTimestamp()
    };

    try {
        await addDoc(collection(db, "pedidos"), pedido);
        alert("¡Pedido enviado con éxito!");
        carrito = [];
        actualizarCarritoUI();
        window.cerrarCarrito();
    } catch (e) {
        console.error("Error al enviar:", e);
    }
};

// Navegación de pestañas
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.tab-btn, .menu-section').forEach(el => el.classList.remove('active'));
        btn.classList.add('active');
        const section = document.getElementById(btn.dataset.tab);
        if (section) section.classList.add('active');
    };
});
// Añade esto al final de tu script.js

// 1. Cerrar carrito al hacer clic fuera (en el área oscura)
window.onclick = function(event) {
    const modal = document.getElementById('cart-modal');
    // Si el clic es exactamente en el overlay oscuro y no en sus hijos
    if (event.target === modal) {
        window.cerrarCarrito();
    }
};

// 2. Mejorar la función cerrarCarrito para que sea fluida
window.cerrarCarrito = () => {
    const modal = document.getElementById('cart-modal');
    modal.classList.remove('active');
};

// 3. Asegurar que abrirCarrito funcione con la clase CSS
window.abrirCarrito = () => {
    const modal = document.getElementById('cart-modal');
    modal.classList.add('active');
};
// Detectar clic en el fondo oscuro para cerrar
const modalCarrito = document.getElementById('cart-modal');
if (modalCarrito) {
    modalCarrito.addEventListener('click', (e) => {
        // Si el clic fue en el fondo (el modal) y no en el contenido blanco
        if (e.target === modalCarrito) {
            window.cerrarCarrito();
        }
    });
}
