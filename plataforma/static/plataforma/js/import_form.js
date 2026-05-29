/**
 * Lógica da página de importação (Colaboradores e Folha)
 */

document.addEventListener('DOMContentLoaded', () => {
    const importForm = document.querySelector('form[enctype="multipart/form-data"]');
    
    if (importForm) {
        // Busca qualquer um dos IDs conhecidos ou o botão do tipo submit dentro do form
        const submitBtn = document.getElementById('btn-importar') || 
                          document.getElementById('btn-importar-folha') ||
                          importForm.querySelector('button[type="submit"]');
        
        if (submitBtn) {
            importForm.addEventListener('submit', () => {
                if (!submitBtn.disabled) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando...';
                }
            });
        }
    }
});
