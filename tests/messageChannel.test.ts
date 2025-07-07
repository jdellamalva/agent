import { 
  MessageChannel, 
  ChannelMessage, 
  ChannelResponse, 
  ChannelUser, 
  ChannelInfo, 
  ChannelCapabilities, 
  MessageChannelConfig, 
  MessageHandler 
} from '../src/core/channels/MessageChannel';

// Mock logger for tests
const mockLogger = {
  child: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
};

// Concrete implementation for testing the abstract class
class TestMessageChannel extends MessageChannel {
  private messages: ChannelMessage[] = [];
  private sentMessages: ChannelResponse[] = [];

  constructor(config: MessageChannelConfig, logger: any = mockLogger) {
    super(config, logger);
  }

  getChannelName(): string {
    return 'test-channel';
  }

  getCapabilities(): ChannelCapabilities {
    return {
      supportsThreads: true,
      supportsFiles: true,
      supportsBlocks: false,
      supportsReactions: true,
      supportsTypingIndicator: true,
      maxMessageLength: 4000,
      supportedFileTypes: ['jpg', 'png', 'txt', 'pdf']
    };
  }

  async start(): Promise<void> {
    this.isConnected = true;
  }

  async stop(): Promise<void> {
    this.isConnected = false;
  }

  async sendMessage(response: ChannelResponse): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Channel not connected');
    }
    this.sentMessages.push(response);
  }

  async updateMessage(channel: string, messageId: string, content: string): Promise<void> {
    // Mock implementation
  }

  async sendTypingIndicator(channel: string): Promise<void> {
    // Mock implementation
  }

  async getChannelInfo(channelId: string): Promise<ChannelInfo> {
    return {
      id: channelId,
      name: `test-channel-${channelId}`,
      type: 'public',
      members: ['user1', 'user2'],
      metadata: { testChannel: true }
    };
  }

  async getUserInfo(userId: string): Promise<ChannelUser> {
    return {
      id: userId,
      name: `test-user-${userId}`,
      displayName: `Test User ${userId}`,
      email: `test-${userId}@example.com`,
      metadata: { testUser: true }
    };
  }

  async healthCheck(): Promise<boolean> {
    return this.isConnected;
  }

  destroy(): void {
    this.isConnected = false;
    this.messageHandlers = [];
  }

  // Test helper methods
  simulateMessage(message: ChannelMessage): void {
    this.messages.push(message);
    this.triggerMessageHandlers(message);
  }

  getSentMessages(): ChannelResponse[] {
    return [...this.sentMessages];
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

describe('MessageChannel', () => {
  let channel: TestMessageChannel;
  let config: MessageChannelConfig;

  beforeEach(() => {
    config = {
      apiToken: 'test-token',
      botToken: 'test-bot-token',
      additionalConfig: { testParam: true }
    };
    channel = new TestMessageChannel(config);
  });

  afterEach(() => {
    channel.destroy();
  });

  describe('constructor', () => {
    it('should initialize with config and logger', () => {
      expect(channel).toBeDefined();
      expect(channel.getConnectionStatus()).toBe(false);
    });

    it('should create child logger with channel name', () => {
      expect(mockLogger.child).toHaveBeenCalledWith({ component: 'channel-test-channel' });
    });
  });

  describe('getChannelName', () => {
    it('should return channel name', () => {
      expect(channel.getChannelName()).toBe('test-channel');
    });
  });

  describe('getCapabilities', () => {
    it('should return channel capabilities', () => {
      const capabilities = channel.getCapabilities();
      
      expect(capabilities).toBeDefined();
      expect(capabilities.supportsThreads).toBe(true);
      expect(capabilities.supportsFiles).toBe(true);
      expect(capabilities.maxMessageLength).toBe(4000);
      expect(capabilities.supportedFileTypes).toContain('jpg');
    });
  });

  describe('connection lifecycle', () => {
    it('should start connection', async () => {
      await channel.start();
      expect(channel.getConnectionStatus()).toBe(true);
    });

    it('should stop connection', async () => {
      await channel.start();
      await channel.stop();
      expect(channel.getConnectionStatus()).toBe(false);
    });

    it('should handle start when already connected', async () => {
      await channel.start();
      await channel.start(); // Should not throw
      expect(channel.getConnectionStatus()).toBe(true);
    });
  });

  describe('sendMessage', () => {
    beforeEach(async () => {
      await channel.start();
    });

    it('should send message when connected', async () => {
      const response: ChannelResponse = {
        channel: 'test-channel-1',
        content: 'Hello, world!',
        metadata: { testMessage: true }
      };

      await channel.sendMessage(response);
      const sentMessages = channel.getSentMessages();
      
      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0]).toEqual(response);
    });

    it('should send threaded message', async () => {
      const response: ChannelResponse = {
        channel: 'test-channel-1',
        content: 'Reply message',
        threadId: 'thread-123'
      };

      await channel.sendMessage(response);
      const sentMessages = channel.getSentMessages();
      
      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0]!.threadId).toBe('thread-123');
    });

    it('should throw error when not connected', async () => {
      await channel.stop(); // Disconnect the channel first
      
      const response: ChannelResponse = {
        channel: 'test-channel-1',
        content: 'Hello, world!'
      };

      await expect(channel.sendMessage(response)).rejects.toThrow('Channel not connected');
    });
  });

  describe('message handlers', () => {
    it('should register message handler', () => {
      const handler: MessageHandler = jest.fn();
      
      channel.onMessage(handler);
      // Should not throw and handler should be registered
    });

    it('should trigger message handlers', async () => {
      const handler: MessageHandler = jest.fn();
      channel.onMessage(handler);

      const message: ChannelMessage = {
        id: 'msg-123',
        content: 'Test message',
        user: 'user-123',
        channel: 'channel-123',
        timestamp: '2025-07-07T10:00:00Z',
        mentions: []
      };

      channel.simulateMessage(message);
      
      // Allow async handlers to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(handler).toHaveBeenCalledWith(message);
    });

    it('should remove message handler', async () => {
      const handler: MessageHandler = jest.fn();
      
      channel.onMessage(handler);
      channel.offMessage(handler);

      const message: ChannelMessage = {
        id: 'msg-123',
        content: 'Test message',
        user: 'user-123',
        channel: 'channel-123',
        timestamp: '2025-07-07T10:00:00Z',
        mentions: []
      };

      channel.simulateMessage(message);
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle multiple message handlers', async () => {
      const handler1: MessageHandler = jest.fn();
      const handler2: MessageHandler = jest.fn();
      
      channel.onMessage(handler1);
      channel.onMessage(handler2);

      const message: ChannelMessage = {
        id: 'msg-123',
        content: 'Test message',
        user: 'user-123',
        channel: 'channel-123',
        timestamp: '2025-07-07T10:00:00Z',
        mentions: []
      };

      channel.simulateMessage(message);
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(handler1).toHaveBeenCalledWith(message);
      expect(handler2).toHaveBeenCalledWith(message);
    });
  });

  describe('channel information', () => {
    it('should get channel info', async () => {
      const channelInfo = await channel.getChannelInfo('channel-123');
      
      expect(channelInfo).toBeDefined();
      expect(channelInfo.id).toBe('channel-123');
      expect(channelInfo.name).toBe('test-channel-channel-123');
      expect(channelInfo.type).toBe('public');
      expect(channelInfo.members).toContain('user1');
    });

    it('should get user info', async () => {
      const userInfo = await channel.getUserInfo('user-456');
      
      expect(userInfo).toBeDefined();
      expect(userInfo.id).toBe('user-456');
      expect(userInfo.name).toBe('test-user-user-456');
      expect(userInfo.email).toBe('test-user-456@example.com');
    });
  });

  describe('healthCheck', () => {
    it('should return false when disconnected', async () => {
      const isHealthy = await channel.healthCheck();
      expect(isHealthy).toBe(false);
    });

    it('should return true when connected', async () => {
      await channel.start();
      const isHealthy = await channel.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });

  describe('destroy', () => {
    it('should clean up resources', () => {
      const handler: MessageHandler = jest.fn();
      channel.onMessage(handler);
      
      channel.destroy();
      
      expect(channel.getConnectionStatus()).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle handler errors gracefully', async () => {
      const errorHandler: MessageHandler = jest.fn().mockRejectedValue(new Error('Handler error'));
      const goodHandler: MessageHandler = jest.fn();
      
      channel.onMessage(errorHandler);
      channel.onMessage(goodHandler);

      const message: ChannelMessage = {
        id: 'msg-123',
        content: 'Test message',
        user: 'user-123',
        channel: 'channel-123',
        timestamp: '2025-07-07T10:00:00Z',
        mentions: []
      };

      // Should not throw even if one handler fails
      expect(() => channel.simulateMessage(message)).not.toThrow();
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(goodHandler).toHaveBeenCalled();
    });
  });
});
