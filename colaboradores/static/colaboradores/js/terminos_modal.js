/**
 * Gerenciamento do Modal de Controle de Términos
 * Explicação: Lógica para preencher o modal com dados do colaborador, histórico e gerenciar o formulário de decisão.
 */

document.addEventListener('DOMContentLoaded', function() {
    const colabDataElement = document.getElementById('colaboradores-data');
    if (!colabDataElement) return;

    const colabData = JSON.parse(colabDataElement.textContent);
    const modal = document.getElementById('terminoModal');
    if (!modal) return;

    // Configuração dos botões de abrir modal
    document.querySelectorAll('.open-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = btn.getAttribute('data-colaborador-id');
            const data = colabData[id];
            
            if (!data) return;

            // Preenche cabeçalho
            document.getElementById('modalNome').textContent = data.nome;
            document.getElementById('modalInfo').innerHTML = `
                RE: ${data.re} | 
                <span class="text-slate-500">
                    <i class="fa-solid fa-calendar-plus mr-1"></i>Admissão: ${data.admissao || '-'}
                </span> | 
                Fase: ${data.tipoTermino}
            `;
            
            // Preenche formulário
            document.getElementById('formColaboradorId').value = id;
            document.getElementById('formEtapa').value = data.etapaAtual;
            
            const formSection = document.getElementById('formSection');
            const closedMessage = document.getElementById('closedMessage');
            const acoesContainer = document.getElementById('acoesContainer');
            
            if (data.encerrado) {
                formSection.classList.add('hidden');
                closedMessage.classList.remove('hidden');
            } else {
                formSection.classList.remove('hidden');
                closedMessage.classList.add('hidden');
                
                // Define as ações baseadas na etapa atual
                renderAcoes(data.etapaAtual, acoesContainer);
            }
            
            // Preenche histórico
            renderHistorico(data.history);
            
            // Preenche dados da GeoVictoria (já carregados na view)
            fillGeoVictoria(data.faltas, data.atestados);
            
            // Abre o modal
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    });

    // Função para preencher dados da GeoVictoria
    function fillGeoVictoria(faltas, atestados) {
        const loading = document.getElementById('geoLoading');
        const dataDiv = document.getElementById('geoData');
        const errorDiv = document.getElementById('geoError');
        const faltasSpan = document.getElementById('geoFaltas');
        const atestadosSpan = document.getElementById('geoAtestados');

        loading.classList.add('hidden');
        errorDiv.classList.add('hidden');
        
        faltasSpan.textContent = faltas;
        atestadosSpan.textContent = atestados;
        
        dataDiv.classList.remove('hidden');
    }

    // Função para renderizar as opções de rádio conforme a etapa
    function renderAcoes(etapa, container) {
        let acoesHtml = '';
        if (etapa === 1) {
            acoesHtml = `
                <label class="action-option" data-value="prorrogado">
                    <input type="radio" name="acao" value="prorrogado" required>
                    <div class="option-content">
                        <i class="fa-solid fa-clock-rotate-left"></i>
                        <span>Prorrogar</span>
                    </div>
                </label>
                <label class="action-option" data-value="termino">
                    <input type="radio" name="acao" value="termino" required>
                    <div class="option-content">
                        <i class="fa-solid fa-user-xmark"></i>
                        <span>Dar Término</span>
                    </div>
                </label>
            `;
        } else {
            acoesHtml = `
                <label class="action-option" data-value="manter">
                    <input type="radio" name="acao" value="manter" required>
                    <div class="option-content">
                        <i class="fa-solid fa-user-check"></i>
                        <span>Manter (Efetivar)</span>
                    </div>
                </label>
                <label class="action-option" data-value="termino">
                    <input type="radio" name="acao" value="termino" required>
                    <div class="option-content">
                        <i class="fa-solid fa-user-xmark"></i>
                        <span>Dar Término</span>
                    </div>
                </label>
            `;
        }
        
        container.innerHTML = acoesHtml;

        // Adiciona evento de mudança para estilizar o selecionado
        const options = container.querySelectorAll('.action-option');
        options.forEach(opt => {
            const radio = opt.querySelector('input');
            radio.addEventListener('change', () => {
                options.forEach(o => o.classList.remove('selected'));
                if (radio.checked) opt.classList.add('selected');
            });
        });
    }

    // Função para renderizar o histórico
    function renderHistorico(history) {
        const histContainer = document.getElementById('historicoContainer');
        if (!history || history.length === 0) {
            histContainer.innerHTML = '<div class="text-sm text-slate-500 italic">Nenhum registro de acompanhamento ainda.</div>';
        } else {
            histContainer.innerHTML = history.map(h => `
                <div class="history-item">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-xs font-bold uppercase tracking-wider text-slate-900">${h.etapa}º Término</span>
                        <span class="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">${h.acao}</span>
                    </div>
                    <p class="text-sm text-slate-700 italic">"${h.obs}"</p>
                    <p class="text-[10px] text-slate-400 mt-1">${h.data} • Por ${h.por}</p>
                </div>
            `).join('');
        }
    }

    // Função global para fechar o modal
    window.closeModal = function() {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        
        // Limpa o formulário ao fechar
        const form = modal.querySelector('form');
        if (form) form.reset();
    };

    // Fechar ao clicar fora do container
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Atalho tecla ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeModal();
    });
});
