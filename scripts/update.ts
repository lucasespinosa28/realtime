import { polymarket } from "../lib/trading";

const file = Bun.file("markets.json");


interface Market {
    conditionId: string;
    Up?: string;
    Down?: string;
}

interface Markets {
    conditionId: string;
    title:string
    Up?: string;
    Down?: string;

}

const markets: Market[] = await file.json();

const updated: Markets[] = [];


let count = markets.length;
for (const market of markets) {
   const data = await polymarket.getMarket(market.conditionId);
    updated.push({
        conditionId: market.conditionId,
        title: data.question,
        Up: market.Up,
        Down: market.Down
    });
   console.log(`Processed market ${count}: ${data.question}`);
   count--;
}

 await Bun.write("market.json", JSON.stringify(updated, null, 2));