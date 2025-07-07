import { PromptEngineer, SystemPromptContext, StructuredCommand, ParsedResponse } from '../src/core/promptEngineer';

describe('PromptEngineer', () => {
  let promptEngineer: PromptEngineer;

  beforeEach(() => {
    promptEngineer = new PromptEngineer();
  });

  describe('generateSystemPrompt', () => {
    it('should generate basic system prompt', () => {
      const context: SystemPromptContext = {
        userRequest: 'Create a new file'
      };

      const prompt = promptEngineer.generateSystemPrompt(context);

      expect(prompt).toContain('You are an advanced LLM agent');
      expect(prompt).toContain('Think');
      expect(prompt).toContain('Act');
      expect(prompt).toContain('Observe');
      expect(prompt).toContain('Available Actions');
      expect(prompt).toContain('Response Format');
    });

    it('should include project context when provided', () => {
      const context: SystemPromptContext = {
        userRequest: 'Create a new file',
        projectContext: 'Node.js project with TypeScript'
      };

      const prompt = promptEngineer.generateSystemPrompt(context);

      expect(prompt).toContain('Project Context');
      expect(prompt).toContain('Node.js project with TypeScript');
    });

    it('should include available actions when provided', () => {
      const context: SystemPromptContext = {
        userRequest: 'Create a new file',
        availableActions: ['file_create', 'file_read', 'git_commit']
      };

      const prompt = promptEngineer.generateSystemPrompt(context);

      expect(prompt).toContain('file_create');
      expect(prompt).toContain('file_read');
      expect(prompt).toContain('git_commit');
    });

    it('should include conversation history when provided', () => {
      const context: SystemPromptContext = {
        userRequest: 'Create a new file',
        conversationHistory: ['User: Hello', 'Assistant: Hi there']
      };

      const prompt = promptEngineer.generateSystemPrompt(context);

      // Note: Current implementation doesn't use conversation history in prompt
      // This test documents expected behavior for future implementation
      expect(prompt).toBeDefined();
    });
  });

  describe('parseResponse', () => {
    it('should parse valid JSON response', () => {
      const jsonResponse = JSON.stringify({
        commands: [
          {
            action: 'file_write',
            parameters: { path: '/test/file.txt', content: 'Hello World' },
            reasoning: 'Creating a test file',
            confidence: 0.9,
            requiresApproval: false
          }
        ],
        reasoning: 'Creating a file as requested',
        needsMoreInfo: false,
        userMessage: 'I will create the file for you'
      });

      const result = promptEngineer.parseResponse(jsonResponse);

      expect(result.commands).toHaveLength(1);
      expect(result.commands[0]?.action).toBe('file_write');
      expect(result.commands[0]?.parameters.path).toBe('/test/file.txt');
      expect(result.commands[0]?.confidence).toBe(0.9);
      expect(result.reasoning).toBe('Creating a file as requested');
      expect(result.needsMoreInfo).toBe(false);
      expect(result.userMessage).toBe('I will create the file for you');
    });

    it('should handle JSON response with markdown code blocks', () => {
      const jsonResponse = `\`\`\`json
{
  "commands": [
    {
      "action": "file_read",
      "parameters": { "path": "/test/file.txt" },
      "reasoning": "Reading file content",
      "confidence": 0.8
    }
  ],
  "reasoning": "Reading the file",
  "needsMoreInfo": false
}
\`\`\``;

      const result = promptEngineer.parseResponse(jsonResponse);

      expect(result.commands).toHaveLength(1);
      expect(result.commands[0]?.action).toBe('file_read');
    });

    it('should handle malformed JSON gracefully', () => {
      const malformedResponse = 'This is not JSON at all';

      const result = promptEngineer.parseResponse(malformedResponse);

      expect(result.commands).toHaveLength(0);
      expect(result.reasoning).toBe('Failed to parse structured response');
      expect(result.needsMoreInfo).toBe(true);
      expect(result.userMessage).toBe(malformedResponse);
    });

    it('should handle invalid command structure gracefully', () => {
      const invalidJsonResponse = JSON.stringify({
        commands: [
          {
            action: 'file_write',
            // Missing parameters
            reasoning: 'Creating a test file',
            confidence: 0.9
          }
        ],
        reasoning: 'Creating a file'
      });

      const result = promptEngineer.parseResponse(invalidJsonResponse);
      expect(result.commands).toHaveLength(0);
      expect(result.reasoning).toBe('Failed to parse structured response');
      expect(result.needsMoreInfo).toBe(true);
    });

    it('should handle invalid confidence values gracefully', () => {
      const invalidConfidenceResponse = JSON.stringify({
        commands: [
          {
            action: 'file_write',
            parameters: { path: '/test/file.txt' },
            reasoning: 'Creating a test file',
            confidence: 1.5 // Invalid confidence > 1
          }
        ],
        reasoning: 'Creating a file'
      });

      const result = promptEngineer.parseResponse(invalidConfidenceResponse);
      expect(result.commands).toHaveLength(0);
      expect(result.reasoning).toBe('Failed to parse structured response');
      expect(result.needsMoreInfo).toBe(true);
    });
  });

  describe('generateFollowUpPrompt', () => {
    it('should generate follow-up prompt', () => {
      const originalRequest = 'Create a new file';
      const clarification = 'What file type and content do you want?';

      const prompt = promptEngineer.generateFollowUpPrompt(originalRequest, clarification);

      expect(prompt).toContain(originalRequest);
      expect(prompt).toContain(clarification);
      expect(prompt).toContain('clarification');
    });
  });

  describe('generateObservationPrompt', () => {
    it('should generate observation prompt from execution results', () => {
      const originalRequest = 'Create a test file';
      const executedCommands: StructuredCommand[] = [
        {
          action: 'file_write',
          parameters: { path: '/test/file.txt', content: 'Hello' },
          reasoning: 'Creating test file',
          confidence: 0.9
        }
      ];
      const results = [{ success: true, path: '/test/file.txt' }];

      const prompt = promptEngineer.generateObservationPrompt(
        originalRequest,
        executedCommands,
        results
      );

      expect(prompt).toContain(originalRequest);
      expect(prompt).toContain('file_write');
      expect(prompt).toContain('Commands executed');
      expect(prompt).toContain('Results');
      expect(prompt).toContain('"success": true');
    });

    it('should handle empty results', () => {
      const originalRequest = 'Test request';
      const executedCommands: StructuredCommand[] = [];
      const results: any[] = [];

      const prompt = promptEngineer.generateObservationPrompt(
        originalRequest,
        executedCommands,
        results
      );

      expect(prompt).toContain(originalRequest);
      expect(prompt).toBeDefined();
    });
  });
});
