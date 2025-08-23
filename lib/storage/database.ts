import { DatabaseMemoryManager } from ".";
import { OrderBookDatabase } from "./OrderBookDatabase";

export const memoryDatabase = new DatabaseMemoryManager();
export const orderBookDatabase = new OrderBookDatabase();