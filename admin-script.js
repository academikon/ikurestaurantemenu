import { db, auth } from './firebase-config.js';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

const correosAutorizados = ["cb01grupo@gmail.com", "kelly.araujotafur@gmail.com"];

// --- DEFINICIÓN DE FUNCIONES (Primero las definimos) ---

const escucharMenu = () => {
    const q = query(collection(db, "platos"), orderBy("timestamp", "desc"));
    onSnapshot(q, (sn) => {
        const listas = {
            diario: document.getElementById('lista-diario'),
            rapida: document.getElementById('lista-rapida'),
            varios: document.getElementById('lista-varios')
        };

        // Verificamos que los elementos existan antes de escribir
        if (!listas.diario) return;

        Object.values(listas).forEach(l => l.innerHTML = '');

        sn.docs.forEach(docSnap => {
            const d = docSnap.data();
            const id = docSnap.id;
            const item = document.createElement('div');
            item.className = 'plato-item';
            item.innerHTML = `
                <span><strong>${d.nombre}</strong> ($${d.precio})</span>
                <div>
                    <button style="background:#4285F4; color:white; border:none; padding:5px; cursor:pointer;" onclick="prepararEdicion('${id}')">Editar</button>
                    <button style="background:red; color:white; border:none; padding:5px; cursor:pointer;" onclick="borrarPlato('${id}')">X</button>
                </div>
            `;
            if (listas[d.categoria]) listas[d.categoria].appendChild(item);
        });
    });
};

const escucharPedidos = () => {
    const q = query(collection(db, "pedidos"), orderBy("timestamp", "desc"));
    onSnapshot(q, (sn) => {
        const cont = document.getElementById('lista-pedidos-realtime');
        if (!cont) return;
        cont.innerHTML = '';

        if (sn.empty) {
            cont.innerHTML = '<p style="text-align:center; color:#888;">No hay pedidos pendientes.</p>';
            return;
        }

        sn.docs.forEach(d => {
            const p = d.data();
            const card = document.createElement('div');
            card.className = 'pedido-card';
            card.style.borderLeftColor = p.estado === 'pendiente' ? '#ffcc00' : '#28a745';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between">
                    <strong>👤 Mesa/Cliente: ${p.cliente}</strong>
                    <span>$${p.total}</span>
                </div>
                <ul style="margin:10px 0; font-size:0.9rem;">
                    ${p.items.map(i => `<li>${i.nombre} ${i.nota ? `<br><small>📝 ${i.nota}</small>` : ''}</li>`).join('')}
                </ul>
                <button style="background:#28a745; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer;" onclick="completarPedido('${d.id}')">Listo</button>
                <button style="background:#dc3545; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer;" onclick="eliminarPedido('${d.id}')">X</button>
            `;
            cont.appendChild(card);
        });
    });
};

// --- LOGICA DE ACCESO ---

onAuthStateChanged(auth, (user) => {
    const panel = document.getElementById('admin-panel');
    const login = document.getElementById('login-screen');
    
    if (user && correosAutorizados.includes(user.email)) {
        panel.style.display = 'block';
        login.style.display = 'none';
        escucharPedidos();
        escucharMenu();
    } else {
        if(user) { alert("Acceso denegado"); signOut(auth); }
        panel.style.display = 'none';
        login.style.display = 'block';
    }
});

const loginBtn = document.getElementById('login-btn');
if (loginBtn) {
    loginBtn.onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
}

// --- GESTIÓN DE FORMULARIO ---

const form = document.getElementById('menu-form');
if (form) {
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
            if (id) {
                await updateDoc(doc(db, "platos", id), datos);
                alert("Actualizado");
            } else {
                await addDoc(collection(db, "platos"), datos);
                alert("Publicado");
            }
            form.reset();
            window.cancelarEdicion();
        } catch (err) { alert("Error al guardar"); }
    };
}

// --- FUNCIONES GLOBALES (Window) ---

window.borrarPlato = async (id) => { if(confirm("¿Borrar?")) await deleteDoc(doc(db, "platos", id)); };
window.completarPedido = async (id) => await updateDoc(doc(db, "pedidos", id), { estado: "completado" });
window.eliminarPedido = async (id) => { if(confirm("¿Eliminar pedido?")) await deleteDoc(doc(db, "pedidos", id)); };

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
            document.getElementById('submit-btn').innerText = "GUARDAR CAMBIOS";
            document.getElementById('cancel-edit').style.display = "block";
            window.scrollTo(0,0);
        }
    }, {onlyOnce: true});
};

window.cancelarEdicion = () => {
    document.getElementById('edit-id').value = "";
    document.getElementById('submit-btn').innerText = "PUBLICA PLATO";
    document.getElementById('cancel-edit').style.display = "none";
    form.reset();
};
