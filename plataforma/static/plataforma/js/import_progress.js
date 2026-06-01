document.addEventListener('DOMContentLoaded', () => {
    const importIdElement = document.getElementById('import-id-data');
    const progressBar = document.getElementById('progress-bar');
    const statusMessage = document.getElementById('status-message');
    const statusText = document.getElementById('status-text');
    const backButton = document.getElementById('back-button');

    if (!importIdElement || !progressBar || !statusMessage || !statusText || !backButton) {
        return;
    }

    const importId = JSON.parse(importIdElement.textContent);
    let pollInterval = null;

    function updateProgress(data) {
        const progress = data.progress || 0;
        progressBar.style.width = `${progress}%`;
        progressBar.setAttribute('aria-valuenow', progress);
        progressBar.textContent = `${progress}%`;

        let icon = '<i class="fa-solid fa-spinner fa-spin me-2"></i>';
        if (data.status === 'completed') {
            icon = '<i class="fa-solid fa-circle-check me-2"></i>';
        } else if (data.status === 'error') {
            icon = '<i class="fa-solid fa-circle-exclamation me-2"></i>';
        }

        statusText.innerHTML = icon + data.message;
        statusMessage.className = 'alert import-status-message';
        progressBar.className = 'progress-bar';

        if (data.status === 'completed') {
            progressBar.classList.add('bg-success');
            statusMessage.classList.add(data.msg_type === 'warning' ? 'alert-warning' : 'alert-success');
            backButton.style.display = 'block';
            clearInterval(pollInterval);
            return;
        }

        if (data.status === 'error') {
            progressBar.classList.add('bg-danger');
            statusMessage.classList.add('alert-danger');
            backButton.style.display = 'block';
            clearInterval(pollInterval);
            return;
        }

        progressBar.classList.add('progress-bar-striped', 'progress-bar-animated');
        statusMessage.classList.add('alert-info');
    }

    function checkStatus() {
        fetch(`/import-status/${importId}/`)
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Status nao encontrado');
                }
                return response.json();
            })
            .then((data) => updateProgress(data))
            .catch(() => {
                statusText.textContent = 'Erro ao verificar progresso. A importacao pode ter sido concluida.';
            });
    }

    pollInterval = setInterval(checkStatus, 1000);
    checkStatus();
});
