import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, 'pages', 'AdminAnalyticsPage.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// Fix: Remove unclosed className attributes with missing closing quote and add proper closing tag
content = content.replace(
    /className="(.+?)\s+title="([^"]+)"/g,
    'className="$1" title="$2"'
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed remaining className issues in AdminAnalyticsPage.tsx');
