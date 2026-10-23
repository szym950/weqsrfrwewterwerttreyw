import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  AppState,
  BackHandler,
  Platform,
  ScrollView,
  Linking,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import type { ReactNode } from "react";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as NavigationBar from "expo-navigation-bar";
import { supabase, supabaseConfigured } from "./src/lib/supabase";
import { loadOrderHistory, shareCompressedOrderHistory } from "./src/lib/order-archive";
import type { OrderRow, OrderStatus, Station } from "./src/types";
import { canAccessOrders, isStaffRole, type StaffRole } from "../src/lib/staff-roles";

type StationFilter = "all" | Station;
type ActiveStatusFilter = "all" | "new" | "in_progress" | "ready";
type HistoryStatusFilter = "all" | "completed" | "cancelled";

const activeOrdersPageSize = 500;
const sessionLoadTimeoutMs = 15_000;

const stationLabels: Record<StationFilter, string> = {
  all: "Wszystkie",
  kitchen: "Kuchnia",
  bar: "Bar",
};

const statusLabels: Record<OrderStatus, string> = {
  new: "Nowe",
  accepted: "Przyjęte",
  preparing: "W przygotowaniu",
  ready: "Gotowe",
  completed: "Zakończone",
  cancelled: "Anulowane",
};

const activeStatusFilters: { key: ActiveStatusFilter; label: string }[] = [
  { key: "all", label: "Wszystkie" },
  { key: "new", label: "Nowe" },
  { key: "in_progress", label: "W trakcie" },
  { key: "ready", label: "Gotowe" },
];

const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  new: "accepted",
  accepted: "preparing",
  preparing: "ready",
  ready: "completed",
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Nie udało się wykonać operacji.";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function App() {
  const [sessionLoading, setSessionLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signInBusy, setSignInBusy] = useState(false);
  const [signInError, setSignInError] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [staffRole, setStaffRole] = useState<StaffRole | null>(null);
  const [staffRoleLoading, setStaffRoleLoading] = useState(true);
  const [staffRoleError, setStaffRoleError] = useState("");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [station, setStation] = useState<StationFilter>("all");
  const [statusFilter, setStatusFilter] = useState<ActiveStatusFilter>("all");
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<OrderRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<HistoryStatusFilter>("all");
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [connection, setConnection] = useState<"connecting" | "live" | "offline">("connecting");
  const [ordersError, setOrdersError] = useState("");
  const [notificationNotice, setNotificationNotice] = useState("");
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [fullscreenEnabled, setFullscreenEnabled] = useState(false);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const hasOrderAccess = canAccessOrders(staffRole);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const visibility = userEmail && hasOrderAccess && fullscreenEnabled ? "hidden" : "visible";
    void NavigationBar.setVisibilityAsync(visibility).catch((error: unknown) => {
      console.error("Nie udało się zmienić widoczności paska nawigacyjnego Androida.", error);
      if (visibility === "hidden") {
        setFullscreenEnabled(false);
        Alert.alert(
          "Nie udało się włączyć pełnego ekranu",
          "Pasek nawigacyjny pozostanie widoczny.",
        );
      }
    });
  }, [fullscreenEnabled, hasOrderAccess, userEmail]);

  useEffect(() => {
    if (Platform.OS !== "android" || !hasOrderAccess) return;
    if (!userEmail) {
      setFullscreenEnabled(false);
      return;
    }

    const promptTimeout = setTimeout(() => {
      Alert.alert(
        "Tryb pełnoekranowy",
        "Czy włączyć tryb pełnoekranowy? Ukryje paski systemowe i zostawi więcej miejsca na zamówienia.",
        [
          { text: "Nie teraz", style: "cancel", onPress: () => setFullscreenEnabled(false) },
          { text: "Włącz", onPress: () => setFullscreenEnabled(true) },
        ],
        { cancelable: false },
      );
    }, 300);

    return () => clearTimeout(promptTimeout);
  }, [hasOrderAccess, userEmail]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void supabase.auth.startAutoRefresh();
      else void supabase.auth.stopAutoRefresh();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!userEmail || !hasOrderAccess) return;

    let active = true;
    const registerNotifications = async () => {
      try {
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("orders", {
            name: "Nowe zamówienia",
            importance: Notifications.AndroidImportance.MAX,
            sound: "default",
          });
        }

        let permission = await Notifications.getPermissionsAsync();
        if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
        if (!active) return;
        if (!permission.granted) {
          setNotificationNotice("Powiadomienia są wyłączone. Włącz je w ustawieniach telefonu.");
          return;
        }

        if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
          setNotificationNotice(
            "Expo Go pokazuje alerty tylko przy otwartej aplikacji. Powiadomienia w tle wymagają zainstalowanej wersji aplikacji.",
          );
          return;
        }

        if (!Device.isDevice) {
          setNotificationNotice("Powiadomienia push wymagają fizycznego urządzenia.");
          return;
        }

        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        if (!projectId) throw new Error("Brak identyfikatora projektu Expo.");

        const token = await Notifications.getExpoPushTokenAsync({ projectId });
        const { data, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!data.user || !active) return;

        const { error } = await supabase.from("staff_push_tokens").upsert(
          {
            expo_push_token: token.data,
            user_id: data.user.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "expo_push_token" },
        );
        if (error) throw error;
        if (active) {
          setPushToken(token.data);
          setNotificationNotice("");
        }
      } catch (error) {
        console.error("Nie udało się włączyć powiadomień push.", error);
        if (active) {
          setNotificationNotice(
            "Nie udało się włączyć powiadomień push. Sprawdź konfigurację uprawnień i EAS.",
          );
        }
      }
    };

    void registerNotifications();
    return () => {
      active = false;
    };
  }, [hasOrderAccess, userEmail]);

  useEffect(() => {
    if (!supabaseConfigured) {
      setSessionLoading(false);
      return;
    }

    let active = true;
    const sessionTimeout = setTimeout(() => {
      if (!active) return;
      setSignInError("Sprawdzenie zapisanej sesji trwa zbyt długo. Możesz zalogować się ponownie.");
      setSessionLoading(false);
    }, sessionLoadTimeoutMs);

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        if (active) {
          setUserEmail(data.session?.user.email ?? null);
          setStaffRoleLoading(Boolean(data.session?.user.email));
          setSignInError("");
        }
      })
      .catch((error: unknown) => {
        console.error("Nie udało się odczytać sesji pracownika.", error);
        if (active) setSignInError("Nie udało się sprawdzić logowania. Spróbuj ponownie.");
      })
      .finally(() => {
        clearTimeout(sessionTimeout);
        if (active) setSessionLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? null);
      setStaffRole(null);
      setStaffRoleLoading(Boolean(session?.user.email));
      setStaffRoleError("");
      setSignInError("");
    });

    return () => {
      active = false;
      clearTimeout(sessionTimeout);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userEmail) {
      setStaffRole(null);
      setStaffRoleLoading(false);
      setStaffRoleError("");
      return;
    }

    let active = true;
    setStaffRole(null);
    setStaffRoleLoading(true);
    setStaffRoleError("");
    void (async () => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error("Nie znaleziono zalogowanego pracownika.");
      const { data, error } = await supabase
        .from("staff_members")
        .select("role")
        .eq("user_id", authData.user.id)
        .maybeSingle();
      if (error) throw error;
      if (active) {
        setStaffRole(data && isStaffRole(data.role) ? data.role : null);
      }
    })()
      .catch((error: unknown) => {
        console.error("Nie udało się sprawdzić uprawnień pracownika.", error);
        if (active) setStaffRoleError("Nie udało się sprawdzić uprawnień. Sprawdź połączenie.");
      })
      .finally(() => {
        if (active) setStaffRoleLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userEmail]);

  useEffect(() => {
    if (!userEmail || !hasOrderAccess) {
      setOrders([]);
      setHistory([]);
      setHistoryLoaded(false);
      setConnection("connecting");
      return;
    }

    let active = true;
    let refreshingOrders = false;
    let refreshRequested = false;
    const refreshOrders = async () => {
      if (refreshingOrders) {
        refreshRequested = true;
        return;
      }

      refreshingOrders = true;
      do {
        refreshRequested = false;
        try {
          const activeOrders: OrderRow[] = [];
          for (let offset = 0; ; offset += activeOrdersPageSize) {
            const { data, error } = await supabase
              .from("orders")
              .select("*, order_items(*)")
              .in("status", ["new", "accepted", "preparing", "ready"])
              .order("created_at", { ascending: true })
              .order("order_number", { ascending: true })
              .range(offset, offset + activeOrdersPageSize - 1);

            if (!active) return;
            if (error) throw error;
            const page = (data ?? []) as OrderRow[];
            activeOrders.push(...page);
            if (page.length < activeOrdersPageSize) break;
          }

          if (!active) return;
          setOrdersError("");
          setOrders(activeOrders);
        } catch (error) {
          console.error("Nie udało się pobrać zamówień.", error);
          if (active) {
            setOrdersError(
              error instanceof Error && error.name === "AbortError"
                ? "Ładowanie zamówień trwa zbyt długo. Sprawdź połączenie i spróbuj ponownie."
                : "Nie udało się pobrać zamówień. Sprawdź połączenie i uprawnienia.",
            );
          }
        }
      } while (active && refreshRequested);
      refreshingOrders = false;
    };

    const channel = supabase
      .channel("kitchen-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        const newOrder = payload.new as { order_number?: unknown; status?: unknown };
        const previousOrder = payload.old as { status?: unknown };
        const isNewOrder =
          (payload.eventType === "INSERT" && newOrder.status === "new") ||
          (payload.eventType === "UPDATE" &&
            previousOrder.status === "awaiting_payment" &&
            newOrder.status === "new");

        if (
          isNewOrder &&
          Constants.executionEnvironment === ExecutionEnvironment.StoreClient &&
          AppState.currentState === "active"
        ) {
          void Notifications.scheduleNotificationAsync({
            content: {
              title: "Nowe zamówienie",
              body:
                typeof newOrder.order_number === "number"
                  ? `Zamówienie #${newOrder.order_number} czeka na przyjęcie.`
                  : "Do panelu wpłynęło nowe zamówienie.",
              sound: "default",
            },
            trigger: null,
          }).catch((error: unknown) => {
            console.error("Nie udało się pokazać powiadomienia o zamówieniu.", error);
          });
        }

        void refreshOrders();
      })
      .subscribe((status) => {
        if (!active) return;
        setConnection(status === "SUBSCRIBED" ? "live" : "offline");
        if (status === "SUBSCRIBED") void refreshOrders();
      });

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshOrders();
    });

    void refreshOrders();
    return () => {
      active = false;
      appStateSubscription.remove();
      void supabase.removeChannel(channel);
    };
  }, [hasOrderAccess, userEmail]);

  const visibleOrders = useMemo(
    () =>
      filterByStation(orders, station).filter((order) => {
        if (statusFilter === "new") return order.status === "new";
        if (statusFilter === "in_progress") {
          return order.status === "accepted" || order.status === "preparing";
        }
        return statusFilter === "all" || order.status === "ready";
      }),
    [orders, station, statusFilter],
  );

  const visibleHistory = useMemo(
    () =>
      filterByStation(history, station).filter(
        (order) => historyStatusFilter === "all" || order.status === historyStatusFilter,
      ),
    [history, historyStatusFilter, station],
  );

  useEffect(() => {
    if (!showHistory || !userEmail || !hasOrderAccess) return;

    let active = true;
    setHistoryLoading(true);
    void loadOrderHistory()
      .then((data) => {
        if (active) {
          setHistory(data);
          setHistoryLoaded(true);
        }
      })
      .catch((error: unknown) => {
        console.error("Nie udało się pobrać historii zamówień.", error);
        if (active) {
          setOrdersError(
            error instanceof Error && error.name === "AbortError"
              ? "Ładowanie historii trwa zbyt długo. Sprawdź połączenie i spróbuj ponownie."
              : "Nie udało się pobrać historii. Sprawdź połączenie i uprawnienia.",
          );
        }
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });

    return () => {
      active = false;
    };
  }, [hasOrderAccess, showHistory, userEmail]);

  const signIn = async () => {
    setSignInError("");
    setSignInBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) setSignInError("Nie udało się zalogować. Sprawdź e-mail i hasło pracownika.");
    } catch (error) {
      console.error("Nie udało się połączyć podczas logowania.", error);
      setSignInError("Brak połączenia podczas logowania. Spróbuj ponownie.");
    } finally {
      setSignInBusy(false);
    }
  };

  const updateStatus = async (order: OrderRow, status: OrderStatus) => {
    setOrdersError("");
    setBusyOrderId(order.id);
    try {
      const { error } = await supabase.from("orders").update({ status }).eq("id", order.id);
      if (error) throw error;
      setOrders((current) =>
        current.filter(
          (item) => item.id !== order.id || (status !== "completed" && status !== "cancelled"),
        ),
      );
      if ((status === "completed" || status === "cancelled") && historyLoaded) {
        setHistory((current) => [{ ...order, status }, ...current]);
      }
    } catch (error) {
      console.error("Nie udało się zmienić statusu zamówienia.", error);
      setOrdersError("Nie udało się zapisać statusu. Spróbuj ponownie.");
    } finally {
      setBusyOrderId(null);
    }
  };

  const confirmCancelOrder = (order: OrderRow) => {
    Alert.alert(
      "Anulować zamówienie?",
      `Czy na pewno chcesz anulować zamówienie #${order.order_number}?`,
      [
        { text: "Nie", style: "cancel" },
        {
          text: "Tak, anuluj",
          style: "destructive",
          onPress: () => void updateStatus(order, "cancelled"),
        },
      ],
    );
  };

  const exportHistory = async () => {
    setArchiveBusy(true);
    setOrdersError("");
    try {
      const fullHistory = await loadOrderHistory();
      setHistory(fullHistory);
      setHistoryLoaded(true);
      await shareCompressedOrderHistory(fullHistory);
    } catch (error) {
      console.error("Nie udało się utworzyć eksportu historii zamówień.", error);
      setOrdersError(
        error instanceof Error ? error.message : "Nie udało się utworzyć kopii historii zamówień.",
      );
    } finally {
      setArchiveBusy(false);
    }
  };

  const signOut = async () => {
    try {
      if (pushToken) {
        const { error: pushTokenError } = await supabase
          .from("staff_push_tokens")
          .delete()
          .eq("expo_push_token", pushToken);
        if (pushTokenError) throw pushTokenError;
        setPushToken(null);
      }
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setOrdersError("");
    } catch (error) {
      console.error("Nie udało się wylogować pracownika.", error);
      setOrdersError("Nie udało się bezpiecznie wylogować. Spróbuj ponownie.");
    }
  };

  const callCustomer = async (phone: string) => {
    try {
      await Linking.openURL(`tel:${phone}`);
    } catch (error) {
      console.error("Nie udało się otworzyć aplikacji telefonu.", error);
      setOrdersError("Nie udało się otworzyć aplikacji telefonu na tym urządzeniu.");
    }
  };

  if (!supabaseConfigured) {
    return (
      <Screen fullscreen={fullscreenEnabled}>
        <Brand />
        <View style={styles.messageCard}>
          <Text style={styles.cardTitle}>Brak konfiguracji połączenia</Text>
          <Text style={styles.bodyText}>
            Dodaj adres Supabase i klucz publiczny do pliku android-app/.env. Nie wpisuj tutaj
            klucza service_role ani danych PayU.
          </Text>
        </View>
      </Screen>
    );
  }

  if (sessionLoading) {
    return (
      <Screen fullscreen={fullscreenEnabled}>
        <ActivityIndicator color={colors.accent} size="large" />
      </Screen>
    );
  }

  if (!userEmail) {
    return (
      <Screen fullscreen={fullscreenEnabled}>
        <Brand />
        <View style={styles.loginCard}>
          <Text style={styles.cardTitle}>Panel pracownika</Text>
          <Text style={styles.bodyText}>
            Zaloguj się kontem utworzonym przez właściciela lokalu.
          </Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="E-mail"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={email}
          />
          <TextInput
            autoCapitalize="none"
            onChangeText={setPassword}
            onSubmitEditing={() => void signIn()}
            placeholder="Hasło"
            placeholderTextColor={colors.muted}
            secureTextEntry
            style={styles.input}
            value={password}
          />
          {signInError ? <Text style={styles.errorText}>{signInError}</Text> : null}
          <ActionButton
            disabled={signInBusy || !email.trim() || !password}
            label={signInBusy ? "Logowanie…" : "Zaloguj się"}
            onPress={() => void signIn()}
          />
        </View>
      </Screen>
    );
  }

  if (staffRoleLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} size="large" />
      </Screen>
    );
  }

  if (!hasOrderAccess) {
    return (
      <Screen>
        <Brand />
        <View style={styles.messageCard}>
          <Text style={styles.cardTitle}>Brak dostępu do zamówień</Text>
          <Text style={styles.bodyText}>
            {staffRole === "menu_editor"
              ? "To konto ma uprawnienia do edycji menu, ale nie do obsługi zamówień."
              : "To konto nie ma przypisanych uprawnień do zamówień."}
          </Text>
          {staffRoleError ? <Text style={styles.errorText}>{staffRoleError}</Text> : null}
          <ActionButton disabled={false} label="Wyloguj" onPress={() => void signOut()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen fullscreen={fullscreenEnabled}>
      <View style={[styles.header, isLandscape && styles.headerLandscape]}>
        <View>
          <Text style={styles.eyebrow}>WAKE UP HOUSE</Text>
          <Text style={[styles.title, isLandscape && styles.landscapeTitle]}>
            {showHistory ? "Historia" : "Zamówienia"}
          </Text>
        </View>
        <View style={[styles.headerActions, isLandscape && styles.landscapeHeaderActions]}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setOrdersError("");
              setShowHistory((current) => !current);
            }}
            style={[styles.headerButton, isLandscape && styles.landscapeHeaderButton]}
          >
            <Text
              style={[styles.headerButtonText, isLandscape && styles.landscapeHeaderButtonText]}
            >
              {showHistory ? "Aktywne" : "Historia"}
            </Text>
          </Pressable>
          {Platform.OS === "android" ? (
            <Pressable
              accessibilityLabel="Wróć do ekranu głównego telefonu"
              accessibilityRole="button"
              onPress={() => BackHandler.exitApp()}
              style={[styles.homeButton, isLandscape && styles.landscapeHeaderButton]}
            >
              <Text
                style={[styles.homeButtonText, isLandscape && styles.landscapeHeaderButtonText]}
              >
                Pulpit
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => void signOut()}
            style={[styles.signOut, isLandscape && styles.landscapeSignOut]}
          >
            <Text style={[styles.signOutText, isLandscape && styles.landscapeSignOutText]}>
              Wyloguj
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.connectionRow, isLandscape && styles.landscapeConnectionRow]}>
        <View style={[styles.connectionDot, connection === "live" && styles.connectionLive]} />
        <Text style={styles.connectionText}>
          {connection === "live"
            ? "Na żywo · Supabase Realtime"
            : connection === "connecting"
              ? "Łączenie z zamówieniami…"
              : "Brak połączenia na żywo"}
        </Text>
        <Text style={styles.userLabel}>{userEmail}</Text>
      </View>
      {notificationNotice ? (
        <Text accessibilityRole="text" style={styles.notificationNotice}>
          {notificationNotice}
        </Text>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.filters, isLandscape && styles.landscapeFilters]}
      >
        {(Object.keys(stationLabels) as StationFilter[]).map((key) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: station === key }}
            key={key}
            onPress={() => setStation(key)}
            style={[
              styles.filter,
              isLandscape && styles.landscapeFilter,
              station === key && styles.filterSelected,
            ]}
          >
            <Text style={[styles.filterText, station === key && styles.filterTextSelected]}>
              {stationLabels[key]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {ordersError ? (
        <Text style={[styles.errorBanner, isLandscape && styles.landscapeErrorBanner]}>
          {ordersError}
        </Text>
      ) : null}
      {showHistory ? (
        <>
          <View style={[styles.historyToolbar, isLandscape && styles.landscapeHistoryToolbar]}>
            <Text style={styles.historyCount}>{history.length} zamówień w historii</Text>
            <Pressable
              accessibilityRole="button"
              disabled={archiveBusy || historyLoading}
              onPress={() => void exportHistory()}
              style={[
                styles.exportButton,
                isLandscape && styles.landscapeExportButton,
                (archiveBusy || historyLoading) && styles.actionButtonDisabled,
              ]}
            >
              <Text style={styles.exportButtonText}>
                {archiveBusy ? "Przygotowuję…" : "Eksport .gz"}
              </Text>
            </Pressable>
          </View>
          <View style={[styles.statusFilters, isLandscape && styles.landscapeStatusFilters]}>
            {(
              [
                ["all", "Wszystkie"],
                ["completed", "Zakończone"],
                ["cancelled", "Anulowane"],
              ] as const
            ).map(([key, label]) => (
              <FilterChip
                compact={isLandscape}
                key={key}
                label={label}
                onPress={() => setHistoryStatusFilter(key)}
                selected={historyStatusFilter === key}
              />
            ))}
          </View>
        </>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.statusFilters,
            isLandscape && styles.landscapeStatusFilters,
          ]}
        >
          {activeStatusFilters.map(({ key, label }) => (
            <FilterChip
              compact={isLandscape}
              key={key}
              label={`${label}${key === "all" ? ` (${filterByStation(orders, station).length})` : ` (${filterByStation(orders, station).filter((order) => matchesActiveStatus(order.status, key)).length})`}`}
              onPress={() => setStatusFilter(key)}
              selected={statusFilter === key}
            />
          ))}
        </ScrollView>
      )}
      {!showHistory &&
      station === "bar" &&
      orders.every((order) => !order.order_items.some((item) => item.station === "bar")) ? (
        <Text style={[styles.emptyStationNote, isLandscape && styles.landscapeEmptyStationNote]}>
          W obecnym menu nie ma jeszcze pozycji przypisanych do baru.
        </Text>
      ) : null}

      <ScrollView
        style={styles.ordersScroll}
        horizontal={isLandscape}
        nestedScrollEnabled={isLandscape}
        showsHorizontalScrollIndicator={isLandscape}
        contentContainerStyle={[styles.orderList, isLandscape && styles.orderListLandscape]}
      >
        {showHistory && historyLoading ? (
          <ActivityIndicator color={colors.accent} size="large" />
        ) : (showHistory ? visibleHistory : visibleOrders).length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              {showHistory ? "Brak zamówień w historii" : "Brak zamówień w tej kolejce"}
            </Text>
            <Text style={styles.bodyText}>
              {showHistory
                ? "Zakończone i anulowane zamówienia pojawią się tutaj."
                : "Zmień filtr statusu lub poczekaj na nowe zamówienie."}
            </Text>
          </View>
        ) : (
          (showHistory ? visibleHistory : visibleOrders).map((order) => {
            const orderItems =
              station === "all"
                ? order.order_items
                : order.order_items.filter((item) => item.station === station);
            const next = showHistory ? undefined : nextStatus[order.status];
            const busy = busyOrderId === order.id;
            const orderStations =
              station === "all"
                ? [...new Set(order.order_items.map((item) => item.station))]
                : [station];

            return (
              <View
                key={order.id}
                style={[
                  styles.orderCard,
                  isLandscape && styles.orderCardLandscape,
                  isLandscape && { width: Math.min(width * 0.92, 800) },
                ]}
              >
                <View
                  style={[styles.orderCardContent, isLandscape && styles.landscapeOrderContent]}
                >
                  <View style={styles.orderHeader}>
                    <View>
                      <Text
                        style={[styles.orderNumber, isLandscape && styles.landscapeOrderNumber]}
                      >
                        #{order.order_number}
                      </Text>
                      <Text style={styles.timeText}>{formatOrderTime(order.created_at)}</Text>
                    </View>
                    <View
                      accessible
                      accessibilityLabel={`Stanowisko ${orderStations.map((item) => stationLabels[item]).join(" i ")}. Status ${statusLabels[order.status]}.`}
                      style={styles.orderHeaderBadges}
                    >
                      {orderStations.map((item) => (
                        <Text
                          key={item}
                          style={[
                            styles.stationBadge,
                            isLandscape && styles.landscapeStationBadge,
                            item === "bar" && styles.barBadge,
                          ]}
                        >
                          {stationLabels[item].toLocaleUpperCase("pl-PL")}
                        </Text>
                      ))}
                      <Text
                        style={[
                          styles.statusBadge,
                          isLandscape && styles.landscapeStatusBadge,
                          styles[`status_${order.status}`],
                        ]}
                      >
                        {displayStatus(order.status)}
                      </Text>
                    </View>
                  </View>

                  <View style={isLandscape && styles.landscapeOrderDetails}>
                    <View
                      style={[styles.customerBlock, isLandscape && styles.landscapeCustomerBlock]}
                    >
                      <Text
                        style={[styles.customerName, isLandscape && styles.landscapeCustomerName]}
                      >
                        {order.customer_name}
                      </Text>
                      <Pressable onPress={() => void callCustomer(order.customer_phone)}>
                        <Text style={[styles.phoneText, isLandscape && styles.landscapePhone]}>
                          {order.customer_phone}
                        </Text>
                      </Pressable>
                      <Text
                        style={[styles.deliveryText, isLandscape && styles.landscapeDeliveryText]}
                      >
                        {order.fulfillment === "delivery" ? "DOSTAWA" : "ODBIÓR OSOBISTY"}
                      </Text>
                      {order.delivery_address ? (
                        <Text
                          style={[styles.addressText, isLandscape && styles.landscapeAddressText]}
                        >
                          {order.delivery_address}
                        </Text>
                      ) : null}
                    </View>

                    <View style={[styles.items, isLandscape && styles.landscapeItems]}>
                      {orderItems.map((item) => (
                        <View key={item.id} style={styles.itemRow}>
                          <Text
                            style={[
                              styles.itemQuantity,
                              isLandscape && styles.landscapeItemQuantity,
                            ]}
                          >
                            {item.quantity}×
                          </Text>
                          <View style={styles.itemDescription}>
                            <Text
                              style={[styles.itemName, isLandscape && styles.landscapeItemName]}
                            >
                              {item.dish_name}
                            </Text>
                            <Text
                              style={[
                                styles.itemCategory,
                                isLandscape && styles.landscapeItemCategory,
                              ]}
                            >
                              {item.category} · {stationLabels[item.station]}
                            </Text>
                          </View>
                          <Text
                            style={[styles.itemPrice, isLandscape && styles.landscapeItemPrice]}
                          >
                            {formatPLN(item.line_total)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View style={[styles.totalRow, isLandscape && styles.landscapeTotalRow]}>
                    <Text style={[styles.totalLabel, isLandscape && styles.landscapeTotalLabel]}>
                      {order.payment_status === "paid"
                        ? "Opłacono przez PayU"
                        : order.payment_method === "cash_delivery"
                          ? "Gotówka przy dostawie"
                          : "Płatność na miejscu"}
                    </Text>
                    <Text style={[styles.totalAmount, isLandscape && styles.landscapeTotalAmount]}>
                      {formatPLN(order.total)}
                    </Text>
                  </View>

                  {next ? (
                    <>
                      <ActionButton
                        compact={isLandscape}
                        disabled={busy}
                        label={busy ? "Zapisywanie…" : nextActionLabels[order.status]}
                        onPress={() => void updateStatus(order, next)}
                      />
                      <Pressable
                        accessibilityRole="button"
                        disabled={busy}
                        onPress={() => confirmCancelOrder(order)}
                        style={[
                          styles.cancelOrderButton,
                          isLandscape && styles.landscapeCancelOrderButton,
                          busy && styles.actionButtonDisabled,
                        ]}
                      >
                        <Text
                          style={[
                            styles.cancelOrderButtonText,
                            isLandscape && styles.landscapeCancelOrderButtonText,
                          ]}
                        >
                          Anuluj zamówienie
                        </Text>
                      </Pressable>
                    </>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const nextActionLabels: Record<string, string> = {
  new: "Przyjmij zamówienie",
  accepted: "Rozpocznij przygotowanie",
  preparing: "Oznacz jako gotowe",
  ready: "Zakończ zamówienie",
};

function filterByStation(orders: OrderRow[], station: StationFilter) {
  return station === "all"
    ? orders
    : orders.filter((order) => order.order_items.some((item) => item.station === station));
}

function matchesActiveStatus(status: OrderStatus, filter: ActiveStatusFilter) {
  if (filter === "all") return true;
  if (filter === "new") return status === "new";
  if (filter === "in_progress") return status === "accepted" || status === "preparing";
  return status === "ready";
}

function displayStatus(status: OrderStatus) {
  if (status === "preparing") return "W TRAKCIE";
  return statusLabels[status].toLocaleUpperCase("pl-PL");
}

function FilterChip({
  compact = false,
  label,
  onPress,
  selected,
}: {
  compact?: boolean;
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.filter,
        styles.statusFilter,
        compact && styles.landscapeFilter,
        selected && styles.filterSelected,
      ]}
    >
      <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function Screen({ children, fullscreen = false }: { children: ReactNode; fullscreen?: boolean }) {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" hidden={Platform.OS === "android" && fullscreen} />
      {children}
    </SafeAreaView>
  );
}

function Brand() {
  return (
    <View style={styles.brand}>
      <Text style={styles.eyebrow}>WAKE UP HOUSE</Text>
      <Text style={styles.title}>Panel zamówień</Text>
    </View>
  );
}

function ActionButton({
  compact = false,
  disabled,
  label,
  onPress,
}: {
  compact?: boolean;
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.actionButton,
        compact && styles.landscapeActionButton,
        disabled && styles.actionButtonDisabled,
      ]}
    >
      {disabled ? (
        <ActivityIndicator color={colors.ink} />
      ) : (
        <Text style={[styles.actionButtonText, compact && styles.landscapeActionButtonText]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function formatPLN(value: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(value);
}

function formatOrderTime(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

const colors = {
  background: "#121110",
  surface: "#201e1b",
  surfaceRaised: "#292622",
  line: "#39352f",
  text: "#f6f2eb",
  muted: "#aaa39a",
  accent: "#f4a340",
  ink: "#21170c",
  danger: "#ff8f80",
  green: "#64d69a",
  red: "#ffb4a8",
  blue: "#b7d7ff",
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 14, paddingTop: 8 },
  brand: { marginTop: 44, marginBottom: 28 },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: "800", letterSpacing: 2 },
  title: { color: colors.text, fontSize: 26, fontWeight: "900", marginTop: 4 },
  loginCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
    padding: 20,
  },
  messageCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 20,
  },
  cardTitle: { color: colors.text, fontSize: 22, fontWeight: "800" },
  bodyText: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  errorText: { color: colors.danger, fontSize: 14 },
  errorBanner: {
    backgroundColor: "#3b2420",
    borderRadius: 10,
    color: colors.danger,
    marginBottom: 12,
    padding: 12,
  },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  headerLandscape: { minHeight: 34 },
  landscapeTitle: { fontSize: 20, marginTop: 0 },
  headerActions: { alignItems: "center", flexDirection: "row", gap: 4 },
  landscapeHeaderActions: { gap: 3 },
  headerButton: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  headerButtonText: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  landscapeHeaderButton: { borderRadius: 8, minHeight: 34, paddingHorizontal: 9 },
  landscapeHeaderButtonText: { fontSize: 12 },
  homeButton: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.line,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 10,
  },
  homeButtonText: { color: colors.text, fontSize: 13, fontWeight: "800" },
  signOut: { padding: 10 },
  signOutText: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  landscapeSignOut: { padding: 6 },
  landscapeSignOutText: { fontSize: 12 },
  connectionRow: { alignItems: "center", flexDirection: "row", gap: 8, marginTop: 8 },
  landscapeConnectionRow: { gap: 5, marginTop: 2 },
  connectionDot: { backgroundColor: colors.accent, borderRadius: 5, height: 9, width: 9 },
  connectionLive: { backgroundColor: colors.green },
  connectionText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  userLabel: { color: colors.muted, flex: 1, fontSize: 11, textAlign: "right" },
  notificationNotice: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 5,
  },
  filters: { flexDirection: "row", gap: 6, marginVertical: 8 },
  landscapeFilters: { gap: 4, marginVertical: 3 },
  filter: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  landscapeFilter: { borderRadius: 9, minHeight: 32, paddingHorizontal: 10, paddingVertical: 4 },
  filterTextSelected: { color: colors.ink },
  statusFilters: { flexDirection: "row", gap: 6, paddingBottom: 8 },
  landscapeStatusFilters: { gap: 4, paddingBottom: 4 },
  statusFilter: { minHeight: 44, justifyContent: "center" },
  historyToolbar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  landscapeHistoryToolbar: { marginBottom: 4 },
  historyCount: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  exportButton: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.accent,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12,
  },
  exportButtonText: { color: colors.accent, fontSize: 14, fontWeight: "900" },
  landscapeExportButton: { minHeight: 32, paddingHorizontal: 9 },
  emptyStationNote: { color: colors.muted, fontSize: 13, marginBottom: 12 },
  landscapeEmptyStationNote: { fontSize: 11, marginBottom: 4 },
  landscapeErrorBanner: { marginBottom: 5, padding: 6 },
  ordersScroll: { flex: 1 },
  orderList: { flexGrow: 1, gap: 12, paddingBottom: 32 },
  orderListLandscape: { flexDirection: "row", alignItems: "stretch", paddingBottom: 6 },
  emptyState: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 16,
    gap: 8,
    padding: 24,
  },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  orderCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
  },
  orderCardLandscape: {
    height: "100%",
    padding: 0,
  },
  landscapeOrderContent: {
    flex: 1,
    padding: 10,
  },
  landscapeOrderDetails: {
    flex: 1,
    flexDirection: "row",
    minHeight: 0,
  },
  landscapeCustomerBlock: {
    borderBottomWidth: 0,
    borderRightColor: colors.line,
    borderRightWidth: 1,
    marginTop: 6,
    paddingBottom: 4,
    paddingRight: 10,
    width: "36%",
  },
  landscapeItems: {
    flex: 1,
    gap: 5,
    paddingLeft: 10,
    paddingVertical: 6,
  },
  orderCardContent: {
    padding: 15,
  },
  orderHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  orderHeaderBadges: { alignItems: "flex-end", gap: 7, maxWidth: "58%" },
  orderNumber: { color: colors.text, fontSize: 24, fontWeight: "900" },
  landscapeOrderNumber: { fontSize: 20 },
  timeText: { color: colors.muted, fontSize: 13, marginTop: 2 },
  statusBadge: {
    backgroundColor: "#3b2e1d",
    color: colors.accent,
    borderRadius: 10,
    fontSize: 18,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingVertical: 10,
    textAlign: "center",
  },
  landscapeStatusBadge: { fontSize: 12, paddingHorizontal: 9, paddingVertical: 5 },
  stationBadge: {
    backgroundColor: colors.blue,
    borderRadius: 8,
    color: "#101820",
    fontSize: 14,
    fontWeight: "900",
    minWidth: 112,
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlign: "center",
  },
  landscapeStationBadge: { fontSize: 10, minWidth: 0, paddingHorizontal: 8, paddingVertical: 5 },
  barBadge: { backgroundColor: colors.accent, color: colors.ink },
  status_new: { backgroundColor: colors.blue, color: "#101820" },
  status_accepted: { backgroundColor: "#ffe08a", color: "#241a00" },
  status_preparing: { backgroundColor: "#ffbc66", color: "#241400" },
  status_ready: { backgroundColor: colors.green, color: "#082116" },
  status_completed: { backgroundColor: colors.green, color: "#082116" },
  status_cancelled: { backgroundColor: colors.red, color: "#32100d" },
  customerBlock: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    marginTop: 14,
    paddingBottom: 13,
  },
  landscapeCustomerName: { fontSize: 15 },
  landscapePhone: { fontSize: 12, marginTop: 2 },
  landscapeDeliveryText: { fontSize: 9, marginTop: 5 },
  landscapeAddressText: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  customerName: { color: colors.text, fontSize: 18, fontWeight: "800" },
  phoneText: { color: colors.accent, fontSize: 15, marginTop: 3 },
  deliveryText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 10,
  },
  addressText: { color: colors.text, fontSize: 15, lineHeight: 21, marginTop: 4 },
  items: { gap: 12, paddingVertical: 14 },
  itemRow: { alignItems: "center", flexDirection: "row", gap: 9 },
  itemQuantity: { color: colors.accent, fontSize: 16, fontWeight: "900", width: 31 },
  itemDescription: { flex: 1 },
  itemName: { color: colors.text, fontSize: 15, fontWeight: "700" },
  landscapeItemQuantity: { fontSize: 13, width: 25 },
  landscapeItemName: { fontSize: 12 },
  landscapeItemCategory: { fontSize: 10, marginTop: 1 },
  landscapeItemPrice: { fontSize: 12 },
  itemCategory: { color: colors.muted, fontSize: 12, marginTop: 2 },
  itemPrice: { color: colors.text, fontSize: 14, fontWeight: "700" },
  totalRow: {
    alignItems: "center",
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 12,
  },
  landscapeTotalRow: { paddingTop: 6 },
  totalLabel: { color: colors.muted, fontSize: 13 },
  totalAmount: { color: colors.text, fontSize: 19, fontWeight: "900" },
  landscapeTotalLabel: { fontSize: 11 },
  landscapeTotalAmount: { fontSize: 15 },
  actionButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 12,
    justifyContent: "center",
    marginTop: 14,
    minHeight: 50,
    paddingHorizontal: 16,
  },
  landscapeActionButton: { borderRadius: 9, marginTop: 6, minHeight: 34, paddingHorizontal: 10 },
  actionButtonDisabled: { opacity: 0.55 },
  actionButtonText: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  landscapeActionButtonText: { fontSize: 12 },
  cancelOrderButton: {
    alignSelf: "flex-end",
    borderColor: colors.red,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 8,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  landscapeCancelOrderButton: { marginTop: 4, minHeight: 30, paddingHorizontal: 9 },
  cancelOrderButtonText: { color: colors.red, fontSize: 14, fontWeight: "800" },
  landscapeCancelOrderButtonText: { fontSize: 12 },
});
