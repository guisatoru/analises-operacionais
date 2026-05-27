function getCookie(name) {
    const cookies = document.cookie ? document.cookie.split(';') : [];

    for (const cookie of cookies) {
        const cleanCookie = cookie.trim();
        if (cleanCookie.startsWith(name + '=')) {
            return decodeURIComponent(cleanCookie.substring(name.length + 1));
        }
    }

    return '';
}

function setGeoSyncProgress(progress, message, status) {
    const container = document.getElementById('geo-sync-progress-container');
    const bar = document.getElementById('geo-sync-progress-bar');
    const text = document.getElementById('geo-sync-progress-text');
    const percent = document.getElementById('geo-sync-progress-percent');
    const reportLinks = document.getElementById('geo-sync-report-links');

    if (!container || !bar || !text || !percent) {
        return;
    }

    container.classList.remove('hidden');
    bar.style.width = progress + '%';
    text.textContent = message;
    percent.textContent = progress + '%';

    bar.classList.toggle('completed', status === 'completed');
    bar.classList.toggle('error', status === 'error');

    if (reportLinks) {
        reportLinks.classList.toggle('hidden', status !== 'completed');
    }
}

function watchGeoSyncProgress(button) {
    const intervalId = window.setInterval(() => {
        fetch('/colaboradores/sync-lojas-geovictoria-progress/')
            .then((response) => response.json())
            .then((progress) => {
                if (progress.status === 'not_found') {
                    return;
                }

                setGeoSyncProgress(progress.progress, progress.message, progress.status);

                if (progress.status === 'completed' || progress.status === 'error') {
                    window.clearInterval(intervalId);
                    if (button) {
                        button.disabled = false;
                    }
                }
            })
            .catch(() => {
                window.clearInterval(intervalId);
                setGeoSyncProgress(0, 'Erro ao consultar o progresso da sincronização.', 'error');
                if (button) {
                    button.disabled = false;
                }
            });
    }, 1500);
}

function startGeoStoreSync() {
    const button = document.getElementById('btn-sync-lojas-geo');
    const form = document.getElementById('colaboradores-filter-form');
    const formData = new FormData(form);

    if (button) {
        button.disabled = true;
    }

    setGeoSyncProgress(0, 'Iniciando sincronização...', 'processing');

    fetch('/colaboradores/sync-lojas-geovictoria/', {
        method: 'POST',
        headers: {
            'X-CSRFToken': getCookie('csrftoken'),
        },
        body: formData,
    })
        .then((response) => response.json())
        .then((data) => {
            if (data.status !== 'started') {
                throw new Error(data.error || 'Não foi possível iniciar a sincronização.');
            }

            setGeoSyncProgress(1, data.message, 'processing');
            watchGeoSyncProgress(button);
        })
        .catch((error) => {
            setGeoSyncProgress(0, error.message, 'error');
            if (button) {
                button.disabled = false;
            }
        });
}

document.addEventListener('DOMContentLoaded', function () {
    const button = document.getElementById('btn-sync-lojas-geo');

    if (button) {
        button.addEventListener('click', startGeoStoreSync);
    }
});
