import { db, auth } from './firebase-config.js';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
import { collection, addDoc, serverTimestamp, query, onSnapshot, doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

const correosAutorizados = ["cb01grupo@gmail.com", "kelly.araujotafur@gmail.com"];

const form = document.getElementById('menu-form');
const submitBtn = document.getElementById('submit-btn');
const cancelBtn = document.getElementById('cancel-edit');
const formTitle = document.getElementById('form-title');
const editIdInput = document.getElementById('edit-id');

// --- 1. AUTENTICACIÓN ---
window.loginConGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
window.cerrarSesion = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
    if (user && correosAutorizados.includes(user.email)) {
        document.getElementById('admin-panel').style.display = 'block';
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('user-tag').innerText = "Admin: " + user.email;
        cargarPlatosOrganizados();
    } else {
        if(user) { alert("No tienes acceso"); signOut(auth); }
        document.getElementById('admin-panel').style.display = 'none';
        document.getElementById('login-screen').style.display = 'block';
    }
});

// --- 2. CARGAR Y ORGANIZAR POR SECCIONES ---
function cargarPlatosOrganizados() {
    const q = collection(db, "platos");
    
    onSnapshot(q, (snapshot) => {
        // Limpiar todas las listas antes de recargar
        const listas = {
            diario: document.getElementById('lista-diario'),
            rapida: document.getElementById('lista-rapida'),
            varios: document.getElementById('lista-varios')
        };
        
        Object.values(listas).forEach(l => l.innerHTML = '<p style="font-size:0.7rem; color:#ccc; padding:10px;">No hay platos aquí.</p>');

        snapshot.docs.forEach(platoDoc => {
            const data = platoDoc.data();
            const id = platoDoc.id;
            const cat = data.categoria || 'diario';

            const itemHTML = `
                <div class="plato-item">
                    <div class="plato-info">
                        <strong>${data.nombre}</strong><br>
                        <small>$${data.precio}</small>
                    </div>
                    <div class="plato-actions">
                        <button class="btn-edit" data-id="${id}">Editar</button>
                        <button class="btn-delete" data-id="${id}">Borrar</button>
                    </div>
                </div>
            `;

            // Si es el primer plato de la lista, quitamos el mensaje de "vacío"
            if (listas[cat].innerHTML.includes("No hay platos")) listas[cat].innerHTML = '';
            listas[cat].innerHTML += itemHTML;
        });

        // Asignar eventos a los botones después de renderizar
        asignarEventos();
    });
}

// --- 3. LÓGICA DE BOTONES (EDITAR / BORRAR) ---
function asignarEventos() {
    // BOTÓN BORRAR
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.onclick = async (e) => {
            if(confirm("¿Seguro que quieres eliminar este plato?")) {
                const id = e.target.getAttribute('data-id');
                await deleteDoc(doc(db, "platos", id));
            }
        };
    });

    // BOTÓN EDITAR
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.onclick = (e) => {
            const id = e.target.getAttribute('data-id');
            prepararEdicion(id);
        };
    });
}

// --- 4. PREPARAR FORMULARIO PARA EDITAR ---
async function prepararEdicion(id) {
    // Buscamos el plato en la lista actual (para no pedirle de nuevo a Firebase si ya lo tenemos)
    // O puedes hacer un getDoc si prefieres. Aquí lo buscaremos por el ID.
    const q = collection(db, "platos");
    onSnapshot(q, (snapshot) => {
        const plato = snapshot.docs.find(d => d.id === id);
        if(plato) {
            const data = plato.data();
            document.getElementById('name').value = data.nombre;
            document.getElementById('price').value = data.precio;
            document.getElementById('category').value = data.categoria;
            document.getElementById('desc').value = data.descripcion || '';
            document.getElementById('ingredients').value = data.ingredientes ? data.ingredientes.join(',') : '';
            
            // Cambiamos el modo del formulario
            editIdInput.value = id;
            formTitle.innerText = "Editando: " + data.nombre;
            submitBtn.innerText = "Guardar Cambios";
            submitBtn.style.background = "#4285F4"; // Color azul para indicar edición
            cancelBtn.style.display = "block";
            window.scrollTo(0,0); // Sube para que veas el formulario
        }
    }, { onlyOnce: true });
}

window.cancelarEdicion = () => {
    form.reset();
    editIdInput.value = "";
    formTitle.innerText = "Publicar Nuevo Plato";
    submitBtn.innerText = "Publicar Plato";
    submitBtn.style.background = "#ffcc00";
    cancelBtn.style.display = "none";
};

// --- 5. GUARDAR O ACTUALIZAR ---
form.onsubmit = async (e) => {
    e.preventDefault();
    const id = editIdInput.value;
    const datos = {
        nombre: document.getElementById('name').value,
        precio: document.getElementById('price').value,
        categoria: document.getElementById('category').value,
        descripcion: document.getElementById('desc').value,
        ingredientes: document.getElementById('ingredients').value.split(','),
        timestamp: serverTimestamp()
    };

    try {
        if (id) {
            // EDITAR EXISTENTE
            await updateDoc(doc(db, "platos", id), datos);
            alert("Plato actualizado con éxito");
            cancelarEdicion();
        } else {
            // CREAR NUEVO
            await addDoc(collection(db, "platos"), datos);
            alert("Nuevo plato publicado");
            form.reset();
        }
    } catch (err) {
        alert("Error: " + err.message);
    }
};
