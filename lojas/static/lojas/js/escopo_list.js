document.addEventListener("DOMContentLoaded", function () {
    // --- Lógica de Filtro (Mantida) ---
    const filterForm = document.querySelector(".escopo-filter-form");
    const searchInput = document.getElementById("id-busca-loja");
    if (filterForm && searchInput) {
        let typingTimer = null;
        searchInput.addEventListener("input", function () {
            clearTimeout(typingTimer);
            typingTimer = setTimeout(function () {
                if (searchInput.value.trim().length === 0 || searchInput.value.trim().length >= 2) {
                    filterForm.submit();
                }
            }, 1200);
        });
    }

    // --- Lógica de Edição Inline ---
    const cargos = JSON.parse(document.getElementById('cargos-data').textContent);
    const turnos = JSON.parse(document.getElementById('turnos-data').textContent);

    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
    const csrftoken = getCookie('csrftoken');

    document.addEventListener('dblclick', function (e) {
        const cell = e.target.closest('.editable');
        if (!cell || cell.querySelector('input') || cell.querySelector('select')) return;

        const field = cell.dataset.field;
        const value = cell.dataset.value;
        const itemId = cell.closest('tr').dataset.itemId;
        const escopoId = cell.closest('.escopo-card').dataset.escopoId;

        let input;
        if (field === 'cargo') {
            input = document.createElement('select');
            cargos.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.nome;
                if (c.id == value) opt.selected = true;
                input.appendChild(opt);
            });
        } else if (field === 'turno') {
            input = document.createElement('select');
            turnos.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.id;
                opt.textContent = t.nome;
                if (t.id == value) opt.selected = true;
                input.appendChild(opt);
            });
        } else {
            input = document.createElement('input');
            input.type = 'number';
            input.value = value;
            input.style.width = '60px';
        }

        const originalContent = cell.innerHTML;
        cell.innerHTML = '';
        cell.appendChild(input);
        input.focus();

        function save() {
            const newValue = input.value;
            if (newValue == value && itemId) {
                cell.innerHTML = originalContent;
                return;
            }

            const data = { id: itemId, escopo_id: escopoId };
            data[field === 'cargo' ? 'cargo_id' : field] = newValue;

            fetch('/escopos/api/item/save/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
                body: JSON.stringify(data)
            })
            .then(res => res.json())
            .then(res => {
                if (res.success) {
                    const tr = cell.closest('tr');
                    tr.dataset.itemId = res.id;
                    cell.dataset.value = newValue;
                    
                    if (field === 'cargo') cell.textContent = res.cargo_nome;
                    else if (field === 'turno') cell.textContent = res.turno_display;
                    else cell.textContent = newValue;

                    // Função auxiliar para formatar moeda
                    function formatarMoeda(valor) {
                        return parseFloat(valor).toFixed(2).replace('.', ',');
                    }

                    // Atualizar valores de cálculo
                    tr.querySelector('.val-base').textContent = 'R$ ' + formatarMoeda(res.detalhes.base_total);
                    tr.querySelector('.val-fixa').textContent = 'R$ ' + formatarMoeda(res.detalhes.insal_fixa);
                    tr.querySelector('.val-ban').textContent = 'R$ ' + formatarMoeda(res.detalhes.insal_ban);
                    tr.querySelector('.val-adic').textContent = 'R$ ' + formatarMoeda(res.detalhes.adic_not);
                    tr.querySelector('.val-total').innerHTML = '<strong>R$ ' + formatarMoeda(res.detalhes.total) + '</strong>';
                    
                    // Atualizar total do card
                    tr.closest('.escopo-card').querySelector('.escopo-total-val').textContent = 'R$ ' + formatarMoeda(res.total_escopo);
                } else {
                    alert('Erro ao salvar: ' + res.error);
                    cell.innerHTML = originalContent;
                }
            });
        }

        input.onblur = save;
        input.onkeydown = (e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cell.innerHTML = originalContent; };
    });

    // Botão Adicionar Item
    document.addEventListener('click', function (e) {
        const btnAdd = e.target.closest('.btn-add-item');
        if (btnAdd) {
            const card = btnAdd.closest('.escopo-card');
            const tbody = card.querySelector('.items-tbody');
            const emptyRow = tbody.querySelector('.empty-row');
            if (emptyRow) emptyRow.remove();

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="editable" data-field="cargo" data-value="">(Duplo clique)</td>
                <td class="editable" data-field="turno" data-value="DIURNO">Diurno</td>
                <td class="editable" data-field="quantidade" data-value="1">1</td>
                <td class="val-base">-</td>
                <td class="val-fixa">-</td>
                <td class="val-ban">-</td>
                <td class="val-adic">-</td>
                <td class="val-total"><strong>-</strong></td>
                <td class="actions-cell">
                    <button class="btn-delete-item" title="Remover item"><i class="fa-solid fa-xmark"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        }

        const btnDel = e.target.closest('.btn-delete-item');
        if (btnDel) {
            const tr = btnDel.closest('tr');
            const itemId = tr.dataset.itemId;
            if (!itemId) {
                tr.remove();
                return;
            }

            if (!confirm('Excluir este item do escopo?')) return;

            fetch(`/escopos/api/item/${itemId}/delete/`, {
                method: 'POST',
                headers: { 'X-CSRFToken': csrftoken }
            })
            .then(res => res.json())
            .then(res => {
                if (res.success) {
                    const card = tr.closest('.escopo-card');
                    tr.remove();
                    card.querySelector('.escopo-total-val').textContent = 'R$ ' + res.total_escopo;
                }
            });
        }
    });
});
