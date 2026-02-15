document.addEventListener("DOMContentLoaded", () => {
    const tableRows = document.querySelectorAll("#result_list tbody tr");
    if (tableRows.length > 0) {
        tableRows.forEach((row, idx) => {
            row.style.transition = "transform 120ms ease, background-color 120ms ease";
            row.addEventListener("mouseenter", () => {
                row.style.transform = "translateX(2px)";
                row.style.backgroundColor = "rgba(77, 194, 255, 0.06)";
            });
            row.addEventListener("mouseleave", () => {
                row.style.transform = "none";
                row.style.backgroundColor = "";
            });
            if (idx % 2 === 0) {
                row.style.backgroundClip = "padding-box";
            }
        });
    }
});
