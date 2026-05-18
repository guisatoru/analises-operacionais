document.addEventListener("DOMContentLoaded", function () {
    const filterForm = document.querySelector(".filter-form");
    const searchInput = document.getElementById("id-busca");

    if (!filterForm || !searchInput) {
        return;
    }

    let typingTimer = null;

    searchInput.addEventListener("input", function () {
        clearTimeout(typingTimer);

        typingTimer = setTimeout(function () {
            filterForm.submit();
        }, 500);
    });
});