import { describe, expect, it, vi } from "vitest";
import { estimateDeliveryCost, searchDeliveryAddresses } from "@/lib/delivery-distance";

function jsonResponse(data: unknown) {
  return { ok: true, json: async () => data } as Response;
}

describe("estimateDeliveryCost", () => {
  it("calculates the fee from the routed driving distance", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ code: "Ok", routes: [{ distance: 5430 }] }));

    const estimate = await estimateDeliveryCost({ latitude: 50.2, longitude: 22 }, fetcher);

    expect(estimate).toEqual({ distanceKm: 5.43, costPLN: 1.09 });
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("route/v1/driving/");
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("overview=false");
  });

  it("turns geocoding results into selectable delivery addresses", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse({
        features: [
          {
            properties: {
              type: "house",
              street: "Parkowa",
              housenumber: "10",
              postcode: "36-060",
              city: "Głogów Małopolski",
              countrycode: "PL",
            },
            geometry: { coordinates: [21.95475, 50.15319] },
          },
        ],
      }),
    );

    const suggestions = await searchDeliveryAddresses("Parkowa 10", fetcher);

    expect(suggestions).toEqual([
      {
        label: "Parkowa 10, 36-060 Głogów Małopolski",
        detail: "36-060 · Głogów Małopolski",
        kind: "address",
        latitude: 50.15319,
        longitude: 21.95475,
      },
    ]);
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("photon.komoot.io/api/");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("keeps a matching city suggestion for short queries and ignores points of interest", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse({
        features: [
          {
            properties: {
              type: "city",
              name: "Głogów Małopolski",
              country: "Polska",
              countrycode: "PL",
            },
            geometry: { coordinates: [21.9627571, 50.1511809] },
          },
          {
            properties: {
              type: "house",
              name: "Przystanek",
              city: "Głogów Małopolski",
              countrycode: "PL",
            },
            geometry: { coordinates: [21.96, 50.15] },
          },
        ],
      }),
    );

    const suggestions = await searchDeliveryAddresses("glo", fetcher);

    expect(suggestions).toEqual([
      {
        label: "Głogów Małopolski",
        detail: "Miejscowość · wybierz, aby doprecyzować adres",
        kind: "place",
        latitude: 50.1511809,
        longitude: 21.9627571,
      },
    ]);
    expect(new URL(String(fetcher.mock.calls[0]?.[0])).searchParams.get("q")).toBe("glo");
  });
});
