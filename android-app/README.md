# Wake Up House — aplikacja zamówień na Androida i iOS

Panel Expo/React Native działa na Androidzie oraz iPhonie i iPadzie. Odbiera
zamówienia z tego samego Supabase Realtime; dodanie iOS nie wymaga zmian w API
ani ponownego wgrywania strony na FTP. Dostęp wymaga konta pracownika
utworzonego ręcznie w Supabase Auth; aplikacja nie udostępnia publicznej
rejestracji. Klucz `service_role` ani klucze PayU nie mogą trafić do tej
aplikacji.

Ekran obsługuje orientację pionową i poziomą, zgodnie z ustawieniem
automatycznego obracania urządzenia. Filtry zamówień mają kompaktowy układ
zaokrąglonych przycisków-kart, aby zostawić więcej miejsca na listę. W poziomie
zamówienia przewija się na boki, a szczegóły pojedynczego zamówienia nie mają
osobnego przewijania. Po zalogowaniu Android pyta, czy ukryć pasek nawigacyjny;
można też pozostać przy standardowym widoku. Przycisk „Pulpit” wraca do ekranu
głównego telefonu.

## Uruchomienie

1. Skopiuj `.env.example` do `.env` i wpisz publiczny URL projektu Supabase oraz
   klucz `sb_publishable_...`. To jedyne wartości Supabase potrzebne aplikacji.
2. Z katalogu `android-app/` uruchom:

   ```sh
   npm install
   npm start
   ```

   Serwer uruchamia się przez tunel, więc iPhone może połączyć się z Expo Go
   również poza tą samą siecią Wi-Fi. Zeskanuj wyświetlony kod QR aparatem
   telefonu i otwórz link w Expo Go. Terminal z serwerem musi pozostać uruchomiony.

3. Do instalowanego APK potrzebne jest konto Expo:

   ```sh
   npm run build:android
   ```

   Ponieważ `.env` jest ignorowany przez Git, przed budową w chmurze dodaj te
   same dwie zmienne `EXPO_PUBLIC_SUPABASE_URL` i
   `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` w zmiennych środowiskowych projektu
   Expo EAS.

## iPhone i iPad

Kod aplikacji i połączenie z Supabase są wspólne z Androidem. Zbuduj wersję
iOS poleceniem:

```sh
npm run build:ios
```

Ten build jest potrzebny do dystrybucji osobnej aplikacji iOS. Do pracy
developerskiej na iPhonie użyj `npm start` i Expo Go — nie wymaga pobierania
ani instalowania osobnego buildu aplikacji.

Do instalacji na iPhonie/iPadzie i publikacji przez TestFlight lub App Store
potrzebne jest konto Apple Developer. EAS poprowadzi konfigurację certyfikatu
i profilu podpisu przy pierwszym buildzie. Zmienne Supabase
`EXPO_PUBLIC_SUPABASE_URL` i `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` muszą być
dodane także do środowiska projektu Expo EAS.

Wydanie aplikacji mobilnej jest niezależne od statycznej strony internetowej:
nie zmienia plików publikowanych przez FTP. Android i iOS korzystają z tego
samego backendu i kont pracowników.

## Dostęp pracowników

W Supabase Dashboard utwórz osobne konta e-mail/hasło w Authentication i
przypisz im rolę przez SQL Editor. Dostępne role:

- `administrator` — zamówienia i edycja menu;
- `menu_editor` — wyłącznie panel menu;
- `orders` — wyłącznie aplikacja zamówień.

Przykład przypisania nowego konta. Wklej UUID z Authentication i wybierz rolę:

```sql
insert into public.staff_members (user_id, role)
values ('UUID-UŻYTKOWNIKA-Z-SUPABASE-AUTH', 'orders');
```

Zamiast `orders` można wpisać `administrator` albo `menu_editor`. Zmiana
istniejącej roli:

```sql
update public.staff_members
set role = 'menu_editor'
where user_id = 'UUID-UŻYTKOWNIKA-Z-SUPABASE-AUTH';
```

Role sprawdza aplikacja, a dostęp do danych dodatkowo ogranicza RLS w bazie.
Nie włączaj publicznej rejestracji; role nadaje zaufany administrator w
Supabase SQL Editor. Nowe wpisy bez jawnie podanej roli otrzymują najmniejsze
uprawnienie, czyli `orders`. Migracja ról zachowuje obecny dostęp istniejących
pracowników, przypisując im `administrator`.

Odebranie dostępu do aplikacji i menu:

```sql
delete from public.staff_members
where user_id = 'UUID-UŻYTKOWNIKA-Z-SUPABASE-AUTH';
```

To nie usuwa konta Auth. Po zakończeniu współpracy usuń również konto osobno
w Supabase Authentication.

## Aktualizacje i stanowiska

Nowe zamówienia oraz zmiany statusów są pobierane przez WebSocket Supabase
Realtime; aplikacja odświeża listę także po powrocie na pierwszy plan. Aktualnie
menu zawiera dania kierowane do kuchni. Stanowisko barowe jest gotowe na pozycje
napojów, ale pojawią się tam dopiero po dodaniu ich do menu i katalogu funkcji
`create-order`. Realtime działa, gdy aplikacja ma połączenie z internetem;
Expo Go pokazuje lokalne alerty tylko wtedy, gdy aplikacja jest otwarta.
Powiadomienia push w tle i po zamknięciu aplikacji wymagają zainstalowanej
wersji aplikacji; Expo Go ich nie obsługuje.
Zapytania do Supabase mają limit 20 sekund, a równoczesne odświeżenia listy
zamówień są łączone, aby nie blokować ekranu podczas ponawiania pobierania.

## Powiadomienia push

Najpierw zastosuj migracje Supabase i wdroż obie funkcje wysyłające powiadomienia:

```sh
npx supabase db push
npx supabase functions deploy create-order
npx supabase functions deploy payu-notify
```

Push w tle wymaga fizycznego urządzenia, zgody pracownika na powiadomienia oraz
poświadczeń FCM/APNs skonfigurowanych w projekcie EAS. Następnie zbuduj i
zainstaluj natywną aplikację przez EAS. Expo Go nadal może pokazywać lokalne
powiadomienia o zamówieniach podczas otwartej sesji, ale nie rejestruje
zdalnych powiadomień push.

Aktywne zamówienia można filtrować według stanowiska (kuchnia/bar) i statusu.
Zakończone oraz anulowane zamówienia są dostępne w historii z Supabase. Historia
może być wyeksportowana jako skompresowany plik `.json.gz` przez systemowe menu
udostępniania; eksport zawiera dane zamówień i jest dostępny tylko po
zalogowaniu pracownika.
