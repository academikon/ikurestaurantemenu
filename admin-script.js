import { db, auth } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

const correos = ["cb01grupo@gmail.com", "kelly.araujotafur@gmail.com"];
let totalPendientesAnterior = 0;

const sonar = () => {
    const audio = document.getElementById('notif-sound');
    if(audio) audio.play().catch(e => console.log("Interacción requerida para sonido"));
};

const escucharData = () => {
    onSnapshot(query(collection(db, "pedidos"), orderBy("timestamp", "desc")), (sn) => {
        const lp = document.getElementById('l-pendientes');
        const la = document.getElementById('l-atendidos');
        const sHoy = document.getElementById('s-hoy');
        const sMes = document.getElementById('s-mes');
        const hBody = document.getElementById('historial-mensual-body');
        const t5 = document.getElementById('top-5');
        const b5 = document.getElementById('bot-5');

        let pendCount = 0, hoy = 0, mesActualTotal = 0;
        const rankingMesActual = {};
        const historialMeses = {}; // { "04-2026": { total: 0, platos: {} } }
        
        const ahora = new Date();
        const mesActualKey = `${ahora.getMonth() + 1}-${ahora.getFullYear()}`;

        if(lp) lp.innerHTML = ''; 
        if(la) la.innerHTML = '';

        sn.docs.forEach(d => {
            const p = d.data();
            const id = d.id;
            const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(p.total);

            if(p.estado === 'pendiente') {
                pendCount++;
                if(lp) lp.innerHTML += `<div class="pedido-card"><strong>${p.cliente}</strong><p style="font-size:0.8rem; margin:10px 0;">${p.items.map(i=>i.nombre).join(', ')}</p><strong>${fmt}</strong><button onclick="completar('${id}')" style="background:var(--success); color:white; border:none; width:100%; padding:10px; border-radius:6px; cursor:pointer; margin-top:10px;">LISTO</button></div>`;
            } else if (p.estado === 'completado' && p.timestamp) {
                const f = p.timestamp.toDate();
                const fKey = `${f.getMonth() + 1}-${f.getFullYear()}`;
                
                // Solo mostrar en la lista de "Hoy" si es la fecha actual
                if(f.getDate() === ahora.getDate() && f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear()) {
                    if(la) la.innerHTML += `<div class="atendido-row"><strong>${p.cliente}</strong><span style="color:var(--success); text-align:center;">${fmt}</span><button onclick="borrarP('${id}')" style="background:none; border:none; color:red; cursor:pointer; text-align:right;">Borrar</button></div>`;
                    hoy += p.total;
                }

                // Acumular para el historial de meses
                if(!historialMeses[fKey]) historialMeses[fKey] = { total: 0, platos: {} };
                historialMeses[fKey].total += p.total;
                p.items.forEach(i => {
                    historialMeses[fKey].platos[i.n] = (historialMeses[fKey].platos[i.n] || 0) + 1;
                    if(fKey === mesActualKey) rankingMesActual[i.nombre] = (rankingMesActual[i.nombre] || 0) + 1;
                });

                if(fKey === mesActualKey) mesActualTotal += p.total;
            }
        });

        if(pendCount > totalPendientesAnterior) sonar();
        totalPendientesAnterior = pendCount;

        const cur = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });
        if(sHoy) sHoy.innerText = cur.format(hoy);
        if(sMes) sMes.innerText = cur.format(mesActualTotal);

        // Renderizar Historial de Meses (Excepto el actual para que sea resumen)
        if(hBody) {
            hBody.innerHTML = '';
            Object.keys(historialMeses).sort().reverse().forEach(key => {
                if(key !== mesActualKey) {
                    const mesData = historialMeses[key];
                    const estrella = Object.keys(mesData.platos).reduce((a, b) => mesData.platos[a] > mesData.platos[b] ? a : b, "---");
                    hBody.innerHTML += `<tr><td>${key}</td><td><strong>${cur.format(mesData.total)}</strong></td><td>${estrella}</td></tr>`;
                }
            });
        }

        // Ranking Mes Actual
        if(t5 && b5) {
            const sorted = Object.keys(rankingMesActual).map(n=>({n, c:rankingMesActual[n]})).sort((a,b)=>b.c - a.c);
            t5.innerHTML = sorted.slice(0,5).map(x=>`<li>${x.n} (${x.c})</li>`).join('');
            b5.innerHTML = sorted.slice(-5).reverse().map(x=>`<li>${x.n} (${x.c})</li>`).join('');
        }
    });
};

const escucharMenu = () => {
    onSnapshot(collection(db, "platos"), (sn) => {
        const inv = document.getElementById('inv-list');
        if(!inv) return;
        inv.innerHTML = '<h4>Inventario y Stock</h4>';
        sn.docs.forEach(docSnap => {
            const d = docSnap.data();
            inv.innerHTML += `<div style="display:flex; justify-content:space-between; padding:15px; border-bottom:1px solid #eee; align-items:center;">
                <span><strong>${d.nombre}</strong></span>
                <div style="display:flex; gap:15px; align-items:center;">
                    <label class="switch"><input type="checkbox" ${d.disponible !== false ? 'checked' : ''} onchange="toggleStock('${docSnap.id}', this.checked)"><span class="slider"></span></label>
                    <button onclick="prepararEdicion('${docSnap.id}')" style="color:blue; border:none; background:none; cursor:pointer;">Editar</button>
                    <button onclick="borrarM('${docSnap.id}')" style="color:red; border:none; background:none; cursor:pointer;">X</button>
                </div>
            </div>`;
        });
    });
};

window.toggleStock = (id, val) => updateDoc(doc(db, "platos", id), { disponible: val });

const mForm = document.getElementById('m-form');
if(mForm) {
    mForm.onsubmit = async (e) => {
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
        if(id) await updateDoc(doc(db, "platos", id), datos);
        else await addDoc(collection(db, "platos"), { ...datos, disponible: true });
        mForm.reset(); window.cancelarEdicion();
    };
}

window.completar = (id) => updateDoc(doc(db, "pedidos", id), { estado: 'completado' });
window.borrarP = (id) => { if(confirm("¿Borrar registro de hoy?")) deleteDoc(doc(db, "pedidos", id)); };
window.borrarM = (id) => { if(confirm("¿Borrar plato permanentemente?")) deleteDoc(doc(db, "platos", id)); };

window.prepararEdicion = (id) => {
    onSnapshot(doc(db, "platos", id), (snap) => {
        const d = snap.data();
        if(!d) return;
        document.getElementById('edit-id').value = id;
        document.getElementById('name').value = d.nombre;
        document.getElementById('price').value = d.precio;
        document.getElementById('category').value = d.categoria;
        document.getElementById('desc').value = d.descripcion || '';
        document.getElementById('ingredients').value = d.ingredientes.join(',');
        document.getElementById('f-title').innerText = "Editando Plato...";
        document.getElementById('s-btn').innerText = "ACTUALIZAR CAMBIOS";
        document.getElementById('close-x').style.display = "block";
        document.querySelector('.content-area').scrollTo({top:0, behavior:'smooth'});
    }, {onlyOnce:true});
};

window.cancelarEdicion = () => {
    const editId = document.getElementById('edit-id');
    const fTitle = document.getElementById('f-title');
    const sBtn = document.getElementById('s-btn');
    const closeX = document.getElementById('close-x');
    if(editId) editId.value = "";
    if(fTitle) fTitle.innerText = "Añadir Plato";
    if(sBtn) sBtn.innerText = "PUBLICAR";
    if(closeX) closeX.style.display = "none";
    if(mForm) mForm.reset();
};

onAuthStateChanged(auth, (u) => {
    if(u && correos.includes(u.email)) {
        const panel = document.getElementById('admin-panel');
        const login = document.getElementById('login-screen');
        if(panel) panel.style.display = 'flex';
        if(login) login.style.display = 'none';
        escucharData(); escucharMenu();
    }
});

const lBtn = document.getElementById('login-btn');
if(lBtn) lBtn.onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
