import { useEffect, useState, type FormEvent } from "react";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  estimateDeliveryCostOnServer,
  searchDeliveryAddressesOnServer,
} from "@/lib/delivery-distance.server";
import type { DeliveryAddressSuggestion, DeliveryEstimate } from "@/lib/delivery-distance";
import { formatPrice, type Dish } from "@/lib/menu";
import { site } from "@/lib/site";

export type CartItem = { dish: Dish; quantity: number };
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
  const [checkoutStage, setCheckoutStage] = useState<"cart" | "details" | "summary">("cart");
  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">("delivery");
  const [customerName, setCustomerName] = useState("");
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
  const total = items.reduce((sum, item) => sum + (item.dish.pricePLN ?? 0) * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    const query = deliveryAddress.trim();
    if (!addressSearchConsent || fulfillment !== "delivery") {
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
    const timeout = window.setTimeout(() => {
      setAddressSearchStatus("Szukam adresów…");
      searchDeliveryAddressesOnServer({ data: { query: deliveryAddress } })
        .then((suggestions) => {
          if (!active) return;
          setAddressSuggestions(suggestions);
          setActiveSuggestionIndex(0);
          setAddressSearchStatus(
            suggestions.length
              ? "Wybierz dokładny adres z podpowiedzi."
              : "Nie znaleziono adresów.",
          );
        })
        .catch(() => {
          if (active) setAddressSearchStatus("Nie udało się pobrać podpowiedzi adresu.");
        });
    }, 450);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [addressSearchConsent, deliveryAddress, fulfillment, selectedAddress]);

  const chooseAddressSuggestion = (suggestion: DeliveryAddressSuggestion) => {
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

  const showSummary = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (fulfillment === "delivery") {
      if (!selectedAddress || selectedAddress.kind !== "address") {
        setDeliveryError("Wybierz dokładny adres z podpowiedzi.");
        return;
      }
      setCalculatingDelivery(true);
      setDeliveryError("");
      try {
        setDeliveryEstimate(
          await estimateDeliveryCostOnServer({
            data: { latitude: selectedAddress.latitude, longitude: selectedAddress.longitude },
          }),
        );
      } catch (error) {
        setDeliveryError(error instanceof Error ? error.message : "Nie udało się obliczyć trasy.");
        setCalculatingDelivery(false);
        return;
      }
      setCalculatingDelivery(false);
    }

    setCheckoutStage("summary");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="cart-dialog">
        <DialogTitle className="cart-title">
          {checkoutStage === "cart"
            ? "Twój koszyk"
            : checkoutStage === "details"
              ? "Dane odbioru"
              : "Podsumowanie"}
          <span className="text-primary">.</span>
        </DialogTitle>
        <DialogDescription>
          {checkoutStage === "cart"
            ? items.length
              ? "Wybrane dania"
              : "Twój koszyk jest pusty."
            : "Podgląd procesu zamówienia — dane pozostają tylko w tej przeglądarce."}
        </DialogDescription>
        {items.length === 0 ? (
          <div className="cart-empty">
            <ShoppingBag />
            <Button onClick={() => onOpenChange(false)}>Wróć do menu</Button>
          </div>
        ) : (
          <>
            {checkoutStage === "cart" && (
              <>
                <div className="cart-items">
                  {items.map(({ dish, quantity }) => (
                    <div className="cart-item" key={dish.name}>
                      <img src={dish.image} alt={dish.name} width="70" height="70" />
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
                  <strong>{formatPrice(total)}</strong>
                </div>
                <p className="cart-checkout-note">
                  To podgląd. Zamówienia online i płatności PayU nie są jeszcze aktywne.
                </p>
                <div className="cart-actions">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Dodaj kolejne dania
                  </Button>
                  <Button onClick={() => setCheckoutStage("details")}>Przejdź do zamówienia</Button>
                </div>
              </>
            )}
            {checkoutStage === "details" && (
              <form className="checkout-form" onSubmit={showSummary}>
                <fieldset className="fulfillment-options">
                  <legend>Sposób odbioru</legend>
                  <label>
                    <input
                      type="radio"
                      name="fulfillment"
                      value="delivery"
                      checked={fulfillment === "delivery"}
                      onChange={() => setFulfillment("delivery")}
                    />{" "}
                    Dostawa
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="fulfillment"
                      value="pickup"
                      checked={fulfillment === "pickup"}
                      onChange={() => setFulfillment("pickup")}
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
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                  />
                </label>
                {fulfillment === "delivery" && (
                  <>
                    <p className="cart-checkout-note">
                      Wyszukiwanie przekaże wpisywany adres do Photon (dane OpenStreetMap), a
                      wybrana lokalizacja posłuży do wyznaczenia trasy przez OSRM. Stawka
                      orientacyjna: 0,20 zł/km trasy samochodowej.
                    </p>
                    <label className="route-disclosure">
                      <input
                        type="checkbox"
                        required
                        checked={addressSearchConsent}
                        onChange={(event) => setAddressSearchConsent(event.target.checked)}
                      />
                      Zgadzam się na przekazanie wpisywanego adresu do usług mapowych w celu
                      wyświetlenia podpowiedzi i wyliczenia trasy.
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
                            setAddressSearchStatus(
                              nextAddress.trim().length < 3
                                ? "Wpisz co najmniej 3 znaki."
                                : "Wyszukiwanie…",
                            );
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
                          disabled={!addressSearchConsent}
                        />
                        {addressSuggestions.length > 0 && (
                          <div
                            className="address-suggestions"
                            id="delivery-address-suggestions"
                            role="listbox"
                            aria-label="Podpowiedzi adresu"
                          >
                            {addressSuggestions.map((suggestion, index) => (
                              <button
                                className="address-suggestion"
                                key={`${suggestion.latitude},${suggestion.longitude}`}
                                id={`delivery-address-suggestion-${index}`}
                                type="button"
                                role="option"
                                aria-selected={activeSuggestionIndex === index}
                                tabIndex={-1}
                                onMouseEnter={() => setActiveSuggestionIndex(index)}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => chooseAddressSuggestion(suggestion)}
                              >
                                <span>{suggestion.label}</span>
                                <small>{suggestion.detail}</small>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="address-search-status" aria-live="polite">
                      {addressSearchStatus}
                    </p>
                    {deliveryError && (
                      <p className="checkout-route-error" role="alert">
                        {deliveryError}
                      </p>
                    )}
                  </>
                )}
                <p className="cart-checkout-note">
                  {fulfillment === "delivery"
                    ? `Dostawa od ${site.delivery.minOrder} · ${site.delivery.zones}`
                    : `Odbiór osobisty: ${site.delivery.pickup}`}
                </p>
                <p className="checkout-preview-warning">
                  Podgląd nie składa zamówienia ani nie wysyła podanych danych.
                </p>
                <div className="cart-actions">
                  <Button type="button" variant="outline" onClick={() => setCheckoutStage("cart")}>
                    Wróć do koszyka
                  </Button>
                  <Button type="submit" disabled={calculatingDelivery}>
                    {calculatingDelivery
                      ? "Wyznaczanie trasy…"
                      : fulfillment === "delivery"
                        ? "Oblicz koszt i pokaż podsumowanie"
                        : "Pokaż podsumowanie"}
                  </Button>
                </div>
              </form>
            )}
            {checkoutStage === "summary" && (
              <div className="checkout-summary">
                <dl>
                  <div>
                    <dt>Odbiorca</dt>
                    <dd>{customerName}</dd>
                  </div>
                  <div>
                    <dt>Telefon</dt>
                    <dd>{customerPhone}</dd>
                  </div>
                  <div>
                    <dt>{fulfillment === "delivery" ? "Adres dostawy" : "Odbiór"}</dt>
                    <dd>{fulfillment === "delivery" ? deliveryAddress : site.addressLine1}</dd>
                  </div>
                  <div>
                    <dt>Pozycje</dt>
                    <dd>{itemCount}</dd>
                  </div>
                  <div>
                    <dt>Suma produktów</dt>
                    <dd>{formatPrice(total)}</dd>
                  </div>
                  {fulfillment === "delivery" && (
                    <div>
                      <dt>Trasa samochodowa</dt>
                      <dd>{deliveryEstimate?.distanceKm.toFixed(2)} km</dd>
                    </div>
                  )}
                  {fulfillment === "delivery" && deliveryEstimate && (
                    <div>
                      <dt>Szacowany koszt dostawy</dt>
                      <dd>{formatPrice(deliveryEstimate.costPLN)}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Razem orientacyjnie</dt>
                    <dd>
                      {formatPrice(
                        total + (fulfillment === "delivery" ? (deliveryEstimate?.costPLN ?? 0) : 0),
                      )}
                    </dd>
                  </div>
                </dl>
                <div className="payu-readiness">
                  <strong>Płatność PayU jest w przygotowaniu</strong>
                  <p>
                    Do uruchomienia potrzebne są dane dostępowe PayU, konfiguracja powiadomień o
                    płatności, obsługa zamówień oraz zatwierdzone dokumenty sklepu.
                  </p>
                </div>
                <p className="checkout-preview-warning">
                  To wyłącznie podgląd. Zamówienie nie zostało złożone, a płatność nie została
                  rozpoczęta.
                </p>
                <div className="cart-actions">
                  <Button variant="outline" onClick={() => setCheckoutStage("details")}>
                    Edytuj dane
                  </Button>
                  <Button disabled>PayU niedostępne</Button>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
