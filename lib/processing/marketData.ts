import type { Market, MarketToken } from "../trading/model";
import { crypto1hMarkets } from "../../scripts/filterMarkerts";

export interface Token extends MarketToken {
    title: string;
}

export let markets: Market[] = [];
export let tokens: Token[] = [];
export let titles = new Map<string, string>();
export let oppositeAsset = new Map<string, string>();

export function loadMarketData(): void {
    markets = crypto1hMarkets();
    tokens = markets.flatMap(market => market.tokens.map(token => ({
        ...token,
        title: market.question.toLowerCase()
    })));

    titles = new Map<string, string>();
    oppositeAsset = new Map<string, string>();

    for (const token of tokens) {
        titles.set(token.token_id, token.title);
    }

    for (const market of markets) {
        if (market.tokens.length === 2) {
            const [asset1, asset2] = market.tokens;
            oppositeAsset.set(asset1.token_id, asset2.token_id);
            oppositeAsset.set(asset2.token_id, asset1.token_id);
        }
    }
}

export function tokensId(): string {
    return tokens.map(token => `"${token.token_id}"`).join(",");
}