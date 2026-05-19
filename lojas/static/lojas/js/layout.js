/**
 * Lógica do Layout e Componentes Globais
 */

document.addEventListener('DOMContentLoaded', () => {
    // Lógica da Sidebar Retrátil
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggle-btn');
    
    if (sidebar && toggleBtn) {
        // Aplica estado inicial sem animação para evitar flicker
        if (localStorage.getItem('sidebar-collapsed') === 'true' || window.innerWidth < 1024) {
            sidebar.classList.add('collapsed');
        }

        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
        });

        // Ajuste automático para mobile
        window.addEventListener('resize', () => {
            if (window.innerWidth < 768) {
                sidebar.classList.add('collapsed');
            }
        });
    }
});
