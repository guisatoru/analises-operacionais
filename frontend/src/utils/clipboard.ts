/**
 * Utilitário para cópia de texto para a área de transferência do usuário.
 * 
 * Por que existe: O navigator.clipboard exige HTTPS para funcionar nos navegadores modernos.
 * Para ambientes locais rodando em HTTP, essa função cria uma área de texto oculta 
 * temporária para realizar a cópia de forma compatível, centralizando a lógica
 * e evitando duplicação em múltiplos componentes.
 * 
 * @param text O texto que será copiado.
 * @returns Uma Promise que resolve para true se a cópia foi bem sucedida, ou false caso contrário.
 */
export const copyTextToClipboard = async (text: string): Promise<boolean> => {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn("Falha ao usar a API moderna de clipboard, usando fallback...", err);
    }
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    // Impede que o elemento seja visível e atrapalhe o layout
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.width = '2em';
    textarea.style.height = '2em';
    textarea.style.padding = '0';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.background = 'transparent';
    textarea.style.opacity = '0';
    
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return !!success;
  } catch (err) {
    console.error('Erro ao copiar informações via execCommand (fallback):', err);
    return false;
  }
};
