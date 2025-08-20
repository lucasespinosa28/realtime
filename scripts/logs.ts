const logs = await Bun.file("./logs/app.log").text();
const markets: string[] = [];
for (const line of logs.split("\n")) {
    // process each line
    if (line.includes("too low")) {
        const match = line.match(/'([^']*)'/);
        if (match) {
            console.log(match[1]); // text between single quotes
            markets.push(match[1])
        }
    }
}

//STOP LOSS:

const loss: string[] = [];
for (const market of markets) {
   for (const line of logs.split("\n")) {
       if (line.includes("STOP LOSS")) {
        if(line.includes(market)){
           console.log(line)
           loss.push(market);
        }
       }
   }
}

// Remove duplicates from loss array
const uniqueLoss = [...new Set(loss)];
console.log("Unique STOP LOSS markets:", uniqueLoss);