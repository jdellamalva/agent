#!/usr/bin/env node
/**
 * Governance Standards Extractor
 * 
 * Dynamically extracts and exposes the standards enforced by each governance script.
 * This provides a programmatic way to access the rules and patterns enforced
 * by the governance system without manually maintaining documentation.
 * 
 * Standards Enforced:
 * - All governance scripts must document their standards in JSDoc headers
 * - Standards must be machine-readable and extractable
 * - Each standard must specify its enforcement type (deterministic vs LLM-assisted)
 * - Standards must include examples of compliant and non-compliant patterns
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface GovernanceStandard {
  scriptName: string;
  title: string;
  purpose: string;
  type: 'deterministic' | 'llm-assisted';
  standards: string[];
  examples?: {
    good?: string[];
    bad?: string[];
  };
}

class StandardsExtractor {
  private rootDir: string;

  constructor() {
    this.rootDir = path.resolve(__dirname, '../..');
  }

  private extractStandardsFromScript(filePath: string): GovernanceStandard | null {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath, '.ts');

    // Extract JSDoc header
    const jsdocMatch = content.match(/\/\*\*\s*([\s\S]*?)\*\//);
    if (!jsdocMatch) return null;

    const jsdoc = jsdocMatch[1];

    // Extract title (first non-empty line after **)
    const titleMatch = jsdoc.match(/\*\s*([^\n]*)/);
    const title = titleMatch ? titleMatch[1].trim() : fileName;

    // Extract purpose from description
    const purposeMatch = jsdoc.match(/\*\s*(.*?)(?:\n\s*\*\s*Standards Enforced:|$)/s);
    const purpose = purposeMatch ? purposeMatch[1].replace(/\*\s*/g, '').trim() : '';

    // Determine type based on content
    const type = content.includes('LLM') || content.includes('llm-assisted') || 
                 fileName.includes('analyze') ? 'llm-assisted' : 'deterministic';

    // Extract standards from "Standards Enforced" section
    const standardsMatch = jsdoc.match(/Standards Enforced:\s*([\s\S]*?)(?:\n\s*\*\s*\*|$)/);
    const standards: string[] = [];
    
    if (standardsMatch) {
      const standardsText = standardsMatch[1];
      const standardLines = standardsText.split('\n')
        .map(line => line.replace(/^\s*\*\s*-?\s*/, '').trim())
        .filter(line => line.length > 0);
      standards.push(...standardLines);
    }

    return {
      scriptName: fileName,
      title,
      purpose,
      type,
      standards
    };
  }

  public async extractAllStandards(): Promise<GovernanceStandard[]> {
    const governanceDir = path.join(this.rootDir, 'scripts', 'governance');
    const files = fs.readdirSync(governanceDir);
    const standards: GovernanceStandard[] = [];

    for (const file of files) {
      if (file.endsWith('.ts') && file !== 'governance-runner.ts' && file !== 'extract-standards.ts') {
        const filePath = path.join(governanceDir, file);
        const standard = this.extractStandardsFromScript(filePath);
        if (standard) {
          standards.push(standard);
        }
      }
    }

    return standards.sort((a, b) => {
      // Sort deterministic first, then by name
      if (a.type !== b.type) {
        return a.type === 'deterministic' ? -1 : 1;
      }
      return a.scriptName.localeCompare(b.scriptName);
    });
  }

  public async generateStandardsDocument(): Promise<string> {
    const standards = await this.extractAllStandards();
    
    let doc = `# Code Governance Standards\n\n`;
    doc += `This document is automatically generated from governance script headers.\n\n`;
    doc += `**Last Updated**: ${new Date().toISOString()}\n\n`;

    // Deterministic standards
    const deterministic = standards.filter(s => s.type === 'deterministic');
    doc += `## 📋 Deterministic Standards (${deterministic.length})\n\n`;
    doc += `These standards are automatically enforced with 100% accuracy:\n\n`;

    deterministic.forEach((standard, index) => {
      doc += `### ${index + 1}. ${standard.title}\n`;
      doc += `**Script**: \`${standard.scriptName}.ts\`\n\n`;
      doc += `${standard.purpose}\n\n`;
      if (standard.standards.length > 0) {
        doc += `**Standards Enforced**:\n`;
        standard.standards.forEach(rule => {
          doc += `- ${rule}\n`;
        });
        doc += `\n`;
      }
      doc += `**Run**: \`npm run governance:${standard.scriptName.replace('check-', '').replace('analyze-', '')}\`\n\n`;
    });

    // LLM-assisted standards
    const llmAssisted = standards.filter(s => s.type === 'llm-assisted');
    doc += `## 🤖 LLM-Assisted Standards (${llmAssisted.length})\n\n`;
    doc += `These standards use AI analysis for subjective quality assessment:\n\n`;

    llmAssisted.forEach((standard, index) => {
      doc += `### ${index + 1}. ${standard.title}\n`;
      doc += `**Script**: \`${standard.scriptName}.ts\`\n\n`;
      doc += `${standard.purpose}\n\n`;
      if (standard.standards.length > 0) {
        doc += `**Standards Evaluated**:\n`;
        standard.standards.forEach(rule => {
          doc += `- ${rule}\n`;
        });
        doc += `\n`;
      }
      doc += `**Run**: \`npm run governance:${standard.scriptName.replace('check-', '').replace('analyze-', '')}\`\n\n`;
    });

    doc += `## 🎮 Quick Reference\n\n`;
    doc += `### Run All Standards\n`;
    doc += `\`\`\`bash\n`;
    doc += `npm run governance:check           # All standards\n`;
    doc += `npm run governance:deterministic   # Deterministic only\n`;
    doc += `npm run governance:llm            # LLM-assisted only\n`;
    doc += `\`\`\`\n\n`;

    doc += `### Individual Standards\n`;
    doc += `\`\`\`bash\n`;
    standards.forEach(standard => {
      const command = standard.scriptName.replace('check-', '').replace('analyze-', '');
      doc += `npm run governance:${command.padEnd(20)} # ${standard.title}\n`;
    });
    doc += `\`\`\`\n\n`;

    doc += `---\n\n`;
    doc += `*This document is automatically generated. Do not edit manually.*\n`;
    doc += `*To update, modify the JSDoc headers in the governance scripts and run \`npm run governance:extract-standards\`.*\n`;

    return doc;
  }

  public async generateJsonExport(): Promise<string> {
    const standards = await this.extractAllStandards();
    return JSON.stringify({
      generatedAt: new Date().toISOString(),
      standards
    }, null, 2);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const extractor = new StandardsExtractor();
  
  const command = process.argv[2] || 'markdown';
  
  if (command === 'json') {
    extractor.generateJsonExport().then(json => {
      console.log(json);
    }).catch(error => {
      console.error('Error generating JSON export:', error);
      process.exit(1);
    });
  } else {
    extractor.generateStandardsDocument().then(doc => {
      console.log(doc);
    }).catch(error => {
      console.error('Error generating standards document:', error);
      process.exit(1);
    });
  }
}

export { StandardsExtractor };
