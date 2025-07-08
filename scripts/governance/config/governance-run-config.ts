/**
 * Governance Run Configuration
 * 
 * Controls which governance checks are executed based on different scenarios.
 * Allows for flexible configuration of governance execution.
 * 
 * NOTE: This configuration is specific to the base agent development.
 * In production deployments, customize these profiles for your project needs.
 */

export interface CheckSelection {
  codeQuality: {
    enabled: boolean;
    checks: {
      magicNumbers: boolean;
      magicStrings: boolean;
      namingConventions: boolean;
      importExport: boolean;
      complexity: boolean;
      solidPrinciples: boolean;
      dryPrinciples: boolean;
    };
  };
  documentation: {
    enabled: boolean;
    checks: {
      documentation: boolean;
      titleContentAlignment: boolean;
    };
  };
  projectManagement: {
    enabled: boolean;
    checks: {
      todoStandards: boolean;
    };
  };
}

export interface GovernanceRunConfig {
  profiles: {
    quick: CheckSelection;
    full: CheckSelection;
    ci: CheckSelection;
    preCommit: CheckSelection;
  };
}

/**
 * Base Agent Governance Run Configuration
 * 
 * WARNING: This configuration is designed for the base agent development.
 * In production deployments:
 * 1. Customize profiles for your project workflow
 * 2. Adjust check selections based on team preferences
 * 3. Consider different profiles for different environments
 */
export const BASE_AGENT_RUN_CONFIG: GovernanceRunConfig = {
  profiles: {
    // Quick profile - fast deterministic checks only
    quick: {
      codeQuality: {
        enabled: true,
        checks: {
          magicNumbers: true,
          magicStrings: true,
          namingConventions: true,
          importExport: true,
          complexity: false,        // Skip LLM-assisted checks
          solidPrinciples: false,   // Skip LLM-assisted checks
          dryPrinciples: false,     // Skip LLM-assisted checks
        },
      },
      documentation: {
        enabled: true,
        checks: {
          documentation: true,
          titleContentAlignment: false, // Skip LLM-assisted checks
        },
      },
      projectManagement: {
        enabled: true,
        checks: {
          todoStandards: true,
        },
      },
    },

    // Full profile - all checks including LLM-assisted
    full: {
      codeQuality: {
        enabled: true,
        checks: {
          magicNumbers: true,
          magicStrings: true,
          namingConventions: true,
          importExport: true,
          complexity: true,
          solidPrinciples: true,
          dryPrinciples: true,
        },
      },
      documentation: {
        enabled: true,
        checks: {
          documentation: true,
          titleContentAlignment: true,
        },
      },
      projectManagement: {
        enabled: true,
        checks: {
          todoStandards: true,
        },
      },
    },

    // CI profile - deterministic checks suitable for CI/CD
    ci: {
      codeQuality: {
        enabled: true,
        checks: {
          magicNumbers: true,
          magicStrings: true,
          namingConventions: true,
          importExport: true,
          complexity: false,        // Skip LLM checks in CI
          solidPrinciples: false,
          dryPrinciples: false,
        },
      },
      documentation: {
        enabled: true,
        checks: {
          documentation: true,
          titleContentAlignment: false, // Skip LLM checks in CI
        },
      },
      projectManagement: {
        enabled: false, // Skip project management in CI
        checks: {
          todoStandards: false,
        },
      },
    },

    // Pre-commit profile - essential checks for commit hooks
    preCommit: {
      codeQuality: {
        enabled: true,
        checks: {
          magicNumbers: true,
          magicStrings: false,      // Skip to keep pre-commit fast
          namingConventions: true,
          importExport: true,
          complexity: false,
          solidPrinciples: false,
          dryPrinciples: false,
        },
      },
      documentation: {
        enabled: false, // Skip documentation checks in pre-commit
        checks: {
          documentation: false,
          titleContentAlignment: false,
        },
      },
      projectManagement: {
        enabled: false, // Skip project management in pre-commit
        checks: {
          todoStandards: false,
        },
      },
    },
  },
};

/**
 * Get governance run configuration for a specific profile
 */
export function getRunConfig(profile: keyof GovernanceRunConfig['profiles']): CheckSelection {
  return BASE_AGENT_RUN_CONFIG.profiles[profile];
}

/**
 * Create a custom configuration by merging with a base profile
 */
export function createCustomConfig(
  baseProfile: keyof GovernanceRunConfig['profiles'],
  overrides: Partial<CheckSelection>
): CheckSelection {
  const base = getRunConfig(baseProfile);
  return {
    codeQuality: {
      ...base.codeQuality,
      ...overrides.codeQuality,
      checks: {
        ...base.codeQuality.checks,
        ...overrides.codeQuality?.checks,
      },
    },
    documentation: {
      ...base.documentation,
      ...overrides.documentation,
      checks: {
        ...base.documentation.checks,
        ...overrides.documentation?.checks,
      },
    },
    projectManagement: {
      ...base.projectManagement,
      ...overrides.projectManagement,
      checks: {
        ...base.projectManagement.checks,
        ...overrides.projectManagement?.checks,
      },
    },
  };
}

/**
 * Production Deployment Notes:
 * 
 * When deploying governance to production projects:
 * 
 * 1. Customize profiles for your team's workflow
 * 2. Adjust LLM-assisted check inclusion based on available resources
 * 3. Consider different profiles for different branches (main vs feature)
 * 4. Configure timeout values for LLM checks in CI environments
 * 5. Add project-specific checks to the configuration
 * 
 * Example customization:
 * - Frontend projects: Enable CSS-related checks
 * - Backend APIs: Focus on security and performance checks
 * - Libraries: Emphasize documentation and API consistency
 */
