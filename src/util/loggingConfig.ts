import { LoggingConfig } from '../types/conversionTypes.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * Logging Configuration Management
 *
 * Handles loading, merging, and validation of logging configuration
 * from multiple sources with proper priority handling.
 */
export class LoggingConfigManager {
  private static defaultConfig: LoggingConfig = {
    enabled: true,
    logLevel: 'error',
    maxLogFiles: 30,
    maxLogSizeBytes: 10 * 1024 * 1024, // 10MB
    logDirectory: path.join(os.homedir(), '.yae-modernize-tailwind', 'logs'),
    enableMemoryBuffer: true,
    bufferSize: 100,
  };

  private static configFilePath = path.join(
    os.homedir(),
    '.yae-modernize-tailwind',
    'config',
    'logging.json',
  );

  /**
   * Get merged configuration from all sources
   * Priority: CLI flags > Environment variables > User config file > Defaults
   */
  static async getConfig(cliOverrides?: Partial<LoggingConfig>): Promise<LoggingConfig> {
    const baseConfig = { ...this.defaultConfig };

    // Load user config file
    const userConfig = await this.loadUserConfig();
    Object.assign(baseConfig, userConfig);

    // Apply environment variables
    const envConfig = this.loadEnvironmentConfig();
    Object.assign(baseConfig, envConfig);

    // Apply CLI overrides
    if (cliOverrides) {
      Object.assign(baseConfig, cliOverrides);
    }

    // Validate final configuration
    this.validateConfig(baseConfig);

    return baseConfig;
  }

  /**
   * Load configuration from user config file
   */
  private static async loadUserConfig(): Promise<Partial<LoggingConfig>> {
    try {
      const configContent = await fs.readFile(this.configFilePath, 'utf8');
      const userConfig = JSON.parse(configContent);

      // Validate user config structure
      if (typeof userConfig === 'object' && userConfig !== null) {
        return this.sanitizeUserConfig(userConfig);
      }
    } catch (error) {
      // Config file doesn't exist or is invalid - return empty config
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`Warning: Failed to load logging config: ${(error as Error).message}`);
      }
    }

    return {};
  }

  /**
   * Load configuration from environment variables
   */
  private static loadEnvironmentConfig(): Partial<LoggingConfig> {
    const envConfig: Partial<LoggingConfig> = {};

    if (process.env.YAE_LOG_ENABLED !== undefined) {
      envConfig.enabled = process.env.YAE_LOG_ENABLED === 'true';
    }

    if (process.env.YAE_LOG_LEVEL) {
      const level = process.env.YAE_LOG_LEVEL.toLowerCase();
      if (['error', 'warn', 'info', 'debug'].includes(level)) {
        envConfig.logLevel = level as LoggingConfig['logLevel'];
      }
    }

    if (process.env.YAE_LOG_DIRECTORY) {
      envConfig.logDirectory = process.env.YAE_LOG_DIRECTORY;
    }

    if (process.env.YAE_LOG_MAX_FILES) {
      const maxFiles = parseInt(process.env.YAE_LOG_MAX_FILES, 10);
      if (!isNaN(maxFiles) && maxFiles > 0) {
        envConfig.maxLogFiles = maxFiles;
      }
    }

    if (process.env.YAE_LOG_MAX_SIZE_MB) {
      const maxSizeMB = parseInt(process.env.YAE_LOG_MAX_SIZE_MB, 10);
      if (!isNaN(maxSizeMB) && maxSizeMB > 0) {
        envConfig.maxLogSizeBytes = maxSizeMB * 1024 * 1024;
      }
    }

    if (process.env.YAE_LOG_MEMORY_BUFFER !== undefined) {
      envConfig.enableMemoryBuffer = process.env.YAE_LOG_MEMORY_BUFFER === 'true';
    }

    if (process.env.YAE_LOG_BUFFER_SIZE) {
      const bufferSize = parseInt(process.env.YAE_LOG_BUFFER_SIZE, 10);
      if (!isNaN(bufferSize) && bufferSize > 0) {
        envConfig.bufferSize = bufferSize;
      }
    }

    return envConfig;
  }

  /**
   * Parse CLI arguments into logging configuration overrides
   */
  static parseCLIOverrides(args: string[]): Partial<LoggingConfig> {
    const overrides: Partial<LoggingConfig> = {};

    // Parse CLI flags
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      switch (arg) {
        case '--no-logs':
          overrides.enabled = false;
          break;

        case '--verbose':
          overrides.logLevel = 'debug';
          break;

        case '--quiet':
          overrides.logLevel = 'error';
          break;

        case '--log-file':
          if (i + 1 < args.length) {
            overrides.logDirectory = path.dirname(args[i + 1]);
            i++; // Skip next argument
          }
          break;

        case '--log-level':
          if (i + 1 < args.length) {
            const level = args[i + 1].toLowerCase();
            if (['error', 'warn', 'info', 'debug'].includes(level)) {
              overrides.logLevel = level as LoggingConfig['logLevel'];
            }
            i++; // Skip next argument
          }
          break;
      }
    }

    return overrides;
  }

  /**
   * Sanitize user configuration to prevent malicious values
   */
  private static sanitizeUserConfig(userConfig: Record<string, unknown>): Partial<LoggingConfig> {
    const sanitized: Partial<LoggingConfig> = {};

    if (typeof userConfig.enabled === 'boolean') {
      sanitized.enabled = userConfig.enabled;
    }

    if (
      typeof userConfig.logLevel === 'string' &&
      ['error', 'warn', 'info', 'debug'].includes(userConfig.logLevel)
    ) {
      sanitized.logLevel = userConfig.logLevel as LoggingConfig['logLevel'];
    }

    if (
      typeof userConfig.maxLogFiles === 'number' &&
      userConfig.maxLogFiles > 0 &&
      userConfig.maxLogFiles <= 365
    ) {
      sanitized.maxLogFiles = userConfig.maxLogFiles;
    }

    if (
      typeof userConfig.maxLogSizeBytes === 'number' &&
      userConfig.maxLogSizeBytes > 0 &&
      userConfig.maxLogSizeBytes <= 100 * 1024 * 1024
    ) {
      sanitized.maxLogSizeBytes = userConfig.maxLogSizeBytes;
    }

    if (typeof userConfig.logDirectory === 'string' && userConfig.logDirectory.length > 0) {
      // Validate directory path is safe - check for .. before normalization
      if (!userConfig.logDirectory.includes('..') && path.isAbsolute(userConfig.logDirectory)) {
        const normalizedPath = path.normalize(userConfig.logDirectory);
        sanitized.logDirectory = normalizedPath;
      }
    }

    if (typeof userConfig.enableMemoryBuffer === 'boolean') {
      sanitized.enableMemoryBuffer = userConfig.enableMemoryBuffer;
    }

    if (
      typeof userConfig.bufferSize === 'number' &&
      userConfig.bufferSize > 0 &&
      userConfig.bufferSize <= 10000
    ) {
      sanitized.bufferSize = userConfig.bufferSize;
    }

    return sanitized;
  }

  /**
   * Validate final configuration and throw if invalid
   */
  private static validateConfig(config: LoggingConfig): void {
    if (config.maxLogFiles <= 0) {
      throw new Error('maxLogFiles must be greater than 0');
    }

    if (config.maxLogSizeBytes <= 0) {
      throw new Error('maxLogSizeBytes must be greater than 0');
    }

    if (config.bufferSize <= 0) {
      throw new Error('bufferSize must be greater than 0');
    }

    if (!config.logDirectory || config.logDirectory.length === 0) {
      throw new Error('logDirectory must be specified');
    }

    // Validate log directory is writable (will be checked during runtime)
    try {
      const normalizedPath = path.normalize(config.logDirectory);
      if (normalizedPath.includes('..')) {
        throw new Error('logDirectory cannot contain relative path components');
      }
    } catch (error) {
      throw new Error(`Invalid logDirectory: ${(error as Error).message}`);
    }
  }

  /**
   * Save user configuration to file
   */
  static async saveUserConfig(config: Partial<LoggingConfig>): Promise<void> {
    try {
      // Ensure config directory exists
      const configDir = path.dirname(this.configFilePath);
      await fs.mkdir(configDir, { recursive: true });

      // Sanitize and save configuration
      const sanitizedConfig = this.sanitizeUserConfig(config);
      await fs.writeFile(this.configFilePath, JSON.stringify(sanitizedConfig, null, 2), 'utf8');
    } catch (error) {
      throw new Error(`Failed to save user config: ${(error as Error).message}`);
    }
  }

  /**
   * Reset configuration to defaults
   */
  static async resetConfig(): Promise<void> {
    try {
      await fs.unlink(this.configFilePath);
    } catch (error) {
      // File doesn't exist, which is fine
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new Error(`Failed to reset config: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Get default configuration
   */
  static getDefaultConfig(): LoggingConfig {
    return { ...this.defaultConfig };
  }

  /**
   * Get configuration file path
   */
  static getConfigFilePath(): string {
    return this.configFilePath;
  }
}
