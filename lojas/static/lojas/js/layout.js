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
            
            // Fecha submenus ao recolher a sidebar
            if (sidebar.classList.contains('collapsed')) {
                document.querySelectorAll('.sidebar-submenu').forEach(sub => sub.classList.remove('show'));
                document.querySelectorAll('.sidebar-link').forEach(link => link.setAttribute('aria-expanded', 'false'));
            }
        });

        // Ajuste automático para mobile
        window.addEventListener('resize', () => {
            if (window.innerWidth < 768) {
                sidebar.classList.add('collapsed');
            }
        });
    }

    // Lógica de Submenus
    const subMenuToggles = document.querySelectorAll('.sidebar-link[data-toggle="submenu"]');
    
    subMenuToggles.forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            if (sidebar.classList.contains('collapsed')) {
                sidebar.classList.remove('collapsed');
                localStorage.setItem('sidebar-collapsed', 'false');
            }
            
            const submenu = toggle.nextElementSibling;
            const isOpen = submenu.classList.contains('show');
            
            // Fecha outros submenus abertos (opcional)
            // document.querySelectorAll('.sidebar-submenu').forEach(sub => sub.classList.remove('show'));
            // document.querySelectorAll('.sidebar-link').forEach(l => l.setAttribute('aria-expanded', 'false'));
            
            if (isOpen) {
                submenu.classList.remove('show');
                toggle.setAttribute('aria-expanded', 'false');
            } else {
                submenu.classList.add('show');
                toggle.setAttribute('aria-expanded', 'true');
            }
        });
    });

    // Abre automaticamente o submenu se houver um item ativo dentro dele
    const activeSubLink = document.querySelector('.sidebar-submenu-link.active');
    if (activeSubLink) {
        const submenu = activeSubLink.closest('.sidebar-submenu');
        if (submenu) {
            submenu.classList.add('show');
            const toggle = submenu.previousElementSibling;
            if (toggle) toggle.setAttribute('aria-expanded', 'true');
        }
    }
});
