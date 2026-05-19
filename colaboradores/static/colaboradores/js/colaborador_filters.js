document.addEventListener("DOMContentLoaded", function () {
    const inputBusca = document.getElementById("filtro-loja-busca");
    const selectLoja = document.getElementById("loja");
    const listContainer = document.getElementById("loja-sugestoes");
  
    if (inputBusca && selectLoja && listContainer) {
      // Sincroniza o valor inicial se houver
      if (selectLoja.selectedIndex > 0) {
        inputBusca.value = selectLoja.options[selectLoja.selectedIndex].text;
      }
  
      // Função para remover acentos e deixar em minúsculo
      function normalizar(texto) {
        return (texto || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
      }
  
      function renderizarLista(termo) {
        listContainer.innerHTML = "";
        const termNormalizado = normalizar(termo);
        let achou = false;
  
        for (let i = 1; i < selectLoja.options.length; i++) {
          const option = selectLoja.options[i];
          const texto = option.text;
          const textoNormalizado = normalizar(texto);
  
          if (textoNormalizado.includes(termNormalizado)) {
            achou = true;
            const item = document.createElement("div");
            item.classList.add("autocomplete-item");
            item.textContent = texto;
  
            item.addEventListener("click", function () {
              inputBusca.value = texto;
              selectLoja.value = option.value;
              listContainer.style.display = "none";
            });
  
            listContainer.appendChild(item);
          }
        }
  
        if (!achou && termo !== "") {
          const semResultado = document.createElement("div");
          semResultado.classList.add("autocomplete-item");
          semResultado.style.color = "#64748b";
          semResultado.style.pointerEvents = "none";
          semResultado.textContent = "Nenhuma loja encontrada...";
          listContainer.appendChild(semResultado);
        }
      }
  
      inputBusca.addEventListener("focus", function () {
        listContainer.style.display = "block";
        renderizarLista(inputBusca.value);
      });
  
      inputBusca.addEventListener("input", function (e) {
        renderizarLista(e.target.value);
        if (e.target.value.trim() === "") {
          selectLoja.value = "";
        }
      });
  
      document.addEventListener("click", function (e) {
        if (!inputBusca.contains(e.target) && !listContainer.contains(e.target)) {
          listContainer.style.display = "none";
        }
      });
    }
  });
  