import { db } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

// Funciones globales (necesarias para los onclick del HTML)
window.toggleIngredients = (element) => {
    const ingDiv = element.querySelector('.ingredients');
    ingDiv.classList.toggle('show');
};

window.switchTab = (event, sectionId) => {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.menu-section').forEach(sec => sec.classList.remove('active'));
    event.currentTarget.classList.add('active');
    document.getElementById(sectionId).classList.add('active');
};

// Escuchar cambios en Firebase
const q = query(collection(db, "platos"), orderBy("timestamp", "desc"));

onSnapshot(q, (snapshot) => {
    const sections = { diario: '', rapida: '', varios: '' };
    const loader = document.getElementById('loader');
    if(loader) loader.style.display = 'none';

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        const itemHTML = `
            <div class="dish-item" onclick="toggleIngredients(this)">
                <div class="dish-header">
                    <h3>${data.nombre}</h3>
                    <span class="price">$${Number(data.precio).toLocaleString()}</span>
                </div>
                <p class="description">${data.descripcion || ''}</p>
                <div class="ingredients">
                    <h4 style="font-size:0.7rem; color:#b8860b; text-transform:uppercase; margin-bottom:5px;">Productos usados:</h4>
                    <ul>
                        ${data.ingredientes ? data.ingredientes.map(ing => `<li>${ing.trim()}</li>`).join('') : '<li>Ver descripción</li>'}
                    </ul>
                </div>
            </div>
        `;
        if (sections[data.categoria] !== undefined) {
            sections[data.categoria] += itemHTML;
        }
    });

    // Inyectar contenido o mensaje de vacío
    Object.keys(sections).forEach(id => {
        document.getElementById(id).innerHTML = sections[id] || '<p style="color:#999; padding:20px; font-style:italic;">Próximamente...</p>';
    });
});
