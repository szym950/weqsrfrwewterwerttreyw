import { Buffer } from "node:buffer";
import { timingSafeEqual, createHash } from "node:crypto";
import { notifyStaffOfNewOrder } from "../_shared/order-push.ts";

function jsonResponse(status: number) {
  return new Response(null, { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function signatureFromHeader(value: string | null) {
  if (!value) return null;
  const fields = new Map(
    value.split(";").flatMap((field) => {
      const separator = field.indexOf("=");
      return separator < 0
        ? []
        : [[field.slice(0, separator).trim().toLowerCase(), field.slice(separator + 1).trim()]];
    }),
  );
  if (fields.get("algorithm")?.toUpperCase() !== "MD5") return null;
  const signature = fields.get("signature");
  return signature && /^[\da-f]{32}$/i.test(signature) ? signature : null;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return jsonResponse(405);
  const secondKey = Deno.env.get("PAYU_SECOND_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const posId = Deno.env.get("PAYU_POS_ID");
  if (!secondKey || !serviceRoleKey || !supabaseUrl || !posId) {
    console.error("Missing PayU notification configuration.");
    return jsonResponse(503);
  }

  const rawBody = await request.text();
  if (!rawBody || rawBody.length > 128_000) return jsonResponse(413);

  const providedSignature = signatureFromHeader(
    request.headers.get("OpenPayu-Signature") ?? request.headers.get("X-OpenPayU-Signature"),
  );
  if (!providedSignature) return jsonResponse(400);

  const expectedSignature = createHash("md5").update(`${rawBody}${secondKey}`, "utf8").digest();
  const suppliedSignature = Buffer.from(providedSignature, "hex");
  if (
    suppliedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(suppliedSignature, expectedSignature)
  ) {
    console.warn("Rejected a PayU notification with an invalid signature.");
    return jsonResponse(401);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse(400);
  }
  if (!isRecord(payload) || !isRecord(payload.order)) return jsonResponse(400);

  const order = payload.order;
  const expectedPosId = Number(posId);
  const merchantPosId = Number(order.merchantPosId);
  const totalGrosz = Number(order.totalAmount);
  const statuses = new Set(["PENDING", "WAITING_FOR_CONFIRMATION", "COMPLETED", "CANCELED"]);
  if (
    typeof order.extOrderId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      order.extOrderId,
    ) ||
    typeof order.orderId !== "string" ||
    !Number.isSafeInteger(expectedPosId) ||
    merchantPosId !== expectedPosId ||
    order.currencyCode !== "PLN" ||
    !Number.isSafeInteger(totalGrosz) ||
    totalGrosz < 1 ||
    typeof order.status !== "string" ||
    !statuses.has(order.status)
  ) {
    return jsonResponse(400);
  }

  let response: Response;
  try {
    response = await fetch(
      `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/rpc/apply_payu_notification`,
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
          p_order_id: order.extOrderId,
          p_payu_order_id: order.orderId,
          p_total_grosz: totalGrosz,
          p_payu_status: order.status,
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
  } catch (error) {
    console.error("Could not update the order from a PayU notification.", error);
    return jsonResponse(503);
  }

  if (!response.ok) {
    console.error("Supabase rejected a PayU notification update.", response.status);
    return jsonResponse(503);
  }

  let applied: unknown;
  try {
    applied = await response.json();
  } catch (error) {
    console.error("Supabase returned an invalid PayU notification response.", error);
    return jsonResponse(503);
  }
  if (applied !== true) {
    console.error("A signed PayU notification did not match a stored order.");
    return jsonResponse(400);
  }
  if (order.status === "COMPLETED") {
    EdgeRuntime.waitUntil(
      notifyStaffOfNewOrder(supabaseUrl, serviceRoleKey, order.extOrderId).catch(
        (error: unknown) => {
          console.error("Could not notify staff about a paid order.", error);
        },
      ),
    );
  }
  return jsonResponse(200);
});
