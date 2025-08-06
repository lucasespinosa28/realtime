import { ClobClient, type BookParams } from "@polymarket/clob-client";

const host = 'https://clob.polymarket.com';
const clobClient = new ClobClient(host, 137);

async function main() {
    const conditionId = "0x00adca43a354dbf652c0b2fbd86f4625abd8dd6bb47cc7c6aef4fa1bdf8db16d";
    const market = await clobClient.getMarket(conditionId);
    console.log(`market: `);
    console.log(market);
   // console.log(`Up: `);
   // console.log(market.tokens[0].token_id);
   // console.log(`Down: `);
   // console.log(market.tokens[1].token_id);

    const YES = market.tokens[0].token_id;
    const NO = market.tokens[1].token_id;

    const orderbooks = await clobClient.getOrderBooks([
        { token_id: YES },
        { token_id: NO },
    ] as BookParams[]);

    console.log(orderbooks);

}
main();