import { site } from "@/lib/site";

const routingEndpoint = "https://router.project-osrm.org/route/v1/driving";
const geocodingEndpoint = "https://photon.komoot.io/api/";

export type DeliveryEstimate = {
  distanceKm: number;
  costPLN: number;
};

export type DeliveryAddressSuggestion = {
  label: string;
  detail: string;
  kind: "place" | "street" | "address";
  latitude: number;
  longitude: number;
  isDeliverable: boolean;
};

const deliveryAreaPlaces = new Set([
  "glogow malopolski",
  "budy glogowskie",
  "wysoka glogowska",
  "rudna mala",
]);

function normalizePlace(value: string) {
  return value
    .replace(/[łŁ]/g, "l")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pl-PL")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isDeliveryArea(properties: PhotonFeature["properties"]) {
  return [properties.locality, properties.city, properties.name]
    .filter((place): place is string => Boolean(place))
    .some((place) => deliveryAreaPlaces.has(normalizePlace(place)));
}

type PhotonFeature = {
  properties: {
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    locality?: string;
    name?: string;
    type?: string;
    country?: string;
    countrycode?: string;
  };
  geometry: { coordinates: [number, number] };
};

type PhotonResult = {
  features?: PhotonFeature[];
};

type RoutingResult = {
  code: string;
  routes?: { distance: number }[];
};

export async function searchDeliveryAddresses(
  query: string,
  fetcher: typeof fetch = fetch,
): Promise<DeliveryAddressSuggestion[]> {
  const geocodingUrl = new URL(geocodingEndpoint);
  geocodingUrl.searchParams.set("q", query.trim());
  geocodingUrl.searchParams.set("limit", "10");
  geocodingUrl.searchParams.set("lat", String(site.delivery.originCoordinates.latitude));
  geocodingUrl.searchParams.set("lon", String(site.delivery.originCoordinates.longitude));

  const response = await fetcher(geocodingUrl);
  if (!response.ok) throw new Error("Nie udało się wyszukać adresu.");

  const results = (await response.json()) as PhotonResult;
  return (results.features ?? []).flatMap(({ properties, geometry }) => {
    const supportedTypes = ["city", "district", "street", "house"];
    if (!supportedTypes.includes(properties.type ?? "")) return [];
    if (properties.countrycode && properties.countrycode !== "PL") return [];
    if (properties.type === "house" && (!properties.street || !properties.housenumber)) {
      return [];
    }

    const [longitude, latitude] = geometry.coordinates;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];

    const street = [properties.street, properties.housenumber].filter(Boolean).join(" ");
    const place = properties.city ?? properties.locality;
    const kind: DeliveryAddressSuggestion["kind"] =
      properties.type === "city" || properties.type === "district"
        ? "place"
        : properties.housenumber && properties.street
          ? "address"
          : properties.street
            ? "street"
            : "place";
    const primary =
      kind === "place" ? properties.name || place : street || properties.name || place;
    const secondary =
      kind === "place"
        ? (properties.postcode ?? "")
        : [properties.postcode, place].filter(Boolean).join(" ");
    const label = [primary, secondary].filter(Boolean).join(", ");
    if (!label) return [];

    const detail =
      kind === "place"
        ? "Miejscowość · wybierz, aby doprecyzować adres"
        : kind === "street"
          ? "Ulica · wybierz ponownie po wpisaniu numeru domu"
          : [properties.postcode, place].filter(Boolean).join(" · ");

    return [
      { label, detail, kind, latitude, longitude, isDeliverable: isDeliveryArea(properties) },
    ];
  });
}

export async function estimateDeliveryCost(
  destination: Pick<DeliveryAddressSuggestion, "latitude" | "longitude"> &
    Partial<Pick<DeliveryAddressSuggestion, "isDeliverable">>,
  fetcher: typeof fetch = fetch,
): Promise<DeliveryEstimate> {
  if (destination.isDeliverable === false) {
    throw new Error(
      "Nie dostarczamy pod wskazany adres. Obsługujemy Głogów Małopolski, Budy Głogowskie, Wysoką Głogowską i Rudną Małą.",
    );
  }

  const { latitude, longitude } = site.delivery.originCoordinates;
  const routingUrl = new URL(
    `${routingEndpoint}/${longitude},${latitude};${destination.longitude},${destination.latitude}`,
  );
  routingUrl.searchParams.set("overview", "false");
  routingUrl.searchParams.set("steps", "false");

  const routingResponse = await fetcher(routingUrl);
  if (!routingResponse.ok) throw new Error("Nie udało się wyznaczyć trasy.");

  const routing = (await routingResponse.json()) as RoutingResult;
  const distanceMeters = routing.routes?.[0]?.distance;
  if (routing.code !== "Ok" || typeof distanceMeters !== "number") {
    throw new Error("Nie znaleziono trasy samochodowej do tego adresu.");
  }

  const distanceKm = Math.round((distanceMeters / 1000) * 100) / 100;
  const costPLN = Math.round((distanceMeters / 1000) * site.delivery.ratePerKmPLN * 100) / 100;

  return { distanceKm, costPLN };
}
