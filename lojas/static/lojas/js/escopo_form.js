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

configureAutocomplete(
    "filtro-loja-busca",
    "id_loja",
    "loja-sugestoes"
);

function configureAutocomplete(
    inputId,
    selectId,
    suggestionsId
) {

    const searchInput = document.getElementById(inputId);
    const hiddenSelect = document.getElementById(selectId);
    const suggestionsBox = document.getElementById(suggestionsId);

    if (!searchInput || !hiddenSelect || !suggestionsBox) {
        return;
    }

    const options = Array.from(hiddenSelect.options).map(function (option) {
        return {
            value: option.value,
            text: option.text.trim(),
            selected: option.selected,
        };
    });

    const selectedOption = options.find(function (option) {
        return option.selected && option.value !== "";
    });

    if (selectedOption) {
        searchInput.value = selectedOption.text;
    }

    function clearSuggestions() {
        suggestionsBox.innerHTML = "";
        suggestionsBox.style.display = "none";
    }

    function selectOption(option) {
        searchInput.value = option.text;
        hiddenSelect.value = option.value;

        clearSuggestions();
    }

    function showSuggestions(searchText) {

        suggestionsBox.innerHTML = "";

        const normalizedSearch =
            searchText.trim().toLowerCase();

        if (normalizedSearch.length === 0) {
            clearSuggestions();
            return;
        }

        const filteredOptions = options.filter(function (option) {

            return (
                option.value !== "" &&
                option.text.toLowerCase().includes(normalizedSearch)
            );

        });

        if (filteredOptions.length === 0) {

            suggestionsBox.innerHTML = `
                <div class="autocomplete-empty">
                    Nenhum resultado encontrado
                </div>
            `;

            suggestionsBox.style.display = "block";

            return;
        }

        filteredOptions.slice(0, 10).forEach(function (option) {

            const item = document.createElement("button");

            item.type = "button";
            item.className = "autocomplete-item";
            item.textContent = option.text;

            item.addEventListener("click", function () {
                selectOption(option);
            });

            suggestionsBox.appendChild(item);

        });

        suggestionsBox.style.display = "block";
    }

    searchInput.addEventListener("input", function () {
        showSuggestions(searchInput.value);
    });

    searchInput.addEventListener("focus", function () {
        showSuggestions(searchInput.value);
    });

    document.addEventListener("click", function (event) {

        const clickedInside =
            searchInput.contains(event.target) ||
            suggestionsBox.contains(event.target);

        if (!clickedInside) {
            clearSuggestions();
        }

    });

}
