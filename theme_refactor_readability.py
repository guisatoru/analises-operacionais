import os

def refactor_page(filepath, is_colab=False, is_lojas=False, is_terminos=False):
    print(f"Refatorando legibilidade e UX em: {filepath}")
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Melhora de contraste para labels de filtro (de text-neutral-400/gray para text-neutral-600)
    content = content.replace("text-neutral-400 uppercase tracking-wider mb-1.5", "text-neutral-600 uppercase tracking-wider mb-1.5")
    content = content.replace("text-neutral-450 uppercase tracking-wider mb-1.5", "text-neutral-600 uppercase tracking-wider mb-1.5")
    content = content.replace("text-neutral-400 uppercase mb-1.5", "text-neutral-600 uppercase mb-1.5")
    content = content.replace("text-neutral-400 uppercase tracking-wider mb-1", "text-neutral-600 uppercase tracking-wider mb-1")
    content = content.replace("text-neutral-400 uppercase mb-1", "text-neutral-600 uppercase mb-1")
    content = content.replace("text-xs font-semibold text-neutral-400 uppercase tracking-wider mr-1", "text-xs font-bold text-neutral-600 uppercase tracking-wider mr-1")

    # 2. Melhora de contraste para cabeçalhos de tabelas (de text-neutral-400/gray para text-neutral-700/bold)
    content = content.replace(
        'bg-neutral-50 dark:bg-neutral-850 text-xs font-semibold text-neutral-400 uppercase tracking-wider',
        'bg-neutral-100 text-xs font-bold text-neutral-700 uppercase tracking-wider'
    )
    content = content.replace(
        'font-mono text-neutral-400',
        'font-mono text-neutral-600'
    )
    content = content.replace(
        'text-[10px] text-neutral-400 font-mono',
        'text-[10px] text-neutral-600 font-mono'
    )

    # 3. Melhora de contraste nas descrições e labels das células de colaboradores
    content = content.replace(
        '<span className="font-medium text-neutral-400">TOTVS:</span>',
        '<span className="font-semibold text-neutral-500">TOTVS:</span>'
    )
    content = content.replace(
        '<span className="font-medium text-neutral-400">Gestão:</span>',
        '<span className="font-semibold text-neutral-500">Gestão:</span>'
    )
    content = content.replace(
        '<span className="font-medium text-neutral-400">Geo:</span>',
        '<span className="font-semibold text-neutral-500">Geo:</span>'
    )
    content = content.replace(
        '<span className="text-neutral-400">Gestão:</span>',
        '<span className="font-semibold text-neutral-500">Gestão:</span>'
    )
    
    # Substituir detalhes cinza claro por cinza escuro
    content = content.replace("text-neutral-600 dark:text-neutral-400", "text-neutral-700")

    # 4. UX Reativa: Recarrega a busca instantaneamente quando o usuário altera filtros de seleção (dropdowns)
    if is_colab:
        # Adiciona lojaFiltro e statusFiltro como dependências do useEffect
        old_effect = """  useEffect(() => {
    fetchColaboradores();
  }, [currentPage, activeTab, statusDivergenteQuery, funcaoDivergenteQuery, divergenteQuery, soTotvsQuery]);"""
        new_effect = """  // Efeito reativo: recarrega a busca com página 1 se mudar filtros de abas ou dropdowns
  useEffect(() => {
    fetchColaboradores(true);
  }, [activeTab, statusDivergenteQuery, funcaoDivergenteQuery, divergenteQuery, soTotvsQuery, lojaFiltro, statusFiltro]);

  // Recarrega se mudar a página corrente
  useEffect(() => {
    fetchColaboradores();
  }, [currentPage]);"""
        content = content.replace(old_effect, new_effect)

    if is_lojas:
        # Adiciona statusFiltro no recarregamento automático
        old_effect = """  useEffect(() => {
    fetchLojas();
  }, [currentPage]);"""
        new_effect = """  // Efeito reativo: recarrega as lojas se mudar a página ou o filtro de status
  useEffect(() => {
    fetchLojas(true);
  }, [statusFiltro]);

  useEffect(() => {
    fetchLojas();
  }, [currentPage]);"""
        content = content.replace(old_effect, new_effect)

    if is_terminos:
        # Adiciona statusGestao e ordenacao ao recarregamento automático
        old_effect = """  useEffect(() => {
    fetchTerminos();
  }, [currentPage, ordenacao]);"""
        new_effect = """  // Efeito reativo: recarrega os prazos se mudar filtros dropdowns, ordenação ou coordenador
  useEffect(() => {
    fetchTerminos(true);
  }, [ordenacao, statusGestao, coordenador]);

  useEffect(() => {
    fetchTerminos();
  }, [currentPage]);"""
        content = content.replace(old_effect, new_effect)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

pages_dir = r"c:\Users\guilherme.satoru\Desktop\analises-operacionais\frontend\src\pages"

refactor_page(os.path.join(pages_dir, "Colaboradores.tsx"), is_colab=True)
refactor_page(os.path.join(pages_dir, "Lojas.tsx"), is_lojas=True)
refactor_page(os.path.join(pages_dir, "Terminos.tsx"), is_terminos=True)

print("Refatoração de legibilidade e UX concluída com sucesso!")
