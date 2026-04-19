//=========
//transactions.js - spravuje transakce
//=========

// formatování částky - přidání mezer pro tisíce (CZK)
function formatMoney(amount) {
    return new Intl.NumberFormat("cs-CZ", {
        style: "currency",
        currency: "CZK",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// načtení transakcí z localStorage
function getTransactions() {
    const data = getUserData();
    if (!data.username) return []; //když není username v úložišti, return prázdný seznam
    return JSON.parse(localStorage.getItem('transactions_' + data.username)) || [];
}

// uložit transakce do localStorage
function saveTransactions(transactions) {
    const data = getUserData();
    if (!data.username) return;
    localStorage.setItem('transactions_' + data.username, JSON.stringify(transactions));
}

// načtení defaultních kategorií pro každého uživatele zvlášť (aby se nemíchaly napříč uživateli)
function initDefaultCategories() {
    const data = getUserData();
    if (!data.username) return;

    const expenseKey = "categories_expense_" + data.username;
    const incomeKey = "categories_income_" + data.username;

    const defaultExpense = [
        "Jídlo",
        "Domácnost",
        "Zábava",
        "Bankovní výběr",
        "Ostatní výdaje"
    ];

    const defaultIncome = [
        "Výplata",
        "Dar",
        "Prodej",
        "Ostatní příjmy"
    ];

    // přidání defaultních kategorií do localStorage, pokud tam ještě nejsou
    let expenseCategories = JSON.parse(localStorage.getItem(expenseKey)) || [];
    defaultExpense.forEach(c => {
        if (!expenseCategories.includes(c)) expenseCategories.push(c);
    });
    expenseCategories = [...new Set(expenseCategories)];
    localStorage.setItem(expenseKey, JSON.stringify(expenseCategories));

    let incomeCategories = JSON.parse(localStorage.getItem(incomeKey)) || [];
    defaultIncome.forEach(c => {
        if (!incomeCategories.includes(c)) incomeCategories.push(c);
    });
    incomeCategories = [...new Set(incomeCategories)];
    localStorage.setItem(incomeKey, JSON.stringify(incomeCategories));
}

// načtení kategorií z localStorage
function getCategories(type) {
    const data = getUserData();
    if (!data.username) return [];
    return JSON.parse(localStorage.getItem("categories_" + type + "_" + data.username)) || [];
}

// uložení nové kategorie
function saveCategory(type, category) {
    const data = getUserData();
    if (!data.username) return;
    const categories = getCategories(type);

    if (!categories.includes(category)) { // kontrola jestli už kategorie neexistuje
        categories.push(category);
        localStorage.setItem(
            "categories_" + type + "_" + data.username,
            JSON.stringify(categories)
        );
    }
}

// načtení kategorií do selectu pro filtrování a pro modální okna
function loadCategories(type, selectId, includeNew = true) {

    const select = document.getElementById(selectId);
    if (!select) return;

    // vyčistí select a znovu ho naplní
    select.innerHTML = "";
    const addOption = (value, text) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = text;
        select.appendChild(option);
        return option;
    };

    // placeholder do modalu - aby tam nebyl vidět první z výběru
    if (selectId === "expense-category" || selectId === "income-category") {
        addOption("", "Vyberte kategorii");
    }

    // pro filtr chceme také kategorii "vše"
    if (selectId === "filter-category" && includeNew === false) {
        addOption("", "Vše");
    }

    // načtení kategorií - pro filtr spojíme příjmy a výdaje
    let categories = [];
    if (selectId === "filter-category") {
        categories = [
            ...getCategories("expense"),
            ...getCategories("income")
        ];
        // odstraněni duplicit - pokud nějaká kategorie příjmu = kategorie výdajů
        categories = [...new Set(categories)];
    } else {
        categories = getCategories(type);
    }

    categories.forEach(category => {
        addOption(category, category);
    });

    if (includeNew) {
        addOption("new", "+ Nová kategorie");
    }
}

// vytvoření nové kategorie
function enableNewCategory(selectId, type) {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.addEventListener("change", function () {
        if (this.value === "new") {

            const newCategory = prompt("Nová kategorie: ");

            if (newCategory) {
                saveCategory(type, newCategory);

                // znovu načte kategorie, aby se vše aktualizovalo
                loadCategories(type, selectId);
                this.value = newCategory;

                // přidáme rovnou do filtru transakcí (uživatel nemusí reloadovat stránku)
                const filterSelect = document.getElementById("filter-category");

                // přida i do seznamu na filtrování, pokud tam ještě není
                if (filterSelect && ![...filterSelect.options].some(o => o.value === newCategory)) {
                    const filterOption = document.createElement("option");
                    filterOption.value = newCategory;
                    filterOption.textContent = newCategory;
                    filterSelect.appendChild(filterOption);
                }

            } else {
                select.value = "";
            }
        }
    });
}

// modál pro přidání výdaje - vytvoří objekt transakce a uloží ho do localStorage
function addExpense(amount, date, place, category, description) {
    const transactions = getTransactions();
    transactions.push({
        type: 'expense',
        amount: -amount, // záporné číslo = je to výdaj
        date,
        place,
        category,
        description,
        timestamp: new Date().getTime() // id podle ktereho se budou rozlišovat
    });
    saveTransactions(transactions);
    updateBalance();
    showTransactions();
    renderIncomeExpenseChart(); // rovnou updatne graf příjmů a výdajů
    initCategoryPieCharts(); // aktualizace koláčových grafů

    // aktualizace koláčového grafu výdajů na defaultní období
    if (window.__categoryPieWidgets?.expense?.setDefaultAndRender) {
        window.__categoryPieWidgets.expense.setDefaultAndRender();
    }
}

// modál pro přidání příjmu - vytvoří objekt transakce a uloží ho do localStorage
function addIncome(amount, date, category, description) {
    const transactions = getTransactions();
    transactions.push({
        type: 'income',
        amount,
        date,
        category,
        description,
        timestamp: new Date().getTime()
    });
    saveTransactions(transactions);
    updateBalance();
    showTransactions();
    renderIncomeExpenseChart();
    initCategoryPieCharts();

    // aktualizace koláčového grafu příjmů na defaultní období
    if (window.__categoryPieWidgets?.income?.setDefaultAndRender) {
        window.__categoryPieWidgets.income.setDefaultAndRender();
    }
}

// balance update
function updateBalance() {
    const data = getUserData();
    if (!data.username) return;
    const transactions = getTransactions();

    const totals = transactions.reduce(
        (acc, t) => {
            const amount = Number(t.amount) || 0;
            if (t.type === 'expense') acc.expense += amount;
            if (t.type === 'income') acc.income += amount;
            return acc;
        },
        { expense: 0, income: 0 }
    );

    // záporné hodnoty --> proto Math.abs, aby se mohly porovnávat s příjmy
    const totalExpense = Math.abs(totals.expense);
    const totalIncome = totals.income;

    data.expenses = totalExpense;
    data.incomes = totalIncome;
    saveUserData(data);

    const balanceEl = document.getElementById("balance");
    if (balanceEl) {
        const balance = totalIncome - totalExpense;

        balanceEl.textContent = formatMoney(balance);

        // odstraneění starých tříd
        balanceEl.classList.remove("balance-positive", "balance-negative");

        // přidání nové podle stavu --> aby se mohlo zbarvit zeleně/červeně
        if (balance > 0) {
            balanceEl.classList.add("balance-positive");
        } else if (balance < 0) {
            balanceEl.classList.add("balance-negative");
        }
    }
}

// vykreslení tabulky transakcí - posledních 5 transakcí
function showLastTransactions() {
    const transactions = getTransactions();
    const sorted = [...transactions].sort((a, b) => {
        // primárně řadíme podle data - nejnovější nahoře (pokud ve stejný den, tak podle timestampu)
        const dateDiff = new Date(b.date) - new Date(a.date);
        if (dateDiff !== 0) return dateDiff;
        return (b.timestamp || 0) - (a.timestamp || 0);
    });
    const last5 = sorted.slice(0, 5);
    renderTransactions(last5);
}

// vygenerování seznamu transakcí
function renderTransactions(transactions) {
    const table = document.getElementById("transaction-table");
    const tbody = document.getElementById("transaction-tbody");
    if (!table || !tbody) return;

    tbody.innerHTML = "";

    // zobrazení zprávy, když nejsou žádné transakce
    const emptyMessage = document.getElementById("no-transactions-message");
    if (emptyMessage) {
        emptyMessage.classList.toggle("hidden", transactions.length !== 0);
    }

    table.classList.toggle("hidden", transactions.length === 0);
    if (transactions.length === 0) return;

    // pro každou transakci vytvoří řádek v tabulce
    transactions.forEach(t => {
        const tr = document.createElement("tr");
        tr.classList.add(t.type === "income" ? "tx-income" : "tx-expense");

        const place = t.place && t.place.trim() ? t.place : "----";
        const description = t.description && t.description.trim() ? t.description : "----";

        const amountValue = Number(t.amount) || 0;
        const formattedAmount = formatMoney(amountValue);

        // pokud není datum, kategorie, místo nebo popis, zobrazí se "----"
        tr.innerHTML = `
            <td class="tx-date">${t.date || "----"}</td>
            <td class="tx-category">${t.category || "----"}</td>
            <td class="tx-place">${place}</td>
            <td class="tx-desc">${description}</td>
            <td class="tx-amount">${formattedAmount}</td>
            <td class="tx-action"><button class="delete-btn" type="button">❌</button></td>
        `;

        // smazání transakce - potvrzení akce a následné smazání podle timestampu
        tr.querySelector(".delete-btn").addEventListener("click", () => {
            if (confirm("Opravdu chcete tuto transakci smazat?")) {
                deleteTransaction(t.timestamp);
            }
        });

        tbody.appendChild(tr);
    });
}

// vykreslení transakcí - podle filtru
function showTransactions() {
    let transactions = getTransactions();
    const limit = document.getElementById("transaction-limit").value;
    const type = document.getElementById("transaction-type").value;
    const category = document.getElementById("filter-category").value;
    const dateFrom = document.getElementById("filter-date-from").value;
    const dateTo = document.getElementById("filter-date-to").value;
    const min = document.getElementById("filter-min").value;
    const max = document.getElementById("filter-max").value;
    const search = document.getElementById("filter-search").value.toLowerCase();

    // typ transakce
    if (type !== "all") {
        transactions = transactions.filter(t => t.type === type);
    }

    // kategorie
    if (category !== "") {
        transactions = transactions.filter(t => t.category === category);
    }

    // datum od - do
    if (dateFrom) {
        const from = new Date(dateFrom)
        transactions = transactions.filter(t => new Date(t.date) >= from);
    }

    if (dateTo) {
        const to = new Date(dateTo);
        transactions = transactions.filter(t => new Date(t.date) <= to);
    }

    // částka minimum a maximum - porovnává se absolutní hodnota, aby se mohly porovnávat i výdaje (které jsou záporné) s příjmy
    if (min) {
        const minValue = parseFloat(min);
        transactions = transactions.filter(t => Math.abs(t.amount) >= minValue);
    }

    if (max) {
        const maxValue = parseFloat(max);
        transactions = transactions.filter(t => Math.abs(t.amount) <= maxValue);
    }

    // vyhledávání
    if (search) {
        transactions = transactions.filter(t =>
            (t.place && t.place.toLowerCase().includes(search)) ||
            (t.description && t.description.toLowerCase().includes(search))
        );
    }

    // řazení - nejdříve podle data (novější nahoře), pokud jsou ve stejný den, tak podle timestampu
    transactions.sort((a, b) => {
        const dateDiff = new Date(b.date) - new Date(a.date);
        if (dateDiff !== 0) return dateDiff;
        return (b.timestamp || 0) - (a.timestamp || 0);
    });

    // limit - pokud není "all", tak ořízne seznam transakcí na zvolený počet
    if (limit !== "all") {
        transactions = transactions.slice(0, limit);
    }

    renderTransactions(transactions);
}

// smazání transakce
function deleteTransaction(timestamp) {
    let transactions = getTransactions();
    transactions = transactions.filter(t => t.timestamp !== timestamp);
    saveTransactions(transactions);
    updateBalance();
    showTransactions();
    renderIncomeExpenseChart();
    initCategoryPieCharts(); //aby se aktualizovaly i kolacove grafy po smazani transakce
}

// export do CSV (=Comma Separated Values) -> vytvoří soubor s transakcemi, který si uživatel může stáhnout
function exportToCSV() {
    //získání transakcí
    const transactions = getTransactions();
    if (transactions.length === 0) {
        alert("Nemáte žádná data k exportu, neváhejte přidat nějaké transakce!");
        return;
    }

    // uspořádání transakcí - stejné jako v tabulce
    let csv = "Datum,Kategorie,Místo,Popis,Částka,Typ\n";
    transactions.forEach(t => {
        const row = [
            t.date,
            t.category,
            t.place || "",
            t.description || "",
            t.amount,
            t.type
        ];

        csv += row.map(value => `"${value}"`).join(",") + "\n";
    });

    // vytvoření souboru (blob - soubor v paměti)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "transakce.csv";
    a.click();

    URL.revokeObjectURL(url);
}
