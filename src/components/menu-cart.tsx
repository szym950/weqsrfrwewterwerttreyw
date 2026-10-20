import { useEffect, useRef, useState, type FormEvent } from "react";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { estimateDeliveryCost, searchDeliveryAddresses } from "@/lib/delivery-distance";
import type { DeliveryAddressSuggestion, DeliveryEstimate } from "@/lib/delivery-distance";
import { formatPrice, type Dish } from "@/lib/menu";
import { deliveryPrepaymentThresholdPLN, requiresDeliveryPrepayment } from "@/lib/order-policy";
import type { CartItem } from "@/lib/cart-state";
import { supabase } from "@/integrations/supabase/client";
import { site } from "@/lib/site";

type Fulfillment = "delivery" | "pickup";
type PaymentMethod = "cash_delivery" | "payu";

const paymentLabels: Record<PaymentMethod, string> = {
  cash_delivery: "Gotówka przy dostawie",
  payu: "PayU online",
};

export function MenuCart({
  open,
  onOpenChange,
  items,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CartItem[];
  onChange: (dish: Dish, delta: number) => void;
}) {
  const [stage, setStage] = useState<"cart" | "details" | "review" | "success">("cart");
  const [fulfillment, setFulfillment] = useState<Fulfillment>("delivery");
  const [payment, setPayment] = useState<PaymentMethod>("cash_delivery");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [selectedAddress, setSelectedAddress] = useState<DeliveryAddressSuggestion | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<DeliveryAddressSuggestion[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [addressSearchConsent, setAddressSearchConsent] = useState(false);
  const [addressSearchStatus, setAddressSearchStatus] = useState("");
  const [deliveryEstimate, setDeliveryEstimate] = useState<DeliveryEstimate | null>(null);
  const [deliveryError, setDeliveryError] = useState("");
  const [calculatingDelivery, setCalculatingDelivery] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [orderNumber, setOrderNumber] = useState<number | null>(null);
  const [orderTotal, setOrderTotal] = useState<number | null>(null);
  const [confirmedPaymentMethod, setConfirmedPaymentMethod] = useState<
    PaymentMethod | "onsite" | null
  >(null);
  const submissionKey = useRef<{ fingerprint: string; key: string } | null>(null);

  const subtotal = items.reduce((sum, item) => sum + (item.dish.pricePLN ?? 0) * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const deliveryCost = fulfillment === "delivery" ? (deliveryEstimate?.costPLN ?? 0) : 0;
  const total = subtotal + deliveryCost;
  const requiresPrepayment = fulfillment === "delivery" && requiresDeliveryPrepayment(subtotal);
  const selectedPayment: PaymentMethod | "onsite" =
    fulfillment === "pickup" ? "onsite" : requiresPrepayment ? "payu" : payment;

  useEffect(() => {
    const query = deliveryAddress.trim();
    if (!open || stage !== "details" || !addressSearchConsent || fulfillment !== "delivery") {
      setAddressSuggestions([]);
      setAddressSearchStatus("");
      return;
    }
    if (selectedAddress?.label === deliveryAddress) {
      setAddressSuggestions([]);
      setAddressSearchStatus("Wybrano dokładny adres.");
      return;
    }
    if (query.length < 3) {
      setAddressSuggestions([]);
      setAddressSearchStatus(query ? "Wpisz co najmniej 3 znaki." : "");
      return;
    }

    let active = true;
    const timeout = window.setTimeout(async () => {
      setAddressSearchStatus("Szukam adresów…");
      try {
        const suggestions = await searchDeliveryAddresses(deliveryAddress);
        if (!active) return;
        setAddressSuggestions(suggestions);
        setActiveSuggestionIndex(0);
        setAddressSearchStatus(
          suggestions.length === 0
            ? "Nie znaleziono adresów."
            : suggestions.some((suggestion) => suggestion.isDeliverable)
              ? "Wybierz dokładny adres. Dostarczamy tylko do Głogowa Małopolskiego, Bud Głogowskich, Wysokiej Głogowskiej i Rudnej Małej."
              : "Nie dostarczamy pod znalezione adresy. Obsługujemy Głogów Małopolski, Budy Głogowskie, Wysoką Głogowską i Rudną Małą.",
        );
      } catch (error) {
        console.error("Nie udało się pobrać podpowiedzi adresu.", error);
        if (active) setAddressSearchStatus("Nie udało się pobrać podpowiedzi adresu.");
      }
    }, 450);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [addressSearchConsent, deliveryAddress, fulfillment, open, selectedAddress, stage]);

  const chooseAddressSuggestion = (suggestion: DeliveryAddressSuggestion) => {
    if (!suggestion.isDeliverable) {
      setAddressSuggestions([]);
      setSelectedAddress(null);
      setDeliveryEstimate(null);
      setDeliveryError(
        "Nie dostarczamy pod wskazany adres. Obsługujemy Głogów Małopolski, Budy Głogowskie, Wysoką Głogowską i Rudną Małą.",
      );
      setAddressSearchStatus("Ten adres jest poza obszarem dostawy.");
      return;
    }

    setDeliveryAddress(suggestion.label);
    setAddressSuggestions([]);
    setDeliveryEstimate(null);
    setDeliveryError("");
    if (suggestion.kind === "address") {
      setSelectedAddress(suggestion);
      setAddressSearchStatus("Wybrano dokładny adres.");
    } else {
      setSelectedAddress(null);
      setAddressSearchStatus(
        suggestion.kind === "place"
          ? "Miejscowość wybrana. Wpisz ulicę i numer domu."
          : "Ulica wybrana. Wpisz numer domu.",
      );
    }
  };

  const showReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDeliveryError("");

    if (fulfillment === "delivery") {
      if (!addressSearchConsent) {
        setDeliveryError("Zaznacz zgodę na wyszukanie adresu i obliczenie trasy.");
        return;
      }
      if (!selectedAddress || selectedAddress.kind !== "address") {
        setDeliveryError("Wybierz dokładny adres z podpowiedzi.");
        return;
      }
      if (!selectedAddress.isDeliverable) {
        setDeliveryError(
          "Nie dostarczamy pod wskazany adres. Obsługujemy Głogów Małopolski, Budy Głogowskie, Wysoką Głogowską i Rudną Małą.",
        );
        return;
      }
      setCalculatingDelivery(true);
      try {
        setDeliveryEstimate(await estimateDeliveryCost(selectedAddress));
      } catch (error) {
        console.error("Nie udało się obliczyć kosztu dostawy.", error);
        setDeliveryError(error instanceof Error ? error.message : "Nie udało się obliczyć trasy.");
        setCalculatingDelivery(false);
        return;
      }
      setCalculatingDelivery(false);
    } else {
      setDeliveryEstimate(null);
    }

    setStage("review");
  };

  const updateFulfillment = (next: Fulfillment) => {
    setFulfillment(next);
    setPayment("cash_delivery");
    setDeliveryEstimate(null);
    setDeliveryError("");
  };

  const submitOrder = async () => {
    setOrderError("");
    if (requiresPrepayment && selectedPayment !== "payu") {
      setOrderError("Zamówienie powyżej 150 zł wymaga płatności PayU.");
      return;
    }

    const order = {
      customerName,
      customerEmail,
      customerPhone,
      fulfillment,
      paymentMethod: selectedPayment,
      deliveryAddress: fulfillment === "delivery" ? (selectedAddress?.label ?? null) : null,
      destination:
        fulfillment === "delivery" && selectedAddress
          ? { latitude: selectedAddress.latitude, longitude: selectedAddress.longitude }
          : null,
      items: items.map(({ dish, quantity }) => ({
        dishName: dish.name,
        quantity,
      })),
    };
    const fingerprint = JSON.stringify(order);
    const key =
      submissionKey.current?.fingerprint === fingerprint
        ? submissionKey.current.key
        : window.crypto.randomUUID();
    submissionKey.current = { fingerprint, key };

    setSubmittingOrder(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-order", {
        body: { ...order, idempotencyKey: key },
      });
      if (error) {
        let serverMessage = "";
        if ("context" in error && error.context instanceof Response) {
          try {
            const responseBody: unknown = await error.context.json();
            if (
              typeof responseBody === "object" &&
              responseBody !== null &&
              "error" in responseBody &&
              typeof responseBody.error === "string"
            ) {
              serverMessage = responseBody.error;
            }
          } catch (responseError) {
            console.error("Nie udało się odczytać komunikatu serwera zamówień.", responseError);
          }
        }
        if (serverMessage) throw new Error(serverMessage);
        throw error;
      }
      if (
        !data ||
        typeof data.orderNumber !== "number" ||
        typeof data.total !== "number" ||
        !Number.isFinite(data.total)
      ) {
        throw new Error("Serwer nie zwrócił potwierdzenia zamówienia.");
      }

      if (typeof data.redirectUrl === "string") {
        items.forEach(({ dish, quantity }) => onChange(dish, -quantity));
        window.location.assign(data.redirectUrl);
        return;
      }

      items.forEach(({ dish, quantity }) => onChange(dish, -quantity));
      setOrderNumber(data.orderNumber);
      setOrderTotal(data.total);
      setConfirmedPaymentMethod(selectedPayment);
      setStage("success");
      submissionKey.current = null;
    } catch (error) {
      console.error("Nie udało się złożyć zamówienia.", error);
      setOrderError(
        error instanceof Error
          ? error.message
          : "Nie udało się wysłać zamówienia. Sprawdź połączenie i spróbuj ponownie.",
      );
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && stage === "success") {
      setStage("cart");
      setOrderNumber(null);
      setOrderTotal(null);
      setConfirmedPaymentMethod(null);
      setOrderError("");
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="cart-dialog">
        <DialogTitle className="cart-title">
          {stage === "success"
            ? "Zamówienie przyjęte"
            : stage === "review"
              ? "Podsumowanie"
              : stage === "details"
                ? "Dane zamówienia"
                : "Twój koszyk"}
          <span className="text-primary">.</span>
        </DialogTitle>
        <DialogDescription>
          {stage === "success"
            ? "Przekazaliśmy je do lokalu."
            : stage === "review"
              ? "Sprawdź produkty, dostawę, płatność i sposób realizacji."
              : items.length
                ? "Wybrane dania"
                : "Twój koszyk jest pusty."}
        </DialogDescription>
        {stage === "success" ? (
          <div className="checkout-summary">
            <h3>Numer zamówienia: #{orderNumber}</h3>
            {orderTotal !== null && (
              <p className="cart-checkout-note">Kwota do zapłaty: {formatPrice(orderTotal)}</p>
            )}
            <p className="cart-checkout-note">
              {confirmedPaymentMethod === "payu"
                ? "PayU potwierdziło płatność. Lokal otrzymał zamówienie."
                : confirmedPaymentMethod === "onsite"
                  ? "Lokal otrzymał zamówienie. Zapłacisz na miejscu przy odbiorze."
                  : "Lokal otrzymał zamówienie. Zapłacisz gotówką przy dostawie."}
            </p>
            <div className="cart-actions">
              <Button onClick={() => handleOpenChange(false)}>Wróć do menu</Button>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="cart-empty">
            <ShoppingBag />
            <Button onClick={() => onOpenChange(false)}>Wróć do menu</Button>
          </div>
        ) : stage === "cart" ? (
          <>
            <div className="cart-items">
              {items.map(({ dish, quantity }) => (
                <div className="cart-item" key={dish.name}>
                  <img src={dish.image} alt="" width="70" height="70" />
                  <div className="cart-item-info">
                    <h3>{dish.name}</h3>
                    <p>
                      {dish.category} ·{" "}
                      {dish.pricePLN === null
                        ? "Cena do uzupełnienia"
                        : formatPrice(dish.pricePLN * quantity)}
                    </p>
                    <div className="quantity-control">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Zmniejsz ilość: ${dish.name}`}
                        onClick={() => onChange(dish, -1)}
                      >
                        <Minus />
                      </Button>
                      <span aria-live="polite">{quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Zwiększ ilość: ${dish.name}`}
                        onClick={() => onChange(dish, 1)}
                        disabled={dish.pricePLN === null}
                      >
                        <Plus />
                      </Button>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Usuń z koszyka"
                    aria-label={`Usuń: ${dish.name}`}
                    onClick={() => onChange(dish, -quantity)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
            <div className="cart-summary">
              <span>Liczba dań</span>
              <strong>{itemCount}</strong>
            </div>
            <div className="cart-summary">
              <span>Suma produktów</span>
              <strong>{formatPrice(subtotal)}</strong>
            </div>
            <p className="cart-checkout-note">
              Koszyk zapisuje się w tej przeglądarce. Przed zakupem zobaczysz pełną cenę, koszt
              dostawy i wybrane sposoby płatności.
            </p>
            <div className="cart-actions">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Wróć do menu
              </Button>
              <Button onClick={() => setStage("details")}>Przejdź do podsumowania</Button>
            </div>
          </>
        ) : stage === "details" ? (
          <form className="checkout-form" onSubmit={showReview}>
            <fieldset className="fulfillment-options">
              <legend>Sposób realizacji</legend>
              <label>
                <input
                  type="radio"
                  name="fulfillment"
                  value="delivery"
                  checked={fulfillment === "delivery"}
                  onChange={() => updateFulfillment("delivery")}
                />{" "}
                Dostawa
              </label>
              <label>
                <input
                  type="radio"
                  name="fulfillment"
                  value="pickup"
                  checked={fulfillment === "pickup"}
                  onChange={() => updateFulfillment("pickup")}
                />{" "}
                Odbiór osobisty
              </label>
            </fieldset>
            <label className="checkout-field">
              Imię i nazwisko
              <input
                required
                autoComplete="name"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
              />
            </label>
            <label className="checkout-field">
              Numer telefonu
              <input
                required
                type="tel"
                autoComplete="tel"
                pattern="[+0-9 ()-]{7,20}"
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
              />
            </label>
            {fulfillment === "delivery" && (
              <label className="checkout-field">
                E-mail
                <input
                  required={requiresPrepayment || payment === "payu"}
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  value={customerEmail}
                  onChange={(event) => setCustomerEmail(event.target.value)}
                />
                <small>E-mail jest potrzebny do płatności PayU.</small>
              </label>
            )}
            {fulfillment === "delivery" && (
              <>
                <p className="cart-checkout-note">
                  Opłata za dostawę wynosi 1,50 zł za każdy kilometr trasy samochodowej z lokalu.
                  Adres i lokalizacja zostaną przekazane Photon (wyszukiwanie) i OSRM (trasa).
                </p>
                <label className="route-disclosure">
                  <input
                    type="checkbox"
                    required
                    checked={addressSearchConsent}
                    onChange={(event) => setAddressSearchConsent(event.target.checked)}
                  />
                  Zgadzam się na przekazanie wpisywanego adresu do Photon i lokalizacji do OSRM w
                  celu wyszukania adresu i obliczenia kosztu trasy drogowej.
                </label>
                <div className="checkout-field">
                  <label htmlFor="delivery-address">Adres dostawy</label>
                  <div className="address-autocomplete">
                    <input
                      id="delivery-address"
                      required
                      autoComplete="street-address"
                      role="combobox"
                      aria-autocomplete="list"
                      aria-expanded={addressSuggestions.length > 0}
                      aria-controls="delivery-address-suggestions"
                      aria-activedescendant={
                        addressSuggestions.length > 0
                          ? `delivery-address-suggestion-${activeSuggestionIndex}`
                          : undefined
                      }
                      placeholder={
                        addressSearchConsent
                          ? "Wpisz miejscowość, ulicę lub numer"
                          : "Najpierw zaznacz zgodę powyżej"
                      }
                      value={deliveryAddress}
                      onChange={(event) => {
                        const nextAddress = event.target.value;
                        setDeliveryAddress(nextAddress);
                        setSelectedAddress(null);
                        setAddressSuggestions([]);
                        setActiveSuggestionIndex(0);
                        setDeliveryEstimate(null);
                        setDeliveryError("");
                      }}
                      onKeyDown={(event) => {
                        if (!addressSuggestions.length) return;
                        if (event.key === "ArrowDown") {
                          event.preventDefault();
                          setActiveSuggestionIndex((index) =>
                            Math.min(index + 1, addressSuggestions.length - 1),
                          );
                        } else if (event.key === "ArrowUp") {
                          event.preventDefault();
                          setActiveSuggestionIndex((index) => Math.max(index - 1, 0));
                        } else if (event.key === "Enter") {
                          event.preventDefault();
                          const suggestion = addressSuggestions[activeSuggestionIndex];
                          if (suggestion) chooseAddressSuggestion(suggestion);
                        } else if (event.key === "Escape") {
                          setAddressSuggestions([]);
                        }
                      }}
                    />
                    {addressSuggestions.length > 0 && (
                      <ul
                        className="address-suggestions"
                        id="delivery-address-suggestions"
                        role="listbox"
                      >
                        {addressSuggestions.map((suggestion, index) => (
                          <li
                            key={`${suggestion.label}-${index}`}
                            id={`delivery-address-suggestion-${index}`}
                            role="option"
                            aria-selected={index === activeSuggestionIndex}
                          >
                            <button
                              type="button"
                              className={`address-suggestion${suggestion.isDeliverable ? "" : " address-suggestion-unavailable"}`}
                              onClick={() => chooseAddressSuggestion(suggestion)}
                            >
                              <strong>{suggestion.label}</strong>
                              <span>
                                {suggestion.isDeliverable
                                  ? suggestion.detail
                                  : "Poza obszarem dostawy"}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {addressSearchStatus && (
                    <span className="address-search-status" role="status">
                      {addressSearchStatus}
                    </span>
                  )}
                </div>
              </>
            )}
            {fulfillment === "delivery" ? (
              <div className="checkout-payment-section">
                {requiresPrepayment && (
                  <div className="payu-readiness" role="alert">
                    <strong>
                      Wartość produktów przekracza {formatPrice(deliveryPrepaymentThresholdPLN)}.
                    </strong>
                    <p>
                      Przy dostawie wymagana jest przedpłata. Gotówka przy dostawie jest
                      niedostępna. Wybierz PayU i opłać zamówienie, aby trafiło do lokalu.
                    </p>
                  </div>
                )}
                <fieldset className="payment-options">
                  <legend>Sposób płatności</legend>
                  {(["cash_delivery", "payu"] as const).map((method) => (
                    <label className="payment-option" key={method}>
                      <input
                        type="radio"
                        name="payment"
                        value={method}
                        checked={requiresPrepayment ? method === "payu" : payment === method}
                        disabled={method === "cash_delivery" && requiresPrepayment}
                        onChange={() => setPayment(method)}
                      />
                      <span>{paymentLabels[method]}</span>
                      {method === "payu" && (
                        <small>Przekierowanie do bezpiecznej strony PayU</small>
                      )}
                      {method === "cash_delivery" && requiresPrepayment && (
                        <small>
                          Niedostępna przy wartości produktów powyżej{" "}
                          {formatPrice(deliveryPrepaymentThresholdPLN)}.
                        </small>
                      )}
                    </label>
                  ))}
                </fieldset>
              </div>
            ) : (
              <p className="cart-checkout-note">
                Przy odbiorze osobistym wybierzesz sposób płatności na miejscu.
              </p>
            )}
            <section className="checkout-legal" aria-labelledby="checkout-legal-title">
              <h3 id="checkout-legal-title">Regulaminy i dokumenty przed zamówieniem</h3>
              <p>Przed złożeniem zamówienia zapoznaj się z dokumentami:</p>
              <nav aria-label="Dokumenty zamówienia">
                {site.legalDocuments.map((document) => (
                  <a
                    key={document.name}
                    href={document.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {document.name}
                  </a>
                ))}
              </nav>
            </section>
            {deliveryError && (
              <p className="checkout-route-error" role="alert">
                {deliveryError}
              </p>
            )}
            <p className="checkout-preview-warning">
              {selectedPayment === "payu"
                ? "Po kliknięciu przejdziesz do PayU. Zamówienie trafi do lokalu dopiero po otrzymaniu potwierdzenia płatności."
                : "Po złożeniu zamówienie trafi do lokalu. Dostawa jest opłacana gotówką przy odbiorze, a przy odbiorze osobistym płatność wybierzesz na miejscu."}
            </p>
            <div className="cart-actions">
              <Button type="button" variant="outline" onClick={() => setStage("cart")}>
                Wróć do koszyka
              </Button>
              <Button type="submit" disabled={calculatingDelivery}>
                {calculatingDelivery ? "Obliczam trasę…" : "Pokaż podsumowanie"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="checkout-summary">
            <section aria-label="Zamawiane produkty">
              <h3>Produkty</h3>
              {items.map(({ dish, quantity }) => (
                <div className="cart-summary" key={dish.name}>
                  <span>
                    {quantity} × {dish.name}
                  </span>
                  <strong>{formatPrice((dish.pricePLN ?? 0) * quantity)}</strong>
                </div>
              ))}
            </section>
            <dl>
              <div>
                <dt>Sposób realizacji</dt>
                <dd>{fulfillment === "delivery" ? "Dostawa" : "Odbiór osobisty"}</dd>
              </div>
              {fulfillment === "delivery" && deliveryEstimate && (
                <>
                  <div>
                    <dt>Adres dostawy</dt>
                    <dd>{selectedAddress?.label}</dd>
                  </div>
                  <div>
                    <dt>Trasa drogowa</dt>
                    <dd>{deliveryEstimate.distanceKm.toFixed(2)} km</dd>
                  </div>
                </>
              )}
              <div>
                <dt>Suma produktów</dt>
                <dd>{formatPrice(subtotal)}</dd>
              </div>
              <div>
                <dt>Koszt dostawy</dt>
                <dd>{fulfillment === "delivery" ? formatPrice(deliveryCost) : "0,00 zł"}</dd>
              </div>
              <div>
                <dt>Płatność</dt>
                <dd>
                  {selectedPayment === "onsite"
                    ? "Wybierzesz na miejscu przy odbiorze"
                    : paymentLabels[selectedPayment]}
                </dd>
              </div>
              <div className="checkout-total">
                <dt>Łącznie</dt>
                <dd>{formatPrice(total)}</dd>
              </div>
              <div>
                <dt>Klient</dt>
                <dd>{customerName}</dd>
              </div>
              <div>
                <dt>Telefon</dt>
                <dd>{customerPhone}</dd>
              </div>
            </dl>
            {requiresPrepayment && (
              <p className="payu-readiness" role="alert">
                Wymagana przedpłata: wartość produktów przy dostawie przekracza{" "}
                {formatPrice(deliveryPrepaymentThresholdPLN)}. Płatność gotówką jest zablokowana;
                zamówienie zostanie przekazane do lokalu po potwierdzeniu płatności PayU.
              </p>
            )}
            <section className="checkout-legal" aria-labelledby="checkout-review-legal-title">
              <h3 id="checkout-review-legal-title">Regulaminy i dokumenty</h3>
              <nav aria-label="Dokumenty zamówienia">
                {site.legalDocuments.map((document) => (
                  <a
                    key={document.name}
                    href={document.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {document.name}
                  </a>
                ))}
              </nav>
            </section>
            <p className="checkout-preview-warning">
              Zamówienie zostanie przekazane do lokalu. Płatność PayU nie jest jeszcze dostępna;
              przy dostawie można zapłacić gotówką, a przy odbiorze płatność wybierzesz na miejscu.
            </p>
            {orderError && (
              <p className="checkout-route-error" role="alert">
                {orderError}
              </p>
            )}
            <div className="cart-actions">
              <Button variant="outline" onClick={() => setStage("details")}>
                Wróć i popraw dane
              </Button>
              {requiresPrepayment ? (
                <Button disabled>PayU niedostępne</Button>
              ) : (
                <Button onClick={() => void submitOrder()} disabled={submittingOrder}>
                  {submittingOrder
                    ? "Wysyłanie…"
                    : selectedPayment === "payu"
                      ? "Zamawiam z obowiązkiem zapłaty — PayU"
                      : "Zamawiam z obowiązkiem zapłaty"}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
