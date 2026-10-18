import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { estimateDeliveryCost, searchDeliveryAddresses } from "@/lib/delivery-distance";

function mapServiceFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, {
    ...init,
    headers: {
      ...Object.fromEntries(new Headers(init?.headers).entries()),
      "User-Agent": "WakeUpHouseMenu/1.0 (bar@arkadiazone.pl)",
    },
  });
}

export const searchDeliveryAddressesOnServer = createServerFn({ method: "POST" })
  .validator(z.object({ query: z.string().trim().min(3).max(120) }))
  .handler(async ({ data }) => searchDeliveryAddresses(data.query, mapServiceFetch));

export const estimateDeliveryCostOnServer = createServerFn({ method: "POST" })
  .validator(
    z.object({
      latitude: z.number().min(49).max(55),
      longitude: z.number().min(14).max(24),
    }),
  )
  .handler(async ({ data }) => estimateDeliveryCost(data, mapServiceFetch));
