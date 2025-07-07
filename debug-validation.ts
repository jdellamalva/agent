import { ResponseParser } from './src/core/responseParser';
import { StructuredCommand } from './src/core/promptEngineer';

// Test simple command validation
const responseParser = new ResponseParser();

const command: StructuredCommand = {
  action: 'file_read',
  parameters: { path: 'test.txt' },
  reasoning: 'Not sure about this',
  confidence: 0.5 // Low confidence
};

const result = responseParser.validateCommand(command);

console.log('Validation Result:', JSON.stringify(result, null, 2));

// Test validation of specific command types
const shellCommand: StructuredCommand = {
  action: 'shell_exec',
  parameters: { command: 'npm install' },
  reasoning: 'Install packages',
  confidence: 0.9
};

const shellResult = responseParser.validateCommand(shellCommand);
console.log('Shell Command Validation:', JSON.stringify(shellResult, null, 2));

const sensitiveCommand: StructuredCommand = {
  action: 'file_write',
  parameters: { path: 'config.json', content: '{"password": "secret123"}' },
  reasoning: 'Write config',
  confidence: 0.9
};

const sensitiveResult = responseParser.validateCommand(sensitiveCommand);
console.log('Sensitive Command Validation:', JSON.stringify(sensitiveResult, null, 2));
