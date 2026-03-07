(function () {
    var LANGS = [
        { code: "en", label: "EN", prefix: "" },
        { code: "de", label: "DE", prefix: "de" },
        { code: "es", label: "ES", prefix: "es" },
        { code: "pl", label: "PL", prefix: "pl" },
    ];

    // Pages that have translated versions (filename only)
    var TRANSLATED_PAGES = ["/", "/index.html", "/how-it-works.html", "/halflife-wizard.html", "/404.html"];

    function detectCurrent() {
        var path = window.location.pathname;
        for (var i = 1; i < LANGS.length; i++) {
            if (path.indexOf("/" + LANGS[i].prefix + "/") === 0) return LANGS[i].code;
        }
        return "en";
    }

    function buildSwitchUrl(targetPrefix) {
        var path = window.location.pathname;
        var currentPrefix = "";
        for (var i = 1; i < LANGS.length; i++) {
            if (path.indexOf("/" + LANGS[i].prefix + "/") === 0) {
                currentPrefix = LANGS[i].prefix;
                break;
            }
        }

        var pagePath;
        if (currentPrefix) {
            pagePath = path.substring(("/" + currentPrefix).length);
        } else {
            pagePath = path;
        }

        // Fall back to homepage if page doesn't have a translation
        if (TRANSLATED_PAGES.indexOf(pagePath) === -1) {
            pagePath = "/";
        }

        if (targetPrefix) {
            return "/" + targetPrefix + pagePath;
        }
        return pagePath || "/";
    }

    document.addEventListener("DOMContentLoaded", function () {
        var current = detectCurrent();

        var wrap = document.createElement("div");
        wrap.className = "lang-switcher";
        wrap.setAttribute("aria-label", "Language switcher");

        LANGS.forEach(function (lang) {
            var el;
            if (lang.code === current) {
                el = document.createElement("span");
                el.className = "active";
            } else {
                el = document.createElement("a");
                el.href = buildSwitchUrl(lang.prefix);
            }
            el.textContent = lang.label;
            el.title = lang.code.toUpperCase();
            wrap.appendChild(el);
        });

        document.body.appendChild(wrap);
    });
})();
