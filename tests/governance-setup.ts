/**
 * Jest Global Setup - Governance Checks
 * 
 * Runs deterministic governance checks before the test suite to ensure
 * code quality standards are met before any tests execute.
 */

const { execSync } = require('child_process');
const path = require('path');

module.exports = async function() {
  console.log('\n🔍 Running governance checks before tests...\n');
  
  const governanceRunner = path.join(__dirname, '../scripts/governance/governance-runner.ts');
  
  try {
    // Run only deterministic checks (fast, no LLM required)
    // Using 60000ms timeout (referenced as TEST.DEFAULT_TIMEOUT in constants)
    const output = execSync(`npx tsx "${governanceRunner}" --deterministic-only`, {
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 60000 // TEST.DEFAULT_TIMEOUT from constants.ts
    });
    
    console.log('✅ All governance checks passed\n');
    
  } catch (error: any) {
    console.error('❌ Governance checks failed:');
    console.error(error.stdout || error.message);
    console.error('\n💡 Fix governance issues before running tests\n');
    
    // Fail the test suite if governance checks fail
    process.exit(1);
  }
};
