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

Strona przekazuje zamówienia do Supabase Edge Function `create-order`. Serwer
ponownie sprawdza katalog i ceny, inicjuje płatność PayU, a aplikacja Android
odbiera zamówienia przez Supabase Realtime. Płatności PayU działają tylko po
wdrożeniu backendu i ustawieniu sekretów. Zamówienia PayU trafiają do lokalu
dopiero po poprawnej weryfikacji powiadomienia z PayU. Dostawa powyżej 150 zł
wymaga PayU; do tego progu klient może zapłacić gotówką lub PayU. Przy odbiorze
osobistym płatność jest na miejscu.

## Uruchomienie przyjmowania zamówień

1. Zaloguj się do Supabase CLI i połącz projekt (`supabase login`,
   `supabase link`).
2. Wypchnij migrację bazy i Edge Function:

   ```sh
   supabase db push
   supabase functions deploy create-order
   ```

   Funkcja korzysta z `SUPABASE_URL` i `SUPABASE_SERVICE_ROLE_KEY` dostępnych
   w środowisku Supabase. Nie umieszczaj klucza service role ani sekretów PayU
   w kodzie strony lub aplikacji.

3. Utwórz osobne konta pracowników w Supabase Authentication; nie włączaj
   publicznej rejestracji.
4. Dodaj UUID pracowników do `public.staff_members` w SQL Editorze. RLS nie
   udostępnia zamówień samym zalogowanym użytkownikom.
5. Skonfiguruj zmienne `EXPO_PUBLIC_SUPABASE_URL` i
   `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` zgodnie z
   [instrukcją aplikacji Android](./android-app/README.md). Następnie uruchom
   panel z `android-app/` albo zbuduj APK przez Expo EAS.
6. Wykonaj kroki konfiguracji sandbox z
   [instrukcji PayU krok po kroku](./PAYU-TEST-INSTRUKCJA.md). Najpierw wdróż
   funkcje PayU, dodaj sekrety w Supabase i dopiero potem publikuj nowy build
   strony.

Szczegółowa instrukcja panelu: [android-app/README.md](./android-app/README.md).
Szczegółowa instrukcja testów PayU:
[PAYU-TEST-INSTRUKCJA.md](./PAYU-TEST-INSTRUKCJA.md).
Wycinek kopii projektu sprzed wdrożenia jest w
`backup/project-before-orders.tar.gz`; archiwum celowo pomija pliki `.env`,
zależności i buildy.

Przy zmianie cen menu zaktualizuj również katalog serwerowy w
`supabase/functions/_shared/menu.ts`; ceny z przeglądarki nie są traktowane
jako wiarygodne. Test katalogu sprawdza zgodność obu list.
