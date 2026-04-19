//========
//charts.js - spravuje grafy
//========

// vygenerovani GRAFU PRO PŘÍJMY A VÝDAJE V ČASE - SLOUPCOVÝ GR
function renderIncomeExpenseChart(aggregate = "month",
    dateFrom = null, dateTo = null) {
    const transactions = getTransactions().map
        (t => ({ ...t, date: new Date(t.date) }));

    const now = new Date();

    // výchozí rozsah - poslednich 6 dnů/týdnů/měsíců/let
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


    // data pro graf 
    const labels = []; // označení jednotlivých úseků na ose x
    const incomeData = []; // hodnoty příjmu na ose y
    const expenseData = []; // hodnoty výdajů na ose y

    let current = new Date(startDate);

    // iterace po jednotlivých úsecích (dnech/týdnech/měsících/letech)
    while (current <= endDate) {
        let next;
        let label;

        // různé možnosti grafu
        switch (aggregate) {
            // pro dny přidáváme po 1 dni, onačení je datum ve formátu "D. M. RRRR"
            case "day":
                next = new Date(current); next.setDate(current.getDate() + 1);
                label = current.toLocaleDateString("cs-CZ");
                break;

            // pro týdny přidáváme po 7 dnech, označení je "Týden X" - kolikátý týden v roce
            case "week":
                next = new Date(current); next.setDate(current.getDate() + 7);
                label = `Týden ${getWeekNumber(current)}`;
                break;

            // pro měsíce přidáváme po 1 měsíci, označení je "Měsíc RRRR" - zkráceně měsíc a rok
            case "month":
                next = new Date(current.getFullYear(), current.getMonth() + 1, 1);
                label = current.toLocaleString("cs-CZ", { month: "short", year: "2-digit" });
                break;

            // pro roky přidáváme po 1 roce, označení je "RRRR" - rok
            case "year":
                next = new Date(current.getFullYear() + 1, 0, 1);
                label = current.getFullYear().toString();
                break;
        }

        labels.push(label);

        // pro aktuální úsek spočítáme součet příjmů a výdajů
        const periodTransactions = transactions.filter(t => t.date >= current && t.date < next);
        const monthIncome = periodTransactions.filter(t => t.type === "income")
            .reduce((sum, t) => sum + t.amount, 0);
        const monthExpense = periodTransactions.filter(t => t.type === "expense")
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);

        // uložíme data pro graf
        incomeData.push(monthIncome);
        expenseData.push(monthExpense);

        current = next;

    }

    const ctx = document.getElementById("income-expense-chart").getContext("2d");

    // pokud už graf existuje, smažeme ho - abychom nevykreslovali 2 přes sebe
    if (window.incomeExpenseChart) window.incomeExpenseChart.destroy();

    //samotné vykreslovani grafu
    window.incomeExpenseChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            // 2 sady dat - příjmy a výdaje
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
            // aby se graf přizpůsobil velikosti obrazovky
            responsive: true,
            // nastavení pro legendu, název grafu a tooltipy
            plugins: {
                legend: { position: "top" },
                title: { display: true, text: "Příjmy a výdaje v čase" },
                tooltip: {
                    // vlastní formátování tooltipu, aby se zobrazovala částka s "Kč"
                    callbacks: {
                        label: function (context) {
                            const label = context.dataset.label || "";
                            const value = context.parsed.y;
                            return `${label}: ${formatKc(value)}`;
                        }
                    }
                }

            },
            scales: { y: { beginAtZero: true } }
        }
    });
}

// pomocná funkce pro převod data na formát pro input type="date" (YYYY-MM-DD)
function toDateInputValue(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

// GRAF PRO PŘÍJMY A VÝDAJE PODLE KATEGORIÍ - KOLÁČOVÝ GRAF
// rozsahy pro předvolené období
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

// agregace transakcí podle kategorie
function aggregateByCategory(transactions, type, from, to) {
    const totals = new Map();

    // projdeme všechny transakce a sečteme částky podle kategorie, přičemž zohledníme typ a datum
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

    // seřazení kategorií sestupně podle částky
    const entries = Array.from(totals.entries())
        .sort((a, b) => b[1] - a[1]); // [category, total]

    const labels = entries.map(([category]) => category);
    const data = entries.map(([, total]) => total);
    return { labels, data };
}

// pomocná funkce pro formatování ceny
function formatKc(value) {
    return `${Math.round(value)} Kč`;
}

// vykreslení nebo aktualizace koláčového grafu (typ: donut)
function createOrUpdateDoughnutChart(storageKey, canvasId, title, labels, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // pokud už graf existuje, smažeme ho - abychom nevykreslovali 2 přes sebe
    if (window[storageKey]) window[storageKey].destroy();

    const total = data.reduce((s, v) => s + v, 0);
    const colors = labels.map((_, i) => `hsl(${(i * 47) % 360} 70% 55%)`);

    // samotné vykreslovani grafu
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
            // aby se graf přizpůsobil velikosti obrazovky
            responsive: true,
            // nastavení pro legendu, název grafu a tooltipy
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

// inicializace kruhového grafu pro kategorie
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
    // získáme reference na všechny potřebné elementy
    const presetEl = document.getElementById(presetId);
    const fromEl = document.getElementById(fromId);
    const toEl = document.getElementById(toId);
    const updateEl = document.getElementById(updateId);
    const emptyEl = document.getElementById(emptyId);
    const canvasEl = document.getElementById(canvasId);

    // pokud chybí některý z elementů, neděláme nic (např. jsme na stránce bez grafu)
    if (!presetEl || !fromEl || !toEl || !updateEl || !emptyEl || !canvasEl) return;

    // funkce pro vykreslení grafu podle aktuálního nastavení (předvolba nebo vlastní období)
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

        // pokud nejsou žádná data, schováme canvas a zobrazíme zprávu o prázdnosti
        const hasData = result.data.length > 0;
        emptyEl.classList.toggle("hidden", hasData);
        canvasEl.classList.toggle("hidden", !hasData);

        // pokud nejsou žádná data, zničíme případný existující graf a nebudeme nic vykreslovat
        if (!hasData) {
            if (window[storageKey]) {
                window[storageKey].destroy();
                window[storageKey] = null;
            }
            return;
        }

        // pokud jsou data, vykreslíme nebo aktualizujeme graf
        createOrUpdateDoughnutChart(storageKey, canvasId, title, result.labels, result.data);
    };

    // funkce pro povolení nebo zakázání inputů pro vlastní období podle výběru předvolby
    const updateCustomEnabled = () => {
        const isCustom = presetEl.value === "custom";
        fromEl.disabled = !isCustom;
        toEl.disabled = !isCustom;

        // schovat/zobrazit UI pro vlastní období
        const rangeWrap = fromEl.closest(".pie-custom-range");
        if (rangeWrap) rangeWrap.classList.toggle("hidden", !isCustom);
        updateEl.classList.toggle("hidden", !isCustom);
    };

    // funkce pro nastavení výchozí předvolby a vykreslení grafu
    const setDefaultAndRender = () => {
        // default = posledních 30 dní
        presetEl.value = "last30";
        updateCustomEnabled();

        // nastavit od-do podle posledních 30 dní jen jako informaci (disabled)
        const last30 = getPresetRange("last30");
        fromEl.value = toDateInputValue(last30.from);
        toEl.value = toDateInputValue(last30.to);

        render();
    };

    // přidáme event listenery pro změnu předvolby a kliknutí na tlačítko aktualizace
    presetEl.addEventListener("change", () => {
        updateCustomEnabled();

        // u předvoleb vykreslíme hned, u vlastního období čekáme na tlačítko "Aktualizovat graf"
        if (presetEl.value !== "custom") {
            render();
        }
    });

    updateEl.addEventListener("click", render);

    // kontrolky pro možnost refresh z jiných skriptů
    if (!window.__categoryPieWidgets) window.__categoryPieWidgets = {};
    window.__categoryPieWidgets[type] = { render, setDefaultAndRender };

    setDefaultAndRender();
}

// inicializace kruhových grafů pro kategorie výdajů a příjmů
function initCategoryPieCharts() {

    // graf pro výdaje podle kategorií
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

    // graf pro příjmy podle kategorií
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

// pomocná funkce pro číslo týdnu - kolikátý týden v roce
function getWeekNumber(d) {
    const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayNum = (date.getDay() + 6) % 7; //pon = 0
    date.setDate(date.getDate() - dayNum + 3);
    const firstThursday = new Date(date.getFullYear(), 0, 4);
    const diff = date - firstThursday;
    return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
}

// inicializace při načtení stránky
document.addEventListener("DOMContentLoaded", () => {
    initCategoryPieCharts();
});
