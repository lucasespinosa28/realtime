const logs = await Bun.file("./logs/app.log").text();
let placed = 0;
let matched = 0;

// Track unique asset IDs for matched
const matchedAssets = new Set<string>();

// Regex to match any asset ID with 77 or more digits
const assetIdPattern = /\b\d{40,}\b/;

// Regex to extract asset ID from log line (handles asset: '123456...')
function extractAssetId(line: string): string | null {
    const match = line.match(/asset:\s*'(\d{40,})'/i);
    return match ? match[1] : null;
}

for (const line of logs.split("\n")) {
    if (line.includes("[INF]")) {
        if (line.includes("bitcoin")) {
            if(line.includes("placed")) {
                placed++;
            }
            if(line.includes("matched")) {
                const assetId = extractAssetId(line);
                if (assetId && assetIdPattern.test(assetId) && !matchedAssets.has(assetId)) {
                    // Only count unique asset matches for similar asset IDs
                    matchedAssets.add(assetId);
                    matched++;
                }
            }
        }
    }
}

console.log({ placed, matched })
