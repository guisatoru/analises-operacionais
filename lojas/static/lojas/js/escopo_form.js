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
        const newItem = itemsContainer.lastElementChild;

        if (newItem) {
            // O django-select2 escuta esse evento para ativar campos criados pelo formset.
            newItem.dispatchEvent(new Event("formset:added", { bubbles: true }));
        }

        configureRemoveButtons();
        totalFormsInput.value = currentIndex + 1;
    });
})();

function configureRemoveButtons() {
    const removeButtons = document.querySelectorAll(".remove-item-button");

    removeButtons.forEach(function (button) {
        button.addEventListener("click", function () {
            const card = button.closest(".escopo-item-card");

            if (card) {
                card.remove();
            }
        });
    });
}

configureRemoveButtons();
