import { corsHeaders } from "../_shared/cors.ts";
import { orderableMenu } from "../_shared/menu.ts";

type OrderRequest = {
  idempotencyKey: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  fulfillment: "delivery" | "pickup";
  paymentMethod: "cash_delivery" | "payu" | "onsite";
  deliveryAddress: string | null;
  destination: { latitude: number; longitude: number } | null;
  items: Array<{ dishName: string; quantity: number }>;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function payuConfiguration() {
  const environment = Deno.env.get("PAYU_ENVIRONMENT") ?? "sandbox";
  const posId = Deno.env.get("PAYU_POS_ID");
  const clientId = Deno.env.get("PAYU_CLIENT_ID");
  const clientSecret = Deno.env.get("PAYU_CLIENT_SECRET");
  const secondKey = Deno.env.get("PAYU_SECOND_KEY");
  const siteUrl = Deno.env.get("SITE_URL")?.replace(/\/+$/, "");

  if (
    (environment !== "sandbox" && environment !== "production") ||
    !posId ||
    !clientId ||
    !clientSecret ||
    !secondKey ||
    !siteUrl
  ) {
    throw new Error("PayU secrets or SITE_URL are missing or invalid.");
  }
  const publicSite = new URL(siteUrl);
  if (
    publicSite.protocol !== "https:" ||
    publicSite.username ||
    publicSite.password ||
    publicSite.pathname !== "/" ||
    publicSite.search ||
    publicSite.hash
  ) {
    throw new Error("SITE_URL must be the public HTTPS website origin.");
  }

  return {
    environment,
    posId,
    clientId,
    clientSecret,
    secondKey,
    siteUrl,
    apiUrl:
      environment === "production" ? "https://secure.payu.com" : "https://secure.snd.payu.com",
  };
}

async function getPayuAccessToken(config: ReturnType<typeof payuConfiguration>) {
  const form = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
  const response = await fetch(`${config.apiUrl}/pl/standard/user/oauth/authorize`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    console.error("PayU OAuth request failed.", response.status);
    throw new Error("Nie udało się połączyć z PayU. Sprawdź dane sandbox w Supabase.");
  }
  const result: unknown = await response.json();
  if (!isRecord(result) || typeof result.access_token !== "string") {
    console.error("PayU OAuth response did not include an access token.");
    throw new Error("PayU nie zwróciło tokenu dostępu.");
  }
  return result.access_token;
}

function splitCustomerName(value: string) {
  const [firstName, ...rest] = value.trim().split(/\s+/);
  return { firstName, lastName: rest.join(" ") || firstName };
}

async function savePayuRedirect(
  supabaseUrl: string,
  serviceRoleKey: string,
  orderId: string,
  payuOrderId: string,
  redirectUrl: string,
) {
  const response = await fetch(
    `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/rpc/save_payu_redirect`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        ...(serviceRoleKey.startsWith("sb_secret_")
          ? {}
          : { Authorization: `Bearer ${serviceRoleKey}` }),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_order_id: orderId,
        p_payu_order_id: payuOrderId,
        p_redirect_url: redirectUrl,
      }),
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok || (await response.json()) !== true) {
    throw new Error("Nie udało się zapisać przekierowania do PayU.");
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON request." }, 400);
  }

  if (!isRecord(payload)) return jsonResponse({ error: "Invalid order." }, 400);
  const body = payload as unknown as Partial<OrderRequest>;
  const {
    idempotencyKey,
    customerName,
    customerEmail,
    customerPhone,
    fulfillment,
    paymentMethod,
    items,
  } = body;

  if (
    typeof idempotencyKey !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      idempotencyKey,
    ) ||
    typeof customerName !== "string" ||
    customerName.trim().length < 2 ||
    customerName.length > 120 ||
    typeof customerPhone !== "string" ||
    !/^[+0-9 ()-]{7,20}$/.test(customerPhone) ||
    customerPhone.replace(/\D/g, "").length < 7 ||
    (fulfillment !== "delivery" && fulfillment !== "pickup") ||
    (paymentMethod !== "cash_delivery" && paymentMethod !== "onsite" && paymentMethod !== "payu") ||
    (fulfillment === "delivery" && paymentMethod === "onsite") ||
    (fulfillment === "pickup" && paymentMethod !== "onsite") ||
    (paymentMethod === "payu" &&
      (fulfillment !== "delivery" ||
        typeof customerEmail !== "string" ||
        customerEmail.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail))) ||
    !Array.isArray(items) ||
    items.length < 1 ||
    items.length > 30
  ) {
    return jsonResponse({ error: "Check the customer and order details." }, 400);
  }

  const validatedItems = [];
  const seen = new Set<string>();
  let subtotalGrosz = 0;
  for (const item of items) {
    if (
      !isRecord(item) ||
      typeof item.dishName !== "string" ||
      typeof item.quantity !== "number" ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 99 ||
      seen.has(item.dishName)
    ) {
      return jsonResponse({ error: "One or more order items are invalid." }, 400);
    }
    const dish = orderableMenu[item.dishName];
    if (!dish) return jsonResponse({ error: "An item is no longer available." }, 400);
    seen.add(item.dishName);
    const lineTotalGrosz = dish.priceGrosz * item.quantity;
    subtotalGrosz += lineTotalGrosz;
    validatedItems.push({
      dish_name: item.dishName,
      category: dish.category,
      station: dish.station,
      quantity: item.quantity,
      unit_price: dish.priceGrosz / 100,
      line_total: lineTotalGrosz / 100,
    });
  }

  if (fulfillment === "delivery" && subtotalGrosz > 15000 && paymentMethod !== "payu") {
    return jsonResponse(
      {
        error: "Zamówienie powyżej 150 zł wymaga płatności PayU.",
      },
      400,
    );
  }

  let payu: ReturnType<typeof payuConfiguration> | undefined;
  if (paymentMethod === "payu") {
    try {
      payu = payuConfiguration();
    } catch (error) {
      console.error(error);
      return jsonResponse({ error: "PayU nie jest jeszcze skonfigurowane w Supabase." }, 503);
    }
  }

  let deliveryCostGrosz = 0;
  let deliveryAddress: string | null = null;
  if (fulfillment === "delivery") {
    const destination = body.destination;
    if (
      typeof body.deliveryAddress !== "string" ||
      body.deliveryAddress.trim().length < 5 ||
      body.deliveryAddress.length > 240 ||
      !isRecord(destination) ||
      typeof destination.latitude !== "number" ||
      typeof destination.longitude !== "number" ||
      destination.latitude < 50.05 ||
      destination.latitude > 50.27 ||
      destination.longitude < 21.78 ||
      destination.longitude > 22.14
    ) {
      return jsonResponse({ error: "Wybierz obsługiwany, dokładny adres dostawy." }, 400);
    }

    const routingUrl = new URL(
      `https://router.project-osrm.org/route/v1/driving/21.9547502,50.1531905;${destination.longitude},${destination.latitude}`,
    );
    routingUrl.searchParams.set("overview", "false");
    routingUrl.searchParams.set("steps", "false");
    let routeResponse: Response;
    try {
      routeResponse = await fetch(routingUrl, { signal: AbortSignal.timeout(8000) });
    } catch (error) {
      console.error("OSRM request failed while verifying a delivery route.", error);
      return jsonResponse({ error: "Nie udało się ponownie obliczyć trasy dostawy." }, 502);
    }
    if (!routeResponse.ok) {
      return jsonResponse({ error: "Nie udało się ponownie obliczyć trasy dostawy." }, 502);
    }
    let route: { code?: string; routes?: { distance?: number }[] };
    try {
      route = await routeResponse.json();
    } catch (error) {
      console.error("OSRM returned invalid route data.", error);
      return jsonResponse({ error: "Nie udało się odczytać trasy dostawy." }, 502);
    }
    const distanceMeters = route.routes?.[0]?.distance;
    if (route.code !== "Ok" || typeof distanceMeters !== "number" || distanceMeters > 30000) {
      return jsonResponse({ error: "Nie znaleziono trasy do tego adresu dostawy." }, 400);
    }
    deliveryCostGrosz = Math.round((distanceMeters / 1000) * 150);
    deliveryAddress = body.deliveryAddress.trim();
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing Supabase service configuration for create-order.");
    return jsonResponse({ error: "Przyjmowanie zamówień jest chwilowo niedostępne." }, 503);
  }

  const subtotal = subtotalGrosz / 100;
  const deliveryCost = deliveryCostGrosz / 100;
  let response: Response;
  try {
    response = await fetch(`${supabaseUrl.replace(/\/+$/, "")}/rest/v1/rpc/create_web_order`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        ...(serviceRoleKey.startsWith("sb_secret_")
          ? {}
          : { Authorization: `Bearer ${serviceRoleKey}` }),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_order: {
          idempotency_key: idempotencyKey,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          fulfillment,
          delivery_address: deliveryAddress,
          customer_email: paymentMethod === "payu" ? customerEmail?.trim() : null,
          payment_method: paymentMethod,
          subtotal: subtotal.toFixed(2),
          delivery_cost: deliveryCost.toFixed(2),
          total: ((subtotalGrosz + deliveryCostGrosz) / 100).toFixed(2),
        },
        p_items: validatedItems,
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    console.error("Supabase order creation request failed.", error);
    return jsonResponse({ error: "Nie udało się zapisać zamówienia. Spróbuj ponownie." }, 503);
  }

  if (!response.ok) {
    console.error("Supabase rejected a new web order.", response.status, await response.text());
    return jsonResponse({ error: "Nie udało się zapisać zamówienia. Spróbuj ponownie." }, 503);
  }

  let result: unknown;
  try {
    result = await response.json();
  } catch (error) {
    console.error("Supabase returned invalid create-order JSON.", error);
    return jsonResponse({ error: "Nie udało się potwierdzić zamówienia." }, 503);
  }
  const order = Array.isArray(result) ? result[0] : null;
  const total = Number(order?.total);
  if (
    !order?.id ||
    !order?.order_number ||
    !Number.isFinite(total) ||
    typeof order.payment_status !== "string"
  ) {
    console.error("Supabase returned an invalid create-order response.");
    return jsonResponse({ error: "Nie udało się potwierdzić zamówienia." }, 503);
  }

  if (paymentMethod === "payu" && order.payment_status !== "paid") {
    if (typeof order.payu_redirect_url === "string" && order.payu_redirect_url) {
      return jsonResponse({
        id: order.id,
        orderNumber: Number(order.order_number),
        total,
        redirectUrl: order.payu_redirect_url,
      });
    }

    if (order.payment_status !== "pending" || !payu) {
      return jsonResponse({ error: "To zamówienie nie oczekuje już na płatność." }, 409);
    }

    try {
      const accessToken = await getPayuAccessToken(payu);
      const { firstName, lastName } = splitCustomerName(customerName);
      const payuProducts = validatedItems.map((item) => ({
        name: item.dish_name,
        unitPrice: Math.round(item.unit_price * 100),
        quantity: item.quantity,
      }));
      if (deliveryCostGrosz > 0) {
        payuProducts.push({
          name: "Dostawa",
          unitPrice: deliveryCostGrosz,
          quantity: 1,
        });
      }

      const payuResponse = await fetch(`${payu.apiUrl}/api/v2_1/orders`, {
        method: "POST",
        redirect: "manual",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          notifyUrl: `${Deno.env.get("SUPABASE_URL")?.replace(/\/+$/, "")}/functions/v1/payu-notify`,
          continueUrl: `${payu.siteUrl}/?payment=return`,
          customerIp:
            request.headers.get("cf-connecting-ip") ??
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            "127.0.0.1",
          merchantPosId: payu.posId,
          description: `Wake Up House - zamowienie #${order.order_number}`,
          currencyCode: "PLN",
          totalAmount: String(subtotalGrosz + deliveryCostGrosz),
          extOrderId: order.id,
          buyer: {
            email: customerEmail!.trim(),
            phone: customerPhone.trim(),
            firstName,
            lastName,
            language: "pl",
          },
          products: payuProducts,
        }),
        signal: AbortSignal.timeout(15000),
      });

      let payuResult: unknown = null;
      try {
        payuResult = await payuResponse.json();
      } catch {
        // PayU can return the redirect URL in the Location header with HTTP 302.
      }

      const responseData = isRecord(payuResult) ? payuResult : {};
      const redirectUrl =
        typeof responseData.redirectUri === "string"
          ? responseData.redirectUri
          : payuResponse.headers.get("Location");
      const payuOrderId = typeof responseData.orderId === "string" ? responseData.orderId : null;
      if ((!payuResponse.ok && payuResponse.status !== 302) || !redirectUrl || !payuOrderId) {
        console.error("PayU order creation failed.", payuResponse.status, responseData.status);
        return jsonResponse(
          { error: "PayU nie utworzyło płatności. Sprawdź ustawienia sandbox i spróbuj ponownie." },
          502,
        );
      }
      const safeRedirect = new URL(redirectUrl);
      const allowedPayuHosts =
        payu.environment === "production"
          ? ["secure.payu.com", "merch-prod.payu.com"]
          : ["secure.snd.payu.com", "merch-prod.snd.payu.com"];
      if (
        safeRedirect.protocol !== "https:" ||
        !allowedPayuHosts.includes(safeRedirect.hostname) ||
        safeRedirect.username ||
        safeRedirect.password
      ) {
        console.error("PayU returned an unexpected payment redirect host.");
        return jsonResponse({ error: "PayU zwróciło nieprawidłowy adres płatności." }, 502);
      }

      await savePayuRedirect(supabaseUrl, serviceRoleKey, order.id, payuOrderId, safeRedirect.href);
      return jsonResponse({
        id: order.id,
        orderNumber: Number(order.order_number),
        total,
        redirectUrl: safeRedirect.href,
      });
    } catch (error) {
      console.error("Could not initialize PayU order.", error);
      return jsonResponse(
        {
          error:
            error instanceof Error
              ? error.message
              : "Nie udało się rozpocząć płatności PayU. Spróbuj ponownie.",
        },
        502,
      );
    }
  }

  return jsonResponse({
    id: order.id,
    orderNumber: Number(order.order_number),
    total,
    paymentStatus: order.payment_status,
  });
});
