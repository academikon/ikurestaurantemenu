import { db, auth } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, addDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

const correos = ["cb01grupo@gmail.com", "kelly.araujotafur@gmail.com"];

// Escuchar Pedidos
const escucharData = () => {
    onSnapshot(query(collection(db, "pedidos"), orderBy("timestamp", "desc")), (sn) => {
        const lp = document.getElementById('l-pendientes');
        if(!lp) return;
        lp.innerHTML = '';
        sn.docs.forEach(d => {
            const p = d.data();
            if(p.estado === 'pendiente') {
                lp.innerHTML += `
                <div class="pedido-card">
                    <div style="display:flex; justify-content:space-between;">
                        <strong>👤 ${p.cliente}</strong>
                        <span style="font-size:0.7rem; background:#eee; padding:2px 8px; border-radius:4px;">${p.tipo.toUpperCase()}</span>
                    </div>
                    <p style="margin:10px 0; font-size:0.9rem;">${p.items.map(i=>i.nombre).join(', ')}</p>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-weight:bold; color:#28a745;">$${p.total.toLocaleString()}</span>
                        <button onclick="completar('${d.id}')" style="background:#28a745; color:white; border:none; padding:8px 15px; border-radius:6px; cursor:pointer; font-weight:bold;">MARCAR LISTO</button>
                    </div>
                </div>`;
            }
        });
    });
};

// Escuchar Inventario (Dividido por grupos)
const escucharMenu = () => {
    onSnapshot(collection(db, "platos"), (sn) => {
        const inv = document.getElementById('inv-list');
        if(!inv) return;
        
        inv.innerHTML = `
            <div class="admin-group"><div class="admin-group-title">Menú del Día</div><div id="adm-diario"></div></div>
            <div class="admin-group"><div class="admin-group-title">Comidas Rápidas</div><div id="adm-rapida"></div></div>
            <div class="admin-group"><div class="admin-group-title">Varios</div><div id="adm-varios"></div></div>
        `;

        sn.docs.forEach(docSnap => {
            const d = docSnap.data();
            const html = `
            <div class="admin-row">
                <span><strong>${d.nombre}</strong> <small>($${Number(d.precio).toLocaleString()})</small></span>
                <div style="display:flex; gap:15px; align-items:center;">
                    <label class="switch">
                        <input type="checkbox" ${d.disponible !== false ? 'checked' : ''} onchange="toggleStock('${docSnap.id}', this.checked)">
                        <span class="slider"></span>
                    </label>
                    <button onclick="prepararEdicion('${docSnap.id}')" style="color:blue; border:none; background:none; cursor:pointer; font-weight:600;">Editar</button>
                    <button onclick="borrarM('${docSnap.id}')" style="color:red; border:none; background:none; cursor:pointer; font-weight:600;">×</button>
                </div>
            </div>`;
            const container = document.getElementById(`adm-${d.categoria}`);
            if(container) container.innerHTML += html;
        });
    });
};

// Funciones Globales
window.completar = (id) => updateDoc(doc(db, "pedidos", id), { estado: 'completado' });
window.toggleStock = (id, val) => updateDoc(doc(db, "platos", id), { disponible: val });
window.borrarM = (id) => confirm("¿Eliminar este plato?") && deleteDoc(doc(db, "platos", id));

window.prepararEdicion = async (id) => {
    const snap = await getDoc(doc(db, "platos", id));
    const d = snap.data();
    document.getElementById('edit-id').value = id;
    document.getElementById('name').value = d.nombre;
    document.getElementById('price').value = d.precio;
    document.getElementById('category').value = d.categoria;
    document.getElementById('desc').value = d.descripcion || '';
    document.getElementById('ingredients').value = d.ingredientes ? d.ingredientes.join(',') : '';
    document.getElementById('f-title').innerText = "Editando: " + d.nombre;
    document.getElementById('close-x').style.display = "block";
    window.scrollTo({top: 0, behavior: 'smooth'});
};

window.cancelarEdicion = () => {
    document.getElementById('edit-id').value = "";
    document.getElementById('f-title').innerText = "Añadir Nuevo Plato";
    document.getElementById('close-x').style.display = "none";
    document.getElementById('m-form').reset();
};

// Guardar/Actualizar
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

// Auth
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
