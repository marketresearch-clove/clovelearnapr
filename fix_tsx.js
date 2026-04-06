const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'pages', 'AdminAnalyticsPage.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// Fix 1: Add closing div for text-right div before ))}`
content = content.replace(
    'certificates earned</p>\n              </div>',
    'certificates earned</p>\n                </div>\n              </div>'
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed AdminAnalyticsPage.tsx');
