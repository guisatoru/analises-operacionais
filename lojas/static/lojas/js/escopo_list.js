document.addEventListener("DOMContentLoaded", function () {

    const filterForm =
        document.querySelector(".escopo-filter-form");

    const searchInput =
        document.getElementById("id-busca-loja");

    if (!filterForm || !searchInput) {
        return;
    }

    let typingTimer = null;

    searchInput.addEventListener("input", function () {

        clearTimeout(typingTimer);

        typingTimer = setTimeout(function () {

            if (searchInput.value.trim().length === 0) {
                filterForm.submit();
                return;
            }

            if (searchInput.value.trim().length >= 2) {
                filterForm.submit();
            }

        }, 1200);

    });

});