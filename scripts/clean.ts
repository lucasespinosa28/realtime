import type { Market } from "../lib/trading/model";

// Function to remove duplicates based on market_slug
function removeDuplicateMarkets(markets: Market[]) {
    const seen = new Set();
    const uniqueMarkets = [];
    
    for (const market of markets) {
        if (!seen.has(market.market_slug)) {
            seen.add(market.market_slug);
            uniqueMarkets.push(market);
        }
    }
    
    return uniqueMarkets;
}

// Main function
async function cleanLossFile() {
    try {
        // Read the loss.json file
        const markets: Market[] = await Bun.file("./data/loss.json").json();

        console.log(`Original number of markets: ${markets.length}`);
        
        // Remove duplicates
        const uniqueMarkets = removeDuplicateMarkets(markets);
        
        console.log(`Number of unique markets: ${uniqueMarkets.length}`);
        console.log(`Duplicates removed: ${markets.length - uniqueMarkets.length}`);
        
        // Write the cleaned data back to the file
        await Bun.write("./data/loss.json", JSON.stringify(uniqueMarkets, null, 2));
        console.log('File has been cleaned and saved successfully!');
        
    } catch (error) {
        console.error('Error processing file:', error.message);
    }
}

// Run the script
cleanLossFile();