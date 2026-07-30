document.addEventListener("DOMContentLoaded", () => {
    const changeLines = [...document.querySelectorAll(".patch-note-entry p")];
    const filterButtons = [...document.querySelectorAll("[data-patch-filter]")];

    changeLines.forEach(line => {
        const match = line.textContent.trim().match(/^\[(UPDATE|FIX|ADDITION|DEV NOTE)\]:\s*/i);
        if (!match) return;

        const type = match[1].toLowerCase().replace(" ", "-");
        line.dataset.patchType = type;
        line.classList.add("patch-change", `patch-change-${type}`);

        const label = document.createElement("span");
        label.className = "patch-change-label";
        label.textContent = match[1];

        line.textContent = line.textContent.replace(match[0], "");
        line.prepend(label);
    });

    document.querySelectorAll(".patch-note-entry").forEach((entry, index) => {
        const heading = entry.querySelector("h2");
        if (!heading) return;

        heading.tabIndex = 0;
        heading.setAttribute("role", "button");
        heading.setAttribute("aria-expanded", index < 3 ? "true" : "false");

        if (index >= 3) {
            entry.classList.add("patch-entry-collapsed");
        }

        const toggleEntry = () => {
            const collapsed = entry.classList.toggle("patch-entry-collapsed");
            heading.setAttribute("aria-expanded", String(!collapsed));
        };

        heading.addEventListener("click", toggleEntry);
        heading.addEventListener("keydown", event => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            toggleEntry();
        });
    });

    filterButtons.forEach(button => {
        button.addEventListener("click", () => {
            const selectedFilter = button.dataset.patchFilter;

            filterButtons.forEach(filterButton => {
                filterButton.classList.toggle("active", filterButton === button);
            });

            changeLines.forEach(line => {
                const type = line.dataset.patchType;
                const visible = selectedFilter === "all" || type === selectedFilter || !type;
                line.classList.toggle("patch-change-hidden", !visible);
            });

            document.querySelectorAll(".patch-note-entry").forEach(entry => {
                const visibleChanges = entry.querySelectorAll(
                    ".patch-change:not(.patch-change-hidden)"
                );
                entry.classList.toggle("patch-entry-empty", visibleChanges.length === 0);
            });
        });
    });
});
