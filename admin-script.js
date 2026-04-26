import { db, auth } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, getDoc, getDocs, serverTimestamp, addDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

const CORREO_MASTER = "cb01grupo@gmail.com";
const correosAutorizados = [CORREO_MASTER, "kelly.araujotafur@gmail.com"];

const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');

if (loginBtn) loginBtn.onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
if (logoutBtn) logoutBtn.onclick = () => signOut(auth);

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

// --- LÓGICA DE PEDIDOS, MÉTRICAS E IMPRESIÓN ---
function escucharPedidos() {
    const q = query(collection(db, "pedidos"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snapshot) => {
        const pedidos = [];
        const lp = document.getElementById('l-pendientes');
        const la = document.getElementById('l-atendidos');
        lp.innerHTML = ''; la.innerHTML = '';
        
        let tHoy = 0, tMes = 0;
        let tNequi = 0, tBanco = 0, tEfectivo = 0;
        const ventasPlatos = {};
        const usoIngredientes = {};

        const hoy = new Date();
        
        snapshot.docs.forEach(docSnap => {
            const p = docSnap.data();
            p.id = docSnap.id;
            pedidos.push(p);

            // Cálculos Estadísticas Originales
            if(p.timestamp) {
                const f = p.timestamp.toDate();
                if(f.getDate() === hoy.getDate() && f.getMonth() === hoy.getMonth()) {
                    tHoy += Number(p.total);
                    if(p.metodoPago === 'nequi') tNequi += Number(p.total);
                    if(p.metodoPago === 'banco') tBanco += Number(p.total);
                    if(p.metodoPago === 'efectivo') tEfectivo += Number(p.total);
                }
                if(f.getMonth() === hoy.getMonth()) tMes += Number(p.total);
            }

            p.items.forEach(item => {
                ventasPlatos[item.nombre] = (ventasPlatos[item.nombre] || 0) + 1;
                if(item.ingredientes) {
                    item.ingredientes.forEach(ing => {
                        usoIngredientes[ing] = (usoIngredientes[ing] || 0) + 1;
                    });
                }
            });

            // Tarjeta de Pedido Original
            const card = document.createElement('div');
            card.className = `pedido-card ${p.estado}`;
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 10px;">
                    <div>
                        <strong style="font-size: 1.1rem;">${p.cliente}</strong>
                        <div style="font-size:0.85rem; color:var(--text-muted);">${p.tipo} - $${Number(p.total).toLocaleString()}</div>
                    </div>
                    <button onclick="imprimirComanda('${encodeURIComponent(JSON.stringify(p))}')" style="background:#3b82f6; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size: 0.8rem;">🖨️ Imprimir</button>
                </div>
                <div style="margin-bottom:15px; padding-left: 10px; border-left: 2px solid var(--border);">
                    ${p.items.map(i => `<div style="font-size:0.9rem; margin-bottom:4px;">• 1x ${i.nombre} ${i.nota ? `<span style="color:#eab308; font-size:0.8rem;">(${i.nota})</span>` : ''}</div>`).join('')}
                </div>
                <div style="display:flex; gap:10px;">
                    <select onchange="actualizarEstado('${p.id}', this.value)" style="flex:1; margin:0;">
                        <option value="pendiente" ${p.estado === 'pendiente' ? 'selected' : ''}>⏳ Pendiente</option>
                        <option value="preparando" ${p.estado === 'preparando' ? 'selected' : ''}>🍳 Preparando</option>
                        <option value="listo" ${p.estado === 'listo' ? 'selected' : ''}>✅ Entregado</option>
                    </select>
                    <select onchange="actualizarPago('${p.id}', this.value)" style="flex:1; margin:0;">
                        <option value="" disabled ${!p.metodoPago ? 'selected' : ''}>Pago...</option>
                        <option value="nequi" ${p.metodoPago === 'nequi' ? 'selected' : ''}>Nequi</option>
                        <option value="banco" ${p.metodoPago === 'banco' ? 'selected' : ''}>Banco</option>
                        <option value="efectivo" ${p.metodoPago === 'efectivo' ? 'selected' : ''}>Efectivo</option>
                    </select>
                </div>
            `;

            if (p.estado === 'listo') la.appendChild(card);
            else lp.appendChild(card);
        });

        // Actualizar Métricas
        document.getElementById('s-hoy').innerText = `$${tHoy.toLocaleString()}`;
        document.getElementById('s-mes').innerText = `$${tMes.toLocaleString()}`;
        document.getElementById('s-nequi').innerText = `$${tNequi.toLocaleString()}`;
        document.getElementById('s-bancolombia').innerText = `$${tBanco.toLocaleString()}`;
        document.getElementById('s-efectivo').innerText = `$${tEfectivo.toLocaleString()}`;

        document.getElementById('rankings-categoria').innerHTML = Object.entries(ventasPlatos)
            .sort((a,b) => b[1] - a[1]).slice(0,5)
            .map(([n,v]) => `<div style="padding:10px; background:#f9fafb; border-radius:8px; border:1px solid #eee; display:flex; justify-content:space-between;"><span>${n}</span> <strong>${v}</strong></div>`).join('');
            
        document.getElementById('rankings-ingredientes').innerHTML = Object.entries(usoIngredientes)
            .sort((a,b) => b[1] - a[1])
            .map(([n,v]) => `<span style="background:var(--sidebar); color:white; padding:4px 10px; border-radius:20px; font-size:0.8rem;">${n} (${v})</span>`).join('');

        renderizarPlanoMesas(pedidos);
    });
}

window.actualizarEstado = async (id, estado) => await updateDoc(doc(db, "pedidos", id), { estado });
window.actualizarPago = async (id, metodoPago) => await updateDoc(doc(db, "pedidos", id), { metodoPago });

// --- LÓGICA DE CARTA ---
function escucharCarta() {
    onSnapshot(collection(db, "platos"), (snap) => {
        const list = document.getElementById('inv-list');
        list.innerHTML = '';
        snap.forEach(d => {
            const item = d.data();
            list.innerHTML += `
            <div style="background:white; padding:15px; margin-bottom:10px; border-radius:8px; border:1px solid #ddd; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong>${item.nombre}</strong> <span style="color:var(--text-muted); font-size:0.9rem;">- $${item.precio}</span><br>
                    <span style="font-size:0.8rem; background:#f1f5f9; padding:2px 6px; border-radius:4px;">${item.categoria.toUpperCase()}</span>
                </div>
                <div style="display:flex; gap:10px;">
                    <button onclick="editarPlato('${d.id}', '${item.nombre}', '${item.precio}', '${item.categoria}', '${item.descripcion || ''}', '${(item.ingredientes||[]).join(', ')}')" style="color:#3b82f6; border:none; background:none; cursor:pointer;">Editar</button>
                    <button onclick="eliminarPlato('${d.id}')" style="color:red; border:none; background:none; cursor:pointer;">Borrar</button>
                </div>
            </div>`;
        });
    });
}

window.eliminarPlato = async (id) => { if(confirm("¿Borrar plato?")) await deleteDoc(doc(db, "platos", id)); };

window.editarPlato = (id, nombre, precio, cat, desc, ing) => {
    document.getElementById('edit-id').value = id;
    document.getElementById('name').value = nombre;
    document.getElementById('price').value = precio;
    document.getElementById('category').value = cat;
    document.getElementById('desc').value = desc;
    document.getElementById('ingredients').value = ing;
    document.getElementById('f-title').innerText = "Editando Plato";
    document.getElementById('btn-cancelar').style.display = 'block';
};

window.cancelarEdicion = () => {
    document.getElementById('m-form').reset();
    document.getElementById('edit-id').value = '';
    document.getElementById('f-title').innerText = "Configurar Plato";
    document.getElementById('btn-cancelar').style.display = 'none';
};

document.getElementById('m-form').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const datos = {
        nombre: document.getElementById('name').value,
        precio: Number(document.getElementById('price').value),
        categoria: document.getElementById('category').value,
        descripcion: document.getElementById('desc').value,
        ingredientes: document.getElementById('ingredients').value.split(',').map(s => s.trim()).filter(s => s !== ''),
        timestamp: serverTimestamp()
    };
    id ? await updateDoc(doc(db, "platos", id), datos) : await addDoc(collection(db, "platos"), datos);
    window.cancelarEdicion();
};

// --- MESAS E IMPRESIÓN ---
window.renderizarPlanoMesas = function(pedidos) {
    const grid = document.getElementById('grid-mesas');
    if (!grid) return;
    const mesasActivas = pedidos.filter(p => p.estado !== 'listo' && p.cliente.toLowerCase().includes('mesa'));
    
    let html = '';
    for(let i = 1; i <= 12; i++) {
        const nombreMesa = `Mesa ${i}`;
        const pMesa = mesasActivas.find(p => p.cliente.toLowerCase() === nombreMesa.toLowerCase());
        
        if(pMesa) {
            html += `
            <div class="mesa-card mesa-ocupada" onclick="cambiarVista('v-pedidos', document.querySelector('.nav-item:nth-child(2)'))">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 8px; color: #d97706;"><path d="M17 11h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h2"/><path d="M9 11V6a3 3 0 0 1 6 0v5"/><path d="M12 11v6"/></svg>
                <h3 style="margin-bottom:4px; font-weight:600;">${nombreMesa}</h3>
                <span style="font-size:0.75rem; background:var(--accent); color:#000; padding:2px 6px; border-radius:4px; font-weight: 500;">OCUPADA</span>
                <div style="font-size:0.9rem; margin-top:8px; font-weight:600; color:var(--text-main);">$${Number(pMesa.total).toLocaleString()}</div>
            </div>`;
        } else {
            html += `
            <div class="mesa-card mesa-libre">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 8px; color: var(--success); opacity: 0.5;"><rect x="3" y="8" width="18" height="4" rx="1"/><line x1="12" y1="8" x2="12" y2="21"/><line x1="19" y1="12" x2="19" y2="21"/><line x1="5" y1="12" x2="5" y2="21"/></svg>
                <h3 style="margin-bottom:4px; font-weight:600;">${nombreMesa}</h3>
                <span style="font-size:0.8rem; color:var(--success); font-weight: 500;">Disponible</span>
            </div>`;
        }
    }
    grid.innerHTML = html;
};

window.imprimirComanda = function(pJsonStr) {
    const p = JSON.parse(decodeURIComponent(pJsonStr));
    const fecha = new Date().toLocaleString();
    let ticketHTML = `
        <div id="ticket-impresion">
            <h2 style="text-align:center; margin-bottom:5px;">IKU RESTAURANTE</h2>
            <p style="text-align:center; margin-top:0; font-size:12px;">Comanda</p>
            <hr style="border-top:1px dashed #000; margin:10px 0;">
            <p style="margin: 5px 0;"><strong>Cliente:</strong> ${p.cliente}</p>
            <p style="margin: 5px 0;"><strong>Fecha:</strong> ${fecha}</p>
            <hr style="border-top:1px dashed #000; margin:10px 0;">
            <ul style="list-style:none; padding:0; margin:0;">
                ${p.items.map(i => `<li style="margin-bottom:8px; font-size: 14px;"><strong>1x ${i.nombre}</strong> <br>${i.nota ? `<span style="font-size:12px; margin-left:15px;">- Nota: ${i.nota}</span>` : ''}</li>`).join('')}
            </ul>
            <hr style="border-top:1px dashed #000; margin:10px 0;">
            <h3 style="text-align:right; margin: 5px 0;">Total: $${Number(p.total).toLocaleString()}</h3>
        </div>
    `;
    const div = document.createElement('div');
    div.innerHTML = ticketHTML;
    document.body.appendChild(div);
    window.print();
    document.body.removeChild(div);
};
