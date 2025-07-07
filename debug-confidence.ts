import { globalValidationEngine, ValidationEngine } from './src/core/validation/ValidationEngine';

// Test the lowConfidenceWarning rule directly
const rules = ValidationEngine.createCommonRules();
const lowConfRule = rules.lowConfidenceWarning(0.7);

const testData = {
  action: 'file_read',
  parameters: { path: 'test.txt' },
  reasoning: 'Not sure about this',
  confidence: 0.5
};

console.log('Testing low confidence rule directly:');
const result = lowConfRule.validate(testData);
console.log(JSON.stringify(result, null, 2));

console.log('Confidence value:', testData.confidence);
console.log('Is number?', typeof testData.confidence === 'number');
console.log('Is less than 0.7?', testData.confidence < 0.7);
