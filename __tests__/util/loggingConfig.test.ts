import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LoggingConfigManager } from '../../src/util/loggingConfig';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

describe('LoggingConfigManager', () => {
  beforeEach(() => {
    // Mock console methods
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Mock filesystem operations
    vi.spyOn(fs, 'readFile').mockResolvedValue('{}');
    vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
    vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    vi.spyOn(fs, 'unlink').mockResolvedValue(undefined);
    
    // Mock os module - this needs to be done differently for ES modules
    vi.doMock('os', () => ({
      homedir: () => '/mock/home',
    }));
    
    // Clear environment variables
    delete process.env.YAE_LOG_ENABLED;
    delete process.env.YAE_LOG_LEVEL;
    delete process.env.YAE_LOG_DIRECTORY;
    delete process.env.YAE_LOG_MAX_FILES;
    delete process.env.YAE_LOG_MAX_SIZE_MB;
    delete process.env.YAE_LOG_MEMORY_BUFFER;
    delete process.env.YAE_LOG_BUFFER_SIZE;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Configuration Loading', () => {
    it('should return default configuration when no overrides exist', async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      
      const config = await LoggingConfigManager.getConfig();
      
      expect(config.enabled).toBe(true);
      expect(config.logLevel).toBe('error');
      expect(config.maxLogFiles).toBe(30);
      expect(config.maxLogSizeBytes).toBe(10 * 1024 * 1024);
      expect(config.logDirectory).toContain('.yae-modernize-tailwind/logs');
      expect(config.enableMemoryBuffer).toBe(true);
      expect(config.bufferSize).toBe(100);
    });

    it('should merge user config file with defaults', async () => {
      const userConfig = {
        enabled: false,
        logLevel: 'debug',
        maxLogFiles: 60,
      };
      
      (fs.readFile as any).mockResolvedValue(JSON.stringify(userConfig));
      
      const config = await LoggingConfigManager.getConfig();
      
      expect(config.enabled).toBe(false);
      expect(config.logLevel).toBe('debug');
      expect(config.maxLogFiles).toBe(60);
      expect(config.maxLogSizeBytes).toBe(10 * 1024 * 1024); // Default value
    });

    it('should handle invalid user config gracefully', async () => {
      (fs.readFile as any).mockResolvedValue('invalid json');
      
      const config = await LoggingConfigManager.getConfig();
      
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load logging config')
      );
      expect(config).toEqual(LoggingConfigManager.getDefaultConfig());
    });
  });

  describe('Environment Variable Loading', () => {
    it('should load configuration from environment variables', async () => {
      process.env.YAE_LOG_ENABLED = 'false';
      process.env.YAE_LOG_LEVEL = 'info';
      process.env.YAE_LOG_DIRECTORY = '/custom/log/dir';
      process.env.YAE_LOG_MAX_FILES = '45';
      process.env.YAE_LOG_MAX_SIZE_MB = '20';
      process.env.YAE_LOG_MEMORY_BUFFER = 'false';
      process.env.YAE_LOG_BUFFER_SIZE = '200';
      
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      
      const config = await LoggingConfigManager.getConfig();
      
      expect(config.enabled).toBe(false);
      expect(config.logLevel).toBe('info');
      expect(config.logDirectory).toBe('/custom/log/dir');
      expect(config.maxLogFiles).toBe(45);
      expect(config.maxLogSizeBytes).toBe(20 * 1024 * 1024);
      expect(config.enableMemoryBuffer).toBe(false);
      expect(config.bufferSize).toBe(200);
    });

    it('should ignore invalid environment values', async () => {
      process.env.YAE_LOG_LEVEL = 'invalid';
      process.env.YAE_LOG_MAX_FILES = 'not-a-number';
      process.env.YAE_LOG_MAX_SIZE_MB = '-5';
      
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      
      const config = await LoggingConfigManager.getConfig();
      
      expect(config.logLevel).toBe('error'); // Default value
      expect(config.maxLogFiles).toBe(30); // Default value
      expect(config.maxLogSizeBytes).toBe(10 * 1024 * 1024); // Default value
    });
  });

  describe('CLI Override Parsing', () => {
    it('should parse CLI flags correctly', () => {
      const args = [
        '--no-logs',
        '--verbose',
        '--log-file', '/custom/log.txt',
        '--log-level', 'warn'
      ];
      
      const overrides = LoggingConfigManager.parseCLIOverrides(args);
      
      expect(overrides.enabled).toBe(false);
      expect(overrides.logLevel).toBe('warn'); // log-level takes precedence over verbose
      expect(overrides.logDirectory).toBe('/custom');
    });

    it('should handle quiet flag', () => {
      const args = ['--quiet'];
      
      const overrides = LoggingConfigManager.parseCLIOverrides(args);
      
      expect(overrides.logLevel).toBe('error');
    });

    it('should handle verbose flag', () => {
      const args = ['--verbose'];
      
      const overrides = LoggingConfigManager.parseCLIOverrides(args);
      
      expect(overrides.logLevel).toBe('debug');
    });

    it('should ignore invalid log levels in CLI', () => {
      const args = ['--log-level', 'invalid'];
      
      const overrides = LoggingConfigManager.parseCLIOverrides(args);
      
      expect(overrides.logLevel).toBeUndefined();
    });
  });

  describe('Configuration Priority', () => {
    it('should apply configuration in correct priority order', async () => {
      // User config file
      const userConfig = {
        enabled: false,
        logLevel: 'info',
        maxLogFiles: 60,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(userConfig));
      
      // Environment variables
      process.env.YAE_LOG_LEVEL = 'warn';
      process.env.YAE_LOG_MAX_FILES = '45';
      
      // CLI overrides
      const cliOverrides = {
        logLevel: 'debug' as const,
      };
      
      const config = await LoggingConfigManager.getConfig(cliOverrides);
      
      // CLI should win
      expect(config.logLevel).toBe('debug');
      // ENV should win over user config
      expect(config.maxLogFiles).toBe(45);
      // User config should win over defaults
      expect(config.enabled).toBe(false);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate configuration and throw on invalid values', async () => {
      const invalidConfig = {
        maxLogFiles: -1,
        maxLogSizeBytes: 0,
        bufferSize: -5,
        logDirectory: '',
      };
      
      await expect(LoggingConfigManager.getConfig(invalidConfig))
        .rejects.toThrow();
    });

    it('should reject relative path components in user config files', async () => {
      const invalidUserConfig = {
        logDirectory: '/path/../etc/passwd',
      };
      
      // Mock the user config file to contain the invalid path
      (fs.readFile as any).mockResolvedValue(JSON.stringify(invalidUserConfig));
      
      const config = await LoggingConfigManager.getConfig();
      
      // The invalid path should be ignored during sanitization, reverting to default
      expect(config.logDirectory).toContain('.yae-modernize-tailwind/logs');
    });
  });

  describe('User Configuration Management', () => {
    it('should save user configuration correctly', async () => {
      const config = {
        enabled: false,
        logLevel: 'debug' as const,
        maxLogFiles: 60,
      };
      
      await LoggingConfigManager.saveUserConfig(config);
      
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('.yae-modernize-tailwind/config'),
        { recursive: true }
      );
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.yae-modernize-tailwind/config/logging.json'),
        expect.stringContaining('"enabled": false'),
        'utf8'
      );
    });

    it('should handle save failures gracefully', async () => {
      (fs.writeFile as any).mockRejectedValue(new Error('Permission denied'));
      
      await expect(LoggingConfigManager.saveUserConfig({}))
        .rejects.toThrow('Failed to save user config: Permission denied');
    });

    it('should reset configuration to defaults', async () => {
      await LoggingConfigManager.resetConfig();
      
      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('.yae-modernize-tailwind/config/logging.json')
      );
    });

    it('should handle reset when config file does not exist', async () => {
      (fs.unlink as any).mockRejectedValue({ code: 'ENOENT' });
      
      await expect(LoggingConfigManager.resetConfig()).resolves.not.toThrow();
    });
  });

  describe('Configuration Sanitization', () => {
    it('should sanitize malicious user configuration', async () => {
      const maliciousConfig = {
        enabled: 'true', // Should be boolean
        logLevel: 'invalid',
        maxLogFiles: 1000, // Too high
        maxLogSizeBytes: 200 * 1024 * 1024, // Too high
        logDirectory: '../../../etc/passwd',
        enableMemoryBuffer: 1, // Should be boolean
        bufferSize: 50000, // Too high
      };
      
      (fs.readFile as any).mockResolvedValue(JSON.stringify(maliciousConfig));
      
      const config = await LoggingConfigManager.getConfig();
      
      // Should use defaults for invalid values
      expect(config.enabled).toBe(true); // Default
      expect(config.logLevel).toBe('error'); // Default
      expect(config.maxLogFiles).toBe(30); // Default
      expect(config.maxLogSizeBytes).toBe(10 * 1024 * 1024); // Default
      expect(config.logDirectory).toContain('.yae-modernize-tailwind/logs'); // Default
      expect(config.enableMemoryBuffer).toBe(true); // Default
      expect(config.bufferSize).toBe(100); // Default
    });

    it('should accept valid user configuration within limits', async () => {
      const validConfig = {
        enabled: false,
        logLevel: 'warn',
        maxLogFiles: 7, // Valid range
        maxLogSizeBytes: 5 * 1024 * 1024, // Valid range
        logDirectory: '/home/user/logs', // Absolute path
        enableMemoryBuffer: false,
        bufferSize: 50, // Valid range
      };
      
      (fs.readFile as any).mockResolvedValue(JSON.stringify(validConfig));
      
      const config = await LoggingConfigManager.getConfig();
      
      expect(config.enabled).toBe(false);
      expect(config.logLevel).toBe('warn');
      expect(config.maxLogFiles).toBe(7);
      expect(config.maxLogSizeBytes).toBe(5 * 1024 * 1024);
      expect(config.logDirectory).toBe('/home/user/logs');
      expect(config.enableMemoryBuffer).toBe(false);
      expect(config.bufferSize).toBe(50);
    });
  });

  describe('Utility Methods', () => {
    it('should return default configuration', () => {
      const defaultConfig = LoggingConfigManager.getDefaultConfig();
      
      expect(defaultConfig.enabled).toBe(true);
      expect(defaultConfig.logLevel).toBe('error');
      expect(defaultConfig.maxLogFiles).toBe(30);
    });

    it('should return configuration file path', () => {
      const configPath = LoggingConfigManager.getConfigFilePath();
      
      expect(configPath).toContain(
        '.yae-modernize-tailwind/config/logging.json'
      );
    });
  });
});