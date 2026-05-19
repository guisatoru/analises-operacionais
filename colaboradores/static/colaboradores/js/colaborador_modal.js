/**
 * Gerenciamento do Modal de Detalhes do Colaborador
 * Explicação: Centraliza a lógica de abertura, fechamento e preenchimento dos dados.
 */

function openColaboradorModal(data) {
    // Preenche os campos de texto
    const fields = {
        'modal-nome': data.nome,
        'modal-re': data.re,
        'modal-cargo': data.cargo,
        'modal-loja': data.loja,
        'modal-admissao': data.admissao,
        'modal-demissao': data.demissao,
        'modal-termino1': data.termino1,
        'modal-termino2': data.termino2
    };

    for (const [id, value] of Object.entries(fields)) {
        const el = document.getElementById(id);
        if (el) el.innerText = value || '-';
    }

    // Gerencia o badge de status
    const statusEl = document.getElementById('modal-status');
    if (statusEl) {
        statusEl.className = 'badge';
        statusEl.innerText = data.status;
        
        if (data.status === 'Ativo') {
            statusEl.classList.add('badge-success');
        } else if (data.status === 'Demitido') {
            statusEl.classList.add('badge-danger');
        } else {
            statusEl.classList.add('badge-neutral');
        }
    }

    // Exibe o modal
    const overlay = document.getElementById('colaboradorModalOverlay');
    if (overlay) {
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeColaboradorModal() {
    const overlay = document.getElementById('colaboradorModalOverlay');
    if (overlay) {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Inicialização dos eventos
document.addEventListener('DOMContentLoaded', function() {
    // Evento para abrir o modal via clique na linha (delegação de evento)
    const tableBody = document.querySelector('.dense-table tbody');
    if (tableBody) {
        tableBody.addEventListener('click', function(e) {
            const row = e.target.closest('.clickable-row');
            if (row) {
                // Captura todos os data-attributes
                const data = {
                    nome: row.getAttribute('data-nome'),
                    re: row.getAttribute('data-re'),
                    cargo: row.getAttribute('data-cargo'),
                    loja: row.getAttribute('data-loja'),
                    status: row.getAttribute('data-status'),
                    admissao: row.getAttribute('data-admissao'),
                    demissao: row.getAttribute('data-demissao'),
                    termino1: row.getAttribute('data-termino1'),
                    termino2: row.getAttribute('data-termino2')
                };
                openColaboradorModal(data);
            }
        });
    }

    // Atalho: Fechar com tecla ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeColaboradorModal();
        }
    });
});
