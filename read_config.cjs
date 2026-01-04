const fs = require('fs');
try {
    const content = fs.readFileSync('./dist/assets/index-DtSmunJR.js', 'utf8');
    const term = 'authDomain';
    const index = content.indexOf(term);
    console.log(`Term '${term}' found at index: ${index}`);
    if (index !== -1) {
        console.log('--- CONTEXT START ---');
        console.log(content.substring(index - 50, index + 300));
        console.log('--- CONTEXT END ---');
    }
} catch (e) {
    console.error(e);
}
