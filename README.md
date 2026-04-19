# rechtbar.github.io
## Osobní správce financí

Webová aplikace zaměřená na přehlednou správu, filtrování a vizualizaci osobních financí a pohybů na účtech. Projekt je navržen s důrazem na intuitivní ovládání a soukromí uživatele.

### Klíčové funkce
**Správa transakcí:** Možnost zadávat příjmy a výdaje s detailními atributy, jako jsou datum, místo, částka, popis a kategorie.\
**Kategorizace:** Podpora pro předpřipravené i vlastní kategorie transakcí.\
**Vizualizace dat:** Automatické generování grafů pomocí knihovny _Chart.js_ pro sledování vývoje financí v čase a poměrů jednotlivých kategorií.\
**Pokročilé filtrování:** Vyhledávání a třídění transakcí podle typu, data, částky nebo klíčových slov.\
**Export dat:** Funkce pro export seznamu transakcí do formátu CSV.\
**Uživatelský systém:** Možnost registrace a přihlášení s personalizovaným dashboardem pro každého uživatele.

### Použité technologie
Aplikace je postavena na moderních webových standardech bez nutnosti instalace serverových komponent:\
**HTML5 & CSS3:** Struktura a responzivní design využívající CSS proměnné pro konzistentní vzhled.\
**JavaScript:** Veškerá aplikační logika a manipulace s DOM.\
**localStorage:** Rozhraní pro trvalé ukládání dat přímo v prohlížeči uživatele, což zajišťuje rychlost a offline dostupnost.\
**WebCrypto API:** Implementace hashovacího algoritmu **SHA-256** pro bezpečné ukládání uživatelských hesel.\
**Chart.js:** Externí knihovna zajišťující vykreslování interaktivních grafů.

### Struktura projektu
_index.html_: Hlavní vstupní bod aplikace a definice rozhraní (dashboard, modály, tabulky).\
_styles.css_: Definice vizuálního stylu, barevného schématu a animací.\
**script:**\
    _app.js_: Správa uživatelů, autentizace a základní přepínání obrazovek.\
    _transactions.js_: Logika pro manipulaci s transakcemi, kategoriemi a výpočty zůstatku.\
    _charts.js_: Inicializace a aktualizace grafických výstupů.\
**graphics:** Logo aplikace a ikonky pro navigaci na stránce\
    _logo.png_\
    _transactions.png, bar-graph-icon.png, pie-chart-icon.png_

### Spuštění aplikace
Web je publikovaný přes GithubPages\
Odkaz: https://rechtbar.github.io/finance-manager/


--------------------------------------------------------------------------------
**Poznámka:** Data jsou uložena vázaně na váš prohlížeč a zařízení. Při smazání historie prohlížeče nebo dat stránek může dojít k odstranění uložených transakcí. Pro trvalou zálohu vašich dat doporučuji pravidelně využívat funkci Export do CSV.
