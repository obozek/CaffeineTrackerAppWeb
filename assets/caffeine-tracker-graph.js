// Shared SVG rendering for the standalone tracker and the watch companion.
(function (env) {
    "use strict";
    const core = env.CaffeineTrackerCore;

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function localHourSec(dayStartSec, hour) {
        const start = new Date(dayStartSec * 1000);
        return Math.floor(new Date(start.getFullYear(), start.getMonth(), start.getDate(), hour).getTime() / 1000);
    }

    function renderGraph(graph, options) {
        const width = options.compact ? 420 : 720;
        const height = options.compact ? 254 : 330;
        const plot = { left: 38, right: 14, top: 16, bottom: 30 };
        const plotWidth = width - plot.left - plot.right;
        const plotHeight = height - plot.top - plot.bottom;
        const startSec = options.startSec;
        const endSec = options.endSec;
        const nowSec = options.nowSec;
        const locale = options.locale;
        const dict = options.dict;
        const duration = Math.max(endSec - startSec, 1);

        function xFor(timeSec) {
            return plot.left + ((timeSec - startSec) / duration) * plotWidth;
        }

        function yFor(level) {
            const clamped = Math.max(0, Math.min(level, graph.maxLevel));
            return plot.top + ((graph.maxLevel - clamped) / graph.maxLevel) * plotHeight;
        }

        function pathFor(points) {
            if (!points.length) return "";
            return points.map(function (point, index) {
                const command = index === 0 ? "M" : "L";
                return `${command}${xFor(point.time).toFixed(2)} ${yFor(point.level).toFixed(2)}`;
            }).join(" ");
        }

        const solidPoints = graph.points.filter(function (point) { return point.time <= nowSec; });
        const futurePoints = graph.points.filter(function (point) { return point.time >= nowSec; });
        if (solidPoints.length && futurePoints.length && futurePoints[0] !== solidPoints[solidPoints.length - 1]) {
            futurePoints.unshift(solidPoints[solidPoints.length - 1]);
        }

        const grid = [];
        const labels = [];

        for (let hour = 0; hour <= 24; hour += 2) {
            const time = options.formatTime ? startSec + duration * hour / 24 : localHourSec(startSec, hour);
            const x = xFor(time);
            grid.push(`<line class="ct-graph-grid" x1="${x.toFixed(2)}" y1="${plot.top}" x2="${x.toFixed(2)}" y2="${height - plot.bottom}"></line>`);

            if (hour < 24 && hour % 4 === 0) {
                const label = options.formatTime ? options.formatTime(time) : core.formatTime(time, locale);
                labels.push(`<text class="ct-graph-label" x="${x.toFixed(2)}" y="${height - 8}" text-anchor="middle">${escapeHtml(label)}</text>`);
            }
        }

        const thresholdLabelPositions = [];
        const thresholds = [
            { value: graph.thresholds.sleep, label: dict.thresholdStimulated, className: "ct-threshold-stimulated" },
            { value: graph.thresholds.optimal, label: dict.thresholdHigh, className: "ct-threshold-high" },
            { value: graph.thresholds.max, label: dict.thresholdMax, className: "ct-threshold-max" },
            ...(options.formatTime ? [{ value: graph.thresholds.belowAt, label: "Your threshold", className: "ct-threshold-personal" }] : []),
        ].filter(threshold => !options.formatTime || (threshold.value > 0 && threshold.value < graph.maxLevel &&
            (threshold.className !== "ct-threshold-personal" || ![graph.thresholds.sleep, graph.thresholds.optimal, graph.thresholds.max].includes(threshold.value))))
            .map(function (threshold) {
            const y = yFor(threshold.value);
            const showLabel = !options.formatTime ||
                (y - plot.top >= 10 && thresholdLabelPositions.every(position => Math.abs(position - y) >= 16));
            if (showLabel) thresholdLabelPositions.push(y);
            return [
                `<line class="${threshold.className}" x1="${plot.left}" y1="${y.toFixed(2)}" x2="${width - plot.right}" y2="${y.toFixed(2)}"></line>`,
                showLabel ? `<text class="ct-threshold-label ${threshold.className}" x="${plot.left + 4}" y="${(y - 4).toFixed(2)}">${escapeHtml(threshold.label)}</text>` : "",
            ].join("");
        }).join("");

        const nowX = xFor(nowSec);
        const nowLine = nowSec >= startSec && nowSec <= endSec
            ? `<line class="ct-now-line" x1="${nowX.toFixed(2)}" y1="${plot.top}" x2="${nowX.toFixed(2)}" y2="${height - plot.bottom}"></line>`
            : "";

        const markers = (graph.markers || []).map(event =>
            `<circle class="ct-dose-marker${event.time > nowSec ? " ct-dose-future" : ""}" cx="${xFor(event.time).toFixed(2)}" cy="${height - plot.bottom}" r="4"><title>${escapeHtml(options.formatTime(event.time))} · ${event.mg} mg</title></circle>`).join("");
        const cursor = options.formatTime
            ? `<line class="ct-graph-cursor" data-plot-start="${plot.left}" data-plot-width="${plotWidth}" x1="${plot.left}" x2="${plot.left}" y1="${plot.top}" y2="${height - plot.bottom}"></line>`
            : "";
        const units = options.formatTime ? `<text class="ct-graph-label" x="${plot.left + 4}" y="${plot.top - 3}">${graph.maxLevel.toLocaleString(undefined, { maximumFractionDigits: 2 })} mg/L</text>` : "";

        return `
            <svg class="ct-graph" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(options.ariaLabel)}" preserveAspectRatio="none">
                <rect class="ct-graph-bg" x="0" y="0" width="${width}" height="${height}" rx="8"></rect>
                ${grid.join("")}
                ${thresholds}
                <line class="ct-graph-axis" x1="${plot.left}" y1="${height - plot.bottom}" x2="${width - plot.right}" y2="${height - plot.bottom}"></line>
                <path class="ct-caffeine-curve" d="${pathFor(solidPoints)}"></path>
                <path class="ct-caffeine-curve ct-caffeine-curve-future" d="${pathFor(futurePoints)}"></path>
                ${nowLine}
                ${markers}
                ${cursor}
                ${units}
                ${labels.join("")}
            </svg>
        `;
    }

    env.CaffeineTrackerGraph = Object.freeze({ renderGraph, escapeHtml });
})(typeof window !== "undefined" ? window : globalThis);
