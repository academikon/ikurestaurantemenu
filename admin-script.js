import { db, auth } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, getDoc, getDocs, serverTimestamp, addDoc, where } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

const CORREO_MASTER = "cb01grupo@gmail.com";
const correosAutorizados = [CORREO_MASTER, "kelly.araujotafur@gmail.com"];

// --- LÓGICA DE SESIÓN ---
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');

if (loginBtn) {
    loginBtn.onclick = () => {
        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider).catch(err => console.error("Error login:", err));
    };
}

if (logoutBtn) {
    logoutBtn.onclick = () => signOut(auth);
}

onAuthStateChanged(auth, (user) => {
    if (user && correosAutorizados.includes(user.email)) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'flex';
        escucharPedidos();
        escucharCarta();
    } else {
        if (user) signOut(auth);
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('admin-panel').style.display = 'none';
    }
});

// --- MONITOR DE PEDIDOS ---
function escucharPedidos() {
    const q = query(collection(db, "pedidos"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snapshot) => {
        const pedidos = [];
        const lp = document.getElementById('l-pendientes');
        const la = document.getElementById('l-atendidos');
        lp.innerHTML = ''; la.innerHTML = '';

        snapshot.docs.forEach(docSnap => {
            const p = docSnap.data();
            p.id = docSnap.id;
            pedidos.push(p);

            const card = document.createElement('div');
            card.className = `pedido-card ${p.estado}`;
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong>${p.cliente}</strong>
                    <button onclick="imprimirComanda('${encodeURIComponent(JSON.stringify(p))}')" style="background:#3b82f6; color:white; border:none; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer;">🖨️ Ticket</button>
                </div>
                <p style="font-size:12px; margin:5px 0;">${p.tipo} - $${Number(p.total).toLocaleString()}</p>
                <div style="margin:10px 0;">${p.items.map(i => `<div style="font-size:13px;">• ${i.nombre}</div>`).join('')}</div>
                <select onchange="actualizarEstado('${p.id}', this.value)" style="width:100%; padding:5px; border-radius:4px;">
                    <option value="pendiente" ${p.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                    <option value="preparando" ${p.estado === 'preparando' ? 'selected' : ''}>Preparando</option>
                    <option value="listo" ${p.estado === 'listo' ? 'selected' : ''}>Listo / Atendido</option>
                </select>
            `;

            if (p.estado === 'listo') la.appendChild(card);
            else lp.appendChild(card);
        });
        renderizarPlanoMesas(pedidos);
    });
}

window.actualizarEstado = async (id, nuevoEstado) => {
    await updateDoc(doc(db, "pedidos", id), { estado: nuevoEstado });
};

// --- PLANO DE MESAS ---
function renderizarPlanoMesas(pedidos) {
    const grid = document.getElementById('grid-mesas');
    if (!grid) return;
    const mesasActivas = pedidos.filter(p => p.estado !== 'listo' && p.cliente.toLowerCase().includes('mesa'));
    
    grid.innerHTML = '';
    for (let i = 1; i <= 12; i++) {
        const nombreMesa = `Mesa ${i}`;
        const pMesa = mesasActivas.find(p => p.cliente.toLowerCase() === nombreMesa.toLowerCase());
        const div = document.createElement('div');
        div.className = `mesa-card ${pMesa ? 'mesa-ocupada' : 'mesa-libre'}`;
        div.innerHTML = `<h3>Mesa ${i}</h3><p>${pMesa ? 'OCUPADA' : 'LIBRE'}</p>${pMesa ? `<strong>$${pMesa.total}</strong>` : ''}`;
        grid.appendChild(div);
    }
}

// --- IMPRESIÓN ---
window.imprimirComanda = (pJson) => {
    const p = JSON.parse(decodeURIComponent(pJson));
    const win = window.open('', 'PRINT');
    win.document.write(`<html><body><h2>IKU - ${p.cliente}</h2><hr>${p.items.map(i => `<p>1x ${i.nombre}</p>`).join('')}<hr><h3>Total: $${p.total}</h3></body></html>`);
    win.document.close();
    win.print();
    win.close();
};

// --- GESTIÓN DE CARTA (Simplificada para fluidez) ---
function escucharCarta() {
    onSnapshot(collection(db, "platos"), (snap) => {
        const list = document.getElementById('inv-list');
        list.innerHTML = '<h3>Platos en el Menú</h3>';
        snap.forEach(d => {
            const item = d.data();
            list.innerHTML += `<div style="background:white; padding:10px; margin-bottom:8px; border-radius:8px; border:1px solid #ddd; display:flex; justify-content:space-between;">
                <span>${item.nombre} - $${item.precio}</span>
                <button onclick="eliminarPlato('${d.id}')" style="color:red; border:none; background:none; cursor:pointer;">Eliminar</button>
            </div>`;
        });
    });
}

window.eliminarPlato = async (id) => { if(confirm("¿Borrar plato?")) await deleteDoc(doc(db, "platos", id)); };

document.getElementById('m-form').onsubmit = async (e) => {
    e.preventDefault();
    const datos = {
        nombre: document.getElementById('name').value,
        precio: Number(document.getElementById('price').value),
        categoria: document.getElementById('category').value,
        descripcion: document.getElementById('desc').value,
        timestamp: serverTimestamp()
    };
    await addDoc(collection(db, "platos"), datos);
    e.target.reset();
};
