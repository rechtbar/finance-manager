//========
//charts.js - spravuje grafy
//========

//vygenerovani bar grafu
function renderIncomeExpenseChart(aggregate = "month",
    dateFrom = null, dateTo = null) {
    const transactions = getTransactions().map
        (t => ({ ...t, date: new Date(t.date) }));

    const now = new Date();

    //vychozi rozsah - poslednich 6 dnu/tydnu/mesicu/let
    let startDate, endDate = dateTo ? new Date(dateTo) : now;

    if (!dateFrom) {
        startDate = new Date(endDate);
        switch (aggregate) {
            case "day": startDate.setDate(endDate.getDate() - 5); break;
            case "week": startDate.setDate(endDate.getDate() - 5 * 7); break;
            case "month": startDate.setMonth(endDate.getMonth() - 5); break;
            case "year": startDate.setFullYear(endDate.getFullYear() - 5); break;
        }
    } else {
        startDate = new Date(dateFrom);
    }

    //labels a popisky
    const labels = []; //oznaceni jednotlivich useku na ose x
    const incomeData = []; //hodnoty prijmu na ose y
    const expenseData = []; //hodnoty vydaju na ose y

    let current = new Date(startDate);

    while (current <= endDate) {
        let next;
        let label;

        //ruzne moznosti grafu
        switch (aggregate) {
            case "day":
                next = new Date(current); next.setDate(current.getDate() + 1);
                label = current.toLocaleDateString("cs-CZ");
                break;

            case "week":
                next = new Date(current); next.setDate(current.getDate() + 7);
                label = `Týden ${getWeekNumber(current)}`;
                break;

            case "month":
                next = new Date(current.getFullYear(), current.getMonth() + 1, 1);
                label = current.toLocaleString("cs-CZ", { month: "short", year: "2-digit" });
                break;

            case "year":
                next = new Date(current.getFullYear() + 1, 0, 1);
                label = current.getFullYear().toString();
                break;
        }

        labels.push(label);

        const periodTransactions = transactions.filter(t => t.date >= current && t.date < next);
        const monthIncome = periodTransactions.filter(t => t.type === "income")
            .reduce((sum, t) => sum + t.amount, 0);
        const monthExpense = periodTransactions.filter(t => t.type === "expense")
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);

        incomeData.push(monthIncome);
        expenseData.push(monthExpense);

        current = next;

    }

    const ctx = document.getElementById("income-expense-chart").getContext("2d");

    // pokud uz graf existuje, smazeme ho - abychom nevykreslovali 2 pres sebe
    if (window.incomeExpenseChart) window.incomeExpenseChart.destroy();

    //samotne vykreslovani grafu, predtim se ziskavaly data
    window.incomeExpenseChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Příjmy",
                    data: incomeData,
                    backgroundColor: "#22c55e",
                },
                {
                    label: "Výdaje",
                    data: expenseData,
                    backgroundColor: "#ef4444",
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: "top" },
                title: { display: true, text: "Příjmy a výdaje v čase" }

            },
            scales: { y: { beginAtZero: true } }
        }
    });
}

//pomocna funkce pro prevod datumu na format pro input pole
function toDateInputValue(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

//rozsahy pro predvolene obdobi
function getPresetRange(preset) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    switch (preset) {
        case "today": {
            return { from: startOfToday, to: endOfToday };
        }
        case "last7": {
            const from = new Date(startOfToday);
            from.setDate(from.getDate() - 6);
            return { from, to: endOfToday };
        }
        case "last30": {
            const from = new Date(startOfToday);
            from.setDate(from.getDate() - 29);
            return { from, to: endOfToday };
        }
        case "thisMonth": {
            const from = new Date(now.getFullYear(), now.getMonth(), 1);
            const to = endOfToday;
            return { from, to };
        }
        case "lastMonth": {
            const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
            return { from, to };
        }
        case "thisYear": {
            const from = new Date(now.getFullYear(), 0, 1);
            const to = endOfToday;
            return { from, to };
        }
        default:
            return { from: null, to: null };
    }
}

// agregace transakci podle kategorie
function aggregateByCategory(transactions, type, from, to) {
    const totals = new Map();

    // agregace transakci
    transactions.forEach((t) => {
        if (t.type !== type) return;
        if (!t.date) return;
        const dt = new Date(t.date);
        if (Number.isNaN(dt.getTime())) return;
        if (from && dt < from) return;
        if (to && dt > to) return;

        const category = t.category || "Bez kategorie";
        const amountRaw = Number(t.amount) || 0;
        const amount = type === "expense" ? Math.abs(amountRaw) : amountRaw;
        if (amount === 0) return;

        totals.set(category, (totals.get(category) || 0) + amount);
    });

    // seřadit kategorie sestupně podle částky
    const entries = Array.from(totals.entries())
        .sort((a, b) => b[1] - a[1]); // [category, total]

    const labels = entries.map(([category]) => category);
    const data = entries.map(([, total]) => total);
    return { labels, data };
}

//pomocna funkce pro formatovani ceny
function formatKc(value) {
    return `${Math.round(value)} Kč`;
}

//vykresleni nebo aktualizace kruhového grafu
function createOrUpdateDoughnutChart(storageKey, canvasId, title, labels, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    if (window[storageKey]) window[storageKey].destroy();

    const total = data.reduce((s, v) => s + v, 0);
    const colors = labels.map((_, i) => `hsl(${(i * 47) % 360} 70% 55%)`);

    window[storageKey] = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels,
            datasets: [
                {
                    data,
                    backgroundColor: colors,
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: "bottom" },
                title: { display: true, text: title },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const label = context.label || "";
                            const value = context.parsed || 0;
                            const pct = total > 0 ? (value / total) * 100 : 0;
                            return `${label}: ${formatKc(value)} (${pct.toFixed(1)} %)`;
                        }
                    }
                }
            }
        }
    });
}

//inicializace kruhového grafu pro kategorie
function initCategoryPieWidget({
    type,
    presetId,
    fromId,
    toId,
    updateId,
    emptyId,
    canvasId,
    storageKey,
    title
}) {
    const presetEl = document.getElementById(presetId);
    const fromEl = document.getElementById(fromId);
    const toEl = document.getElementById(toId);
    const updateEl = document.getElementById(updateId);
    const emptyEl = document.getElementById(emptyId);
    const canvasEl = document.getElementById(canvasId);

    if (!presetEl || !fromEl || !toEl || !updateEl || !emptyEl || !canvasEl) return;

    const render = () => {
        const preset = presetEl.value;
        let from = null;
        let to = null;

        if (preset === "custom") {
            from = fromEl.value ? new Date(fromEl.value) : null;
            to = toEl.value ? new Date(toEl.value + "T23:59:59.999") : null;
        } else {
            const range = getPresetRange(preset);
            from = range.from;
            to = range.to;
        }

        const transactions = getTransactions();
        const result = aggregateByCategory(transactions, type, from, to);

        const hasData = result.data.length > 0;
        emptyEl.classList.toggle("hidden", hasData);
        canvasEl.classList.toggle("hidden", !hasData);

        if (!hasData) {
            if (window[storageKey]) {
                window[storageKey].destroy();
                window[storageKey] = null;
            }
            return;
        }

        createOrUpdateDoughnutChart(storageKey, canvasId, title, result.labels, result.data);
    };

    const updateCustomEnabled = () => {
        const isCustom = presetEl.value === "custom";
        fromEl.disabled = !isCustom;
        toEl.disabled = !isCustom;

        // schovat/zobrazit UI pro vlastní období
        const rangeWrap = fromEl.closest(".pie-custom-range");
        if (rangeWrap) rangeWrap.classList.toggle("hidden", !isCustom);
        updateEl.classList.toggle("hidden", !isCustom);
    };

    const setDefaultAndRender = () => {
        // default = posledních 30 dní (poslední měsíc)
        presetEl.value = "last30";
        updateCustomEnabled();

        // nastavit od-do podle posledních 30 dní jen jako informaci (disabled)
        const last30 = getPresetRange("last30");
        fromEl.value = toDateInputValue(last30.from);
        toEl.value = toDateInputValue(last30.to);

        render();
    };

    presetEl.addEventListener("change", () => {
        updateCustomEnabled();

        // U předvoleb vykreslíme hned, u vlastního období čekáme na tlačítko
        if (presetEl.value !== "custom") {
            render();
        }
    });

    updateEl.addEventListener("click", render);

    // Uložíme si kontrolky pro možnost refresh z jiných skriptů (např. po přidání transakce)
    if (!window.__categoryPieWidgets) window.__categoryPieWidgets = {};
    window.__categoryPieWidgets[type] = { render, setDefaultAndRender };

    setDefaultAndRender();
}

//inicializace kruhových grafů pro kategorie výdajů a příjmů
function initCategoryPieCharts() {
    //if (window.__categoryPieChartsInitialized) return;
    //window.__categoryPieChartsInitialized = true;

    initCategoryPieWidget({
        type: "expense",
        presetId: "expense-pie-preset",
        fromId: "expense-pie-from",
        toId: "expense-pie-to",
        updateId: "expense-pie-update",
        emptyId: "expense-pie-empty",
        canvasId: "expense-category-pie",
        storageKey: "expenseCategoryPieChart",
        title: "Výdaje podle kategorií"
    });

    initCategoryPieWidget({
        type: "income",
        presetId: "income-pie-preset",
        fromId: "income-pie-from",
        toId: "income-pie-to",
        updateId: "income-pie-update",
        emptyId: "income-pie-empty",
        canvasId: "income-category-pie",
        storageKey: "incomeCategoryPieChart",
        title: "Příjmy podle kategorií"
    });
}

//pomocna funkce pro cislo tydnu - kolikaty tyden v roce
function getWeekNumber(d) {
    const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayNum = (date.getDay() + 6) % 7; //pon = 0
    date.setDate(date.getDate() - dayNum + 3);
    const firstThursday = new Date(date.getFullYear(), 0, 4);
    const diff = date - firstThursday;
    return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
}

//inicializace pri nacteni stranky
document.addEventListener("DOMContentLoaded", () => {
    initCategoryPieCharts();
});