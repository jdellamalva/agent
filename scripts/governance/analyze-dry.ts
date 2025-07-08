#!/usr/bin/env node
/**
 * DRY Principle Analysis Script
 * 
 * Uses LLM analysis to detect potential violations of the DRY principle
 * by analyzing code similarity and duplication patterns.
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { getGovernanceTarget } from './config/governance-targets.js';

interface DRYViolation {
  files: string[];
  similarity: number;
  violationType: 'duplicate-logic' | 'similar-functions' | 'repeated-patterns';
  confidence: number;
  explanation: string;
  suggestion: string;
}

interface CodeBlock {
  file: string;
  startLine: number;
  endLine: number;
  content: string;
  type: 'function' | 'class' | 'method';
  name: string;
}

class DRYAnalyzer {
  private openai: OpenAI;
  private violations: DRYViolation[] = [];

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });
  }

  async analyze(): Promise<DRYViolation[]> {
    const target = getGovernanceTarget('codeQuality');
    const allFiles: string[] = [];
    
    // Use governance target patterns to find files
    for (const pattern of target.includePatterns) {
      const matches = await glob(pattern, { 
        ignore: target.excludePatterns 
      });
      allFiles.push(...matches);
    }
    
    // Filter by file extensions
    const files = allFiles.filter(file => {
      const ext = path.extname(file);
      return target.fileTypes.includes(ext);
    });
    
    console.log(`Analyzing ${files.length} files for DRY violations...`);
    
    // Extract code blocks from all files
    const codeBlocks = await this.extractCodeBlocks(files);
    
    // Compare similar-looking code blocks
    await this.findSimilarCodeBlocks(codeBlocks);
    
    return this.violations;
  }

  private async extractCodeBlocks(files: string[]): Promise<CodeBlock[]> {
    const blocks: CodeBlock[] = [];
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      
      // Extract functions, classes, and methods
      blocks.push(...this.extractFromFile(file, lines));
    }
    
    return blocks;
  }

  private extractFromFile(filePath: string, lines: string[]): CodeBlock[] {
    const blocks: CodeBlock[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Function detection
      const functionMatch = line.match(/^\s*(export\s+)?(async\s+)?function\s+(\w+)/);
      if (functionMatch) {
        const endLine = this.findBlockEnd(lines, i);
        blocks.push({
          file: filePath,
          startLine: i + 1,
          endLine: endLine + 1,
          content: lines.slice(i, endLine + 1).join('\n'),
          type: 'function',
          name: functionMatch[3],
        });
      }
      
      // Class detection
      const classMatch = line.match(/^\s*(export\s+)?(abstract\s+)?class\s+(\w+)/);
      if (classMatch) {
        const endLine = this.findBlockEnd(lines, i);
        blocks.push({
          file: filePath,
          startLine: i + 1,
          endLine: endLine + 1,
          content: lines.slice(i, endLine + 1).join('\n'),
          type: 'class',
          name: classMatch[3],
        });
      }
      
      // Method detection (inside classes)
      const methodMatch = line.match(/^\s*(public|private|protected)?\s*(async\s+)?(\w+)\s*\(/);
      if (methodMatch && !functionMatch && !classMatch) {
        const endLine = this.findBlockEnd(lines, i);
        if (endLine > i + 2) { // Only consider non-trivial methods
          blocks.push({
            file: filePath,
            startLine: i + 1,
            endLine: endLine + 1,
            content: lines.slice(i, endLine + 1).join('\n'),
            type: 'method',
            name: methodMatch[3],
          });
        }
      }
    }
    
    return blocks;
  }

  private findBlockEnd(lines: string[], startLine: number): number {
    let braceCount = 0;
    let foundOpenBrace = false;
    
    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;
      
      braceCount += openBraces - closeBraces;
      
      if (openBraces > 0) foundOpenBrace = true;
      if (foundOpenBrace && braceCount === 0) {
        return i;
      }
    }
    
    return lines.length - 1;
  }

  private async findSimilarCodeBlocks(blocks: CodeBlock[]): Promise<void> {
    // Group blocks by type and compare within groups
    const functionBlocks = blocks.filter(b => b.type === 'function');
    const methodBlocks = blocks.filter(b => b.type === 'method');
    
    await this.compareSimilarBlocks(functionBlocks, 'functions');
    await this.compareSimilarBlocks(methodBlocks, 'methods');
  }

  private async compareSimilarBlocks(blocks: CodeBlock[], blockType: string): Promise<void> {
    console.log(`Analyzing ${blocks.length} ${blockType} for similarities...`);
    
    // Compare blocks in batches to avoid overwhelming the LLM
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const block1 = blocks[i];
        const block2 = blocks[j];
        
        // Skip if same file and very close (likely same block)
        if (block1.file === block2.file && Math.abs(block1.startLine - block2.startLine) < 10) {
          continue;
        }
        
        // Quick heuristic check before LLM analysis
        if (this.areBlocksSimilarHeuristic(block1, block2)) {
          await this.analyzeBlockSimilarity(block1, block2);
        }
      }
    }
  }

  private areBlocksSimilarHeuristic(block1: CodeBlock, block2: CodeBlock): boolean {
    // Quick checks to filter out obviously different blocks
    const lines1 = block1.content.split('\n').length;
    const lines2 = block2.content.split('\n').length;
    
    // Similar length
    if (Math.abs(lines1 - lines2) > Math.max(lines1, lines2) * 0.5) {
      return false;
    }
    
    // Similar function names might indicate duplication
    if (this.areNamesSimilar(block1.name, block2.name)) {
      return true;
    }
    
    // Check for common patterns or keywords
    const keywords1 = this.extractKeywords(block1.content);
    const keywords2 = this.extractKeywords(block2.content);
    const commonKeywords = keywords1.filter(k => keywords2.includes(k));
    
    return commonKeywords.length > Math.min(keywords1.length, keywords2.length) * 0.3;
  }

  private areNamesSimilar(name1: string, name2: string): boolean {
    // Check for similar naming patterns
    const similarity = this.calculateStringsimilarity(name1, name2);
    return similarity > 0.6;
  }

  private calculateStringsimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + cost
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private extractKeywords(content: string): string[] {
    // Extract significant keywords from code
    const keywords = content
      .replace(/[{}();,]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && /^[a-zA-Z]/.test(word))
      .filter(word => !['const', 'function', 'return', 'this', 'await', 'async'].includes(word.toLowerCase()));
    
    return [...new Set(keywords)];
  }

  private async analyzeBlockSimilarity(block1: CodeBlock, block2: CodeBlock): Promise<void> {
    const prompt = `Analyze these two code blocks for potential DRY principle violations:

Block 1 (${block1.file}:${block1.startLine}-${block1.endLine}):
\`\`\`typescript
${block1.content}
\`\`\`

Block 2 (${block2.file}:${block2.startLine}-${block2.endLine}):
\`\`\`typescript
${block2.content}
\`\`\`

Please analyze if these blocks violate the DRY principle and respond in this JSON format:
{
  "isDryViolation": boolean,
  "confidence": number (0-1),
  "violationType": "duplicate-logic" | "similar-functions" | "repeated-patterns",
  "similarity": number (0-1),
  "explanation": "Brief explanation of the violation",
  "suggestion": "How to refactor to eliminate duplication"
}

Focus on:
1. Duplicate business logic
2. Similar algorithms or patterns
3. Repeated validation or error handling
4. Consider that some similarity is acceptable (e.g., different business domains)`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 500,
      });

      const analysis = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      if (analysis.isDryViolation && analysis.confidence > 0.6) {
        this.violations.push({
          files: [block1.file, block2.file],
          similarity: analysis.similarity,
          violationType: analysis.violationType,
          confidence: analysis.confidence,
          explanation: analysis.explanation,
          suggestion: analysis.suggestion,
        });
      }
      
    } catch (error) {
      console.warn(`Failed to analyze similarity between ${block1.file} and ${block2.file}:`, error);
    }
  }
}

async function main() {
  console.log('🔍 Analyzing codebase for DRY principle violations...\n');
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable is required for DRY analysis');
    process.exit(1);
  }
  
  const analyzer = new DRYAnalyzer();
  const violations = await analyzer.analyze();
  
  if (violations.length === 0) {
    console.log('✅ No significant DRY violations detected!');
    process.exit(0);
  }
  
  console.log(`❌ Found ${violations.length} potential DRY violations:\n`);
  
  violations.forEach((violation, index) => {
    console.log(`🚨 Violation ${index + 1}: ${violation.violationType}`);
    console.log(`   Confidence: ${(violation.confidence * 100).toFixed(1)}%`);
    console.log(`   Similarity: ${(violation.similarity * 100).toFixed(1)}%`);
    console.log(`   Files: ${violation.files.join(' ↔ ')}`);
    console.log(`   Issue: ${violation.explanation}`);
    console.log(`   Suggestion: ${violation.suggestion}`);
    console.log();
  });
  
  console.log('💡 Tip: Extract common patterns into shared utilities or base classes');
  
  // Exit with warning (not error) since these are recommendations
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}` || 
    (process.argv[1] && process.argv[1].endsWith(path.basename(new URL(import.meta.url).pathname)))) {
  main().catch(console.error);
}

export { DRYAnalyzer };
