document.addEventListener("DOMContentLoaded", function () {

    const searchInput = document.getElementById("filtro-loja-busca");
    const hiddenSelect = document.getElementById("filtro-loja");
    const suggestionsBox = document.getElementById("loja-sugestoes");

    if (!searchInput || !hiddenSelect || !suggestionsBox) {
        return;
    }

    const storeOptions = Array.from(hiddenSelect.options).map(function (option) {
        return {
            value: option.value,
            text: option.text.trim(),
            selected: option.selected,
        };
    });

    const selectedOption = storeOptions.find(function (option) {
        return option.selected && option.value !== "";
    });

    if (selectedOption) {
        searchInput.value = selectedOption.text;
    }

    function clearSuggestions() {
        suggestionsBox.innerHTML = "";
        suggestionsBox.style.display = "none";
    }

    function selectStore(store) {
        searchInput.value = store.text;
        hiddenSelect.value = store.value;

        clearSuggestions();
    }

    function showSuggestions(searchText) {

        suggestionsBox.innerHTML = "";

        const normalizedSearch = searchText.trim().toLowerCase();

        if (normalizedSearch.length === 0) {
            hiddenSelect.value = "";

            clearSuggestions();

            return;
        }

        const filteredStores = storeOptions.filter(function (store) {

            return (
                store.value !== "" &&
                store.text.toLowerCase().includes(normalizedSearch)
            );

        });

        if (filteredStores.length === 0) {

            suggestionsBox.innerHTML = `
                <div class="autocomplete-empty">
                    Nenhuma loja encontrada
                </div>
            `;

            suggestionsBox.style.display = "block";

            return;
        }

        filteredStores.slice(0, 10).forEach(function (store) {

            const item = document.createElement("button");

            item.type = "button";
            item.className = "autocomplete-item";
            item.textContent = store.text;

            item.addEventListener("click", function () {
                selectStore(store);
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

});