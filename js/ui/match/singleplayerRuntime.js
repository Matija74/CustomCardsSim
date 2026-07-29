import { initializeLocalMatch } from "./matchController.js";

initializeLocalMatch().catch(error => {
    console.error("Failed to initialize the game:", error);
    const log = document.getElementById("gameLogMessages");
    if (log) log.textContent = error.message;
});
