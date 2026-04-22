import { db } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

// --- 1. LÓGICA DE PESTAÑAS (TABS) ---
const tabs = document.querySelectorAll('.tab-btn');
const sections = document.querySelectorAll('.menu-section');

tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
        const target = e.target.getAttribute('data-tab');

        // 1. Apagar todos los botones y secciones
        tabs.forEach(btn => btn.classList.remove('active'));
        sections.forEach(sec => {
            sec.classList.remove('active');
            sec.style.display = 'none'; // Aseguramos que se oculte
        });

        // 2. Encender solo la que elegimos
        e.target.classList.add('active');
        const activeSection = document.getElementById(target);
        if (activeSection) {
            activeSection.classList.add('active');
            activeSection.style.display = 'block'; // Aseguramos que se vea
        }
    });
});

// --- 2. CARGA Y FILTRADO POR CATEGORÍA ---
const renderMenu = () => {
    const q = query(collection(db, "platos"), orderBy("timestamp", "desc"));
    
    onSnapshot(q, (snapshot) => {
        // Objetos vacíos para separar los platos
        const htmlPorCategoria = {
            diario: '',
            rapida: '',
            varios: ''
        };

        const loader = document.getElementById('loader');
        if (loader) loader.style.display = 'none';

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            
            // Si el plato no tiene categoría, lo mandamos a 'diario' por defecto
            const categoriaPlato = data.categoria || 'diario';

            const formattedPrice = new Intl.NumberFormat('es-CO', {
                style: 'currency', currency: 'COP', minimumFractionDigits: 0
            }).format(data.precio);

            const dishHTML = `
                <div class="dish-item">
                    <div class="dish-header">
                        <h3>${data.nombre}</h3>
                        <span class="price">${formattedPrice}</span>
                    </div>
                    <p class="description">${data.descripcion || ''}</p>
                </div>
            `;

            // AQUÍ ESTÁ EL FILTRO: Solo sumamos el HTML a su categoría correspondiente
            if (htmlPorCategoria[categoriaPlato] !== undefined) {
                htmlPorCategoria[categoriaPlato] += dishHTML;
            }
        });

        // 3. INYECTAR CADA GRUPO EN SU SECCIÓN CORRESPONDIENTE
        Object.keys(htmlPorCategoria).forEach(cat => {
            const contenedor = document.getElementById(cat);
            if (contenedor) {
                // Si la categoría está vacía, ponemos el mensaje de próximamente
                contenedor.innerHTML = htmlPorCategoria[cat] || '<p style="text-align:center; color:#999; padding:20px;">Próximamente más delicias...</p>';
            }
        });
    });
};

renderMenu();
