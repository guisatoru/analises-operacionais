document.addEventListener('DOMContentLoaded', () => {
    const loginBelongsToThisTab = sessionStorage.getItem('login-tab-active') === 'true';

    if (loginBelongsToThisTab) {
        return;
    }

    const logoutForm = document.getElementById('tab-session-logout-form');

    if (logoutForm) {
        logoutForm.submit();
    }
});
