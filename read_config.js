const fs = require('fs');
const content = fs.readFileSync('./dist/assets/index-DtSmunJR.js', 'utf8');
const index = content.indexOf('apiKey');
if (index !== -1) {
    console.log(content.substring(index, index + 400));
} else {
    console.log('Not found');
}
