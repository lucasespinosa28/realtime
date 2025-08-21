import { isConstructorDeclaration } from "typescript";
import type { Market } from "./lib/trading/model";
import { isTimeMatch } from "./utils/time";

const markets: Market[] = await Bun.file("crypto.json").json();

for (const market of markets) {
    // Check if time matches current ET time
    if (isTimeMatch(market.question)) {
        console.log(market);
    }
}