function serviceHeaders(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    ...(serviceRoleKey.startsWith("sb_secret_")
      ? {}
      : { Authorization: `Bearer ${serviceRoleKey}` }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function setNotificationState(
  baseUrl: string,
  headers: Record<string, string>,
  functionName: "complete_order_push_notification" | "release_order_push_notification",
  orderId: string,
) {
  const response = await fetch(`${baseUrl}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ p_order_id: orderId }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error(`Could not ${functionName.replaceAll("_", " ")}: ${response.status}`);
  }
  return response.json();
}

export async function notifyStaffOfNewOrder(
  supabaseUrl: string,
  serviceRoleKey: string,
  orderId: string,
) {
  const baseUrl = supabaseUrl.replace(/\/+$/, "");
  const headers = serviceHeaders(serviceRoleKey);
  let claimed = false;
  try {
    const claimResponse = await fetch(`${baseUrl}/rest/v1/rpc/claim_order_push_notification`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ p_order_id: orderId }),
      signal: AbortSignal.timeout(8000),
    });
    if (!claimResponse.ok) {
      throw new Error(`Could not claim order push notification: ${claimResponse.status}`);
    }

    const claimResult: unknown = await claimResponse.json();
    if (!Array.isArray(claimResult) || claimResult.length === 0) return;
    claimed = true;

    const claim = claimResult[0] as unknown;
    if (
      !isRecord(claim) ||
      typeof claim.order_number !== "number" ||
      !Number.isSafeInteger(claim.order_number)
    ) {
      throw new Error("Supabase returned an invalid order number for a push notification.");
    }
    const orderNumber = claim.order_number;

    const tokensUrl = new URL(`${baseUrl}/rest/v1/staff_push_tokens`);
    tokensUrl.searchParams.set("select", "expo_push_token,staff_members!inner(role)");
    tokensUrl.searchParams.set("staff_members.role", "in.(administrator,orders)");
    const tokensResponse = await fetch(tokensUrl, {
      headers,
      signal: AbortSignal.timeout(8000),
    });
    if (!tokensResponse.ok) {
      throw new Error(`Could not load staff push tokens: ${tokensResponse.status}`);
    }

    const tokenRows: unknown = await tokensResponse.json();
    if (!Array.isArray(tokenRows)) throw new Error("Supabase returned invalid push tokens.");
    const tokens = tokenRows.flatMap((row: unknown) =>
      isRecord(row) && typeof row.expo_push_token === "string" ? [row.expo_push_token] : [],
    );

    for (let offset = 0; offset < tokens.length; offset += 100) {
      const messages = tokens.slice(offset, offset + 100).map((to) => ({
        to,
        sound: "default",
        channelId: "orders",
        title: "Nowe zamówienie",
        body: `Zamówienie #${orderNumber} czeka na przyjęcie.`,
        data: { orderId },
      }));
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(messages),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        throw new Error(`Expo Push Service returned ${response.status}.`);
      }

      const result: unknown = await response.json();
      if (!isRecord(result) || !Array.isArray(result.data)) {
        throw new Error("Expo Push Service returned an invalid response.");
      }

      const tickets: unknown[] = result.data;
      for (const ticket of tickets) {
        if (isRecord(ticket) && ticket.status === "error") {
          console.error("Expo Push Service rejected a staff notification.", ticket.message);
        }
      }
    }

    const completed = await setNotificationState(
      baseUrl,
      headers,
      "complete_order_push_notification",
      orderId,
    );
    if (completed !== true) throw new Error("Could not mark the order notification as sent.");
    claimed = false;
  } catch (error) {
    if (claimed) {
      try {
        await setNotificationState(baseUrl, headers, "release_order_push_notification", orderId);
      } catch (releaseError) {
        console.error("Could not release the order notification claim.", releaseError);
      }
    }
    throw error;
  }
}
