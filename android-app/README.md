# Wake Up House — Android panel zamówień

Panel Expo/React Native odbiera zamówienia z Supabase Realtime. Dostęp wymaga
konta pracownika utworzonego ręcznie w Supabase Auth; aplikacja nie udostępnia
publicznej rejestracji. Klucz `service_role` ani klucze PayU nie mogą trafić do
tej aplikacji.

## Uruchomienie

1. Skopiuj `.env.example` do `.env` i wpisz publiczny URL projektu Supabase oraz
   klucz `sb_publishable_...`. To jedyne wartości Supabase potrzebne aplikacji.
2. Z katalogu `android-app/` uruchom:

   ```sh
   npm install
   npm start
   ```

3. Otwórz aplikację w Expo Go lub emulatorze Android. Do instalowanego APK
   potrzebne jest konto Expo:

   ```sh
   npx eas-cli build --platform android --profile preview
   ```

   Ponieważ `.env` jest ignorowany przez Git, przed budową w chmurze dodaj te
   same dwie zmienne `EXPO_PUBLIC_SUPABASE_URL` i
   `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` w zmiennych środowiskowych projektu
   Expo EAS.

## Dostęp pracowników

W Supabase Dashboard utwórz osobne konta e-mail/hasło dla pracowników w
Authentication, a następnie dodaj ich UUID do `public.staff_members` w SQL
Editorze:

```sql
insert into public.staff_members (user_id)
values ('UUID-UŻYTKOWNIKA-Z-SUPABASE-AUTH');
```

Samo zalogowanie nie daje dostępu do zamówień; RLS sprawdza członkostwo w tej
tabeli. Nie włączaj publicznej rejestracji. Przydzielaj dostęp wyłącznie
zaufanej obsłudze i usuń konto oraz wpis z `staff_members` po zakończeniu
współpracy.

## Aktualizacje i stanowiska

Nowe zamówienia oraz zmiany statusów są pobierane przez WebSocket Supabase
Realtime; aplikacja odświeża listę także po powrocie na pierwszy plan. Aktualnie
menu zawiera dania kierowane do kuchni. Stanowisko barowe jest gotowe na pozycje
napojów, ale pojawią się tam dopiero po dodaniu ich do menu i katalogu funkcji
`create-order`. Realtime działa, gdy aplikacja ma połączenie z internetem;
powiadomienia push przy zamkniętej aplikacji nie są jeszcze skonfigurowane.
