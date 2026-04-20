// Cambiar entre pestañas (Diario, Comidas Rápidas, Varios)
function switchTab(event, sectionId) {
    // 1. Quitar clases activas
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.menu-section').forEach(sec => sec.classList.remove('active'));

    // 2. Activar el botón y la sección seleccionada
    event.currentTarget.classList.add('active');
    document.getElementById(sectionId).classList.add('active');
    
    // 3. Resetear los ingredientes abiertos al cambiar de pestaña
    document.querySelectorAll('.ingredients').forEach(ing => ing.classList.remove('show'));
}

// Mostrar u ocultar ingredientes de cada plato
function toggleIngredients(element) {
    const ingredientsDiv = element.querySelector('.ingredients');
    
    // Opcional: Cerrar otros ingredientes abiertos en la misma sección para no saturar
    const parentSection = element.parentElement;
    parentSection.querySelectorAll('.ingredients').forEach(ing => {
        if(ing !== ingredientsDiv) ing.classList.remove('show');
    });

    // Abrir o cerrar el actual
    ingredientsDiv.classList.toggle('show');
}
