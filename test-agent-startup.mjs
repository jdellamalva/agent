// Test script to mimic the agent startup
import dotenv from 'dotenv';
dotenv.config();

console.log('Environment variables after dotenv.config():');
console.log('SLACK_BOT_TOKEN:', process.env.SLACK_BOT_TOKEN ? 'Present' : 'Missing');
console.log('SLACK_APP_TOKEN:', process.env.SLACK_APP_TOKEN ? 'Present' : 'Missing');
console.log('SLACK_SIGNING_SECRET:', process.env.SLACK_SIGNING_SECRET ? 'Present' : 'Missing');

// Import and test the config
import { validateConfig, defaultConfig } from './src/utils/config.js';

console.log('\nConfig values:');
console.log('config.slack.botToken:', defaultConfig.slack.botToken ? 'Present' : 'Missing');
console.log('config.slack.appToken:', defaultConfig.slack.appToken ? 'Present' : 'Missing');
console.log('config.slack.signingSecret:', defaultConfig.slack.signingSecret ? 'Present' : 'Missing');

console.log('\nTrying to validate config...');
try {
  validateConfig(defaultConfig);
  console.log('✅ Config validation passed!');
} catch (error) {
  console.error('❌ Config validation failed:', error.message);
}
