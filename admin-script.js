import { db, auth } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, addDoc, getDoc, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

const correos = ["cb01grupo@gmail.com", "kelly.araujotafur@gmail.com"];
let totalPAnterior = 0;

// Iconos SVG minimalistas
const ICON_EDIT = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>`;
const ICON_TRASH = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

const sonar = () => { const a = document.getElementById('notif-sound'); if(a) a.play().catch(e => {}); };

// PROCESAR ESTADÍSTICAS
const procesarEstadisticas = async (pedidos) => {
    const ahora = new Date();
    const mesActual = `${ahora.getMonth() + 1}-${ahora.getFullYear()}`;
    const hoyStr = ahora.toDateString();
    let vHoy = 0, vMes = 0;
    const conteoGlobal = {};
    const historialMeses = {}; 

    const platosSnap = await getDocs(collection(db, "platos"));
    const catMapa = {};
    platosSnap.forEach(d => { catMapa[d.data().nombre] = d.data().categoria; });

    pedidos.forEach(p => {
        if (p.estado !== 'completado' || !p.timestamp) return;
        const f = p.timestamp.toDate();
        const mKey = `${f.getMonth() + 1}-${f.getFullYear()}`;
        if (f.toDateString() === hoyStr) vHoy += p.total;
        if (mKey === mesActual) vMes += p.total;

        if (!historialMeses[mKey]) historialMeses[mKey] = { total: 0, platos: {} };
        historialMeses[mKey].total += p.total;

        p.items.forEach(i => {
            historialMeses[mKey].platos[i.nombre] = (historialMeses[mKey].platos[i.nombre] || 0) + 1;
            if (mKey === mesActual) {
                if (!conteoGlobal[i.nombre]) conteoGlobal[i.nombre] = { cantidad: 0, cat: catMapa[i.nombre] || 'varios' };
                conteoGlobal[i.nombre].cantidad++;
            }
        });
    });

    const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);
    document.getElementById('s-hoy').innerText = fmt(vHoy);
    document.getElementById('s-mes').innerText = fmt(vMes);

    const rankingsDiv = document.getElementById('rankings-categoria');
    if(rankingsDiv) {
        const tops = { diario: { n: '---', c: 0 }, rapida: { n: '---', c: 0 }, varios: { n: '---', c: 0 } };
        Object.keys(conteoGlobal).forEach(nom => {
            const inf = conteoGlobal[nom];
            if (inf.cantidad > tops[inf.cat].c) tops[inf.cat] = { n: nom, c: inf.cantidad };
        });
        rankingsDiv.innerHTML = `
            <div style="padding:15px; background:#f8fafc; border-radius:12px; font-size:0.8rem;"><strong>📅 Menú Día</strong><br>${tops.diario.n}</div>
            <div style="padding:15px; background:#f8fafc; border-radius:12px; font-size:0.8rem;"><strong>🍔 Rápidas</strong><br>${tops.rapida.n}</div>
            <div style="padding:15px; background:#f8fafc; border-radius:12px; font-size:0.8rem;"><strong>✨ Varios</strong><br>${tops.varios.n}</div>`;
    }

    const hBody = document.getElementById('historial-meses');
    if(hBody) {
        hBody.innerHTML = '';
        Object.keys(historialMeses).sort().reverse().forEach(m => {
            const d = historialMeses[m];
            const top = Object.keys(d.platos).reduce((a, b) => d.platos[a] > d.platos[b] ? a : b, "---");
            hBody.innerHTML += `<tr><td style="padding:10px;">${m}</td><td style="padding:10px;"><strong>${fmt(d.total)}</strong></td><td style="padding:10px;">${top}</td></tr>`;
        });
    }
};

const escucharData = () => {
    onSnapshot(query(collection(db, "pedidos"), orderBy("timestamp", "desc")), (sn) => {
        const lp = document.getElementById('l-pendientes');
        const la = document.getElementById('l-atendidos');
        const allPedidos = [];
        let pCount = 0;
        const hoy = new Date().toDateString();

        lp.innerHTML = ''; la.innerHTML = '';
        sn.docs.forEach(docSnap => {
            const p = docSnap.data();
            allPedidos.push(p);

            // ITEMS CON SUS NOTAS
            const itemsHTML = p.items.map(i => `
                <div style="margin-bottom:4px;">
                    • ${i.nombre} ${i.nota ? `<span class="item-nota">Nota: ${i.nota}</span>` : ''}
                </div>
            `).join('');

            if (p.estado === 'pendiente') {
                pCount++;
                lp.innerHTML += `
                <div class="pedido-card">
                    <div class="pedido-header"><strong>👤 ${p.cliente}</strong><span class="badge-tipo">${p.tipo.toUpperCase()}</span></div>
                    <div style="font-size:0.9rem; margin:10px 0;">${itemsHTML}</div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-weight:bold; color:var(--success);">$${Number(p.total).toLocaleString()}</span>
                        <button style="background:var(--success); color:white; border:none; padding:8px 16px; border-radius:10px; cursor:pointer; font-weight:bold;" onclick="completar('${docSnap.id}')">LISTO</button>
                    </div>
                </div>`;
            } else if (p.estado === 'completado' && p.timestamp?.toDate().toDateString() === hoy) {
                la.innerHTML += `
                <div class="admin-row" style="border:none; border-bottom:1px solid #f1f5f9;">
                    <span><strong>${p.cliente}</strong> <small style="color:#94a3b8; margin-left:10px;">${p.tipo}</small></span>
                    <span style="color:var(--success); font-weight:600;">$${Number(p.total).toLocaleString()}</span>
                </div>`;
            }
        });
        if(pCount > totalPAnterior) sonar();
        totalPAnterior = pCount;
        procesarEstadisticas(allPedidos);
    });
};

const escucharMenu = () => {
    onSnapshot(collection(db, "platos"), (sn) => {
        const inv = document.getElementById('inv-list');
        inv.innerHTML = `
            <div class="admin-group" id="g-diario"><div class="admin-group-header" onclick="toggleSeccion(this)"><h4>📅 Menú del Día</h4><span class="chevron">▼</span></div><div class="admin-group-content" id="adm-diario"></div></div>
            <div class="admin-group" id="g-rapida"><div class="admin-group-header" onclick="toggleSeccion(this)"><h4>🍔 Comidas Rápidas</h4><span class="chevron">▼</span></div><div class="admin-group-content" id="adm-rapida"></div></div>
            <div class="admin-group" id="g-varios"><div class="admin-group-header" onclick="toggleSeccion(this)"><h4>✨ Varios</h4><span class="chevron">▼</span></div><div class="admin-group-content" id="adm-varios"></div></div>
        `;
        sn.docs.forEach(docSnap => {
            const d = docSnap.data();
            const html = `
            <div class="admin-row">
                <div style="display:flex; flex-direction:column;"><strong>${d.nombre}</strong><span style="font-size:0.8rem; color:var(--success); font-weight:600;">$${Number(d.precio).toLocaleString()}</span></div>
                <div class="actions">
                    <label class="switch"><input type="checkbox" ${d.disponible !== false ? 'checked' : ''} onchange="toggleStock('${docSnap.id}', this.checked)"><span class="slider"></span></label>
                    <button class="btn-icon btn-edit" onclick="prepararEdicion('${docSnap.id}')">${ICON_EDIT}</button>
                    <button class="btn-icon btn-delete" onclick="triggerDelete('${docSnap.id}')">${ICON_TRASH}</button>
                </div>
            </div>`;
            const target = document.getElementById(`adm-${d.categoria}`);
            if(target) target.innerHTML += html;
        });
    });
};

window.completar = (id) => updateDoc(doc(db, "pedidos", id), { estado: 'completado' });
window.toggleStock = (id, val) => updateDoc(doc(db, "platos", id), { disponible: val });

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

window.prepararEdicion = async (id) => {
    const snap = await getDoc(doc(db, "platos", id));
    const d = snap.data();
    document.getElementById('edit-id').value = id;
    document.getElementById('name').value = d.nombre;
    document.getElementById('price').value = d.precio;
    document.getElementById('category').value = d.categoria;
    document.getElementById('desc').value = d.descripcion || '';
    document.getElementById('ingredients').value = d.ingredientes?.join(',') || '';
    document.getElementById('f-title').innerText = "✏️ Editando: " + d.nombre;
    document.getElementById('s-btn').innerText = "ACTUALIZAR CAMBIOS";
    document.getElementById('close-x').style.display = "block";
    document.querySelector('.main-content').scrollTo({top: 0, behavior: 'smooth'});
};

window.cancelarEdicion = () => {
    document.getElementById('edit-id').value = "";
    document.getElementById('f-title').innerText = "➕ Gestionar Carta";
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
