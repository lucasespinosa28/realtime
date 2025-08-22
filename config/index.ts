import CONSTANT from "./constant";
import type { Instructions } from "./model";

const instructions: Instructions[] = [
    {
        title: "xrp up or down",  // Changed to match formatTitle output
        minutes: 0,
        price: 0.90,
        size: 5,
    },
    {
        //bitcoin up or down - august 22, 2am et
        title: "bitcoin up or down",  // Changed "or" to "Or"
        minutes: 0,
        price: 0.05,
        size: 5,
    },
    {
        title: "ethereum up or down",  // Changed "or" to "Or"
        minutes: 0,
        price: 0.90,
        size: 5,
    },
    {
        title: "solana up or down",  // Changed "or" to "Or"
        minutes: 0,
        price: 0.90,
        size: 5,
    }

]
export {
    instructions,
    CONSTANT,
}