import { db, auth } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, getDocs, serverTimestamp, addDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
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
        
        const superZone = document.getElementById('super-admin-zone');
        if(superZone) superZone.style.display = (u.email === CORREO_MASTER) ? 'block' : 'none';

        escucharCarta(); escucharPedidos(); 
    } else {
        if(u) signOut(auth);
        document.getElementById('admin-panel').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
    }
});

const escucharCarta = () => {
    onSnapshot(query(collection(db, "platos"), orderBy("timestamp", "desc")), (snap) => {
        const container = document.getElementById('lista-menu');
        container.innerHTML = '';
        snap.forEach(docSnap => {
            const p = docSnap.data();
            const div = document.createElement('div');
            div.className = `admin-dish-card ${p.disponible === false ? 'not-available' : ''}`;
            div.innerHTML = `
                <div class="dish-info">
                    <h4>${p.nombre}</h4>
                    <p>$${p.precio.toLocaleString()}</p>
                    <small>${p.categoria}</small>
                </div>
                <div class="dish-actions">
                    <button onclick="editarPlato('${docSnap.id}', '${p.nombre}', ${p.precio}, '${p.categoria}', '${p.descripcion||''}', '${(p.ingredientes||[]).join(', ')}')" class="btn-edit">✏️</button>
                    <button onclick="eliminarPlato('${docSnap.id}')" class="btn-delete">🗑️</button>
                </div>
            `;
            container.appendChild(div);
        });
    });
};

const escucharPedidos = () => {
    onSnapshot(query(collection(db, "pedidos"), orderBy("timestamp", "desc")), (snap) => {
        const activos = document.getElementById('pedidos-activos');
        const atendidos = document.getElementById('l-atendidos');
        activos.innerHTML = ''; atendidos.innerHTML = '';

        snap.forEach(docSnap => {
            const p = docSnap.data();
            const div = document.createElement('div');
            div.className = `pedido-card state-${p.estado}`;
            div.innerHTML = `
                <div class="pedido-header">
                    <span>Mesa: ${p.mesa}</span>
                    <span class="pedido-time">${p.timestamp?.toDate().toLocaleTimeString() || 'Reciente'}</span>
                </div>
                <div class="pedido-items">
                    ${p.items.map(i => `<div>• ${i.cantidad}x ${i.nombre} ${i.excluidos?.length ? `<br><small>Sin: ${i.excluidos.join(', ')}</small>` : ''}</div>`).join('')}
                </div>
                <div class="pedido-actions">
                    <select onchange="cambiarEstado('${docSnap.id}', this.value)">
                        <option value="recibido" ${p.estado==='recibido'?'selected':''}>Recibido</option>
                        <option value="preparando" ${p.estado==='preparando'?'selected':''}>Preparando</option>
                        <option value="listo" ${p.estado==='listo'?'selected':''}>Listo</option>
                        <option value="entregado" ${p.estado==='entregado'?'selected':''}>Entregado</option>
                    </select>
                    ${p.atendido ? 
                        `<button onclick="marcarAtendido('${docSnap.id}', false)" class="btn-archive">Restaurar</button>` :
                        `<button onclick="marcarAtendido('${docSnap.id}', true)" class="btn-archive">Atender</button>`
                    }
                </div>
            `;
            p.atendido ? atendidos.appendChild(div) : activos.appendChild(div);
        });
    });
};

window.cambiarEstado = async (id, nuevo) => {
    await updateDoc(doc(db, "pedidos", id), { estado: nuevo });
};

window.marcarAtendido = async (id, val) => {
    await updateDoc(doc(db, "pedidos", id), { atendido: val });
};

window.eliminarPlato = (id) => {
    const modal = document.getElementById('delete-modal');
    modal.style.display = 'flex';
    document.getElementById('confirm-delete-btn').onclick = async () => {
        await deleteDoc(doc(db, "platos", id));
        modal.style.display = 'none';
    };
};

window.editarPlato = (id, n, p, c, d, i) => {
    document.getElementById('edit-id').value = id;
    document.getElementById('name').value = n;
    document.getElementById('price').value = p;
    document.getElementById('category').value = c;
    document.getElementById('desc').value = d;
    document.getElementById('ingredients').value = i;
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
        ingredientes: document.getElementById('ingredients').value.split(',').map(s=>s.trim()).filter(s=>s!==''),
        timestamp: serverTimestamp()
    };
    id ? await updateDoc(doc(db, "platos", id), datos) : await addDoc(collection(db, "platos"), datos);
    cancelarEdicion();
};

window.resetearEstadisticas = async () => {
    if(!confirm("¿Estás SEGURO de borrar TODOS los pedidos? Esta acción no se puede deshacer.")) return;
    const batch = writeBatch(db);
    const snap = await getDocs(collection(db, "pedidos"));
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
    alert("Sistema reseteado con éxito.");
};
