import { db, auth } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, getDoc, getDocs, serverTimestamp, addDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

const CORREO_MASTER = "cb01grupo@gmail.com";
const correosAutorizados = [CORREO_MASTER, "kelly.araujotafur@gmail.com"];

const ICON_EDIT = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>`;
const ICON_TRASH = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
const ICON_CHECK = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

// --- GESTIÓN DE PEDIDOS (CON ORDEN Y TIEMPO) ---
function escucharPedidos() {
    // 1. Pedidos siempre por orden de llegada (ASC: el primero que llega es el primero en la lista)
    const q = query(collection(db, "pedidos"), orderBy("timestamp", "asc"));
    
    onSnapshot(q, (sn) => {
        const listaPendientes = document.getElementById('lista-pedidos-pendientes');
        const listaAtendidos = document.getElementById('lista-pedidos-atendidos');
        
        if(listaPendientes) listaPendientes.innerHTML = '';
        if(listaAtendidos) listaAtendidos.innerHTML = '';

        sn.docs.forEach(docSnap => {
            const p = docSnap.data();
            const id = docSnap.id;
            const fecha = p.timestamp?.toDate() || new Date();
            const hora = fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            // 2. Cálculo del tiempo de preparación
            let tiempoTexto = '';
            if (p.estado === 'atendido' && p.atendidoAt && p.timestamp) {
                const diff = Math.round((p.atendidoAt.toDate() - p.timestamp.toDate()) / 60000);
                tiempoTexto = `<span class="tiempo-prep">⏱️ ${diff} min</span>`;
            }

            const html = `
                <div class="pedido-card ${p.estado}">
                    <div class="pedido-header">
                        <div>
                            <strong>${p.cliente}</strong>
                            <span style="font-size:0.8rem; color:#64748b; display:block;">🕒 ${hora} ${tiempoTexto}</span>
                        </div>
                        <span class="badge-${p.tipo}">${p.tipo.toUpperCase()}</span>
                    </div>
                    <div class="pedido-items">
                        ${p.items.map(i => `<div>• ${i.nombre} ${i.nota ? `<small style="color:red;">(${i.nota})</small>` : ''}</div>`).join('')}
                    </div>
                    <div class="pedido-footer">
                        <strong>Total: $${p.total.toLocaleString()}</strong>
                        ${p.estado === 'pendiente' ? `<button onclick="completarPedido('${id}')" class="btn-atender">${ICON_CHECK} ATENDER</button>` : ''}
                    </div>
                </div>`;

            p.estado === 'pendiente' ? listaPendientes.innerHTML += html : listaAtendidos.innerHTML += html;
        });
        actualizarEstadisticas();
    });
}

window.completarPedido = async (id) => {
    await updateDoc(doc(db, "pedidos", id), {
        estado: 'atendido',
        atendidoAt: serverTimestamp() // Marca de tiempo para el cálculo de preparación
    });
};

// --- GESTIÓN DE LA CARTA (RESTAURADA ORIGINAL) ---
function escucharCarta() {
    const q = query(collection(db, "platos"), orderBy("timestamp", "desc"));
    onSnapshot(q, (sn) => {
        const grid = document.getElementById('grid-carta');
        if(!grid) return;
        grid.innerHTML = '';

        sn.docs.forEach(docSnap => {
            const d = docSnap.data();
            const id = docSnap.id;
            const card = document.createElement('div');
            card.className = `plato-card ${!d.disponible ? 'agotado' : ''}`;
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <div>
                        <h4 style="margin:0;">${d.nombre}</h4>
                        <small>${d.categoria}</small>
                    </div>
                    <div style="display:flex; gap:5px;">
                        <button onclick="editarPlato('${id}')" class="btn-icon">${ICON_EDIT}</button>
                        <button onclick="confirmarEliminar('${id}')" class="btn-icon delete">${ICON_TRASH}</button>
                    </div>
                </div>
                <div style="margin:10px 0; font-weight:bold;">$${d.precio.toLocaleString()}</div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span>Stock: ${d.stock}</span>
                    <label class="switch">
                        <input type="checkbox" ${d.disponible ? 'checked' : ''} onchange="toggleDisponibilidad('${id}', this.checked)">
                        <span class="slider"></span>
                    </label>
                </div>`;
            grid.appendChild(card);
        });
    });
}

window.toggleDisponibilidad = async (id, estado) => {
    await updateDoc(doc(db, "platos", id), { disponible: estado });
};

window.confirmarEliminar = async (id) => {
    if(confirm("¿Seguro que quieres eliminar este plato?")) {
        await deleteDoc(doc(db, "platos", id));
    }
};

window.editarPlato = async (id) => {
    const snap = await getDoc(doc(db, "platos", id));
    if (snap.exists()) {
        const d = snap.data();
        document.getElementById('edit-id').value = id;
        document.getElementById('name').value = d.nombre;
        document.getElementById('price').value = d.precio;
        document.getElementById('category').value = d.categoria;
        document.getElementById('stock').value = d.stock;
        document.getElementById('desc').value = d.descripcion || '';
        document.getElementById('ingredients').value = d.ingredientes ? d.ingredientes.join(', ') : '';
        document.querySelector('.form-container h3').innerText = "Editar Plato";
        document.getElementById('btn-cancelar').style.display = "block";
    }
};

window.cancelarEdicion = () => {
    document.getElementById('plate-form').reset();
    document.getElementById('edit-id').value = '';
    document.querySelector('.form-container h3').innerText = "Nuevo Plato";
    document.getElementById('btn-cancelar').style.display = "none";
};

window.guardarPlato = async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const stock = Number(document.getElementById('stock').value);
    const datos = {
        nombre: document.getElementById('name').value,
        precio: Number(document.getElementById('price').value),
        categoria: document.getElementById('category').value,
        stock: stock,
        descripcion: document.getElementById('desc').value,
        ingredientes: document.getElementById('ingredients').value.split(',').map(s => s.trim()),
        timestamp: serverTimestamp()
    };
    if(!id) datos.disponible = stock > 0;
    
    id ? await updateDoc(doc(db, "platos", id), datos) : await addDoc(collection(db, "platos"), datos);
    cancelarEdicion();
};

// --- LOGIN Y ANALÍTICA ---
async function actualizarEstadisticas() {
    const sn = await getDocs(collection(db, "pedidos"));
    let total = 0, count = 0;
    sn.forEach(doc => {
        const p = doc.data();
        if(p.estado === 'atendido') { total += p.total; count++; }
    });
    if(document.getElementById('ventas-totales')) document.getElementById('ventas-totales').innerText = `$${total.toLocaleString()}`;
    if(document.getElementById('pedidos-completados')) document.getElementById('pedidos-completados').innerText = count;
}

onAuthStateChanged(auth, (u) => {
    if(u && correosAutorizados.includes(u.email)) {
        document.getElementById('admin-panel').style.display = 'flex';
        document.getElementById('login-screen').style.display = 'none';
        escucharPedidos(); escucharCarta();
    } else {
        if(u) signOut(auth);
        document.getElementById('admin-panel').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
    }
});

window.loginGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
window.cerrarSesion = () => signOut(auth);
document.getElementById('plate-form')?.addEventListener('submit', guardarPlato);
