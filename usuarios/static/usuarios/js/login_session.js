document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');

    if (!loginForm) {
        return;
    }

    loginForm.addEventListener('submit', () => {
        sessionStorage.setItem('login-tab-active', 'true');
    });
});
