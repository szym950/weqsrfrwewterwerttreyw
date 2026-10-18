# Wake Up House

Statyczna strona menu Wake Up House. Po zbudowaniu działa z typowego hostingu
plików statycznych: nie wymaga Cloudflare, bazy danych ani serwera aplikacyjnego.
Podstrony są obsługiwane po stronie przeglądarki i używają adresów z `#`, więc
hosting nie potrzebuje reguł przekierowań.

## Uruchomienie lokalne

Wymagane: Node.js i npm.

```sh
npm install
npm run dev
```

## Publikacja na własnym serwerze

```sh
npm install
npm run build
```

Wgraj **całą zawartość katalogu `dist/`** do katalogu strony na swoim serwerze
WWW. `dist/index.html` jest punktem wejścia, a obok niego muszą znaleźć się
wygenerowane pliki z `assets/`, zdjęcia, ikony i dokumenty. Nie uruchamiaj
serwera Node — serwer WWW ma jedynie udostępniać te pliki. Domena
`http://wakeuphouse.pl` wskazuje na katalog z opublikowanymi plikami.

Zdjęcia dań znajdują się w `public/`, a dane menu w `src/lib/menu.ts`. Zmiany
opublikujesz ponownie po kolejnym `npm run build` i wgraniu nowej zawartości
`dist/`.

Koszyk jest lokalnym podglądem i nie składa zamówień ani nie pobiera płatności.
Sekcja najczęściej wybieranych dań używa statystyk zapisanych wyłącznie w
przeglądarce danego użytkownika.
