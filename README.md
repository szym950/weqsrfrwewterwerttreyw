# Wake Up House

Strona menu Wake Up House działa na zwykłym hostingu plików przez FTP.
Kategorie, produkty, zdjęcia i ceny są przechowywane w Supabase i po wdrożeniu
panelu nie wymagają ręcznej publikacji strony przy każdej zmianie.

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
hosting nie wymaga dodatkowych reguł przekierowań. `src/lib/menu.ts` zawiera
menu początkowe i awaryjne; po wdrożeniu migracji witryna pobiera aktualne dane
z Supabase Realtime. Koszyk zapisuje produkty w przeglądarce i odświeża ich
dane po zmianie menu.

Strona przekazuje zamówienia do Supabase Edge Function `create-order`. Serwer
pobiera aktualne produkty i ceny z bazy przy składaniu zamówienia, inicjuje
płatność PayU, a aplikacja Android odbiera zamówienia przez Supabase Realtime.
Płatności PayU działają tylko po wdrożeniu backendu i ustawieniu sekretów.
Zamówienia PayU trafiają do lokalu dopiero po poprawnej weryfikacji
powiadomienia z PayU. Dostawa powyżej 150 zł wymaga PayU; do tego progu klient
może zapłacić gotówką lub PayU. Przy odbiorze osobistym płatność jest na miejscu.

## Uruchomienie przyjmowania zamówień

1. Zaloguj się do Supabase CLI i połącz projekt (`supabase login`,
   `supabase link`).
2. Wypchnij migracje bazy i zaktualizuj funkcje:

   ```sh
   npx supabase db push --linked
   npx supabase functions deploy create-order
   npx supabase functions deploy payu-notify
   ```

   Migracja `20261023190000_live_menu.sql` przenosi początkowe pozycje do
   `menu_categories` i `menu_dishes` oraz konfiguruje publiczny bucket zdjęć.
   Migracja `20261024000000_staff_roles.sql` dodaje role i ograniczenia RLS.
   Funkcje korzystają z `SUPABASE_URL` i
   `SUPABASE_SERVICE_ROLE_KEY` dostępnych w środowisku Supabase. Nie umieszczaj
   klucza service role ani sekretów PayU w kodzie strony lub aplikacji.

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

## Panel menu w Windows 11

Po jednorazowym wdrożeniu najnowszej zawartości `dist/` przez FTP otwórz stronę
po bezpiecznym HTTPS w Google Chrome i przejdź do `/#/zarzadzanie-menu`.
Zaloguj się kontem, które ma wpis w `public.staff_members`. W Chrome wybierz „Zainstaluj Wake Up House”
z menu przeglądarki, aby dodać panel jako aplikację w Windows 11. Nie jest to
osobny instalator `.exe`; aktualizuje się razem ze stroną. Zmiany produktów,
kategorii, cen i zdjęć zapisują się od razu w Supabase i są widoczne na stronie
oraz w zamówieniach bez kolejnego wgrywania plików przez FTP.

Po zastosowaniu migracji `20261024000000_staff_roles.sql` konta pracowników
mają jedną z trzech ról: `administrator` (zamówienia i edycja menu),
`menu_editor` (tylko edycja menu) albo `orders` (tylko zamówienia). Nowe
rekordy w `staff_members` domyślnie otrzymują rolę `orders`; istniejące konta
zachowują dotychczasowy dostęp jako `administrator`. Role można przypisywać w
Supabase SQL Editorze, zmieniając kolumnę `role`. Uprawnienia sprawdza zarówno
interfejs, jak i RLS w bazie. Szczegóły i gotowe zapytania są w
[instrukcji dostępu pracowników](./android-app/README.md#dostęp-pracowników).
Po wdrożeniu migracji wgraj nową stronę przez FTP i zbuduj/instaluj aktualny
APK Androida, żeby w aplikacji pojawiła się obsługa ról. Sama baza blokuje
niedozwolony dostęp również w starszych wersjach aplikacji.

Szczegółowa instrukcja panelu zamówień: [android-app/README.md](./android-app/README.md).
Szczegółowa instrukcja testów PayU:
[PAYU-TEST-INSTRUKCJA.md](./PAYU-TEST-INSTRUKCJA.md).
Wycinek kopii projektu sprzed wdrożenia jest w
`backup/project-before-orders.tar.gz`; archiwum celowo pomija pliki `.env`,
zależności i buildy.

Panel menu: `/#/zarzadzanie-menu`. Ceny z przeglądarki nie są traktowane jako
wiarygodne — funkcja zamówień odczytuje je z bazy i sama wylicza kwoty.
