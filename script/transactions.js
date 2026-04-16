//=========
//transactions.js - spravuje transakce
//=========

//fromatovani castky - pridani mezer pro tisice (CZK)
function formatMoney(amount) {
    return new Intl.NumberFormat("cs-CZ", {
        style: "currency",
        currency: "CZK",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

//nacteni transakci s localStorage
function getTransactions() {
    const data = getUserData();
    if (!data.username) return []; //kdyz neni username v ulozisti
    return JSON.parse(localStorage.getItem('transactions_' + data.username)) || [];
}

//ulozit transakce do localStorage
function saveTransactions(transactions) {
    const data = getUserData();
    if (!data.username) return;
    localStorage.setItem('transactions_' + data.username, JSON.stringify(transactions));
}

//nacteni defaultnich kategorii pro kazdeho usera zvlast
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

    // Změna dřívější obecné kategorie "Ostatní" -> správný text pro typ.
    // (když už ji má uživatel uloženou v localStorage, a teď chceš používat "Ostatní výdaje/příjmy")
    let expenseCategories = JSON.parse(localStorage.getItem(expenseKey)) || [];
    if (expenseCategories.includes("Ostatní") && !expenseCategories.includes("Ostatní výdaje")) {
        expenseCategories = expenseCategories.map(c => c === "Ostatní" ? "Ostatní výdaje" : c);
    }
    defaultExpense.forEach(c => {
        if (!expenseCategories.includes(c)) expenseCategories.push(c);
    });
    expenseCategories = [...new Set(expenseCategories)];
    localStorage.setItem(expenseKey, JSON.stringify(expenseCategories));

    let incomeCategories = JSON.parse(localStorage.getItem(incomeKey)) || [];
    if (incomeCategories.includes("Ostatní") && !incomeCategories.includes("Ostatní příjmy")) {
        incomeCategories = incomeCategories.map(c => c === "Ostatní" ? "Ostatní příjmy" : c);
    }
    defaultIncome.forEach(c => {
        if (!incomeCategories.includes(c)) incomeCategories.push(c);
    });
    incomeCategories = [...new Set(incomeCategories)];
    localStorage.setItem(incomeKey, JSON.stringify(incomeCategories));
}

//načtení kategorií z local storage
function getCategories(type) {
    const data = getUserData();
    if (!data.username) return [];
    return JSON.parse(localStorage.getItem("categories_" + type + "_" + data.username)) || [];
}

//ulozeni nove kategorie
function saveCategory(type, category) {
    const data = getUserData();
    if (!data.username) return;
    const categories = getCategories(type);

    if (!categories.includes(category)) { //kontrola jestli uz kategorie neexistuje
        categories.push(category);
        localStorage.setItem(
            "categories_" + type + "_" + data.username,
            JSON.stringify(categories)
        );
    }
}

//nacteni kategorie do selectu
function loadCategories(type, selectId, includeNew = true) {

    const select = document.getElementById(selectId);
    if (!select) return;

    //vycisti select a znovu ho naplni
    select.innerHTML = "";
    const addOption = (value, text) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = text;
        select.appendChild(option);
        return option;
    };

    //placeholder do modalu - aby tam nebyl jen prvni z vyberu
    if (selectId === "expense-category" || selectId === "income-category") {
        addOption("", "Vyberte kategorii");
    }

    //pro filtr chceme take kategorii "vse"
    if (selectId === "filter-category" && includeNew === false) {
        addOption("", "Vše");
    }

    //nacteni kategorii - pro filtr spojime prijmy a vydaje
    let categories = [];
    if (selectId === "filter-category") {
        categories = [
            ...getCategories("expense"),
            ...getCategories("income")
        ];
        //odstraneni duplicit
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

//vytvoreni nove kategorie
function enableNewCategory(selectId, type) {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.addEventListener("change", function () {
        if (this.value === "new") {

            const newCategory = prompt("Nová kategorie: ");

            if (newCategory) {
                saveCategory(type, newCategory);

                //znovu nacte kategorie aby se vse aktualizovalo
                loadCategories(type, selectId);
                this.value = newCategory;

                //pokud je to select filtru, pridame ho tam rovnou
                const filterSelect = document.getElementById("filter-category");

                //prida i do seznamu na filtrovani
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

//pridat vydaj
function addExpense(amount, date, place, category, description) {
    const transactions = getTransactions();
    transactions.push({
        type: 'expense',
        amount: -amount, //zaporne cislo = je to vydaj
        date,
        place,
        category,
        description,
        timestamp: new Date().getTime() //id podle ktereho se budou rozlisovat
    });
    saveTransactions(transactions);
    updateBalance();
    showTransactions();
    renderIncomeExpenseChart(); //rovnou updatne graf

    // aktualizace koláčového grafu výdajů na defaultní období
    if (window.__categoryPieWidgets?.expense?.setDefaultAndRender) {
        window.__categoryPieWidgets.expense.setDefaultAndRender();
    }
}

//prijem
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

    // aktualizace koláčového grafu příjmů na defaultní období
    if (window.__categoryPieWidgets?.income?.setDefaultAndRender) {
        window.__categoryPieWidgets.income.setDefaultAndRender();
    }
}

//balance update
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
    // Vydaje zaporne --> proto Math.abs, aby se mohly porovnavat s prijmy
    const totalExpense = Math.abs(totals.expense);
    const totalIncome = totals.income;

    data.expenses = totalExpense;
    data.incomes = totalIncome;
    saveUserData(data);

    const balanceEl = document.getElementById("balance");
    if (balanceEl) {
        const balance = totalIncome - totalExpense;

        balanceEl.textContent = formatMoney(balance);

        // odstraneni starych trid
        balanceEl.classList.remove("balance-positive", "balance-negative");

        // pridani nove podle stavu --> aby se mohlo zbarvit zelene/cervene
        if (balance > 0) {
            balanceEl.classList.add("balance-positive");
        } else if (balance < 0) {
            balanceEl.classList.add("balance-negative");
        }
    }
}

//vykreslení posledních posledních 5 transakcí
function showLastTransactions() {
    const transactions = getTransactions();
    const sorted = [...transactions].sort((a, b) => {
        // Primárně řadíme podle data - nejnovejsi nahore (pokud ve stejny dan, tak podle timestampu)
        const dateDiff = new Date(b.date) - new Date(a.date);
        if (dateDiff !== 0) return dateDiff;
        return (b.timestamp || 0) - (a.timestamp || 0);
    });
    const last5 = sorted.slice(0, 5);
    renderTransactions(last5);
}

//vygenerovani seznamu transakci
function renderTransactions(transactions) {
    const table = document.getElementById("transaction-table");
    const tbody = document.getElementById("transaction-tbody");
    if (!table || !tbody) return;

    tbody.innerHTML = "";

    const emptyMessage = document.getElementById("no-transactions-message");
    if (emptyMessage) {
        emptyMessage.classList.toggle("hidden", transactions.length !== 0);
    }

    table.classList.toggle("hidden", transactions.length === 0);
    if (transactions.length === 0) return;

    transactions.forEach(t => {
        const tr = document.createElement("tr");
        tr.classList.add(t.type === "income" ? "tx-income" : "tx-expense");

        const place = t.place && t.place.trim() ? t.place : "----";
        const description = t.description && t.description.trim() ? t.description : "----";

        const amountValue = Number(t.amount) || 0;
        const formattedAmount = formatMoney(amountValue);

        tr.innerHTML = `
            <td class="tx-date">${t.date || "----"}</td>
            <td class="tx-category">${t.category || "----"}</td>
            <td class="tx-place">${place}</td>
            <td class="tx-desc">${description}</td>
            <td class="tx-amount">${formattedAmount}</td>
            <td class="tx-action"><button class="delete-btn" type="button">❌</button></td>
        `;

        // smazani transakce - potvrzeni
        tr.querySelector(".delete-btn").addEventListener("click", () => {
            if (confirm("Opravdu chcete tuto transakci smazat?")) {
                deleteTransaction(t.timestamp);
            }
        });

        tbody.appendChild(tr);
    });
}

//vykresleni transakci - podle filtru
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

    //typ
    if (type !== "all") {
        transactions = transactions.filter(t => t.type === type);
    }

    //kategorie
    if (category !== "") {
        transactions = transactions.filter(t => t.category === category);
    }

    //datum od - do
    if (dateFrom) {
        const from = new Date(dateFrom)
        transactions = transactions.filter(t => new Date(t.date) >= from);
    }

    if (dateTo) {
        const to = new Date(dateTo);
        transactions = transactions.filter(t => new Date(t.date) <= to);
    }

    //částka
    if (min) {
        const minValue = parseFloat(min);
        transactions = transactions.filter(t => Math.abs(t.amount) >= minValue);
    }

    if (max) {
        const maxValue = parseFloat(max);
        transactions = transactions.filter(t => Math.abs(t.amount) <= maxValue);
    }

    //vyhledavani
    if (search) {
        transactions = transactions.filter(t =>
            t.place && t.place.toLowerCase().includes(search) ||
            t.description && t.description.toLowerCase().includes(search)
        );
    }

    //řazení
    transactions.sort((a, b) => {
        const dateDiff = new Date(b.date) - new Date(a.date);
        if (dateDiff !== 0) return dateDiff;
        return (b.timestamp || 0) - (a.timestamp || 0);
    });

    //limit
    if (limit !== "all") {
        transactions = transactions.slice(0, limit);
    }

    renderTransactions(transactions);
}

//smazani transakce
function deleteTransaction(timestamp) {
    let transactions = getTransactions();
    transactions = transactions.filter(t => t.timestamp !== timestamp);
    saveTransactions(transactions);
    updateBalance();
    showTransactions();
    renderIncomeExpenseChart();
    initCategoryPieCharts(); //aby se aktualizovaly i kolacove grafy po smazani transakce
}

//export do csv (comma separated values)
function exportToCSV() {
    //získání transakcí
    const transactions = getTransactions();
    if (transactions.length === 0) {
        alert("Nemáte žádná data k exportu, neváhejte přidat nějaké transakce!");
        return;
    }

    //usporádání transakcí
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

        csv += row.map(value => `${value}`).join(",") + "\n";
    });

    //vytvoření souboru (blob - soubor v paměti)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "transakce.csv";
    a.click();

    URL.revokeObjectURL(url);
}