# Instrukcja PayU od zera — najpierw testy, bez prawdziwych pieniędzy

Ta instrukcja prowadzi przez uruchomienie **testowej** płatności PayU. Rób
kroki po kolei. Na początku użyj danych sandbox, nie produkcyjnych. Do
zakończenia płatności PayU potrzebuje prawdziwego, publicznego adresu HTTPS
Twojej strony i backendu Supabase. Sama strona wgrana przez FTP nie wystarczy
do przechowania sekretów — dlatego sekret PayU wpisujesz wyłącznie do Supabase.

## Co przygotowaliśmy

- Strona tworzy zamówienie przez Supabase Edge Function.
- Serwer sprawdza menu i ceny, tworzy płatność w PayU i przekazuje klienta na
  stronę płatności PayU.
- PayU wysyła potwierdzenie na adres funkcji `payu-notify`.
- Backend weryfikuje podpis **Drugim kluczem**, kwotę, walutę, POS ID oraz
  identyfikator zamówienia. Dopiero wtedy zamówienie pojawia się na Androidzie.
- Aplikacja Android odbiera zamówienia przez Supabase Realtime.
- Przy dostawie do 150 zł klient może wybrać gotówkę lub PayU. Powyżej 150 zł
  płatność PayU jest wymagana. Przy odbiorze osobistym płatność jest na miejscu.

**Nie wpisuj żadnego klucza PayU do strony, aplikacji Android, pliku `.env`
strony ani na czacie.** Tylko do lokalnego pliku `supabase/.env.payu`, którego
Git nie zapisuje, a następnie do Supabase Secrets.

## Część 1 — przygotuj testowe dane PayU

1. Zaloguj się do panelu PayU.
2. Upewnij się, że masz dane dla **środowiska testowego / sandbox**. Nie używaj
   prawdziwego produkcyjnego POS ID, client secret ani Drugiego klucza do testów.
3. Przygotuj cztery wartości z **tego samego testowego punktu POS**:
   - POS ID,
   - OAuth client ID,
   - OAuth client secret,
   - Drugi klucz (MD5).
4. Jeśli w Twoim panelu nie ma sandboxa, PayU publikuje oddzielne dane
   demonstracyjne w [dokumentacji testów PayU](https://developers.payu.com/europe/docs/testing/).
   Są to dane testowe, nie dane Twojego prawdziwego punktu POS.

PayU używa adresu `https://secure.snd.payu.com` dla sandboxa i
`https://secure.payu.com` dla produkcji. Nasza konfiguracja wybiera serwer
automatycznie na podstawie `PAYU_ENVIRONMENT`.

## Część 2 — wpisz dane do prywatnego pliku na komputerze

Otwórz projekt w VS Code i terminal w głównym folderze projektu — tam, gdzie
znajduje się `package.json`.

Skopiuj przykładowy plik:

- Windows PowerShell:

  ```powershell
  Copy-Item supabase/.env.payu.example supabase/.env.payu
  ```

- macOS / Linux / terminal VS Code:

  ```sh
  cp supabase/.env.payu.example supabase/.env.payu
  ```

W VS Code otwórz plik `supabase/.env.payu` i zamień przykładowe wartości:

```dotenv
PAYU_ENVIRONMENT=sandbox
PAYU_POS_ID=TU_WKLEJ_TESTOWY_POS_ID
PAYU_CLIENT_ID=TU_WKLEJ_TESTOWY_OAUTH_CLIENT_ID
PAYU_CLIENT_SECRET=TU_WKLEJ_TESTOWY_OAUTH_CLIENT_SECRET
PAYU_SECOND_KEY=TU_WKLEJ_TESTOWY_DRUGI_KLUCZ_MD5
SITE_URL=https://TU-WKLEJ-PUBLICZNY-ADRES-STRONY
```

Przykład adresu strony: `https://twoja-domena.pl` — bez ukośnika na końcu.
Adres musi już działać przez HTTPS. Nie wpisuj `localhost`, jeśli chcesz
przetestować powrót klienta i powiadomienie PayU.

**Ważne:** nie zmieniaj `PAYU_ENVIRONMENT=sandbox` podczas testów. Plik
`supabase/.env.payu` jest celowo wykluczony z Git.

## Część 3 — połącz terminal z projektem Supabase

W tym samym terminalu, nadal w folderze głównym projektu, wykonuj po kolei:

```sh
npx supabase login
```

Zaloguj się w oknie przeglądarki, które otworzy Supabase.

Następnie połącz repozytorium z projektem Supabase tej strony:

```sh
npx supabase link --project-ref rsfzhzzswrhtossxigsl
```

Jeżeli Supabase zapyta o hasło do bazy danych, wpisz hasło bazy z konfiguracji
projektu Supabase (nie client secret PayU).

### Zainstaluj tabele i reguły bezpieczeństwa

```sh
npx supabase db push
```

Jeśli pojawi się pytanie o wykonanie migracji, zatwierdź je. Ta komenda tworzy
tabele zamówień, statusy płatności i dostęp pracowników. Nie tworzy ani nie
zmienia produktów PayU.

### Wyślij poufne dane do Supabase

```sh
npx supabase secrets set --env-file supabase/.env.payu
```

To zapisuje cztery klucze PayU i `SITE_URL` po stronie Supabase. **Nie wysyła
tych kluczy do przeglądarki ani do aplikacji na telefonie.**

Opcjonalnie sprawdź, czy Supabase zna nazwy ustawień:

```sh
npx supabase secrets list
```

Polecenie powinno pokazać nazwy `PAYU_ENVIRONMENT`, `PAYU_POS_ID`,
`PAYU_CLIENT_ID`, `PAYU_CLIENT_SECRET`, `PAYU_SECOND_KEY` i `SITE_URL`.
Nie kopiuj ani nie publikuj żadnych wartości sekretów.

### Wgraj backend zamówień i odbioru potwierdzeń

```sh
npx supabase functions deploy create-order
npx supabase functions deploy payu-notify
```

Obie funkcje muszą być wdrożone. Funkcja `create-order` rozpoczyna płatność,
a `payu-notify` odbiera podpisane potwierdzenie od PayU.

**Nie musisz samodzielnie wpisywać adresu powiadomień do panelu PayU.** Strona
przekazuje PayU poprawny adres Supabase przy tworzeniu każdej płatności.

## Część 4 — przygotuj konta pracowników

1. W Supabase otwórz **Authentication → Users**.
2. Dodaj konto e-mail i hasło dla siebie / pracownika.
3. Skopiuj UUID (User UID) tego użytkownika.
4. Otwórz **SQL Editor → New query** i uruchom zapytanie, podstawiając UUID:

   ```sql
   insert into public.staff_members (user_id)
   values ('TU_WKLEJ_UUID_UZYTKOWNIKA');
   ```

Bez tego wpisu nawet prawidłowo zalogowana aplikacja nie pokaże zamówień.
Nie włączaj publicznej rejestracji pracowników.

## Część 5 — uruchom apkę na Androidzie

1. Ustaw w `android-app/.env` publiczny URL projektu Supabase i klucz
   `sb_publishable_...`. Możesz skopiować przykład:

   ```sh
   cp android-app/.env.example android-app/.env
   ```

   W PowerShell użyj:

   ```powershell
   Copy-Item android-app/.env.example android-app/.env
   ```

2. Wpisz do `android-app/.env`:

   ```dotenv
   EXPO_PUBLIC_SUPABASE_URL=https://rsfzhzzswrhtossxigsl.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=TU_WKLEJ_KLUCZ_SB_PUBLISHABLE
   ```

   To klucz publiczny Supabase, nie klucz `service_role`, nie `sb_secret_...`
   i nie żaden klucz PayU.

3. Otwórz drugi terminal w folderze `android-app`:

   ```sh
   npm install
   npm start
   ```

4. Na telefonie zainstaluj **Expo Go**, zeskanuj kod QR z terminala i zaloguj
   się kontem pracownika dodanym w poprzedniej części.

W celu przygotowania APK do zainstalowania niezależnie od Expo Go użyj Expo
EAS zgodnie z [instrukcją aplikacji Android](./android-app/README.md). Zmienne
`EXPO_PUBLIC_SUPABASE_URL` i `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` trzeba
dodać także do ustawień projektu Expo EAS przed budową APK.

## Część 6 — opublikuj nową wersję strony

Płatność zadziała na stronie publicznej dopiero po wgraniu nowego builda.

1. Wróć terminalem do głównego folderu repozytorium.
2. Upewnij się, że lokalny `.env` strony ma prawidłowe:
   `VITE_SUPABASE_URL` i `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Zbuduj nową stronę:

   ```sh
   npm install
   npm run build
   ```

4. Wgraj **zawartość nowego folderu `dist/`** na hosting FTP, tak jak zwykle
   publikujesz stronę.

Adres publicznej strony musi być taki sam jak wartość `SITE_URL` zapisana w
Supabase Secrets. Nie wgrywaj na hosting pliku `supabase/.env.payu`.

## Część 7 — wykonaj płatność testową

1. Otwórz opublikowaną stronę menu.
2. Dodaj do koszyka produkty. Żeby przetestować wymaganą przedpłatę, wybierz
   produkty o łącznej cenie **powyżej 150 zł**.
3. Wybierz **Dostawa**, wpisz prawdziwy testowy adres z obszaru dostaw i wybierz
   dokładną podpowiedź adresu.
4. Wpisz imię, telefon i e-mail. E-mail jest wymagany dla PayU.
5. Wybierz **PayU online** i przejdź do podsumowania.
6. Sprawdź kwotę. Kliknij **Zamawiam z obowiązkiem zapłaty — PayU**.
7. Powinna otworzyć się testowa strona PayU z kwotą w PLN. Dokończ testową
   płatność metodą podaną w [oficjalnej instrukcji testów PayU](https://developers.payu.com/europe/docs/testing/).
   Używaj wyłącznie testowej metody płatności PayU — nie wpisuj prawdziwej karty.
8. Po powrocie na stronę zobaczysz informację, że serwis czeka na potwierdzenie.
   Sam powrót z PayU **nie jest potwierdzeniem zapłaty**.
9. Po chwili zamówienie powinno pojawić się w aplikacji Android ze statusem
   „Nowe” i informacją „Opłacono przez PayU”. Odśwież widok, jeśli aplikacja
   była w tle.

Możesz też przetestować zamówienie dostawy poniżej 150 zł, wybierając
**Gotówka przy dostawie**. Powinno pojawić się w aplikacji natychmiast, bez
przekierowania do PayU. Przy odbiorze osobistym zamówienie również trafia
bezpośrednio do lokalu, a płatność jest na miejscu.

## Jeśli coś nie działa

### Strona pokazuje „PayU nie jest jeszcze skonfigurowane”

- Sprawdź, czy nie ma literówki w nazwach sekretów w `supabase/.env.payu`.
- Uruchom ponownie:

  ```sh
  npx supabase secrets set --env-file supabase/.env.payu
  ```

### PayU nie otwiera strony płatności

- Upewnij się, że używasz czterech danych sandbox z **tego samego** POS.
- Sprawdź, czy `PAYU_ENVIRONMENT=sandbox`.
- W Supabase otwórz **Edge Functions → create-order → Logs**. Sprawdź log z
  chwili próby.
- Nie wysyłaj w logach ani na czacie `client_secret`, `second key` ani tokenu
  OAuth.

### Płatność się udała, ale zamówienia nie ma na telefonie

- W Supabase sprawdź, czy wdrożona jest funkcja `payu-notify`.
- Sprawdź **Edge Functions → payu-notify → Logs**.
- Sprawdź, czy `PAYU_SECOND_KEY` jest z tego samego sandbox POS co pozostałe
  dane.
- Sprawdź w SQL Editorze:

  ```sql
  select order_number, status, payment_method, payment_status, total, created_at
  from public.orders
  order by created_at desc
  limit 10;
  ```

  Przy opłaconym zamówieniu `payment_status` powinien wynosić `paid`, a `status`
  `new`.

- W panelu pracownika upewnij się, że logujesz się użytkownikiem wpisanym do
  `public.staff_members`.

### Adres powrotu / callback

- `SITE_URL` musi być publiczną domeną `https://...`, bez końcowego ukośnika.
- PayU dostaje callback jako `https://<PROJECT-REF>.supabase.co/functions/v1/payu-notify`.
- W menu PayU nie trzeba konfigurować lokalnego adresu `localhost`.

## Kiedy przejść na prawdziwe płatności

Zrób to dopiero po poprawnym teście sandbox i po akceptacji integracji przez
PayU:

1. Utwórz **oddzielną prywatną kopię** `supabase/.env.payu` z produkcyjnymi
   danymi POS. Nie zastępuj nią testowych danych bez zapisania ich sobie
   w bezpiecznym miejscu.
2. Ustaw `PAYU_ENVIRONMENT=production`, produkcyjny POS ID, client ID,
   client secret i Drugi klucz.
3. Zostaw `SITE_URL` jako prawdziwą domenę sklepu z HTTPS.
4. Wgraj sekrety do Supabase:

   ```sh
   npx supabase secrets set --env-file supabase/.env.payu
   ```

5. Wykonaj jeszcze jeden mały test na prawdziwej płatności, dopiero gdy
   rozumiesz, że obciąży on prawdziwe konto klienta. Nie testuj kartą klienta
   bez jego zgody.

W razie wątpliwości **zostaw `PAYU_ENVIRONMENT=sandbox`**.

## Oficjalne materiały

- [PayU — podstawowy przepływ płatności](https://developers.payu.com/europe/docs/payment-flows/)
- [PayU — autoryzacja OAuth i tworzenie zamówienia](https://developers.payu.com/europe/docs/payment-flows/auth-and-order/)
- [PayU — powiadomienia i weryfikacja podpisu Drugim kluczem](https://developers.payu.com/europe/docs/payment-flows/lifecycle/)
- [PayU — testy sandbox](https://developers.payu.com/europe/docs/testing/)
- [Supabase — zarządzanie sekretami Edge Functions](https://supabase.com/docs/guides/functions/secrets)
