import { polymarketAPILogger } from "../../utils/logger";



const priceHandler = (price: number): number => {
  const fixedPrice = Number(price.toFixed(2));
  if (fixedPrice !== price) {
    price = fixedPrice;
  }

  // Check if current time has 40 minutes or less (e.g., 8:40, 12:30, etc.)
  const currentTime = new Date();
  const minutes = currentTime.getMinutes();


  if ([0.96, 0.97, 0.98, 0.99].includes(price)) {
    price = 0.95;
  }

  if ([0.90, 0.91, 0.92, 0.93, 0.94].includes(price)) {
    price = 0.90;
  }

  if (minutes <= 40) {
    price = 0.90;
    polymarketAPILogger.info("Time has {minutes} minutes (≤40), setting price to 0.90", { minutes });
  }
  return price;
};

export default priceHandler;