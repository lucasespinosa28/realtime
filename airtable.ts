import Airtable from "airtable";

const baseId = process.env.BASE_ID;
const apiKey = process.env.API_KEY;

if (!baseId) {
  throw new Error('Missing BASE_ID environment variable');
}
if (!apiKey) {
  throw new Error('Missing API_KEY environment variable');
}

Airtable.configure({
    endpointUrl: 'https://api.airtable.com',
    apiKey: apiKey
});
const base = Airtable.base(baseId);

// base('Table 1').select({
//     // Selecting the first 3 records in Grid view:
//     maxRecords: 100,
//     view: "Grid view"
// }).eachPage(function page(records, fetchNextPage) {
//     // This function (`page`) will get called for each page of records.

//     records.forEach(function (record) {
//         console.log('id:', record.get('id'));
//         console.log('price:', record.get('price'));
//         console.log('event:', record.get('event'));
//         console.log('outcome:', record.get('outcome'));
//         console.log('url:', record.get('url'));
//     });

//     // To fetch the next page of records, call `fetchNextPage`.
//     // If there are more records, `page` will get called again.
//     // If there are no more records, `done` will get called.
//     fetchNextPage();

// }, function done(err) {
//     if (err) { console.error(err); return; }
// });

base('Table 1').create([
  {
    fields: {
      id: "0x4235694608b03ef0cf4f962408817be445b292b6e327c81dbf3ba07f690e9636",
      price: 0.97,
      event: "xrp-up-or-down-august-5-8pm-et",
      outcome: "Down",
      url: "https://polymarket.com/event/xrp-up-or-down-august-5-8pm-et"
    }
  }
], function(err, records) {
  if (err) {
    console.error(err);
    return;
  }
  if (records) {
    records.forEach(function(record) {
      console.log('Created record:', record.getId());
    });
  }
});