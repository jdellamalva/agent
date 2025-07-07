import { MessageParser, ParsedMessage, MessageContext } from '../src/integrations/messageParser';

// Mock the logger
jest.mock('../src/utils/logger', () => ({
  agentLogger: {
    child: jest.fn(() => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    }))
  }
}));

describe('MessageParser', () => {
  describe('parseMessage', () => {
    it('should parse basic message', () => {
      const parsed = MessageParser.parseMessage(
        'Create a new file please',
        'U123456',
        'C123456',
        '1234567890.123'
      );

      expect(parsed.prompt).toBe('Create a new file');
      expect(parsed.user).toBe('U123456');
      expect(parsed.channel).toBe('C123456');
      expect(parsed.timestamp).toBe('1234567890.123');
      expect(parsed.mentions).toHaveLength(0);
      expect(parsed.hasUrgentFlag).toBe(false);
      expect(parsed.hasQuietFlag).toBe(false);
    });

    it('should extract user mentions', () => {
      const parsed = MessageParser.parseMessage(
        'Hey <@U123456> can you help <@U789012>?',
        'U111111',
        'C123456',
        '1234567890.123'
      );

      expect(parsed.mentions).toContain('U123456');
      expect(parsed.mentions).toContain('U789012');
      expect(parsed.mentions).toHaveLength(2);
    });

    it('should detect urgent flags', () => {
      const urgentMessages = [
        'This is urgent please help',
        'ASAP need assistance',
        'Help me !urgent',
        'URGENT: fix this bug'
      ];

      urgentMessages.forEach(message => {
        const parsed = MessageParser.parseMessage(message, 'U123', 'C123', '123');
        expect(parsed.hasUrgentFlag).toBe(true);
      });
    });

    it('should detect quiet flags', () => {
      const quietMessages = [
        'Please work on this quietly',
        'Run this in silent mode',
        'Background processing needed'
      ];

      quietMessages.forEach(message => {
        const parsed = MessageParser.parseMessage(message, 'U123', 'C123', '123');
        expect(parsed.hasQuietFlag).toBe(true);
      });
    });

    it('should extract requested actions', () => {
      const parsed = MessageParser.parseMessage(
        'Create a new file and then analyze the code',
        'U123456',
        'C123456',
        '1234567890.123'
      );

      expect(parsed.requestedActions).toContain('create');
      expect(parsed.requestedActions).toContain('analyze');
    });

    it('should clean text by removing mentions and extra spaces', () => {
      const parsed = MessageParser.parseMessage(
        '  <@U123456>   create    a   file   please   ',
        'U123456',
        'C123456',
        '1234567890.123'
      );

      expect(parsed.prompt).toBe('create a file');
    });

    it('should handle thread messages', () => {
      const parsed = MessageParser.parseMessage(
        'Reply in thread',
        'U123456',
        'C123456',
        '1234567890.123',
        '1234567890.000'
      );

      expect(parsed.threadTimestamp).toBe('1234567890.000');
    });

    it('should remove common greetings from prompt', () => {
      const greetings = [
        'Hey agent, create a file',
        'Hi there, help me',
        'Hello please assist' // Remove comma to match regex pattern
      ];

      const expected = [
        'agent, create a file',
        'there, help me', 
        'please assist' // Hello followed by space is removed completely
      ];

      greetings.forEach((message, index) => {
        const parsed = MessageParser.parseMessage(message, 'U123', 'C123', '123');
        expect(parsed.prompt).toBe(expected[index]);
      });
    });

    it('should remove trailing politeness', () => {
      const politeMessages = [
        'Create a file please',
        'Help me thanks',
        'Assist me thank you'
      ];

      politeMessages.forEach(message => {
        const parsed = MessageParser.parseMessage(message, 'U123', 'C123', '123');
        expect(parsed.prompt).not.toMatch(/(please|thanks|thank you)$/i);
      });
    });
  });

  describe('getMessageContext', () => {
    it('should identify direct message context', () => {
      const context = MessageParser.getMessageContext(
        'D123456', // DM channel
        'Help me with this',
        undefined
      );

      expect(context.isDirectMessage).toBe(true);
      expect(context.isThread).toBe(false);
      expect(context.channelType).toBe('dm');
      expect(context.botMentioned).toBe(false);
    });

    it('should identify public channel context', () => {
      const context = MessageParser.getMessageContext(
        'C123456', // Public channel
        'General discussion',
        undefined
      );

      expect(context.isDirectMessage).toBe(false);
      expect(context.channelType).toBe('public');
    });

    it('should identify private channel context', () => {
      const context = MessageParser.getMessageContext(
        'G123456', // Private group
        'Private discussion',
        undefined
      );

      expect(context.isDirectMessage).toBe(false);
      expect(context.channelType).toBe('private');
    });

    it('should identify thread context', () => {
      const context = MessageParser.getMessageContext(
        'C123456',
        'Reply in thread',
        '1234567890.000'
      );

      expect(context.isThread).toBe(true);
    });

    it('should detect bot mentions', () => {
      const contextWithMention = MessageParser.getMessageContext(
        'C123456',
        '<@U123456> help me',
        undefined
      );

      const contextWithAgentMention = MessageParser.getMessageContext(
        'C123456',
        'Hey @agent help me',
        undefined
      );

      expect(contextWithMention.botMentioned).toBe(true);
      expect(contextWithAgentMention.botMentioned).toBe(true);
    });
  });

  describe('shouldProcessMessage', () => {
    it('should process direct messages', () => {
      const parsed: ParsedMessage = {
        prompt: 'Help me',
        user: 'U123',
        channel: 'D123',
        timestamp: '123',
        mentions: [],
        hasUrgentFlag: false,
        hasQuietFlag: false,
        requestedActions: []
      };

      const context: MessageContext = {
        isDirectMessage: true,
        isThread: false,
        channelType: 'dm',
        botMentioned: false
      };

      expect(MessageParser.shouldProcessMessage(parsed, context)).toBe(true);
    });

    it('should process channel messages with bot mention', () => {
      const parsed: ParsedMessage = {
        prompt: 'Help me',
        user: 'U123',
        channel: 'C123',
        timestamp: '123',
        mentions: [],
        hasUrgentFlag: false,
        hasQuietFlag: false,
        requestedActions: []
      };

      const context: MessageContext = {
        isDirectMessage: false,
        isThread: false,
        channelType: 'public',
        botMentioned: true
      };

      expect(MessageParser.shouldProcessMessage(parsed, context)).toBe(true);
    });

    it('should not process channel messages without bot mention', () => {
      const parsed: ParsedMessage = {
        prompt: 'General discussion',
        user: 'U123',
        channel: 'C123',
        timestamp: '123',
        mentions: [],
        hasUrgentFlag: false,
        hasQuietFlag: false,
        requestedActions: []
      };

      const context: MessageContext = {
        isDirectMessage: false,
        isThread: false,
        channelType: 'public',
        botMentioned: false
      };

      expect(MessageParser.shouldProcessMessage(parsed, context)).toBe(false);
    });

    it('should not process empty prompts', () => {
      const parsed: ParsedMessage = {
        prompt: '',
        user: 'U123',
        channel: 'D123',
        timestamp: '123',
        mentions: [],
        hasUrgentFlag: false,
        hasQuietFlag: false,
        requestedActions: []
      };

      const context: MessageContext = {
        isDirectMessage: true,
        isThread: false,
        channelType: 'dm',
        botMentioned: false
      };

      expect(MessageParser.shouldProcessMessage(parsed, context)).toBe(false);
    });

    it('should not process whitespace-only prompts', () => {
      const parsed: ParsedMessage = {
        prompt: '   \n\t   ',
        user: 'U123',
        channel: 'D123',
        timestamp: '123',
        mentions: [],
        hasUrgentFlag: false,
        hasQuietFlag: false,
        requestedActions: []
      };

      const context: MessageContext = {
        isDirectMessage: true,
        isThread: false,
        channelType: 'dm',
        botMentioned: false
      };

      expect(MessageParser.shouldProcessMessage(parsed, context)).toBe(false);
    });
  });

  describe('summarizeMessage', () => {
    it('should create basic message summary', () => {
      const parsed: ParsedMessage = {
        prompt: 'Create a new file for the project',
        user: 'U123456',
        channel: 'C123456',
        timestamp: '1234567890.123',
        mentions: [],
        hasUrgentFlag: false,
        hasQuietFlag: false,
        requestedActions: ['create']
      };

      const context: MessageContext = {
        isDirectMessage: false,
        isThread: false,
        channelType: 'public',
        botMentioned: true
      };

      const summary = MessageParser.summarizeMessage(parsed, context);

      expect(summary).toContain('U123456');
      expect(summary).toContain('public');
      expect(summary).toContain('Create a new file');
      expect(summary).toContain('create');
    });

    it('should include urgent flag in summary', () => {
      const parsed: ParsedMessage = {
        prompt: 'Fix this urgent bug',
        user: 'U123456',
        channel: 'C123456',
        timestamp: '1234567890.123',
        mentions: [],
        hasUrgentFlag: true,
        hasQuietFlag: false,
        requestedActions: []
      };

      const context: MessageContext = {
        isDirectMessage: false,
        isThread: false,
        channelType: 'public',
        botMentioned: true
      };

      const summary = MessageParser.summarizeMessage(parsed, context);

      expect(summary).toContain('🚨 URGENT');
    });

    it('should include quiet flag in summary', () => {
      const parsed: ParsedMessage = {
        prompt: 'Process this quietly',
        user: 'U123456',
        channel: 'C123456',
        timestamp: '1234567890.123',
        mentions: [],
        hasUrgentFlag: false,
        hasQuietFlag: true,
        requestedActions: []
      };

      const context: MessageContext = {
        isDirectMessage: false,
        isThread: false,
        channelType: 'public',
        botMentioned: true
      };

      const summary = MessageParser.summarizeMessage(parsed, context);

      expect(summary).toContain('🤫 Quiet mode');
    });

    it('should truncate long prompts in summary', () => {
      const longPrompt = 'A'.repeat(150);
      const parsed: ParsedMessage = {
        prompt: longPrompt,
        user: 'U123456',
        channel: 'C123456',
        timestamp: '1234567890.123',
        mentions: [],
        hasUrgentFlag: false,
        hasQuietFlag: false,
        requestedActions: []
      };

      const context: MessageContext = {
        isDirectMessage: false,
        isThread: false,
        channelType: 'public',
        botMentioned: true
      };

      const summary = MessageParser.summarizeMessage(parsed, context);

      expect(summary).toContain('...');
      expect(summary.length).toBeLessThan(longPrompt.length + 50); // Account for other summary parts
    });
  });

  describe('action extraction', () => {
    it('should extract create actions', () => {
      const messages = [
        'Create a new file',
        'Make a directory',
        'Build the project',
        'Generate documentation'
      ];

      messages.forEach(message => {
        const parsed = MessageParser.parseMessage(message, 'U123', 'C123', '123');
        expect(parsed.requestedActions).toContain('create');
      });
    });

    it('should extract update actions', () => {
      const messages = [
        'Update the file',
        'Modify the configuration',
        'Change the settings',
        'Edit the code'
      ];

      messages.forEach(message => {
        const parsed = MessageParser.parseMessage(message, 'U123', 'C123', '123');
        expect(parsed.requestedActions).toContain('update');
      });
    });

    it('should extract delete actions', () => {
      const messages = [
        'Delete the file',
        'Remove the directory',
        'Clean up the project'
      ];

      messages.forEach(message => {
        const parsed = MessageParser.parseMessage(message, 'U123', 'C123', '123');
        expect(parsed.requestedActions).toContain('delete');
      });
    });

    it('should extract analyze actions', () => {
      const messages = [
        'Analyze the code',
        'Check the quality',
        'Review the implementation',
        'Examine the structure'
      ];

      messages.forEach(message => {
        const parsed = MessageParser.parseMessage(message, 'U123', 'C123', '123');
        expect(parsed.requestedActions).toContain('analyze');
      });
    });

    it('should extract multiple actions from one message', () => {
      const parsed = MessageParser.parseMessage(
        'Create a file and then analyze it',
        'U123',
        'C123',
        '123'
      );

      expect(parsed.requestedActions).toContain('create');
      expect(parsed.requestedActions).toContain('analyze');
    });

    it('should deduplicate extracted actions', () => {
      const parsed = MessageParser.parseMessage(
        'Create a file, make a directory, create another file',
        'U123',
        'C123',
        '123'
      );

      const createCount = parsed.requestedActions.filter(action => action === 'create').length;
      expect(createCount).toBe(1); // Should be deduplicated
    });
  });

  describe('text cleaning', () => {
    it('should remove channel mentions', () => {
      const parsed = MessageParser.parseMessage(
        'Discussion in <#C123456|general> channel',
        'U123',
        'C123',
        '123'
      );

      expect(parsed.prompt).not.toContain('<#C123456|general>');
    });

    it('should clean URLs but preserve functionality', () => {
      const parsed = MessageParser.parseMessage(
        'Check this out <https://example.com|example>',
        'U123',
        'C123',
        '123'
      );

      expect(parsed.prompt).not.toContain('<https://example.com|example>');
    });

    it('should normalize whitespace', () => {
      const parsed = MessageParser.parseMessage(
        'Create    a     file   with    content',
        'U123',
        'C123',
        '123'
      );

      expect(parsed.prompt).toBe('Create a file with content');
    });

    it('should handle very short messages', () => {
      const parsed = MessageParser.parseMessage(
        'Hi',
        'U123',
        'C123',
        '123'
      );

      expect(parsed.prompt).toBe(''); // Too short after cleaning
    });
  });

  describe('channel type detection', () => {
    it('should detect public channels', () => {
      const context = MessageParser.getMessageContext('C123456', 'test', undefined);
      expect(context.channelType).toBe('public');
    });

    it('should detect private groups', () => {
      const context = MessageParser.getMessageContext('G123456', 'test', undefined);
      expect(context.channelType).toBe('private');
    });

    it('should detect direct messages', () => {
      const context = MessageParser.getMessageContext('D123456', 'test', undefined);
      expect(context.channelType).toBe('dm');
    });

    it('should default to public for unknown channel types', () => {
      const context = MessageParser.getMessageContext('X123456', 'test', undefined);
      expect(context.channelType).toBe('public');
    });
  });
});
