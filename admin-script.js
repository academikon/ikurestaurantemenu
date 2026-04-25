import { db, auth } from './firebase-config.js';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

const correosAutorizados = ["cb01grupo@gmail.com", "kelly.araujotafur@gmail.com"];

// --- 1. RENDERIZAR MENÚ ---
const escucharMenu = () => {
    const q = query(collection(db, "platos"), orderBy("timestamp", "desc"));
    onSnapshot(q, (sn) => {
        const listas = { diario: document.getElementById('lista-diario'), rapida: document.getElementById('lista-rapida'), varios: document.getElementById('lista-varios') };
        if (!listas.diario) return;
        Object.values(listas).forEach(l => l.innerHTML = '');
        sn.docs.forEach(docSnap => {
            const d = docSnap.data();
            const id = docSnap.id;
            const precio = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(d.precio);
            const item = document.createElement('div');
            item.style = "display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #eee; align-items:center;";
            item.innerHTML = `<span><strong>${d.nombre}</strong> (${precio})</span>
                <div><button onclick="prepararEdicion('${id}')" style="background:#e0f2fe; border:none; padding:5px 10px; border-radius:4px; color:#0284c7; cursor:pointer;">Editar</button>
                <button onclick="borrarPlato('${id}')" style="background:#fee2e2; border:none; padding:5px 10px; border-radius:4px; color:#ef4444; cursor:pointer; margin-left:5px;">X</button></div>`;
            if (listas[d.categoria]) listas[d.categoria].appendChild(item);
        });
    });
};

// --- 2. RENDERIZAR PEDIDOS (LA CLAVE DEL CAMBIO) ---
const escucharPedidos = () => {
    const q = query(collection(db, "pedidos"), orderBy("timestamp", "desc"));
    onSnapshot(q, (sn) => {
        const pendientesCont = document.getElementById('lista-pedidos-pendientes');
        const atendidosCont = document.getElementById('lista-pedidos-atendidos');
        
        if (!pendientesCont || !atendidosCont) return;
        
        pendientesCont.innerHTML = '';
        atendidosCont.innerHTML = '';

        sn.docs.forEach(d => {
            const p = d.data();
            const id = d.id;
            const totalFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(p.total);

            if (p.estado === 'pendiente') {
                // DISEÑO GRANDE PARA COCINA
                const card = document.createElement('div');
                card.className = 'pedido-card';
                card.innerHTML = `
                    <div class="pedido-header">
                        <strong>👤 ${p.cliente}</strong>
                        <span style="color:var(--success); font-weight:700;">${totalFmt}</span>
                    </div>
                    <ul class="pedido-items">
                        ${p.items.map(i => `<li><strong>${i.nombre}</strong> ${i.nota ? `<br><small>📝 ${i.nota}</small>` : ''}</li>`).join('')}
                    </ul>
                    <button onclick="completarPedido('${id}')" style="background:var(--success); color:white; border:none; padding:10px; width:100%; border-radius:6px; font-weight:bold; cursor:pointer;">LISTO PARA ENTREGAR</button>
                `;
                pendientesCont.appendChild(card);
            } else {
                // DISEÑO PEQUEÑO PARA LA LISTA DE ABAJO
                const row = document.createElement('div');
                row.className = 'atendido-row';
                row.innerHTML = `
                    <span class="atendido-mesa">Mesa/Cliente: ${p.cliente}</span>
                    <span class="atendido-valor">${totalFmt}</span>
                    <button class="btn-borrar-atendido" onclick="eliminarPedido('${id}')">Borrar Registro</button>
                `;
                atendidosCont.appendChild(row);
            }
        });

        if (pendientesCont.innerHTML === '') pendientesCont.innerHTML = '<p style="color:#888;">No hay pedidos en cocina.</p>';
        if (atendidosCont.innerHTML === '') atendidosCont.innerHTML = '<p style="color:#888; font-size:0.8rem; text-align:center;">Aún no hay despachos.</p>';
    });
};

// --- 3. ESTADÍSTICAS ---
const escucharEstadisticas = () => {
    const q = query(collection(db, "pedidos"));
    onSnapshot(q, (sn) => {
        let hoy = 0, mes = 0;
        const ahora = new Date();
        sn.docs.forEach(d => {
            const p = d.data();
            if (p.estado === 'completado' && p.timestamp) {
                const f = p.timestamp.toDate();
                if (f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear()) {
                    mes += p.total;
                    if (f.getDate() === ahora.getDate()) hoy += p.total;
                }
            }
        });
        const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });
        if(document.getElementById('ventas-hoy')) document.getElementById('ventas-hoy').innerText = fmt.format(hoy);
        if(document.getElementById('ventas-mes')) document.getElementById('ventas-mes').innerText = fmt.format(mes);
    });
};

// --- ACCESO Y FUNCIONES ---
onAuthStateChanged(auth, (user) => {
    if (user && correosAutorizados.includes(user.email)) {
        document.getElementById('admin-panel').style.display = 'flex';
        document.getElementById('login-screen').style.display = 'none';
        escucharPedidos(); escucharMenu(); escucharEstadisticas();
    } else {
        if(user) { alert("Acceso denegado"); signOut(auth); }
        document.getElementById('admin-panel').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
    }
});

document.getElementById('login-btn').onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
document.getElementById('logout-btn').onclick = () => signOut(auth);

const form = document.getElementById('menu-form');
form.onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const datos = {
        nombre: document.getElementById('name').value,
        precio: Number(document.getElementById('price').value),
        categoria: document.getElementById('category').value,
        descripcion: document.getElementById('desc').value,
        ingredientes: document.getElementById('ingredients').value.split(',').map(i => i.trim()),
        timestamp: serverTimestamp()
    };
    try {
        if (id) await updateDoc(doc(db, "platos", id), datos);
        else await addDoc(collection(db, "platos"), datos);
        form.reset(); window.cancelarEdicion();
    } catch (err) { alert("Error al guardar"); }
};

window.borrarPlato = async (id) => { if(confirm("¿Borrar plato?")) await deleteDoc(doc(db, "platos", id)); };
window.completarPedido = async (id) => await updateDoc(doc(db, "pedidos", id), { estado: "completado" });
window.eliminarPedido = async (id) => { if(confirm("¿Eliminar registro?")) await deleteDoc(doc(db, "pedidos", id)); };

window.prepararEdicion = (id) => {
    const q = query(collection(db, "platos"));
    onSnapshot(q, (sn) => {
        const d = sn.docs.find(doc => doc.id === id)?.data();
        if(d) {
            document.getElementById('edit-id').value = id;
            document.getElementById('name').value = d.nombre;
            document.getElementById('price').value = d.precio;
            document.getElementById('category').value = d.categoria;
            document.getElementById('desc').value = d.descripcion || '';
            document.getElementById('ingredients').value = d.ingredientes ? d.ingredientes.join(', ') : '';
            document.getElementById('form-title').innerText = "Editando Plato";
            document.getElementById('submit-btn').innerText = "ACTUALIZAR CAMBIOS";
            document.getElementById('close-edit-btn').style.display = "block";
            document.querySelector('.content-area').scrollTo({top: 0, behavior: 'smooth'});
        }
    }, {onlyOnce: true});
};

window.cancelarEdicion = () => {
    document.getElementById('edit-id').value = "";
    document.getElementById('form-title').innerText = "Añadir Nuevo Plato";
    document.getElementById('submit-btn').innerText = "PUBLICAR PLATO";
    document.getElementById('close-edit-btn').style.display = "none";
    form.reset();
};
