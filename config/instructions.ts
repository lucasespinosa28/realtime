import type { Instructions } from "./model";

const instructions: Instructions[] = [
    {
        slug: "up-or-down",
        size: 5,
        jump:"bitcoin",
        Solana:{
            Up: 0.4,
            Down: 0.2
        },
        Bitcoin:{
            Up: 0.1,
            Down: 0.7
        },
        Ethereum:{
            Up: 0.5,
            Down: 0.8
        },
        xrp:{
            Up:0.6,
            Down:0.5
        }
    }
];

export default instructions;


// Asset	Outcome	Perfect Price Balance
// xrp	Up	<=0.6
// xrp	Down	<=0.5
// solana	Up	<=0.4
// solana	Down	<=0.2
// bitcoin	Up	<=0.1
// bitcoin	Down	<=0.7
// ethereum	Up	<=0.5
// ethereum	Down	<=0.8