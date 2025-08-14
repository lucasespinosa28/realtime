import { ClobClient } from "@polymarket/clob-client";
import { Wallet } from "ethers";
import CONSTANT from "../../config/constant";

const address = CONSTANT.proxy;

const signer = new Wallet(CONSTANT.key);

const clobClient = new ClobClient(CONSTANT.host, 137, signer);
export const creds = await clobClient.deriveApiKey();

const polymarket = new ClobClient(CONSTANT.host, 137, signer, creds, 2, address);
export default polymarket;

