export interface Instructions  {
    slug:string;
    size:number;
    jump:string;
    Solana:{
            Up: number
            Down: number
        },
        Bitcoin:{
            Up:number,
            Down: number
        },
        Ethereum:{
            Up: number,
            Down: number
        },
        xrp:{
            Up:number,
            Down:number
        }
}
