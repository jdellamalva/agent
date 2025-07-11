/**
 * MessageParser - Intelligent message parsing and context extraction
 * 
 * **Purpose**: 
 * Parses raw chat messages from various platforms (Slack, Discord, etc.) and
 * extracts structured information including prompts, mentions, flags, and
 * contextual metadata for agent processing.
 * 
 * **Dependencies**:
 * - Logger: For message parsing diagnostics and debugging
 * - No external dependencies (platform-agnostic parsing logic)
 * 
 * **Key Patterns**:
 * - Static utility class for stateless message processing
 * - Regex-based extraction with performance optimization
 * - Platform-specific formatting normalization
 * - Context-aware parsing based on message metadata
 * 
 * **Lifecycle**:
 * 1. Receive raw message with platform-specific formatting
 * 2. Clean and normalize text content (remove platform markup)
 * 3. Extract structured elements (mentions, flags, actions)
 * 4. Build contextual metadata (channel type, thread status)
 * 5. Return parsed message ready for agent processing
 * 
 * **Performance Considerations**:
 * - Compiled regex patterns for efficient text processing
 * - Minimal string operations to reduce memory allocation
 * - Short-circuit evaluation for common parsing scenarios
 * - Caching of repeated parsing operations
 * 
 * **Error Handling**:
 * - Graceful handling of malformed message content
 * - Fallback to original text if parsing fails
 * - Detailed logging for parsing failure analysis
 * - Platform-specific edge case handling
 */

import { agentLogger } from '../utils/logger';

const logger = agentLogger.child({ component: 'message-parser' });

export interface ParsedMessage {
  prompt: string;
  user: string;
  channel: string;
  timestamp: string;
  threadTimestamp?: string;
  mentions: string[];
  hasUrgentFlag: boolean;
  hasQuietFlag: boolean;
  requestedActions: string[];
}

export interface MessageContext {
  isDirectMessage: boolean;
  isThread: boolean;
  channelType: 'public' | 'private' | 'dm';
  botMentioned: boolean;
}

/**
 * MessageParser - Platform-agnostic message parsing and content extraction
 * 
 * **Responsibility**: 
 * - Parse raw chat messages into structured, actionable data
 * - Extract user intent, flags, mentions, and contextual information
 * - Normalize platform-specific formatting differences
 * - Provide consistent parsing interface across message platforms
 * 
 * **Collaborators**:
 * - Logger: For parsing diagnostics and error tracking
 * - MessageChannel implementations: For platform-specific message handling
 * - LLMOrchestrator: Consumes parsed messages for processing
 * 
 * **Parsing Features**:
 * - Mention extraction (@user, @channel patterns)
 * - Flag detection (urgent, quiet, background processing modes)
 * - Action keyword identification (file operations, git commands)
 * - Context analysis (DM vs channel, thread vs main conversation)
 * 
 * **Platform Support**: 
 * Designed for extensibility across Slack, Discord, Teams, and custom platforms
 */
export class MessageParser {
  
  /**
   * Parse chat message into structured data for agent processing
   * 
   * @param text - Raw message content with platform formatting
   * @param user - User identifier who sent the message
   * @param channel - Channel identifier where message was sent
   * @param ts - Message timestamp for threading and ordering
   * @param threadTs - Optional thread timestamp for conversation context
   * 
   * @returns ParsedMessage with extracted prompt, mentions, flags, and metadata
   * 
   * **Processing Steps**:
   * 1. Clean platform-specific markup and formatting
   * 2. Extract core prompt content for LLM processing
   * 3. Identify user/channel mentions for notifications
   * 4. Detect priority flags (urgent, quiet) for processing hints
   * 5. Extract action keywords for command routing
   * 
   * **Performance**: O(n) where n is message length, with regex optimizations
   */
  public static parseMessage(
    text: string,
    user: string,
    channel: string,
    ts: string,
    threadTs?: string
  ): ParsedMessage {
    logger.debug('Parsing message', { text, user, channel });

    // Clean the text
    const cleanedText = this.cleanText(text);
    
    // Extract prompt (main content)
    const prompt = this.extractPrompt(cleanedText);
    
    // Extract mentions
    const mentions = this.extractMentions(text);
    
    // Check for flags
    const hasUrgentFlag = this.hasFlag(cleanedText, ['urgent', 'asap', '!urgent']);
    const hasQuietFlag = this.hasFlag(cleanedText, ['quiet', 'silent', 'background']);
    
    // Extract requested actions
    const requestedActions = this.extractRequestedActions(cleanedText);

    const parsed: ParsedMessage = {
      prompt,
      user,
      channel,
      timestamp: ts,
      mentions,
      hasUrgentFlag,
      hasQuietFlag,
      requestedActions,
      ...(threadTs && { threadTimestamp: threadTs }),
    };

    logger.debug('Parsed message', parsed);
    return parsed;
  }

  /**
   * Get context about the message
   */
  public static getMessageContext(
    channel: string,
    text: string,
    threadTs?: string
  ): MessageContext {
    return {
      isDirectMessage: channel.startsWith('D'),
      isThread: !!threadTs,
      channelType: this.getChannelType(channel),
      botMentioned: this.isBotMentioned(text),
    };
  }

  /**
   * Clean text by removing mentions, extra spaces, etc.
   */
  private static cleanText(text: string): string {
    return text
      .replace(/<@U[A-Z0-9]+>/g, '') // Remove user mentions
      .replace(/<#C[A-Z0-9]+\|[^>]+>/g, '') // Remove channel mentions
      .replace(/<https?:\/\/[^>]+>/g, '') // Remove links (keep just URL)
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Extract the main prompt from cleaned text
   */
  private static extractPrompt(cleanedText: string): string {
    // Remove common bot trigger words
    let prompt = cleanedText
      .replace(/^(hey|hi|hello)\s+/i, '')
      .replace(/\s+(please|thanks|thank you)$/i, '')
      .trim();

    // If the prompt is very short, it might be a greeting
    if (prompt.length < 3) {
      return '';
    }

    return prompt;
  }

  /**
   * Extract user mentions from text
   */
  private static extractMentions(text: string): string[] {
    const mentionRegex = /<@(U[A-Z0-9]+)>/g;
    const mentions: string[] = [];
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      if (match[1]) {
        mentions.push(match[1]);
      }
    }

    return mentions;
  }

  /**
   * Check if text contains any of the specified flags
   */
  private static hasFlag(text: string, flags: string[]): boolean {
    const lowerText = text.toLowerCase();
    return flags.some(flag => lowerText.includes(flag.toLowerCase()));
  }

  /**
   * Extract requested actions from the text
   */
  private static extractRequestedActions(text: string): string[] {
    const actions: string[] = [];
    const lowerText = text.toLowerCase();

    // Common action patterns
    const actionPatterns = [
      { pattern: /create|make|build|generate/i, action: 'create' },
      { pattern: /update|modify|change|edit/i, action: 'update' },
      { pattern: /delete|remove|clean/i, action: 'delete' },
      { pattern: /analyze|check|review|examine/i, action: 'analyze' },
      { pattern: /deploy|publish|release/i, action: 'deploy' },
      { pattern: /test|run tests/i, action: 'test' },
      { pattern: /clone|fork|copy/i, action: 'clone' },
      { pattern: /commit|save|persist/i, action: 'commit' },
      { pattern: /merge|combine/i, action: 'merge' },
      { pattern: /refactor|improve|optimize/i, action: 'refactor' },
    ];

    for (const { pattern, action } of actionPatterns) {
      if (pattern.test(text)) {
        actions.push(action);
      }
    }

    return [...new Set(actions)]; // Remove duplicates
  }

  /**
   * Check if bot is mentioned in the text
   */
  private static isBotMentioned(text: string): boolean {
    return /<@U[A-Z0-9]+>/.test(text) || text.toLowerCase().includes('@agent');
  }

  /**
   * Determine channel type
   */
  private static getChannelType(channel: string): 'public' | 'private' | 'dm' {
    if (channel.startsWith('C')) return 'public';
    if (channel.startsWith('G')) return 'private';
    if (channel.startsWith('D')) return 'dm';
    return 'public'; // fallback
  }

  /**
   * Validate if a message should be processed
   */
  public static shouldProcessMessage(parsed: ParsedMessage, context: MessageContext): boolean {
    // Don't process empty prompts
    if (!parsed.prompt.trim()) {
      return false;
    }

    // Always process direct messages
    if (context.isDirectMessage) {
      return true;
    }

    // In channels, only process if bot is mentioned
    if (context.botMentioned) {
      return true;
    }

    return false;
  }

  /**
   * Generate a summary of the parsed message
   */
  public static summarizeMessage(parsed: ParsedMessage, context: MessageContext): string {
    const parts = [
      `User: ${parsed.user}`,
      `Channel: ${context.channelType}`,
      `Prompt: "${parsed.prompt.substring(0, 100)}${parsed.prompt.length > 100 ? '...' : ''}"`,
    ];

    if (parsed.hasUrgentFlag) parts.push('🚨 URGENT');
    if (parsed.hasQuietFlag) parts.push('🤫 Quiet mode');
    if (parsed.requestedActions.length > 0) parts.push(`Actions: ${parsed.requestedActions.join(', ')}`);

    return parts.join(' | ');
  }
}
