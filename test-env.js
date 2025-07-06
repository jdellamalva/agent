const dotenv = require('dotenv');
const path = require('path');

console.log('Current working directory:', process.cwd());
console.log('Loading .env from:', path.resolve('.env'));

const result = dotenv.config();
console.log('Dotenv result:', result);

console.log('SLACK_BOT_TOKEN:', process.env.SLACK_BOT_TOKEN ? 'Present' : 'Missing');
console.log('SLACK_BOT_TOKEN length:', process.env.SLACK_BOT_TOKEN?.length || 0);
console.log('SLACK_APP_TOKEN:', process.env.SLACK_APP_TOKEN ? 'Present' : 'Missing');
console.log('SLACK_SIGNING_SECRET:', process.env.SLACK_SIGNING_SECRET ? 'Present' : 'Missing');
