//========
//app.js - spravuje uzivatele a zobrazeni
//========

//načtení data o uživateli z local storage
function getUserData() {
    return JSON.parse(localStorage.getItem('userData')) || {};
}

//ulozeni dat do local storage
function saveUserData(data) {
    localStorage.setItem('userData', JSON.stringify(data));
}

//hash hesla -- pomocí SHA-256 (WebCrypto API)
async function hashPassword(plainPassword) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plainPassword);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    //prevod hex --> string
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

//funkce pro zobrazení úvodní obrazovky
//--nacte defaultni kategorie, update balance, transakce a graf
function showDashboard(username) {
    document.getElementById("login-page").classList.add("hidden");
    document.getElementById("dashboard").classList.remove("hidden");
    document.getElementById("user-name").textContent = username;

    initDefaultCategories();

    // reset filtru pro aktualne prihlaseneho uzivatela
    //-- jinak tam mohou zustat kategorie pridane ostatnimi uzivateli
    loadCategories(null, "filter-category", false);

    updateBalance();
    showLastTransactions();
    renderIncomeExpenseChart();
    initCategoryPieCharts();
}
//zobrazeni prihlasovaci obrazovky
function showLogin() {
    document.getElementById("dashboard").classList.add("hidden");
    document.getElementById("login-page").classList.remove("hidden");

    // aby po odhlášení nezůstalo vyplněné jméno/heslo
    const loginForm = document.getElementById("login-form");
    if (loginForm) loginForm.reset();

    const registerSection = document.getElementById("register-section");
    if (registerSection) registerSection.classList.add("hidden");
    const registerForm = document.getElementById("register-form");
    if (registerForm) registerForm.reset();
}

//MODALY: PRIDANI TRANSAKCE
//ukazat modal pro pridani vydaje
function showExpenseModal() {
    document.getElementById("expense-modal").classList.remove("hidden");
    //nastavi datum na dnesni, pokud uzivatel neuvede sam
    document.getElementById("expense-date").value = new Date().toISOString().split('T')[0];
}

//skryti modalu pro pridani vydaje
function hideExpenseModal() {
    document.getElementById("expense-modal").classList.add("hidden");
}

//ukazani modalu pro prijmy
function showIncomeModal() {
    document.getElementById("income-modal").classList.remove("hidden");
    document.getElementById("income-date").value = new Date().toISOString().split('T')[0];
}

//skryti modalu pro pridani prijmu
function hideIncomeModal() {
    document.getElementById("income-modal").classList.add("hidden");
}

//EVENT LISTENERS: cekaji az se neco stane a pak spusti funkci
document.addEventListener("DOMContentLoaded", () => { //DOM = document object model
    const data = getUserData();
    //pokud je uz prihlaseny, zobraz dashboard
    if (data.loggedIn) {
        showDashboard(data.username);
    }

    //prihlaseni
    document.getElementById("login-form").addEventListener("submit", async (event) => {
        event.preventDefault(); //zabrani znovunacteni zacatku

        const username = document.getElementById("username").value.trim(); //aby nezalezelo na mezerach
        const password = document.getElementById("password").value.trim();

        const user = JSON.parse(localStorage.getItem("user_" + username));

        if (!user) {
            alert("Neplatné jméno nebo heslo!");
            return;
        }

        if (!user.passwordHash) {
            alert("Neplatné jméno nebo heslo!");
            return;
        }

        const enteredHash = await hashPassword(password);
        if (enteredHash === user.passwordHash) {
            saveUserData({ ...user, loggedIn: true });
            showDashboard(username);
        } else {
            alert("Neplatné jméno nebo heslo!");
        }
    });

    //odhlaseni
    document.getElementById("logout").addEventListener("click", () => {
        const data = getUserData();
        data.loggedIn = false;
        saveUserData(data);
        showLogin();
    });

    //registrace nového uživatele (2× heslo)
    const registerSection = document.getElementById("register-section");
    const registerForm = document.getElementById("register-form");
    const registerUsername = document.getElementById("register-username");
    const registerPassword = document.getElementById("register-password");
    const registerPasswordConfirm = document.getElementById("register-password-confirm");
    const passwordMatchMessage = document.getElementById("password-match-message");

    const updatePasswordMatchUi = () => {
        if (!registerPassword || !registerPasswordConfirm) return;

        const p1 = registerPassword.value;
        const p2 = registerPasswordConfirm.value;

        registerPasswordConfirm.classList.remove("input-error", "input-ok");
        if (passwordMatchMessage) passwordMatchMessage.textContent = "";

        // Neindikujeme chybu, dokud uživatel nezačne psát potvrzení
        if (p2.length === 0) return;

        if (p1 === p2) {
            registerPasswordConfirm.classList.add("input-ok");
            if (passwordMatchMessage) passwordMatchMessage.textContent = "Hesla se shodují.";
        } else {
            registerPasswordConfirm.classList.add("input-error");
            if (passwordMatchMessage) passwordMatchMessage.textContent = "Hesla se neshodují.";
        }
    };

    document.getElementById("new-user").addEventListener("click", () => {
        if (!registerSection || !registerForm) return;
        registerForm.reset();
        if (passwordMatchMessage) passwordMatchMessage.textContent = "";
        if (registerPasswordConfirm) registerPasswordConfirm.classList.remove("input-error", "input-ok");
        registerSection.classList.toggle("hidden");
        if (!registerSection.classList.contains("hidden") && registerUsername) {
            registerUsername.focus();
        }
    });

    document.getElementById("cancel-register").addEventListener("click", () => {
        if (!registerSection || !registerForm) return;
        registerForm.reset();
        if (passwordMatchMessage) passwordMatchMessage.textContent = "";
        if (registerPasswordConfirm) registerPasswordConfirm.classList.remove("input-error", "input-ok");
        registerSection.classList.add("hidden");
    });

    if (registerPassword) registerPassword.addEventListener("input", updatePasswordMatchUi);
    if (registerPasswordConfirm) registerPasswordConfirm.addEventListener("input", updatePasswordMatchUi);

    if (registerForm) {
        registerForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            if (!registerUsername || !registerPassword || !registerPasswordConfirm) return;

            const username = registerUsername.value.trim();
            const p1 = registerPassword.value;
            const p2 = registerPasswordConfirm.value;

            if (!username || !p1 || !p2) return;

            if (p1 !== p2) {
                updatePasswordMatchUi();
                alert("Hesla se neshodují.");
                return;
            }

            if (localStorage.getItem("user_" + username)) {
                alert("Tento uživatel už existuje!");
                return;
            }

            const passwordHash = await hashPassword(p1);
            localStorage.setItem(
                "user_" + username,
                JSON.stringify({
                    username: username,
                    passwordHash: passwordHash,
                    incomes: 0,
                    expenses: 0
                })
            );

            if (registerSection) registerSection.classList.add("hidden");
            registerForm.reset();
            if (passwordMatchMessage) passwordMatchMessage.textContent = "";
            if (registerPasswordConfirm) registerPasswordConfirm.classList.remove("input-error", "input-ok");

            saveUserData({ username: username, loggedIn: true });
            showDashboard(username);
        });
    }

    //export do CSV
    document.getElementById("export-csv").addEventListener("click", exportToCSV);

    // načtení kategorii pri nacteni dashboardu
    loadCategories("expense", "expense-category"); // formulář
    loadCategories("income", "income-category");   // formulář
    loadCategories(null, "filter-category", false); // filtr

    //povoli pridani nove kategorie
    enableNewCategory("expense-category", "expense");
    enableNewCategory("income-category", "income");

    //otevreni modalu pro pridani vydaje
    document.getElementById("add-expense").addEventListener("click", () => {
        initDefaultCategories();
        loadCategories("expense", "expense-category");
        showExpenseModal();
    });

    //zavreni modalu pro pridani vydaje
    document.getElementById("close-expense-modal").addEventListener("click", hideExpenseModal);

    //vyplneni modalu pro pridani vydaje
    document.getElementById("expense-form").addEventListener("submit", (event) => {
        event.preventDefault();
        const amount = parseFloat(document.getElementById("expense-amount").value);
        const date = document.getElementById("expense-date").value;
        const place = document.getElementById("expense-place").value;
        const category = document.getElementById("expense-category").value;
        const description = document.getElementById("expense-description").value;

        if (amount > 0) {
            addExpense(amount, date, place, category, description);
            alert("Výdaj uložen!");
            hideExpenseModal();
            //vycistit formular
            document.getElementById("expense-form").reset();
        } else {
            alert("Neplatná částka!");
        }
    });

    //otevrit modal pro prijem
    document.getElementById("add-income").addEventListener("click", () => {
        initDefaultCategories();
        loadCategories("income", "income-category");
        showIncomeModal();
    });

    //zavrit modal pro prijem
    document.getElementById("close-income-modal").addEventListener("click", hideIncomeModal);

    //vyplneni modalu pro pridani prijmu
    document.getElementById("income-form").addEventListener("submit", (event) => {
        event.preventDefault();
        const amount = parseFloat(document.getElementById("income-amount").value);
        const date = document.getElementById("income-date").value;
        const category = document.getElementById("income-category").value;
        const description = document.getElementById("income-description").value;

        if (amount > 0) {
            addIncome(amount, date, category, description);
            alert("Příjem uložen!");
            hideIncomeModal();
            document.getElementById("income-form").reset();
        } else {
            alert("Neplatná částka!");
        }
    });

    //zobrazit nebo schovat pokrocile filtry
    document.getElementById("filters").addEventListener("click", () => {
        const filters = document.getElementById("advanced-filters");
        filters.classList.toggle("hidden"); //toggle = switch mezi 2 možnostmi (hide  x show)
    });

    //aplikace filtru a zobrazeni transakci
    // Limit a typ chceme renderovat hned po změně výběru
    document.getElementById("transaction-limit").addEventListener("change", showTransactions);
    document.getElementById("transaction-limit").addEventListener("input", showTransactions);
    document.getElementById("transaction-type").addEventListener("change", showTransactions);
    document.getElementById("transaction-type").addEventListener("input", showTransactions);

    // Ostatní filtry hromadně až po kliknutí
    document.getElementById("apply-filters").addEventListener("click", showTransactions);

    //reset fitrů
    document.getElementById("reset-filters").addEventListener("click", () => {
        document.getElementById("transaction-limit").value = "10";
        document.getElementById("transaction-type").value = "all";
        document.getElementById("filter-category").value = "";
        document.getElementById("filter-date-from").value = "";
        document.getElementById("filter-date-to").value = "";
        document.getElementById("filter-min").value = "";
        document.getElementById("filter-max").value = "";
        document.getElementById("filter-search").value = "";

        showTransactions();

    });

    //zobrazeni a update grafu
    document.getElementById("update-chart").addEventListener("click", () => {
        const aggregate = document.getElementById("chart-interval-type").value;
        const dateFrom = document.getElementById("chart-date-from").value || null;
        const dateTo = document.getElementById("chart-date-to").value || null;
        renderIncomeExpenseChart(aggregate, dateFrom, dateTo);
    });

});


