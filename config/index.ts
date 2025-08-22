
import CONSTANT from "./constant";
import type { Instructions } from "./model";

const instructions: Instructions[] = [
    {
        title: "XRP Up or Down",
        minutes: 0,
        price: 0.90,
        size: 5,
    },
    {
        //bitcoin up or down - august 22, 2am et
        title: "Bitcoin Up or Down",
        minutes: 0,
        price: 0.05,
        size: 5,
    },
    {
        title: "Ethereum Up or Down ",
        minutes: 0,
        price: 0.90,
        size: 5,
    },
    {
        title: "Solana Up or Down",
        minutes: 0,
        price: 0.90,
        size: 5,
    }
    
]

export {
    instructions,
    CONSTANT,
}