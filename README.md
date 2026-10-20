# Wake Up House

Statyczna strona menu Wake Up House. Po zbudowaniu działa na zwykłym hostingu
plików przez FTP — serwer nie musi obsługiwać Node.js ani TanStack Start.

## Uruchomienie lokalne

Wymagane: Node.js i npm.

```sh
npm install
npm run dev
```

## Budowanie

```sh
npm install
npm run build
```

## Publikacja przez FTP

1. Uruchom powyższe polecenia w katalogu projektu na komputerze z Node.js.
2. W FileZilla otwórz utworzony katalog `dist/` na komputerze.
3. Wgraj **zawartość** `dist/` (w tym `index.html` i cały katalog `assets/`)
   do katalogu strony na serwerze, zwykle `public_html/` lub `www/`.
4. Nie wgrywaj archiwum repozytorium ani katalogów `src/`, `node_modules/`
   lub `.output/`. Nie usuwaj serwerowych katalogów, takich jak `cgi-bin`.

Menu działa jako aplikacja statyczna, a podstrony używają adresów z `#`, więc
hosting nie wymaga dodatkowych reguł przekierowań. Zdjęcia dań znajdują się w
`public/`, a dane menu w `src/lib/menu.ts`. Koszyk zapisuje produkty w
przeglądarce i zachowuje je podczas przechodzenia między podstronami.

Podsumowanie testowe pokazuje produkty, opłatę za trasę samochodową (1,50 zł/km),
wybrany sposób płatności i realizacji. PayU oraz wysyłanie zamówień do lokalu
wymagają jeszcze konta sprzedawcy i backendu; do tego czasu strona nie wysyła
zamówień, nie pobiera płatności ani nie pokazuje przycisku finalizacji zakupu.
Przy odbiorze osobistym metodę płatności wybiera się na miejscu. Przy dostawie
gotówka jest dostępna do wartości produktów 150 zł; powyżej 150 zł wymagana
jest przedpłata, dlatego gotówka jest zablokowana. PayU nie jest jeszcze
uruchomione, więc takie zamówienia można jedynie sprawdzić w podglądzie.
