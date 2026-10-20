import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { ReactNode } from "react";
import { supabase, supabaseConfigured } from "./src/lib/supabase";
import type { OrderRow, OrderStatus, Station } from "./src/types";

type StationFilter = "all" | Station;

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

const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  new: "accepted",
  accepted: "preparing",
  preparing: "ready",
  ready: "completed",
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Nie udało się wykonać operacji.";

export default function App() {
  const [sessionLoading, setSessionLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signInBusy, setSignInBusy] = useState(false);
  const [signInError, setSignInError] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [station, setStation] = useState<StationFilter>("all");
  const [connection, setConnection] = useState<"connecting" | "live" | "offline">("connecting");
  const [ordersError, setOrdersError] = useState("");
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void supabase.auth.startAutoRefresh();
      else void supabase.auth.stopAutoRefresh();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) {
      setSessionLoading(false);
      return;
    }

    let active = true;
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        if (active) setUserEmail(data.session?.user.email ?? null);
      })
      .catch((error: unknown) => {
        console.error("Nie udało się odczytać sesji pracownika.", error);
        if (active) setSignInError("Nie udało się sprawdzić logowania. Spróbuj ponownie.");
      })
      .finally(() => {
        if (active) setSessionLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? null);
      setSignInError("");
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userEmail) {
      setOrders([]);
      setConnection("connecting");
      return;
    }

    let active = true;
    const refreshOrders = async () => {
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("*, order_items(*)")
          .in("status", ["new", "accepted", "preparing", "ready"])
          .order("created_at", { ascending: true })
          .limit(100);

        if (!active) return;
        if (error) throw error;
        setOrdersError("");
        setOrders((data ?? []) as OrderRow[]);
      } catch (error) {
        console.error("Nie udało się pobrać zamówień.", error);
        if (active) {
          setOrdersError("Nie udało się pobrać zamówień. Sprawdź połączenie i uprawnienia.");
        }
      }
    };

    const channel = supabase
      .channel("kitchen-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => void refreshOrders(),
      )
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
  }, [userEmail]);

  const visibleOrders = useMemo(
    () =>
      orders.filter(
        (order) => station === "all" || order.order_items.some((item) => item.station === station),
      ),
    [orders, station],
  );

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
        current.filter((item) => item.id !== order.id || status !== "completed"),
      );
    } catch (error) {
      console.error("Nie udało się zmienić statusu zamówienia.", error);
      setOrdersError("Nie udało się zapisać statusu. Spróbuj ponownie.");
    } finally {
      setBusyOrderId(null);
    }
  };

  const signOut = async () => {
    try {
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
      <Screen>
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
      <Screen>
        <ActivityIndicator color={colors.accent} size="large" />
      </Screen>
    );
  }

  if (!userEmail) {
    return (
      <Screen>
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

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>WAKE UP HOUSE</Text>
          <Text style={styles.title}>Zamówienia</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => void signOut()} style={styles.signOut}>
          <Text style={styles.signOutText}>Wyloguj</Text>
        </Pressable>
      </View>

      <View style={styles.connectionRow}>
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

      <View style={styles.filters}>
        {(Object.keys(stationLabels) as StationFilter[]).map((key) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: station === key }}
            key={key}
            onPress={() => setStation(key)}
            style={[styles.filter, station === key && styles.filterSelected]}
          >
            <Text style={[styles.filterText, station === key && styles.filterTextSelected]}>
              {stationLabels[key]}
            </Text>
          </Pressable>
        ))}
      </View>

      {ordersError ? <Text style={styles.errorBanner}>{ordersError}</Text> : null}
      {station === "bar" &&
      orders.every((order) => !order.order_items.some((item) => item.station === "bar")) ? (
        <Text style={styles.emptyStationNote}>
          W obecnym menu nie ma jeszcze pozycji przypisanych do baru.
        </Text>
      ) : null}

      <ScrollView contentContainerStyle={styles.orderList}>
        {visibleOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Brak aktywnych zamówień</Text>
            <Text style={styles.bodyText}>
              Nowe zamówienie pojawi się tutaj od razu po złożeniu.
            </Text>
          </View>
        ) : (
          visibleOrders.map((order) => {
            const orderItems =
              station === "all"
                ? order.order_items
                : order.order_items.filter((item) => item.station === station);
            const next = nextStatus[order.status];
            const busy = busyOrderId === order.id;

            return (
              <View key={order.id} style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View>
                    <Text style={styles.orderNumber}>#{order.order_number}</Text>
                    <Text style={styles.timeText}>{formatOrderTime(order.created_at)}</Text>
                  </View>
                  <Text style={styles.statusBadge}>{statusLabels[order.status]}</Text>
                </View>

                <View style={styles.customerBlock}>
                  <Text style={styles.customerName}>{order.customer_name}</Text>
                  <Pressable onPress={() => void callCustomer(order.customer_phone)}>
                    <Text style={styles.phoneText}>{order.customer_phone}</Text>
                  </Pressable>
                  <Text style={styles.deliveryText}>
                    {order.fulfillment === "delivery" ? "DOSTAWA" : "ODBIÓR OSOBISTY"}
                  </Text>
                  {order.delivery_address ? (
                    <Text style={styles.addressText}>{order.delivery_address}</Text>
                  ) : null}
                </View>

                <View style={styles.items}>
                  {orderItems.map((item) => (
                    <View key={item.id} style={styles.itemRow}>
                      <Text style={styles.itemQuantity}>{item.quantity}×</Text>
                      <View style={styles.itemDescription}>
                        <Text style={styles.itemName}>{item.dish_name}</Text>
                        <Text style={styles.itemCategory}>
                          {item.category} · {stationLabels[item.station]}
                        </Text>
                      </View>
                      <Text style={styles.itemPrice}>{formatPLN(item.line_total)}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>
                    {order.payment_status === "paid"
                      ? "Opłacono przez PayU"
                      : order.payment_method === "cash_delivery"
                        ? "Gotówka przy dostawie"
                        : "Płatność na miejscu"}
                  </Text>
                  <Text style={styles.totalAmount}>{formatPLN(order.total)}</Text>
                </View>

                {next ? (
                  <ActionButton
                    disabled={busy}
                    label={busy ? "Zapisywanie…" : nextActionLabels[order.status]}
                    onPress={() => void updateStatus(order, next)}
                  />
                ) : null}
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

function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" />
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
  disabled,
  label,
  onPress,
}: {
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.actionButton, disabled && styles.actionButtonDisabled]}
    >
      {disabled ? (
        <ActivityIndicator color={colors.ink} />
      ) : (
        <Text style={styles.actionButtonText}>{label}</Text>
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
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 18, paddingTop: 18 },
  brand: { marginTop: 44, marginBottom: 28 },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: "800", letterSpacing: 2 },
  title: { color: colors.text, fontSize: 30, fontWeight: "900", marginTop: 5 },
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
  signOut: { padding: 10 },
  signOutText: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  connectionRow: { alignItems: "center", flexDirection: "row", gap: 8, marginTop: 15 },
  connectionDot: { backgroundColor: colors.accent, borderRadius: 5, height: 9, width: 9 },
  connectionLive: { backgroundColor: colors.green },
  connectionText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  userLabel: { color: colors.muted, flex: 1, fontSize: 11, textAlign: "right" },
  filters: { flexDirection: "row", gap: 8, marginVertical: 18 },
  filter: {
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  filterTextSelected: { color: colors.ink },
  emptyStationNote: { color: colors.muted, fontSize: 13, marginBottom: 12 },
  orderList: { gap: 12, paddingBottom: 32 },
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
    padding: 15,
  },
  orderHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  orderNumber: { color: colors.text, fontSize: 24, fontWeight: "900" },
  timeText: { color: colors.muted, fontSize: 13, marginTop: 2 },
  statusBadge: {
    backgroundColor: "#3b2e1d",
    borderRadius: 20,
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  customerBlock: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    marginTop: 14,
    paddingBottom: 13,
  },
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
  totalLabel: { color: colors.muted, fontSize: 13 },
  totalAmount: { color: colors.text, fontSize: 19, fontWeight: "900" },
  actionButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 12,
    justifyContent: "center",
    marginTop: 14,
    minHeight: 50,
    paddingHorizontal: 16,
  },
  actionButtonDisabled: { opacity: 0.55 },
  actionButtonText: { color: colors.ink, fontSize: 15, fontWeight: "900" },
});
