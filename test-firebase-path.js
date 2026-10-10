import fs from 'fs';
fetch('https://egurujik-default-rtdb.firebaseio.com/gurujismart/Users/9699368189/MonthlyTests/6c8ee993.json').then(res => res.json()).then(data => {
    fs.writeFileSync('firebase_testpath.json', JSON.stringify(data, null, 2));
    console.log("Done");
});
