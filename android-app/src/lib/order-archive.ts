import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { gzipSync, strToU8 } from "fflate";
import { supabase } from "./supabase";
import type { OrderRow } from "../types";

const pageSize = 500;

export async function loadOrderHistory() {
  const history: OrderRow[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .in("status", ["completed", "cancelled"])
      .order("created_at", { ascending: false })
      .order("order_number", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    const page = (data ?? []) as OrderRow[];
    history.push(...page);
    if (page.length < pageSize) return history;
  }
}

export async function shareCompressedOrderHistory(orders: OrderRow[]) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Udostępnianie plików nie jest dostępne na tym urządzeniu.");
  }

  const archive = gzipSync(
    strToU8(
      JSON.stringify({
        format: "wakeuphouse-orders",
        version: 1,
        exportedAt: new Date().toISOString(),
        orders,
      }),
    ),
    { level: 9 },
  );
  const file = new File(
    Paths.cache,
    `wakeuphouse-orders-${new Date().toISOString().slice(0, 10)}.json.gz`,
  );
  await file.write(archive);
  await Sharing.shareAsync(file.uri, {
    dialogTitle: "Eksport historii zamówień",
    mimeType: "application/gzip",
    UTI: "org.gnu.gnu-zip-archive",
  });
}
