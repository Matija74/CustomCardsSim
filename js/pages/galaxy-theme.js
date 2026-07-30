(function () {
    const defaults = {
        layoutDensity: "comfortable",
        fontStyle: "modern",
        colorTheme: "obsidian",
        accentColor: "#44d7b6",
        cardScale: 100,
        motionEnabled: true
    };
    const appearanceKeys = [
        "layoutDensity",
        "fontStyle",
        "colorTheme",
        "accentColor",
        "cardScale",
        "motionEnabled"
    ];
    const interfaceQueryKey = "ccsui";
    let currentPreferences = { ...defaults };

    function pickAppearancePreferences(settings) {
        return appearanceKeys.reduce((result, key) => {
            result[key] = settings[key];
            return result;
        }, {});
    }

    function encodeInterfacePreferences(settings) {
        try {
            return btoa(JSON.stringify(pickAppearancePreferences(settings)))
                .replace(/\+/g, "-")
                .replace(/\//g, "_")
                .replace(/=+$/g, "");
        } catch {
            return "";
        }
    }

    function decodeInterfacePreferences(value) {
        if (!value) {
            return {};
        }

        try {
            const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
            const padding = "=".repeat((4 - normalized.length % 4) % 4);
            return JSON.parse(atob(normalized + padding));
        } catch {
            return {};
        }
    }

    function getUrlInterfacePreferences() {
        return decodeInterfacePreferences(
            new URLSearchParams(window.location.search).get(interfaceQueryKey)
        );
    }

    function persistInterfacePreferences(settings) {
        try {
            const existing = JSON.parse(localStorage.getItem("gameSettings") || "{}");
            localStorage.setItem("gameSettings", JSON.stringify({
                ...existing,
                ...pickAppearancePreferences(settings)
            }));
        } catch {
            // File URLs can expose limited storage. Link propagation still works.
        }
    }

    function addInterfacePreferencesToUrl(value) {
        const url = new URL(value, window.location.href);
        const token = encodeInterfacePreferences(currentPreferences);

        if (token && /(?:^|\/)(?:index|[^/]+)\.html$/i.test(url.pathname)) {
            url.searchParams.set(interfaceQueryKey, token);
        }

        return url;
    }

    function syncInterfaceLinks() {
        document.querySelectorAll("a[href]").forEach((link) => {
            const rawHref = link.getAttribute("href");
            if (!rawHref || rawHref.startsWith("#") || /^(?:mailto:|tel:|javascript:)/i.test(rawHref)) {
                return;
            }

            const url = addInterfacePreferencesToUrl(rawHref);
            if (url.origin === window.location.origin || window.location.protocol === "file:") {
                link.href = url.href;
            }
        });
    }

    function normalizeHexColor(value) {
        const match = String(value || "").trim().match(/^#([0-9a-f]{6})$/i);
        return match ? `#${match[1].toLowerCase()}` : defaults.accentColor;
    }

    function getRgb(hexColor) {
        const hex = normalizeHexColor(hexColor).slice(1);
        return {
            red: parseInt(hex.slice(0, 2), 16),
            green: parseInt(hex.slice(2, 4), 16),
            blue: parseInt(hex.slice(4, 6), 16)
        };
    }

    function getRelativeLuminance(hexColor) {
        const { red, green, blue } = getRgb(hexColor);
        const channels = [red, green, blue].map((channel) => {
            const normalized = channel / 255;
            return normalized <= 0.03928
                ? normalized / 12.92
                : Math.pow((normalized + 0.055) / 1.055, 2.4);
        });
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    }

    function mixHexColor(hexColor, target, amount) {
        const source = getRgb(hexColor);
        const mixed = ["red", "green", "blue"].map((key) => {
            return Math.round(source[key] + (target - source[key]) * amount);
        });
        return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
    }

    function applyInterfacePreferences(settings, options = {}) {
        const preferences = { ...defaults, ...(settings || {}) };
        const root = document.documentElement;
        const accentColor = normalizeHexColor(preferences.accentColor);
        const isLightAccent = getRelativeLuminance(accentColor) > 0.48;
        const accentSecondary = mixHexColor(accentColor, isLightAccent ? 0 : 255, isLightAccent ? 0.12 : 0.18);
        root.dataset.density = preferences.layoutDensity;
        root.dataset.font = preferences.fontStyle;
        root.dataset.theme = preferences.colorTheme;
        root.dataset.motion = preferences.motionEnabled ? "on" : "off";
        root.style.setProperty("--user-accent", accentColor);
        root.style.setProperty("--user-accent-2", accentSecondary);
        root.style.setProperty("--accent-contrast", isLightAccent ? "#091018" : "#ffffff");
        root.style.setProperty("--accent-icon-filter", isLightAccent ? "brightness(0) saturate(100%)" : "none");
        root.style.setProperty("--user-card-scale", String(preferences.cardScale / 100));
        if (options.persist !== false) {
            currentPreferences = preferences;
            persistInterfacePreferences(preferences);

            if (document.body) {
                syncInterfaceLinks();
            }
        }
    }

    window.applyInterfacePreferences = applyInterfacePreferences;
    window.previewInterfacePreferences = function (settings) {
        applyInterfacePreferences(settings, { persist: false });
    };
    window.addInterfacePreferencesToUrl = function (value) {
        return addInterfacePreferencesToUrl(value).href;
    };
    try {
        applyInterfacePreferences({
            ...getUrlInterfacePreferences(),
            ...JSON.parse(localStorage.getItem("gameSettings") || "{}")
        });
    } catch {
        applyInterfacePreferences({
            ...defaults,
            ...getUrlInterfacePreferences()
        });
    }

    document.addEventListener("DOMContentLoaded", syncInterfaceLinks);
    document.addEventListener("click", function (event) {
        const link = event.target.closest?.("a[href]");
        if (link) {
            syncInterfaceLinks();
        }
    }, true);

    window.addEventListener("storage", function (event) {
        if (event.key !== "gameSettings") {
            return;
        }

        try {
            applyInterfacePreferences(JSON.parse(event.newValue || "{}"));
        } catch {
            applyInterfacePreferences(defaults);
        }
    });

    function scheduleThemeInit(callback) {
        function runWhenIdle() {
            if (typeof window.requestIdleCallback === "function") {
                window.requestIdleCallback(callback, { timeout: 1200 });
            } else {
                window.setTimeout(callback, 120);
            }
        }

        if (document.readyState === "complete") {
            runWhenIdle();
            return;
        }

        window.addEventListener("load", runWhenIdle, { once: true });
    }

    function initGalaxyTheme() {
        if (!document.body || document.getElementById("galaxyStars")) {
            return;
        }

        const isDensePage = Boolean(
            document.querySelector(".singleplayer-page, .multiplayer-page")
        );

        if (isDensePage) {
            return;
        }

        const canvas = document.createElement("canvas");
        canvas.id = "galaxyStars";
        canvas.className = "galaxy-stars";
        canvas.setAttribute("aria-hidden", "true");
        document.body.insertBefore(canvas, document.body.firstChild);

        const ctx = canvas.getContext("2d");

        if (!ctx) {
            return;
        }

        const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
        let stars = [];
        let animationFrameId = 0;
        let viewportWidth = window.innerWidth;
        let viewportHeight = window.innerHeight;

        function createStars() {
            const starCount = Math.min(
                180,
                Math.max(55, Math.floor((viewportWidth * viewportHeight) / 14000))
            );

            stars = Array.from({ length: starCount }, function () {
                return {
                    x: Math.random() * viewportWidth,
                    y: Math.random() * viewportHeight,
                    radius: Math.random() * 1.4 + 0.35,
                    alpha: Math.random() * 0.55 + 0.25,
                    drift: Math.random() * 0.12 + 0.03,
                    twinkle: Math.random() * 0.02 + 0.006,
                    phase: Math.random() * Math.PI * 2
                };
            });
        }

        function resizeCanvas() {
            const ratio = Math.min(window.devicePixelRatio || 1, 2);

            viewportWidth = window.innerWidth;
            viewportHeight = window.innerHeight;

            canvas.width = Math.floor(viewportWidth * ratio);
            canvas.height = Math.floor(viewportHeight * ratio);
            canvas.style.width = viewportWidth + "px";
            canvas.style.height = viewportHeight + "px";

            ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
            createStars();
        }

        function drawStars(time) {
            ctx.clearRect(0, 0, viewportWidth, viewportHeight);

            for (const star of stars) {
                const alphaPulse = Math.sin(time * star.twinkle + star.phase) * 0.18;
                const alpha = Math.max(0.18, Math.min(1, star.alpha + alphaPulse));

                ctx.beginPath();
                ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(255, 255, 255, " + alpha.toFixed(3) + ")";
                ctx.fill();

                if (!motionQuery.matches) {
                    star.y += star.drift;
                    star.x += star.drift * 0.06;

                    if (star.y > viewportHeight + 4) {
                        star.y = -4;
                        star.x = Math.random() * viewportWidth;
                    }

                    if (star.x > viewportWidth + 4) {
                        star.x = -4;
                    }
                }
            }

            if (!motionQuery.matches) {
                animationFrameId = window.requestAnimationFrame(drawStars);
            }
        }

        function restart() {
            window.cancelAnimationFrame(animationFrameId);
            resizeCanvas();
            drawStars(performance.now());
        }

        window.addEventListener("resize", restart);

        if (typeof motionQuery.addEventListener === "function") {
            motionQuery.addEventListener("change", restart);
        } else if (typeof motionQuery.addListener === "function") {
            motionQuery.addListener(restart);
        }

        restart();
    }

    scheduleThemeInit(initGalaxyTheme);
})();
