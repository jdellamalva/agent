/**
 * Tests for SlackChannel - Slack Channel Implementation
 * 
 * Tests Slack integration, message handling, event processing,
 * and API interactions.
 */

import { jest } from '@jest/globals';
import { SlackChannel, SlackChannelConfig } from '../src/providers/channels/SlackChannel';
import { ChannelResponse, ChannelMessage } from '../src/core/channels/MessageChannel';
import { SlackError } from '../src/utils/errors';

// Mock Slack Bolt components
const mockApp = {
  start: jest.fn() as jest.MockedFunction<any>,
  stop: jest.fn() as jest.MockedFunction<any>,
  event: jest.fn() as jest.MockedFunction<any>,
  message: jest.fn() as jest.MockedFunction<any>,
  error: jest.fn() as jest.MockedFunction<any>
};

const mockWebClient = {
  chat: {
    postMessage: jest.fn() as jest.MockedFunction<any>,
    update: jest.fn() as jest.MockedFunction<any>
  },
  conversations: {
    info: jest.fn() as jest.MockedFunction<any>,
    replies: jest.fn() as jest.MockedFunction<any>
  },
  users: {
    info: jest.fn() as jest.MockedFunction<any>
  },
  auth: {
    test: jest.fn() as jest.MockedFunction<any>
  }
};

// Mock Slack modules
const mockSocketModeReceiver = jest.fn();

jest.mock('@slack/bolt', () => ({
  App: jest.fn(() => mockApp),
  SocketModeReceiver: jest.fn(),
  LogLevel: { INFO: 'info' }
}));

jest.mock('@slack/web-api', () => ({
  WebClient: jest.fn(() => mockWebClient)
}));

// Mock logger
const mockChildLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  child: jest.fn().mockReturnValue(mockChildLogger)
};

describe('SlackChannel', () => {
  let channel: SlackChannel;
  let config: SlackChannelConfig;

  beforeEach(() => {
    config = {
      botToken: 'xoxb-test-bot-token',
      signingSecret: 'test-signing-secret',
      appToken: 'xapp-test-app-token'
    };

    jest.clearAllMocks();
    channel = new SlackChannel(config, mockLogger);
  });

  describe('constructor', () => {
    it('should initialize with valid config', async () => {
      expect(channel).toBeInstanceOf(SlackChannel);
      expect(channel.getChannelName()).toBe('slack');
      const { SocketModeReceiver } = await import('@slack/bolt');
      expect(SocketModeReceiver).toHaveBeenCalledWith({
        appToken: config.appToken
      });
    });

    it('should throw error when bot token is missing', () => {
      const invalidConfig = { ...config, botToken: '' };
      
      expect(() => new SlackChannel(invalidConfig, mockLogger)).toThrow(SlackError);
      expect(() => new SlackChannel(invalidConfig, mockLogger)).toThrow('Missing required Slack configuration');
    });

    it('should throw error when signing secret is missing', () => {
      const invalidConfig = { ...config, signingSecret: '' };
      
      expect(() => new SlackChannel(invalidConfig, mockLogger)).toThrow(SlackError);
    });

    it('should throw error when app token is missing', () => {
      const invalidConfig = { ...config, appToken: '' };
      
      expect(() => new SlackChannel(invalidConfig, mockLogger)).toThrow(SlackError);
    });

    it('should setup event handlers during initialization', () => {
      expect(mockApp.event).toHaveBeenCalledWith('app_mention', expect.any(Function));
      expect(mockApp.message).toHaveBeenCalledWith(expect.any(Function));
      expect(mockApp.error).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('getChannelName', () => {
    it('should return "slack"', () => {
      expect(channel.getChannelName()).toBe('slack');
    });
  });

  describe('getCapabilities', () => {
    it('should return correct capabilities', () => {
      const capabilities = channel.getCapabilities();

      expect(capabilities).toEqual({
        supportsThreads: true,
        supportsFiles: true,
        supportsBlocks: true,
        supportsReactions: true,
        supportsTypingIndicator: false,
        maxMessageLength: 40000,
        supportedFileTypes: ['*']
      });
    });
  });

  describe('start', () => {
    it('should start the Slack app successfully', async () => {
      mockApp.start.mockResolvedValue(undefined);

      await channel.start();

      expect(mockApp.start).toHaveBeenCalledTimes(1);
      expect(mockChildLogger.info).toHaveBeenCalledWith('Slack channel started successfully');
    });

    it('should handle start errors', async () => {
      const error = new Error('Failed to start');
      mockApp.start.mockRejectedValue(error);

      await expect(channel.start()).rejects.toThrow(SlackError);
      await expect(channel.start()).rejects.toThrow('Failed to start Slack channel');
      
      expect(mockChildLogger.error).toHaveBeenCalledWith('Failed to start Slack channel', { error });
    });
  });

  describe('stop', () => {
    it('should stop the Slack app successfully', async () => {
      mockApp.stop.mockResolvedValue(undefined);

      await channel.stop();

      expect(mockApp.stop).toHaveBeenCalledTimes(1);
      expect(mockChildLogger.info).toHaveBeenCalledWith('Slack channel stopped');
    });

    it('should handle stop errors gracefully', async () => {
      const error = new Error('Failed to stop');
      mockApp.stop.mockRejectedValue(error);

      await channel.stop();

      expect(mockChildLogger.error).toHaveBeenCalledWith('Error stopping Slack channel', { error });
    });
  });

  describe('sendMessage', () => {
    const mockResponse: ChannelResponse = {
      channel: 'C1234567890',
      content: 'Hello, World!',
      threadId: '1234567890.123'
    };

    it('should send message successfully', async () => {
      mockWebClient.chat.postMessage.mockResolvedValue({ ok: true });

      await channel.sendMessage(mockResponse);

      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith({
        channel: mockResponse.channel,
        text: mockResponse.content,
        thread_ts: mockResponse.threadId
      });

      expect(mockChildLogger.info).toHaveBeenCalledWith('Message sent successfully', {
        channel: mockResponse.channel,
        threadId: mockResponse.threadId
      });
    });

    it('should send message with blocks', async () => {
      const responseWithBlocks = {
        ...mockResponse,
        blocks: [{ type: 'section', text: { type: 'plain_text', text: 'Block content' } }]
      };
      mockWebClient.chat.postMessage.mockResolvedValue({ ok: true });

      await channel.sendMessage(responseWithBlocks);

      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith({
        channel: responseWithBlocks.channel,
        text: responseWithBlocks.content,
        thread_ts: responseWithBlocks.threadId,
        blocks: responseWithBlocks.blocks
      });
    });

    it('should send message without thread', async () => {
      const responseWithoutThread = { 
        ...mockResponse, 
        threadId: undefined as any // Cast to bypass strict typing
      };
      mockWebClient.chat.postMessage.mockResolvedValue({ ok: true });

      await channel.sendMessage(responseWithoutThread);

      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith({
        channel: responseWithoutThread.channel,
        text: responseWithoutThread.content
      });
    });

    it('should handle send message errors', async () => {
      const error = new Error('Slack API error');
      mockWebClient.chat.postMessage.mockRejectedValue(error);

      await expect(channel.sendMessage(mockResponse)).rejects.toThrow(SlackError);
      await expect(channel.sendMessage(mockResponse)).rejects.toThrow('Failed to send message to Slack');

      expect(mockChildLogger.error).toHaveBeenCalledWith('Error sending message', {
        error,
        response: mockResponse
      });
    });
  });

  describe('updateMessage', () => {
    it('should update message successfully', async () => {
      mockWebClient.chat.update.mockResolvedValue({ ok: true });

      await channel.updateMessage('C1234567890', '1234567890.123', 'Updated content');

      expect(mockWebClient.chat.update).toHaveBeenCalledWith({
        channel: 'C1234567890',
        ts: '1234567890.123',
        text: 'Updated content'
      });

      expect(mockChildLogger.info).toHaveBeenCalledWith('Message updated successfully', {
        channel: 'C1234567890',
        messageId: '1234567890.123'
      });
    });

    it('should handle update message errors', async () => {
      const error = new Error('Update failed');
      mockWebClient.chat.update.mockRejectedValue(error);

      await expect(channel.updateMessage('C1234567890', '1234567890.123', 'Updated content'))
        .rejects.toThrow(SlackError);
      await expect(channel.updateMessage('C1234567890', '1234567890.123', 'Updated content'))
        .rejects.toThrow('Failed to update message');

      expect(mockChildLogger.error).toHaveBeenCalledWith('Error updating message', { error });
    });
  });

  describe('sendTypingIndicator', () => {
    it('should send thinking message as typing indicator', async () => {
      mockWebClient.chat.postMessage.mockResolvedValue({ ok: true });

      await channel.sendTypingIndicator('C1234567890');

      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C1234567890',
        text: '🤔 Thinking...'
      });
    });

    it('should handle typing indicator errors gracefully', async () => {
      const error = new Error('Failed to send');
      mockWebClient.chat.postMessage.mockRejectedValue(error);

      await channel.sendTypingIndicator('C1234567890');

      expect(mockChildLogger.error).toHaveBeenCalledWith('Error sending typing indicator', { error });
    });
  });

  describe('getChannelInfo', () => {
    const mockChannelInfo = {
      channel: {
        id: 'C1234567890',
        name: 'general',
        topic: { value: 'General discussion' },
        purpose: { value: 'Company-wide announcements' },
        num_members: 42,
        is_private: false,
        is_im: false
      }
    };

    it('should get channel info successfully', async () => {
      mockWebClient.conversations.info.mockResolvedValue(mockChannelInfo);

      const channelInfo = await channel.getChannelInfo('C1234567890');

      expect(channelInfo).toEqual({
        id: 'C1234567890',
        name: 'general',
        type: 'public',
        metadata: {
          topic: 'General discussion',
          purpose: 'Company-wide announcements',
          memberCount: 42
        }
      });

      expect(mockWebClient.conversations.info).toHaveBeenCalledWith({
        channel: 'C1234567890'
      });
    });

    it('should handle private channels', async () => {
      const privateChannelInfo = {
        ...mockChannelInfo,
        channel: { ...mockChannelInfo.channel, is_private: true }
      };
      mockWebClient.conversations.info.mockResolvedValue(privateChannelInfo);

      const channelInfo = await channel.getChannelInfo('C1234567890');

      expect(channelInfo.type).toBe('private');
    });

    it('should handle direct messages', async () => {
      const dmInfo = {
        ...mockChannelInfo,
        channel: { ...mockChannelInfo.channel, is_im: true }
      };
      mockWebClient.conversations.info.mockResolvedValue(dmInfo);

      const channelInfo = await channel.getChannelInfo('D1234567890');

      expect(channelInfo.type).toBe('dm');
    });

    it('should throw error when channel not found', async () => {
      mockWebClient.conversations.info.mockResolvedValue({ channel: null });

      await expect(channel.getChannelInfo('C1234567890')).rejects.toThrow(SlackError);
      await expect(channel.getChannelInfo('C1234567890')).rejects.toThrow('Failed to get channel info');
    });

    it('should handle channel info errors', async () => {
      const error = new Error('Access denied');
      mockWebClient.conversations.info.mockRejectedValue(error);

      await expect(channel.getChannelInfo('C1234567890')).rejects.toThrow(SlackError);
      await expect(channel.getChannelInfo('C1234567890')).rejects.toThrow('Failed to get channel info');

      expect(mockChildLogger.error).toHaveBeenCalledWith('Error getting channel info', {
        error,
        channelId: 'C1234567890'
      });
    });
  });

  describe('getUserInfo', () => {
    const mockUserInfo = {
      user: {
        id: 'U1234567890',
        name: 'john.doe',
        real_name: 'John Doe',
        profile: {
          email: 'john.doe@example.com',
          title: 'Software Engineer',
        },
        tz: 'America/New_York',
        is_bot: false
      }
    };

    it('should get user info successfully', async () => {
      mockWebClient.users.info.mockResolvedValue(mockUserInfo);

      const userInfo = await channel.getUserInfo('U1234567890');

      expect(userInfo).toEqual({
        id: 'U1234567890',
        name: 'john.doe',
        displayName: 'John Doe',
        email: 'john.doe@example.com',
        metadata: {
          title: 'Software Engineer',
          timeZone: 'America/New_York',
          isBot: false
        }
      });

      expect(mockWebClient.users.info).toHaveBeenCalledWith({
        user: 'U1234567890'
      });
    });

    it('should handle missing profile data', async () => {
      const userWithMinimalInfo = {
        user: {
          id: 'U1234567890',
          name: 'john.doe',
          is_bot: true
        }
      };
      mockWebClient.users.info.mockResolvedValue(userWithMinimalInfo);

      const userInfo = await channel.getUserInfo('U1234567890');

      expect(userInfo).toEqual({
        id: 'U1234567890',
        name: 'john.doe',
        displayName: 'Unknown',
        email: '',
        metadata: {
          title: '',
          timeZone: '',
          isBot: true
        }
      });
    });

    it('should throw error when user not found', async () => {
      mockWebClient.users.info.mockResolvedValue({ user: null });

      await expect(channel.getUserInfo('U1234567890')).rejects.toThrow(SlackError);
      await expect(channel.getUserInfo('U1234567890')).rejects.toThrow('Failed to get user info');
    });

    it('should handle user info errors', async () => {
      const error = new Error('User lookup failed');
      mockWebClient.users.info.mockRejectedValue(error);

      await expect(channel.getUserInfo('U1234567890')).rejects.toThrow(SlackError);
      await expect(channel.getUserInfo('U1234567890')).rejects.toThrow('Failed to get user info');

      expect(mockChildLogger.error).toHaveBeenCalledWith('Error getting user info', {
        error,
        userId: 'U1234567890'
      });
    });
  });

  describe('healthCheck', () => {
    it('should return true when auth test succeeds', async () => {
      mockWebClient.auth.test.mockResolvedValue({ ok: true });

      const isHealthy = await channel.healthCheck();

      expect(isHealthy).toBe(true);
      expect(mockWebClient.auth.test).toHaveBeenCalledTimes(1);
    });

    it('should return false when auth test fails', async () => {
      mockWebClient.auth.test.mockResolvedValue({ ok: false });

      const isHealthy = await channel.healthCheck();

      expect(isHealthy).toBe(false);
    });

    it('should return false when auth test throws error', async () => {
      const error = new Error('Auth failed');
      mockWebClient.auth.test.mockRejectedValue(error);

      const isHealthy = await channel.healthCheck();

      expect(isHealthy).toBe(false);
      expect(mockChildLogger.error).toHaveBeenCalledWith('Slack health check failed', { error });
    });
  });

  describe('getThreadHistory', () => {
    const mockThreadReplies = {
      messages: [
        {
          ts: '1234567890.123',
          text: 'Original message',
          user: 'U1234567890'
        },
        {
          ts: '1234567890.124',
          text: 'Reply message',
          user: 'U0987654321',
          bot_id: 'B123456789'
        }
      ]
    };

    it('should retrieve thread history successfully', async () => {
      mockWebClient.conversations.replies.mockResolvedValue(mockThreadReplies);

      const history = await channel.getThreadHistory('C1234567890', '1234567890.123', 5);

      expect(history).toHaveLength(2);
      expect(history[0]).toEqual({
        id: '1234567890.123',
        content: 'Original message',
        user: 'U1234567890',
        channel: 'C1234567890',
        timestamp: '1234567890.123',
        threadId: '1234567890.123',
        mentions: [],
        metadata: {
          isBot: false,
          originalMessage: mockThreadReplies.messages[0]
        }
      });

      expect(mockWebClient.conversations.replies).toHaveBeenCalledWith({
        channel: 'C1234567890',
        ts: '1234567890.123',
        limit: 5
      });
    });

    it('should handle empty thread history', async () => {
      mockWebClient.conversations.replies.mockResolvedValue({ messages: null });

      const history = await channel.getThreadHistory('C1234567890', '1234567890.123');

      expect(history).toEqual([]);
    });

    it('should handle thread history errors gracefully', async () => {
      const error = new Error('Access denied');
      mockWebClient.conversations.replies.mockRejectedValue(error);

      const history = await channel.getThreadHistory('C1234567890', '1234567890.123');

      expect(history).toEqual([]);
      expect(mockChildLogger.warn).toHaveBeenCalledWith('Failed to retrieve thread history', {
        error,
        channelId: 'C1234567890',
        threadId: '1234567890.123'
      });
    });

    it('should extract mentions from messages', async () => {
      const messageWithMentions = {
        messages: [{
          ts: '1234567890.123',
          text: 'Hey <@U1234567890> and <@U0987654321>, how are you?',
          user: 'U1111111111'
        }]
      };
      mockWebClient.conversations.replies.mockResolvedValue(messageWithMentions);

      const history = await channel.getThreadHistory('C1234567890', '1234567890.123');

      expect(history).toHaveLength(1);
      expect(history[0]!.mentions).toEqual(['U1234567890', 'U0987654321']);
    });
  });

  describe('getApp', () => {
    it('should return the Slack app instance', () => {
      const app = channel.getApp();
      expect(app).toBe(mockApp);
    });
  });

  describe('createSlackChannel factory', () => {
    it('should create channel instance', () => {
      const { createSlackChannel } = require('../src/providers/channels/SlackChannel');
      const factoryChannel = createSlackChannel(config, mockLogger);
      
      expect(factoryChannel).toBeInstanceOf(SlackChannel);
      expect(factoryChannel.getChannelName()).toBe('slack');
    });
  });

  describe('event handling', () => {
    let appMentionHandler: (args: any) => Promise<void>;
    let messageHandler: (args: any) => Promise<void>;
    let errorHandler: (error: any) => Promise<void>;

    beforeEach(() => {
      // Extract the event handlers that were registered
      const eventCalls = mockApp.event.mock.calls;
      const messageCalls = mockApp.message.mock.calls;
      const errorCalls = mockApp.error.mock.calls;
      
      appMentionHandler = eventCalls.find((call: any) => call[0] === 'app_mention')?.[1];
      messageHandler = messageCalls[0]?.[0];
      errorHandler = errorCalls[0]?.[0];
    });

    it('should handle app mentions correctly', async () => {
      const mockEvent = {
        event: {
          ts: '1234567890.123',
          text: '<@U123456789> hello there',
          user: 'U0987654321',
          channel: 'C1234567890',
          thread_ts: '1234567890.120'
        }
      };

      // Mock the triggerMessageHandlers method
      const triggerSpy = jest.spyOn(channel, 'triggerMessageHandlers' as any).mockResolvedValue(undefined);

      await appMentionHandler(mockEvent);

      expect(mockChildLogger.info).toHaveBeenCalledWith('Received app mention', {
        user: 'U0987654321',
        channel: 'C1234567890',
        text: '<@U123456789> hello there'
      });

      expect(triggerSpy).toHaveBeenCalledWith(expect.objectContaining({
        id: '1234567890.123',
        content: '<@U123456789> hello there',
        user: 'U0987654321',
        channel: 'C1234567890',
        timestamp: '1234567890.123',
        threadId: '1234567890.120'
      }));
    });

    it('should handle direct messages correctly', async () => {
      const mockMessage = {
        message: {
          ts: '1234567890.123',
          text: 'Hello bot',
          user: 'U0987654321',
          channel: 'D1234567890',
          channel_type: 'im'
        }
      };

      const triggerSpy = jest.spyOn(channel, 'triggerMessageHandlers' as any).mockResolvedValue(undefined);

      await messageHandler(mockMessage);

      expect(mockChildLogger.info).toHaveBeenCalledWith('Received direct message', {
        user: 'U0987654321',
        text: 'Hello bot'
      });

      expect(triggerSpy).toHaveBeenCalledWith(expect.objectContaining({
        id: '1234567890.123',
        content: 'Hello bot',
        user: 'U0987654321',
        channel: 'D1234567890'
      }));
    });

    it('should handle app errors', async () => {
      const mockError = new Error('Slack app error');

      await errorHandler(mockError);

      expect(mockChildLogger.error).toHaveBeenCalledWith('Slack app error', { error: mockError });
    });
  });
});
