import { useEffect, useRef, useState, type FormEvent } from "react";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { estimateDeliveryCost, searchDeliveryAddresses } from "@/lib/delivery-distance";
import type { DeliveryAddressSuggestion, DeliveryEstimate } from "@/lib/delivery-distance";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice, type Dish } from "@/lib/menu";
import { deliveryPrepaymentThresholdPLN, requiresDeliveryPrepayment } from "@/lib/order-policy";
import type { CartItem } from "@/lib/cart-state";
import { site } from "@/lib/site";

type Fulfillment = "delivery" | "pickup";
type PaymentMethod = "cash_delivery" | "payu";
type OrderConfirmation = { orderNumber: number; total: number };

const paymentLabels: Record<PaymentMethod, string> = {
  cash_delivery: "Gotówka przy dostawie",
  payu: "PayU online",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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
  const [stage, setStage] = useState<"cart" | "details" | "review" | "complete">("cart");
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
  const [orderConfirmation, setOrderConfirmation] = useState<OrderConfirmation | null>(null);
  const idempotencyKey = useRef<string | null>(null);

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

  const submitOrder = async () => {
    if (submittingOrder) return;
    setSubmittingOrder(true);
    setOrderError("");

    try {
      idempotencyKey.current ??= crypto.randomUUID();
      const { data, error } = await supabase.functions.invoke("create-order", {
        body: {
          idempotencyKey: idempotencyKey.current,
          customerName,
          customerEmail: selectedPayment === "payu" ? customerEmail : undefined,
          customerPhone,
          fulfillment,
          paymentMethod: selectedPayment,
          deliveryAddress: fulfillment === "delivery" ? selectedAddress?.label : null,
          destination:
            fulfillment === "delivery" && selectedAddress
              ? {
                  latitude: selectedAddress.latitude,
                  longitude: selectedAddress.longitude,
                }
              : null,
          items: items.map(({ dish, quantity }) => ({ dishName: dish.name, quantity })),
        },
      });

      if (error) {
        console.error("Nie udało się wysłać zamówienia.", error);
        if (error.context instanceof Response) {
          try {
            const body: unknown = await error.context.clone().json();
            if (isRecord(body) && typeof body["error"] === "string") {
              setOrderError(body["error"]);
              return;
            }
          } catch (parseError) {
            console.error("Nie udało się odczytać błędu odpowiedzi zamówienia.", parseError);
          }
        }
        setOrderError("Nie udało się wysłać zamówienia. Sprawdź połączenie i spróbuj ponownie.");
        return;
      }

      if (
        !isRecord(data) ||
        typeof data["orderNumber"] !== "number" ||
        typeof data["total"] !== "number" ||
        !Number.isFinite(data["total"])
      ) {
        console.error("Serwer zwrócił nieprawidłowe potwierdzenie zamówienia.");
        setOrderError("Nie udało się potwierdzić zamówienia. Skontaktuj się z lokalem.");
        return;
      }

      if (selectedPayment === "payu") {
        const redirectUrl = data["redirectUrl"];
        if (typeof redirectUrl !== "string") {
          console.error("Serwer nie zwrócił adresu płatności PayU.");
          setOrderError("Nie udało się rozpocząć płatności PayU. Spróbuj ponownie.");
          return;
        }
        try {
          const url = new URL(redirectUrl);
          const allowedHosts = new Set([
            "secure.snd.payu.com",
            "merch-prod.snd.payu.com",
            "secure.payu.com",
            "merch-prod.payu.com",
          ]);
          if (url.protocol !== "https:" || !allowedHosts.has(url.hostname)) {
            throw new Error("Unexpected PayU redirect URL.");
          }
          window.location.assign(url.href);
          return;
        } catch (error) {
          console.error("Serwer zwrócił nieprawidłowy adres przekierowania PayU.", error);
          setOrderError("PayU zwróciło nieprawidłowy adres płatności.");
          return;
        }
      }

      setOrderConfirmation({ orderNumber: data["orderNumber"], total: data["total"] });
      setStage("complete");
      idempotencyKey.current = null;
      for (const item of items) onChange(item.dish, -item.quantity);
    } catch (error) {
      console.error("Wystąpił błąd podczas wysyłania zamówienia.", error);
      setOrderError("Nie udało się wysłać zamówienia. Sprawdź połączenie i spróbuj ponownie.");
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setStage("cart");
      setOrderError("");
      setOrderConfirmation(null);
      idempotencyKey.current = null;
    }
    onOpenChange(nextOpen);
  };

  const returnToDetails = () => {
    idempotencyKey.current = null;
    setOrderError("");
    setStage("details");
  };

  const updateFulfillment = (next: Fulfillment) => {
    setFulfillment(next);
    setPayment("cash_delivery");
    setDeliveryEstimate(null);
    setDeliveryError("");
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="cart-dialog">
        <DialogTitle className="cart-title">
          {stage === "review"
            ? "Podsumowanie"
            : stage === "details"
              ? "Dane zamówienia"
              : stage === "complete"
                ? "Zamówienie wysłane"
                : "Twój koszyk"}
          <span className="text-primary">.</span>
        </DialogTitle>
        <DialogDescription>
          {stage === "review"
            ? "Sprawdź produkty, dostawę, płatność i sposób realizacji."
            : stage === "complete"
              ? "Szczegóły zamówienia zostały przekazane do lokalu."
              : items.length
                ? "Wybrane dania"
                : "Twój koszyk jest pusty."}
        </DialogDescription>
        {stage === "complete" && orderConfirmation ? (
          <div className="checkout-summary">
            <p>
              Zamówienie <strong>#{orderConfirmation.orderNumber}</strong> zostało wysłane do
              lokalu.
            </p>
            <div className="checkout-total">Łącznie: {formatPrice(orderConfirmation.total)}</div>
            <p className="cart-checkout-note">
              {fulfillment === "pickup"
                ? "Płatność przy odbiorze na miejscu."
                : "Płatność gotówką przy dostawie."}
            </p>
            <div className="cart-actions">
              <Button onClick={() => handleDialogOpenChange(false)}>Wróć do menu</Button>
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
            {fulfillment === "delivery" && selectedPayment === "payu" && (
              <label className="checkout-field">
                Adres e-mail do płatności PayU
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={customerEmail}
                  onChange={(event) => setCustomerEmail(event.target.value)}
                />
                <small>
                  Adres e-mail zostanie przekazany operatorowi PayU w celu obsługi płatności.
                </small>
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
                      Przy dostawie wymagana jest przedpłata PayU. Gotówka przy dostawie jest
                      niedostępna.
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
                      {method === "payu" && <small>Płatność online przez PayU.</small>}
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
              <p className="payu-readiness" role="status">
                Wartość produktów przy dostawie przekracza{" "}
                {formatPrice(deliveryPrepaymentThresholdPLN)}. Wymagana jest płatność PayU.
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
            <p className="cart-checkout-note">
              {selectedPayment === "payu"
                ? "Po złożeniu zamówienia przejdziesz na bezpieczną stronę płatności PayU. Lokal otrzyma zamówienie po potwierdzeniu płatności."
                : fulfillment === "pickup"
                  ? "Po złożeniu zamówienia zapłacisz przy odbiorze na miejscu."
                  : "Po złożeniu zamówienia lokal otrzyma je w panelu. Zapłacisz gotówką przy dostawie."}
            </p>
            {orderError && (
              <p className="checkout-route-error" role="alert">
                {orderError}
              </p>
            )}
            <div className="cart-actions">
              <Button variant="outline" onClick={returnToDetails} disabled={submittingOrder}>
                Wróć i popraw dane
              </Button>
              <Button onClick={() => handleDialogOpenChange(false)} disabled={submittingOrder}>
                Wróć do menu
              </Button>
              <Button onClick={submitOrder} disabled={submittingOrder}>
                {submittingOrder
                  ? "Przygotowuję zamówienie…"
                  : selectedPayment === "payu"
                    ? "Przejdź do płatności PayU"
                    : "Zamawiam z obowiązkiem zapłaty"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
