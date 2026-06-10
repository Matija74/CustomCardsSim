(function () {
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
