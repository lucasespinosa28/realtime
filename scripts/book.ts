import { orderBookDatabase } from "../lib/storage/database";

const book = orderBookDatabase.getAll();

console.log(book)