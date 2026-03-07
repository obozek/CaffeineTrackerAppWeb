(function () {
    var STORAGE_KEY = "theme";

    function getStored() {
        try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
    }

    function apply(theme) {
        if (theme === "light" || theme === "dark") {
            document.documentElement.setAttribute("data-theme", theme);
        } else {
            document.documentElement.removeAttribute("data-theme");
        }
    }

    function updateButtons(theme) {
        var btns = document.querySelectorAll(".theme-toggle button");
        btns.forEach(function (btn) {
            btn.classList.toggle("active", btn.getAttribute("data-theme") === (theme || "auto"));
        });
    }

    function setTheme(theme) {
        if (theme === "auto") {
            try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
            apply(null);
        } else {
            try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) {}
            apply(theme);
        }
        updateButtons(theme);
    }

    // Apply stored theme immediately
    var stored = getStored();
    if (stored) apply(stored);

    // Build toggle widget
    document.addEventListener("DOMContentLoaded", function () {
        var wrap = document.createElement("div");
        wrap.className = "theme-toggle";
        wrap.setAttribute("aria-label", "Theme switcher");

        ["auto", "light", "dark"].forEach(function (t) {
            var btn = document.createElement("button");
            btn.type = "button";
            btn.setAttribute("data-theme", t);
            btn.textContent = t === "auto" ? "Auto" : t === "light" ? "☀️" : "🌙";
            btn.title = t.charAt(0).toUpperCase() + t.slice(1) + " theme";
            btn.addEventListener("click", function () { setTheme(t); });
            wrap.appendChild(btn);
        });

        document.body.appendChild(wrap);
        updateButtons(stored || "auto");
    });
})();
