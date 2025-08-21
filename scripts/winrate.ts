import { DatabaseManager } from "../lib/storage/database";

const database1 = new DatabaseManager("trades.sqlite");
const database2 = new DatabaseManager("trades1.sqlite");
const database3 = new DatabaseManager("trades2.sqlite");
const database4 = new DatabaseManager("trades3.sqlite");
const database5 = new DatabaseManager("trades4.sqlite");

const tradeDB1 = database1.getAllTradesUnfiltered();
const tradeDB2 = database2.getAllTradesUnfiltered();
const tradeDB3 = database3.getAllTradesUnfiltered();
const tradeDB4 = database4.getAllTradesUnfiltered();
const tradeDB5 = database5.getAllTradesUnfiltered();

const tradeDB = tradeDB1.concat(tradeDB2, tradeDB3, tradeDB4, tradeDB5);
