(function () {
    const addButton = document.getElementById("add-item-btn");
    const itemsContainer = document.getElementById("itens-escopo");
    const totalFormsInput = document.getElementById("id_itens-TOTAL_FORMS");
    const itemTemplate = document.getElementById("item-escopo-template");

    if (!addButton || !itemsContainer || !totalFormsInput || !itemTemplate) {
        return;
    }

    addButton.addEventListener("click", function () {
        const currentIndex = Number(totalFormsInput.value);

        // Usamos __prefix__ porque o Django usa esse marcador no formulário vazio do formset.
        const newItemHtml = itemTemplate.innerHTML.replace(/__prefix__/g, currentIndex);

        itemsContainer.insertAdjacentHTML("beforeend", newItemHtml);
        totalFormsInput.value = currentIndex + 1;
    });
})();