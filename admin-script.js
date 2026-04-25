import { db, auth } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, getDoc, getDocs, serverTimestamp, addDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

const CORREO_MASTER = "cb01grupo@gmail.com";
const correosAutorizados = [CORREO_MASTER, "kelly.araujotafur@gmail.com"];

const ICON_EDIT = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>`;
const ICON_TRASH = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
const ICON_CHECK = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

// --- GESTIÓN DE PEDIDOS (TIEMPO REAL) ---
function escucharPedidos() {
    // Ordenamos por timestamp ASC para que el primero que llegue esté arriba
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
            const horaFormateada = fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            // Calcular tiempo de preparación si ya fue atendido
            let tiempoInfo = '';
            if (p.estado === 'atendido' && p.atendidoAt && p.timestamp) {
                const inicio = p.timestamp.toDate();
                const fin = p.atendidoAt.toDate();
                const diffMinutos = Math.round((fin - inicio) / 60000);
                tiempoInfo = `<span style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:10px; font-size:0.7rem; font-weight:bold; margin-left:10px;">⏱️ ${diffMinutos} min</span>`;
            }

            const html = `
                <div class="pedido-card ${p.estado}">
                    <div class="pedido-header">
                        <div>
                            <strong>${p.cliente}</strong>
                            <span style="font-size:0.8rem; color:#64748b; display:block;">🕒 ${horaFormateada} ${tiempoInfo}</span>
                        </div>
                        <span class="badge-${p.tipo}">${p.tipo.toUpperCase()}</span>
                    </div>
                    <div class="pedido-items">
                        ${p.items.map(item => `
                            <div class="item-line">
                                <span>${item.nombre}</span>
                                ${item.nota ? `<small style="display:block; color:var(--danger);">• ${item.nota}</small>` : ''}
                            </div>
                        `).join('')}
                    </div>
                    <div class="pedido-footer">
                        <strong>Total: $${p.total.toLocaleString()}</strong>
                        ${p.estado === 'pendiente' ? 
                            `<button class="btn-atender" onclick="completarPedido('${id}')">${ICON_CHECK} ATENDER</button>` : 
                            `<span style="color:var(--success); font-weight:bold; font-size:0.8rem;">FINALIZADO</span>`
                        }
                    </div>
                </div>
            `;

            if (p.estado === 'pendiente') {
                listaPendientes.innerHTML += html;
            } else {
                listaAtendidos.innerHTML += html;
            }
        });
        actualizarEstadisticas();
    });
}

window.completarPedido = async (id) => {
    try {
        await updateDoc(doc(db, "pedidos", id), {
            estado: 'atendido',
            atendidoAt: serverTimestamp() // Guardamos la hora exacta de finalización
        });
    } catch (e) {
        console.error("Error al actualizar pedido:", e);
    }
};

// --- GESTIÓN DE LA CARTA (PLATOS) ---
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
                        <small style="color:#64748b;">${d.categoria}</small>
                    </div>
                    <div style="display:flex; gap:5px;">
                        <button onclick="editarPlato('${id}')" class="btn-icon">${ICON_EDIT}</button>
                        <button onclick="confirmarEliminar('${id}')" class="btn-icon delete">${ICON_TRASH}</button>
                    </div>
                </div>
                <div style="margin:15px 0; font-weight:bold; color:var(--accent);">$${d.precio.toLocaleString()}</div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:0.8rem;">Stock: ${d.stock}</span>
                    <label class="switch">
                        <input type="checkbox" ${d.disponible ? 'checked' : ''} onchange="toggleDisponibilidad('${id}', this.checked)">
                        <span class="slider"></span>
                    </label>
                </div>
            `;
            grid.appendChild(card);
        });
    });
}

// --- FUNCIONES AUXILIARES ---

window.toggleDisponibilidad = async (id, estado) => {
    await updateDoc(doc(db, "platos", id), { disponible: estado });
};

window.guardarPlato = async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const stockIngresado = Number(document.getElementById('stock').value);
    
    const datos = {
        nombre: document.getElementById('name').value,
        precio: Number(document.getElementById('price').value),
        categoria: document.getElementById('category').value,
        stock: stockIngresado,
        descripcion: document.getElementById('desc').value,
        ingredientes: document.getElementById('ingredients').value.split(',').map(s => s.trim()),
        timestamp: serverTimestamp()
    };
    
    if(!id) datos.disponible = stockIngresado > 0;
    
    try {
        id ? await updateDoc(doc(db, "platos", id), datos) : await addDoc(collection(db, "platos"), datos);
        cancelarEdicion();
    } catch (err) {
        console.error("Error guardando:", err);
    }
};

window.editarPlato = async (id) => {
    const docRef = await getDoc(doc(db, "platos", id));
    if (docRef.exists()) {
        const d = docRef.data();
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

// --- ESTADÍSTICAS ---
async function actualizarEstadisticas() {
    const sn = await getDocs(collection(db, "pedidos"));
    let totalVentas = 0;
    let contadorPedidos = 0;
    let ingredientesMap = {};

    sn.docs.forEach(docSnap => {
        const p = docSnap.data();
        if(p.estado === 'atendido') {
            totalVentas += p.total;
            contadorPedidos++;
        }
    });

    const vElement = document.getElementById('ventas-totales');
    const pElement = document.getElementById('pedidos-completados');
    if(vElement) vElement.innerText = `$${totalVentas.toLocaleString()}`;
    if(pElement) pElement.innerText = contadorPedidos;
}

// --- AUTH ---
onAuthStateChanged(auth, (u) => {
    if(u && correosAutorizados.includes(u.email)) {
        document.getElementById('admin-panel').style.display = 'flex';
        document.getElementById('login-screen').style.display = 'none';
        escucharPedidos(); 
        escucharCarta();
    } else {
        if(u) signOut(auth);
        document.getElementById('admin-panel').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
    }
});

window.loginGoogle = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider);
};

window.cerrarSesion = () => signOut(auth);
