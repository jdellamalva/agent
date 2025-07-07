import { ResponseParser, ValidationResult, SafetyCheck } from '../src/core/responseParser';
import { StructuredCommand, ParsedResponse } from '../src/core/promptEngineer';

describe('ResponseParser', () => {
  let responseParser: ResponseParser;

  beforeEach(() => {
    responseParser = new ResponseParser();
  });

  describe('validateCommand', () => {
    it('should validate valid command', () => {
      const command: StructuredCommand = {
        action: 'file_read',
        parameters: { path: 'test.txt' },
        reasoning: 'Need to read the file',
        confidence: 0.9
      };

      const result = responseParser.validateCommand(command);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject command with missing action', () => {
      const command: any = {
        parameters: { path: 'test.txt' },
        reasoning: 'Test reasoning',
        confidence: 0.9
      };

      const result = responseParser.validateCommand(command);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('action'))).toBe(true);
    });

    it('should reject command with missing reasoning', () => {
      const command: any = {
        action: 'file_read',
        parameters: { path: 'test.txt' },
        confidence: 0.9
      };

      const result = responseParser.validateCommand(command);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('reasoning'))).toBe(true);
    });

    it('should reject command with invalid confidence', () => {
      const command: any = {
        action: 'file_read',
        parameters: { path: 'test.txt' },
        reasoning: 'Test reasoning',
        confidence: 1.5 // Invalid: > 1
      };

      const result = responseParser.validateCommand(command);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('confidence'))).toBe(true);
    });

    it('should validate action-specific parameters', () => {
      const command: StructuredCommand = {
        action: 'file_read',
        parameters: {}, // missing path
        reasoning: 'Test reasoning',
        confidence: 0.9
      };

      const result = responseParser.validateCommand(command);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('path'))).toBe(true);
    });

    it('should provide warnings for low confidence', () => {
      const command: StructuredCommand = {
        action: 'file_read',
        parameters: { path: 'test.txt' },
        reasoning: 'Not sure about this',
        confidence: 0.5 // Low confidence
      };

      const result = responseParser.validateCommand(command);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('confidence'))).toBe(true);
    });

    it('should validate git_clone parameters', () => {
      const validCommand: StructuredCommand = {
        action: 'git_clone',
        parameters: { url: 'https://github.com/user/repo.git', destination: './repo' },
        reasoning: 'Clone repository',
        confidence: 0.9
      };

      const result = responseParser.validateCommand(validCommand);
      expect(result.isValid).toBe(true);

      const invalidCommand: StructuredCommand = {
        action: 'git_clone',
        parameters: { url: 'https://github.com/user/repo.git' }, // missing destination
        reasoning: 'Clone repository',
        confidence: 0.9
      };

      const invalidResult = responseParser.validateCommand(invalidCommand);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors.some(e => e.includes('destination'))).toBe(true);
    });

    it('should detect security issues', () => {
      const command: StructuredCommand = {
        action: 'file_read',
        parameters: { path: '../../../etc/passwd' }, // Path traversal
        reasoning: 'Read system file',
        confidence: 0.9
      };

      const result = responseParser.validateCommand(command);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('traversal'))).toBe(true);
    });
  });

  describe('performSafetyCheck', () => {
    it('should pass safe commands', () => {
      const command: StructuredCommand = {
        action: 'file_read',
        parameters: { path: 'src/test.ts' },
        reasoning: 'Read source file',
        confidence: 0.9
      };

      const result = responseParser.performSafetyCheck(command);

      expect(result.isDestructive).toBe(false);
      expect(result.requiresApproval).toBe(false);
      expect(result.riskLevel).toBe('low');
    });

    it('should flag destructive commands', () => {
      const command: StructuredCommand = {
        action: 'file_delete',
        parameters: { path: 'important.txt' },
        reasoning: 'Delete file',
        confidence: 0.9
      };

      const result = responseParser.performSafetyCheck(command);

      expect(result.isDestructive).toBe(true);
      expect(result.requiresApproval).toBe(true);
      expect(result.riskLevel).toBe('high');
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it('should detect system file access', () => {
      const command: StructuredCommand = {
        action: 'file_read',
        parameters: { path: '/etc/passwd' },
        reasoning: 'Read system file',
        confidence: 0.9
      };

      const result = responseParser.performSafetyCheck(command);

      expect(result.requiresApproval).toBe(true);
      expect(result.reasons.some(r => r.includes('system'))).toBe(true);
    });

    it('should flag shell commands', () => {
      const command: StructuredCommand = {
        action: 'shell_exec',
        parameters: { command: 'ls -la' },
        reasoning: 'List files',
        confidence: 0.9
      };

      const result = responseParser.performSafetyCheck(command);

      expect(result.requiresApproval).toBe(true);
      expect(result.riskLevel).toBe('high');
      expect(result.reasons.some(r => r.includes('Shell execution'))).toBe(true);
    });

    it('should detect high-risk patterns', () => {
      const command: StructuredCommand = {
        action: 'shell_exec',
        parameters: { command: 'rm -rf /' },
        reasoning: 'Dangerous command',
        confidence: 0.9
      };

      const result = responseParser.performSafetyCheck(command);

      expect(result.isDestructive).toBe(true);
      expect(result.requiresApproval).toBe(true);
      expect(result.riskLevel).toBe('high');
      expect(result.reasons.some(r => r.includes('High-risk pattern'))).toBe(true);
    });

    it('should respect explicit approval requests', () => {
      const command: StructuredCommand = {
        action: 'file_read',
        parameters: { path: 'test.txt' },
        reasoning: 'Read file',
        confidence: 0.9,
        requiresApproval: true
      };

      const result = responseParser.performSafetyCheck(command);

      expect(result.requiresApproval).toBe(true);
      expect(result.reasons.some(r => r.includes('explicitly requests'))).toBe(true);
    });
  });

  describe('parseAndValidateResponse', () => {
    it('should process complete valid response', () => {
      const response: ParsedResponse = {
        reasoning: "Creating and reading a test file",
        userMessage: "I'll create and read the file for you",
        commands: [
          {
            action: 'file_write',
            parameters: { path: 'test.txt', content: 'Hello' },
            reasoning: 'Create the file',
            confidence: 0.9
          },
          {
            action: 'file_read',
            parameters: { path: 'test.txt' },
            reasoning: 'Read the file back',
            confidence: 0.9
          }
        ]
      };

      const result = responseParser.parseAndValidateResponse(response);

      expect(result.validCommands).toHaveLength(2);
      expect(result.invalidCommands).toHaveLength(0);
      expect(result.safetyChecks).toHaveLength(2);
    });

    it('should separate valid and invalid commands', () => {
      const response: ParsedResponse = {
        reasoning: "Mixed valid and invalid commands",
        userMessage: "Processing commands",
        commands: [
          {
            action: 'file_read',
            parameters: { path: 'test.txt' },
            reasoning: 'Valid command',
            confidence: 0.9
          },
          {
            action: 'invalid_action',
            parameters: {},
            reasoning: 'Invalid action',
            confidence: 0.9
          },
          {
            action: 'file_read',
            parameters: {}, // missing path
            reasoning: 'Missing params',
            confidence: 0.9
          }
        ]
      };

      const result = responseParser.parseAndValidateResponse(response);

      expect(result.validCommands).toHaveLength(2); // file_read with valid params and invalid_action (warning only)
      expect(result.invalidCommands).toHaveLength(1); // file_read with missing params (error)
      expect(result.safetyChecks).toHaveLength(3);
    });

    it('should handle empty command list', () => {
      const response: ParsedResponse = {
        reasoning: "No actions needed",
        userMessage: "Just providing information",
        commands: []
      };

      const result = responseParser.parseAndValidateResponse(response);

      expect(result.validCommands).toHaveLength(0);
      expect(result.invalidCommands).toHaveLength(0);
      expect(result.safetyChecks).toHaveLength(0);
    });

    it('should flag dangerous commands for approval', () => {
      const response: ParsedResponse = {
        reasoning: "Need to delete system files",
        userMessage: "Deleting files",
        commands: [
          {
            action: 'file_delete',
            parameters: { path: '/etc/important.conf' },
            reasoning: 'Delete system file',
            confidence: 0.9
          }
        ]
      };

      const result = responseParser.parseAndValidateResponse(response);

      expect(result.validCommands).toHaveLength(1);
      expect(result.safetyChecks[0]?.safety.requiresApproval).toBe(true);
      expect(result.safetyChecks[0]?.safety.riskLevel).toBe('high');
    });
  });

  describe('security validation', () => {
    it('should warn about sensitive information in parameters', () => {
      const command: StructuredCommand = {
        action: 'file_write',
        parameters: { path: 'config.json', content: '{"password": "secret123"}' },
        reasoning: 'Write config',
        confidence: 0.9
      };

      const result = responseParser.validateCommand(command);

      expect(result.warnings.some(w => w.includes('sensitive'))).toBe(true);
    });

    it('should warn about non-HTTPS URLs', () => {
      const command: StructuredCommand = {
        action: 'git_clone',
        parameters: { url: 'http://example.com/repo.git', destination: './repo' },
        reasoning: 'Clone repository',
        confidence: 0.9
      };

      const result = responseParser.validateCommand(command);

      expect(result.warnings.some(w => w.includes('HTTPS'))).toBe(true);
    });

    it('should validate shell command parameters', () => {
      const validCommand: StructuredCommand = {
        action: 'shell_exec',
        parameters: { command: 'npm install' },
        reasoning: 'Install packages',
        confidence: 0.9
      };

      const result = responseParser.validateCommand(validCommand);
      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes('dangerous'))).toBe(true);

      const invalidCommand: StructuredCommand = {
        action: 'shell_exec',
        parameters: {}, // missing command
        reasoning: 'Run command',
        confidence: 0.9
      };

      const invalidResult = responseParser.validateCommand(invalidCommand);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors.some(e => e.includes('command'))).toBe(true);
    });
  });
});
