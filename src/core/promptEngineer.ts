/**
 * Prompt Engineering System for LLM Agent
 * 
 * This module handles system prompts and response parsing for converting
 * natural language requests into structured, actionable commands.
 */

export interface SystemPromptContext {
  userRequest: string;
  projectContext?: string;
  availableActions?: string[];
  conversationHistory?: string[];
}

export interface StructuredCommand {
  action: string;
  parameters: Record<string, any>;
  reasoning: string;
  confidence: number; // 0-1 scale
  requiresApproval?: boolean;
}

export interface ParsedResponse {
  commands: StructuredCommand[];
  reasoning: string;
  needsMoreInfo?: boolean;
  userMessage?: string; // Human-readable response to user
}

/**
 * Prompt Engineering System - Advanced prompt generation and response structuring
 * 
 * **Purpose**: 
 * Converts natural language requests into structured prompts that guide LLMs
 * to generate precise, executable commands with appropriate context and constraints.
 * 
 * **Dependencies**:
 * - No external dependencies (pure prompt generation logic)
 * - Consumed by: LLMOrchestrator for request processing
 * - Used with: ResponseParser for command validation
 * 
 * **Key Patterns**:
 * - Template-based prompt generation with dynamic context injection
 * - Structured response formatting to ensure parseable LLM outputs
 * - Context-aware action filtering based on available capabilities
 * - Few-shot learning examples for complex command structures
 * 
 * **Lifecycle**:
 * 1. Receive user request and environmental context
 * 2. Generate system prompt with available actions and constraints
 * 3. Inject project-specific context and conversation history
 * 4. Format response requirements for structured command output
 * 5. Return complete prompt ready for LLM processing
 * 
 * **Performance Considerations**:
 * - Prompt templates are static and efficiently concatenated
 * - Context injection is minimal to reduce token usage
 * - Action lists are filtered to relevant capabilities only
 * 
 * **Error Handling**:
 * - Graceful handling of missing context elements
 * - Default fallbacks for undefined action lists
 * - Validation hints embedded in prompts to guide LLM behavior
 */
export class PromptEngineer {
  
  /**
   * Generate comprehensive system prompt for LLM request processing
   * 
   * @param context - Request context containing:
   *   - userRequest: Natural language instruction from user
   *   - projectContext: Current codebase and project state information
   *   - availableActions: List of actions the agent can execute
   *   - conversationHistory: Previous exchanges for context continuity
   * 
   * @returns Complete system prompt string optimized for structured command generation
   * 
   * **Prompt Engineering Strategy**:
   * - Clear role definition and behavioral expectations
   * - Explicit response format requirements with JSON schema
   * - Context injection for project-aware decision making
   * - Safety guidelines and approval requirements
   * - Few-shot examples for complex command patterns
   * 
   * **Token Optimization**:
   * - Concise but complete instruction set
   * - Dynamic action filtering to include only relevant capabilities
   * - Minimal context injection to stay within token limits
   */
  public generateSystemPrompt(context: SystemPromptContext): string {
    const basePrompt = `You are an advanced LLM agent capable of managing codebases and executing development tasks.

Your role is to:
1. **Think**: Analyze user requests and understand what needs to be done
2. **Act**: Generate structured commands that can be executed programmatically  
3. **Observe**: Learn from execution results and adjust future actions

## Available Actions:
${this.getAvailableActionsPrompt(context.availableActions)}

## Response Format:
You must respond with a JSON object containing:
{
  "commands": [
    {
      "action": "action_name",
      "parameters": { "key": "value" },
      "reasoning": "Why this action is needed",
      "confidence": 0.9,
      "requiresApproval": false
    }
  ],
  "reasoning": "Overall reasoning for the approach",
  "needsMoreInfo": false,
  "userMessage": "Human-readable response to show the user"
}

## Guidelines:
- Break complex tasks into smaller, specific actions
- Always explain your reasoning
- Set requiresApproval=true for destructive operations
- Use confidence scores to indicate uncertainty
- Request more information if the request is unclear
- Provide helpful user messages explaining what you're doing

## Safety Rules:
- Never execute destructive operations without approval
- Always validate file paths and parameters
- Prefer read operations before write operations
- Create backups before major changes
- Sandbox operations when possible`;

    if (context.projectContext) {
      return basePrompt + `\n\n## Project Context:\n${context.projectContext}`;
    }

    return basePrompt;
  }

  /**
   * Generate available actions section for the prompt
   */
  private getAvailableActionsPrompt(availableActions?: string[]): string {
    // For now, we'll define the initial set of actions
    // Later this will be dynamically generated from the action registry
    const defaultActions = [
      'file_read - Read file contents',
      'file_write - Create or update files', 
      'file_delete - Delete files (requires approval)',
      'dir_create - Create directories',
      'dir_list - List directory contents',
      'git_status - Check git repository status',
      'git_clone - Clone a repository',
      'git_commit - Commit changes',
      'git_push - Push changes to remote',
      'npm_install - Install npm packages',
      'npm_run - Run npm scripts',
      'shell_exec - Execute shell commands (requires approval)',
      'code_analyze - Analyze code structure and quality',
      'project_scaffold - Create new project from template'
    ];

    const actions = availableActions || defaultActions;
    return actions.map(action => `- ${action}`).join('\n');
  }

  /**
   * Parse LLM response into structured commands
   */
  public parseResponse(response: string): ParsedResponse {
    try {
      // Remove any markdown code blocks if present
      const cleanResponse = response
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsed = JSON.parse(cleanResponse);
      
      // Validate the response structure
      if (!parsed.commands || !Array.isArray(parsed.commands)) {
        throw new Error('Response must contain a commands array');
      }

      // Validate each command
      for (const command of parsed.commands) {
        if (!command.action || typeof command.action !== 'string') {
          throw new Error('Each command must have an action string');
        }
        if (!command.parameters || typeof command.parameters !== 'object') {
          throw new Error('Each command must have a parameters object');
        }
        if (!command.reasoning || typeof command.reasoning !== 'string') {
          throw new Error('Each command must have reasoning');
        }
        if (typeof command.confidence !== 'number' || command.confidence < 0 || command.confidence > 1) {
          throw new Error('Each command must have a confidence between 0 and 1');
        }
      }

      return {
        commands: parsed.commands,
        reasoning: parsed.reasoning || 'No reasoning provided',
        needsMoreInfo: parsed.needsMoreInfo || false,
        userMessage: parsed.userMessage || 'Processing your request...'
      };

    } catch (error) {
      // If JSON parsing fails, treat as a regular response that needs more info
      return {
        commands: [],
        reasoning: 'Failed to parse structured response',
        needsMoreInfo: true,
        userMessage: response // Return the original response as user message
      };
    }
  }

  /**
   * Generate a follow-up prompt when more information is needed
   */
  public generateFollowUpPrompt(originalRequest: string, clarification: string): string {
    return `The user originally requested: "${originalRequest}"

They provided this clarification: "${clarification}"

Please provide a structured response with specific actions to take.`;
  }

  /**
   * Generate a prompt for handling execution results
   */
  public generateObservationPrompt(
    originalRequest: string, 
    executedCommands: StructuredCommand[], 
    results: any[]
  ): string {
    return `You executed the following commands in response to: "${originalRequest}"

Commands executed:
${executedCommands.map((cmd, i) => `${i + 1}. ${cmd.action} - ${cmd.reasoning}`).join('\n')}

Results:
${results.map((result, i) => `${i + 1}. ${JSON.stringify(result, null, 2)}`).join('\n')}

Based on these results, do you need to take any additional actions? If the task is complete, provide a summary for the user. If more actions are needed, provide them in the structured format.`;
  }
}
