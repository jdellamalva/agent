import { globalValidationEngine } from './src/core/validation/ValidationEngine';
import { CommandValidationRules } from './src/core/validation/CommandValidationRules';

// Initialize rules
console.log('Initializing rules...');
CommandValidationRules.initialize();

// Check what rules are registered
console.log('StructuredCommand rules:', globalValidationEngine.hasRules('StructuredCommand'));
console.log('file_read rules:', globalValidationEngine.hasRules('file_read'));
console.log('shell_exec rules:', globalValidationEngine.hasRules('shell_exec'));

// Test direct validation
const structuredCommandData = {
  action: 'file_read',
  parameters: { path: 'test.txt' },
  reasoning: 'Not sure about this',
  confidence: 0.5
};

console.log('Direct StructuredCommand validation:');
const result = globalValidationEngine.validate('StructuredCommand', structuredCommandData);
console.log(JSON.stringify(result, null, 2));

console.log('Direct file_read validation:');
const fileResult = globalValidationEngine.validate('file_read', structuredCommandData.parameters);
console.log(JSON.stringify(fileResult, null, 2));
