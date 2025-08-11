import { createFullMarket, init } from "../lib/storage/db";
import type { FullMarketRecord } from "../lib/storage/types";
import { clobClient } from "../lib/trading";
  const { saveLatestCursor } = await import("../lib/storage/db");
  
async function fetchAllMarketsAndSave() {
  // Initialize DB (create tables if needed)
  init();

  const allMarkets = [];
  let nextCursor = "";
  let page = 1;
  let latestCursor = "";
  while (true) {
    // getMarkets() returns response.data as Market[]
    // To support pagination, we need to call the underlying clobClient.getMarkets with next_cursor
    // But current getMarkets() does not support cursor, so we call clobClient.getMarkets directly
    // For now, we assume getMarkets() returns the first page, so we need to patch this if needed
    // If getMarkets() supports cursor, use it
  const response = await clobClient.getMarkets(nextCursor);
    const { data, next_cursor } = response;
    if (!Array.isArray(data)) break;
    for (const market of data) {
      // Only save if end_date_iso is not in the past
      const endDate = new Date(market.end_date_iso ?? "");
      const now = new Date();
      if (isNaN(endDate.getTime()) || endDate >= now) {
        const fullMarket: FullMarketRecord = {
          id: market.condition_id,
          title: market.question,
          enable_order_book: market.enable_order_book ?? false,
          active: market.active ?? false,
          closed: market.closed ?? false,
          archived: market.archived ?? false,
          accepting_orders: market.accepting_orders ?? false,
          accepting_order_timestamp: market.accepting_order_timestamp ?? null,
          minimum_order_size: Number(market.minimum_order_size ?? 0),
          minimum_tick_size: Number(market.minimum_tick_size ?? 0),
          condition_id: market.condition_id,
          question_id: market.question_id ?? "",
          question: market.question ?? "",
          description: market.description ?? "",
          market_slug: market.market_slug ?? "",
          end_date_iso: market.end_date_iso ?? "",
          game_start_time: market.game_start_time ?? null,
          seconds_delay: Number(market.seconds_delay ?? 0),
          fpmm: market.fpmm ?? "",
          maker_base_fee: Number(market.maker_base_fee ?? 0),
          taker_base_fee: Number(market.taker_base_fee ?? 0),
          notifications_enabled: market.notifications_enabled ?? false,
          neg_risk: market.neg_risk ?? false,
          neg_risk_market_id: market.neg_risk_market_id ?? "",
          neg_risk_request_id: market.neg_risk_request_id ?? "",
          icon: market.icon ?? "",
          image: market.image ?? "",
          rewards: market.rewards ?? {},
          is_50_50_outcome: market.is_50_50_outcome ?? false,
          tokens: market.tokens ?? [],
          tags: market.tags ?? [],
        };
        createFullMarket(fullMarket);
      }
    }
    allMarkets.push(...data);
    console.log(`Fetched page ${page}, got ${data.length} markets.`);
    if (!next_cursor || next_cursor === "LTE=") {
      latestCursor = nextCursor;
      break;
    }
    nextCursor = next_cursor;
    page++;
  }
  console.log(`Total markets fetched: ${allMarkets.length}`);
  // Save the latest cursor used
  saveLatestCursor(latestCursor);
}

fetchAllMarketsAndSave().catch((err) => {
  console.error("Error fetching and saving markets:", err);
  process.exit(1);
});
