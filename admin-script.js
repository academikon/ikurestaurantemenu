import { db, auth } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, addDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

const correos = ["cb01grupo@gmail.com", "kelly.araujotafur@gmail.com"];

// Iconos SVG minimalistas
const ICON_EDIT = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>`;
const ICON_TRASH = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

const escucharMenu = () => {
    onSnapshot(collection(db, "platos"), (sn) => {
        const inv = document.getElementById('inv-list');
        if(!inv) return;
        
        inv.innerHTML = `
            <div class="admin-group" id="g-diario"><div class="admin-group-header" onclick="toggleSeccion(this)"><h4>📅 Menú del Día</h4><span class="chevron">▼</span></div><div class="admin-group-content" id="adm-diario"></div></div>
            <div class="admin-group" id="g-rapida"><div class="admin-group-header" onclick="toggleSeccion(this)"><h4>🍔 Comidas Rápidas</h4><span class="chevron">▼</span></div><div class="admin-group-content" id="adm-rapida"></div></div>
            <div class="admin-group" id="g-varios"><div class="admin-group-header" onclick="toggleSeccion(this)"><h4>✨ Varios</h4><span class="chevron">▼</span></div><div class="admin-group-content" id="adm-varios"></div></div>
        `;

        sn.docs.forEach(docSnap => {
            const d = docSnap.data();
            const html = `
            <div class="admin-row">
                <span><strong>${d.nombre}</strong> <small style="color:#888;">($${Number(d.precio).toLocaleString()})</small></span>
                <div class="actions">
                    <label class="switch">
                        <input type="checkbox" ${d.disponible !== false ? 'checked' : ''} onchange="toggleStock('${docSnap.id}', this.checked)">
                        <span class="slider"></span>
                    </label>
                    <button class="btn-icon btn-edit" onclick="prepararEdicion('${docSnap.id}')" title="Editar">${ICON_EDIT}</button>
                    <button class="btn-icon btn-delete" onclick="triggerDelete('${docSnap.id}')" title="Eliminar">${ICON_TRASH}</button>
                </div>
            </div>`;
            const container = document.getElementById(`adm-${d.categoria}`);
            if(container) container.innerHTML += html;
        });
    });
};

// MODAL DE ELIMINACIÓN PERSONALIZADO
let itemToDelete = null;
window.triggerDelete = (id) => {
    itemToDelete = id;
    document.getElementById('delete-modal').style.display = 'flex';
};

document.getElementById('confirm-delete-btn').onclick = async () => {
    if(itemToDelete) {
        await deleteDoc(doc(db, "platos", itemToDelete));
        itemToDelete = null;
        document.getElementById('delete-modal').style.display = 'none';
    }
};

// ... (Resto de funciones: escucharData, toggleStock, mForm.onsubmit, etc se mantienen o actualizan)

const escucharData = () => {
    onSnapshot(query(collection(db, "pedidos"), orderBy("timestamp", "desc")), (sn) => {
        const lp = document.getElementById('l-pendientes');
        const sHoy = document.getElementById('s-hoy');
        const sMes = document.getElementById('s-mes');
        let totalHoy = 0, totalMes = 0;
        const ahora = new Date();

        if(lp) lp.innerHTML = '';
        sn.docs.forEach(d => {
            const p = d.data();
            if(p.estado === 'pendiente') {
                lp.innerHTML += `
                <div class="card" style="border-left:6px solid var(--accent);">
                    <div style="display:flex; justify-content:space-between;"><strong>👤 ${p.cliente}</strong><small>${p.tipo.toUpperCase()}</small></div>
                    <p style="font-size:0.85rem; margin:10px 0;">${p.items.map(i=>i.nombre).join(', ')}</p>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-weight:bold; color:var(--success);">$${p.total.toLocaleString()}</span>
                        <button onclick="completar('${d.id}')" style="background:var(--success); color:white; border:none; padding:8px 15px; border-radius:6px; cursor:pointer; font-weight:bold;">LISTO</button>
                    </div>
                </div>`;
            } else if(p.estado === 'completado' && p.timestamp) {
                const f = p.timestamp.toDate();
                if(f.toDateString() === ahora.toDateString()) totalHoy += p.total;
                if(f.getMonth() === ahora.getMonth()) totalMes += p.total;
            }
        });
        if(sHoy) sHoy.innerText = `$${totalHoy.toLocaleString()}`;
        if(sMes) sMes.innerText = `$${totalMes.toLocaleString()}`;
    });
};

window.completar = (id) => updateDoc(doc(db, "pedidos", id), { estado: 'completado' });
window.toggleStock = (id, val) => updateDoc(doc(db, "platos", id), { disponible: val });

window.prepararEdicion = async (id) => {
    const snap = await getDoc(doc(db, "platos", id));
    const d = snap.data();
    document.getElementById('edit-id').value = id;
    document.getElementById('name').value = d.nombre;
    document.getElementById('price').value = d.precio;
    document.getElementById('category').value = d.categoria;
    document.getElementById('desc').value = d.descripcion || '';
    document.getElementById('ingredients').value = d.ingredientes ? d.ingredientes.join(',') : '';
    document.getElementById('f-title').innerText = "✏️ Editando Plato";
    document.getElementById('s-btn').innerText = "ACTUALIZAR CAMBIOS";
    document.getElementById('close-x').style.display = "block";
    document.querySelector('.main-content').scrollTo({top:0, behavior:'smooth'});
};

window.cancelarEdicion = () => {
    document.getElementById('edit-id').value = "";
    document.getElementById('f-title').innerText = "Añadir Nuevo Plato";
    document.getElementById('s-btn').innerText = "GUARDAR EN LA CARTA";
    document.getElementById('close-x').style.display = "none";
    document.getElementById('m-form').reset();
};

document.getElementById('m-form').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const datos = {
        nombre: document.getElementById('name').value,
        precio: Number(document.getElementById('price').value),
        categoria: document.getElementById('category').value,
        descripcion: document.getElementById('desc').value,
        ingredientes: document.getElementById('ingredients').value.split(','),
        timestamp: serverTimestamp()
    };
    id ? await updateDoc(doc(db, "platos", id), datos) : await addDoc(collection(db, "platos"), { ...datos, disponible: true });
    cancelarEdicion();
};

onAuthStateChanged(auth, (u) => {
    if(u && correos.includes(u.email)) {
        document.getElementById('admin-panel').style.display = 'flex';
        document.getElementById('login-screen').style.display = 'none';
        escucharData(); escucharMenu();
    } else {
        if(u) signOut(auth);
        document.getElementById('admin-panel').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
    }
});

document.getElementById('login-btn').onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
