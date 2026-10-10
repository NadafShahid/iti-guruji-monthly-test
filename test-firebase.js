import fs from 'fs';
fetch('https://egurujik-default-rtdb.firebaseio.com/gurujismart/MonthlyTestIndex.json').then(res => res.json()).then(data => {
    fs.writeFileSync('firebase_dump.json', JSON.stringify(data, null, 2));
    console.log("Done");
});
