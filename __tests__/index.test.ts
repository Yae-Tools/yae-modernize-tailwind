import { promises as fs } from 'fs';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import inquirer from 'inquirer';
import { simpleGit } from 'simple-git';
import ora from 'ora';
import { CONVERSIONS } from '../src/conversions';
import { detectEnvironment, getTailwindVersion, shouldShowTailwindWarning } from '../src/environment';
import { exitMessage } from '../src/util/exitMessage';
import { glob } from 'glob';

// Mock external modules
vi.mock('yargs');
vi.mock('yargs/helpers');
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
}));
vi.mock('glob');
vi.mock('inquirer');
vi.mock('simple-git');
vi.mock('ora');
vi.mock('../src/environment');
vi.mock('../src/util/exitMessage', () => ({
  exitMessage: vi.fn(() => {
    throw new Error('process.exit was called');
  }),
}));
vi.mock('chalk', () => {
  const mockChalk = (str: string) => str;
  mockChalk.blue = mockChalk;
  mockChalk.red = mockChalk;
  mockChalk.yellow = mockChalk;
  mockChalk.cyan = mockChalk;
  mockChalk.green = mockChalk;
  mockChalk.bold = mockChalk;
  mockChalk.underline = mockChalk;
  
  return {
    default: mockChalk,
  };
});

// Mock process methods  
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('CLI Tool', () => {
  const mockYargs = vi.mocked(yargs);
  const mockHideBin = vi.mocked(hideBin);
  const mockReadFile = vi.mocked(fs.readFile);
  const mockWriteFile = vi.mocked(fs.writeFile);
  const mockGlob = vi.mocked(glob);
  const mockInquirerPrompt = vi.mocked(inquirer.prompt);
  const mockSimpleGit = vi.mocked(simpleGit);
  const mockDetectEnvironment = vi.mocked(detectEnvironment);
  const mockGetTailwindVersion = vi.mocked(getTailwindVersion);
  const mockShouldShowTailwindWarning = vi.mocked(shouldShowTailwindWarning);
  const mockOra = vi.mocked(ora);
  const mockExitMessage = vi.mocked(exitMessage);

  let mockYargsChain: any;
  let mockSpinner: any;
  let originalTTY: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    // Mock spinner instance
    mockSpinner = {
      start: vi.fn().mockReturnThis(),
      succeed: vi.fn().mockReturnThis(),
      fail: vi.fn().mockReturnThis(),
      text: '',
    };
    mockOra.mockReturnValue(mockSpinner);

    // Mock yargs chain
    mockYargsChain = {
      option: vi.fn().mockReturnThis(),
      help: vi.fn().mockReturnThis(),
      argv: Promise.resolve({
        conversions: [],
        path: './**/*.{js,jsx,ts,tsx,html,css,svelte}',
        ignoreGit: false,
        'ignore-git': false,
        _: [],
        $0: 'cli',
      }),
    };

    mockYargs.mockReturnValue(mockYargsChain);
    mockHideBin.mockReturnValue(['node', 'script.js']);

    // Default mocks
    mockDetectEnvironment.mockResolvedValue('Unknown');
    mockGetTailwindVersion.mockResolvedValue('3.4.0');
    mockShouldShowTailwindWarning.mockReturnValue(false);
    mockSimpleGit.mockReturnValue({
      status: vi.fn().mockResolvedValue({ isClean: () => true }),
    } as any);
    mockGlob.mockResolvedValue([]);
    
    // Mock inquirer prompt to handle different prompt types
    mockInquirerPrompt.mockImplementation(async (questions: any) => {
      const question = Array.isArray(questions) ? questions[0] : questions;
      
      if (question.name === 'continue') {
        return { continue: true };
      } else if (question.name === 'selectedConversions') {
        return { selectedConversions: ['size'] }; // Default to some conversions
      }
      
      return {};
    });

    // Store original TTY value
    originalTTY = process.stdout.isTTY;
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Restore original TTY value
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalTTY,
      writable: true,
      configurable: true,
    });
  });

  const importRun = async () => {
    return (await import('../src/index')).run;
  };

  describe('Environment Detection', () => {
    it('should continue when environment is Unknown', async () => {
      mockDetectEnvironment.mockResolvedValue('Unknown');
      
      const run = await importRun();
      await run();
      
      expect(mockInquirerPrompt).not.toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'confirm',
            name: 'continue',
          }),
        ])
      );
    });

    it('should prompt for environment confirmation when environment is detected and TTY is available', async () => {
      mockDetectEnvironment.mockResolvedValue('React');
      mockInquirerPrompt.mockResolvedValueOnce({ continue: true });
      
      const run = await importRun();
      await run();
      
      expect(mockInquirerPrompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'confirm',
          name: 'continue',
          message: 'React environment detected. Press Y to continue...',
          default: true,
        }),
      ]);
    });

    it('should exit when user cancels environment confirmation', async () => {
      mockDetectEnvironment.mockResolvedValue('React');
      mockInquirerPrompt.mockImplementation(async (questions: any) => {
        const question = Array.isArray(questions) ? questions[0] : questions;
        
        if (question.name === 'continue') {
          return { continue: false };
        } else if (question.name === 'selectedConversions') {
          return { selectedConversions: ['size'] };
        }
        
        return {};
      });
      
      const run = await importRun();
      
      await expect(async () => {
        await run();
      }).rejects.toThrow('process.exit was called');
      
      expect(mockConsoleLog).toHaveBeenCalledWith('Operation cancelled by user.');
      expect(mockExitMessage).toHaveBeenCalled();
    });

    it('should not prompt for environment confirmation when TTY is not available', async () => {
      Object.defineProperty(process.stdout, 'isTTY', { value: false });
      mockDetectEnvironment.mockResolvedValue('React');
      
      // Provide conversions in command line to avoid exit
      mockYargsChain.argv = Promise.resolve({
        conversions: ['size'],
        path: './**/*.{js,jsx,ts,tsx,html,css,svelte}',
        ignoreGit: false,
        'ignore-git': false,
        _: [],
        $0: 'cli',
      });
      
      const run = await importRun();
      await run();
      
      expect(mockInquirerPrompt).not.toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'confirm',
            name: 'continue',
          }),
        ])
      );
    });
  });

  describe('Tailwind CSS Version Checks', () => {
    it('should show warning when Tailwind CSS is not found', async () => {
      mockGetTailwindVersion.mockResolvedValue(null);
      mockShouldShowTailwindWarning.mockReturnValue(true);
      
      const run = await importRun();
      await run();
      
      expect(mockGetTailwindVersion).toHaveBeenCalledWith(process.cwd());
      expect(mockShouldShowTailwindWarning).toHaveBeenCalledWith(null);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        "\x1b[31m⚠️  Warning: For full compatibility, especially with 'size' conversions, ensure your project uses Tailwind CSS v3.4 or later.\x1b[0m"
      );
    });

    it('should show warning when Tailwind CSS version is below 3.4', async () => {
      mockGetTailwindVersion.mockResolvedValue('3.3.0');
      mockShouldShowTailwindWarning.mockReturnValue(true);
      
      const run = await importRun();
      await run();
      
      expect(mockGetTailwindVersion).toHaveBeenCalledWith(process.cwd());
      expect(mockShouldShowTailwindWarning).toHaveBeenCalledWith('3.3.0');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        "\x1b[31m⚠️  Warning: For full compatibility, especially with 'size' conversions, ensure your project uses Tailwind CSS v3.4 or later.\x1b[0m"
      );
    });

    it('should not show warning when Tailwind CSS version is 3.4 or higher', async () => {
      mockGetTailwindVersion.mockResolvedValue('3.4.1');
      mockShouldShowTailwindWarning.mockReturnValue(false);
      
      const run = await importRun();
      await run();
      
      expect(mockGetTailwindVersion).toHaveBeenCalledWith(process.cwd());
      expect(mockShouldShowTailwindWarning).toHaveBeenCalledWith('3.4.1');
      expect(mockConsoleLog).not.toHaveBeenCalledWith(
        "\x1b[31m⚠️  Warning: For full compatibility, especially with 'size' conversions, ensure your project uses Tailwind CSS v3.4 or later.\x1b[0m"
      );
    });

    it('should handle version strings with prefixes correctly', async () => {
      mockGetTailwindVersion.mockResolvedValue('^3.4.0');
      mockShouldShowTailwindWarning.mockReturnValue(false);
      
      const run = await importRun();
      await run();
      
      expect(mockGetTailwindVersion).toHaveBeenCalledWith(process.cwd());
      expect(mockShouldShowTailwindWarning).toHaveBeenCalledWith('^3.4.0');
    });
  });

  describe('Git Repository Checks', () => {
    it('should continue when git repository is clean', async () => {
      mockSimpleGit.mockReturnValue({
        status: vi.fn().mockResolvedValue({ isClean: () => true }),
      } as any);
      
      const run = await importRun();
      await run();
      
      expect(mockExitMessage).not.toHaveBeenCalled();
    });

    it('should exit when git repository is not clean and ignore-git is false', async () => {
      mockSimpleGit.mockReturnValue({
        status: vi.fn().mockResolvedValue({ isClean: () => false }),
      } as any);
      
      mockYargsChain.argv = Promise.resolve({
        conversions: [],
        path: './**/*.{js,jsx,ts,tsx,html,css,svelte}',
        ignoreGit: false,
        'ignore-git': false,
        _: [],
        $0: 'cli',
      });
      
      const run = await importRun();
      
      try {
        await run();
      } catch (error) {
        // Expected to throw due to process.exit mock
        expect((error as Error).message).toBe('process.exit was called');
      }
      
      expect(mockConsoleError).toHaveBeenCalledWith(
        'Error: Git repository is not clean. Please commit or stash your changes before running the converter, or use --ignore-git to override.'
      );
      expect(mockExitMessage).toHaveBeenCalled();
    });

    it('should continue when git repository is not clean but ignore-git is true (camelCase)', async () => {
      mockSimpleGit.mockReturnValue({
        status: vi.fn().mockResolvedValue({ isClean: () => false }),
      } as any);
      
      mockYargsChain.argv = Promise.resolve({
        conversions: ['size'],
        path: './**/*.{js,jsx,ts,tsx,html,css,svelte}',
        ignoreGit: true,
        'ignore-git': false,
        _: [],
        $0: 'cli',
      });
      
      const run = await importRun();
      await run();
      
      expect(mockExitMessage).not.toHaveBeenCalled();
    });

    it('should continue when git repository is not clean but ignore-git is true (kebab-case)', async () => {
      mockSimpleGit.mockReturnValue({
        status: vi.fn().mockResolvedValue({ isClean: () => false }),
      } as any);
      
      mockYargsChain.argv = Promise.resolve({
        conversions: ['size'],
        path: './**/*.{js,jsx,ts,tsx,html,css,svelte}',
        ignoreGit: undefined,
        'ignore-git': true,
        _: [],
        $0: 'cli',
      });
      
      const run = await importRun();
      await run();
      
      expect(mockExitMessage).not.toHaveBeenCalled();
    });

    it('should warn when not a git repository', async () => {
      mockSimpleGit.mockReturnValue({
        status: vi.fn().mockRejectedValue(new Error('Not a git repository')),
      } as any);
      
      const run = await importRun();
      await run();
      
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        'Warning: Not a Git repository or Git not installed. Skipping Git clean check.'
      );
      expect(mockExitMessage).not.toHaveBeenCalled();
    });
  });

  describe('Conversion Selection', () => {
    it('should use provided conversions from command line', async () => {
      mockYargsChain.argv = Promise.resolve({
        conversions: ['size', 'margin'],
        path: './**/*.{js,jsx,ts,tsx,html,css,svelte}',
        ignoreGit: false,
        'ignore-git': false,
        _: [],
        $0: 'cli',
      });
      
      const run = await importRun();
      await run();
      
      expect(mockInquirerPrompt).not.toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'checkbox',
            name: 'selectedConversions',
          }),
        ])
      );
    });

    it('should prompt for conversions when none provided and TTY is available', async () => {
      mockInquirerPrompt.mockResolvedValueOnce({ selectedConversions: ['size'] });
      
      const run = await importRun();
      await run();
      
      expect(mockInquirerPrompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'checkbox',
          name: 'selectedConversions',
          message: 'Select the conversions to apply:',
          choices: Object.keys(CONVERSIONS),
        }),
      ]);
    });

    it('should exit with message when no conversions provided and TTY is not available', async () => {
      Object.defineProperty(process.stdout, 'isTTY', { value: false });
      
      const run = await importRun();
      
      await expect(async () => {
        await run();
      }).rejects.toThrow('process.exit was called');
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        'No conversions selected. Please specify conversions with the -c flag or run in an interactive terminal.'
      );
      expect(mockExitMessage).toHaveBeenCalled();
    });

    it('should exit when no conversions are selected in interactive mode', async () => {
      mockInquirerPrompt.mockResolvedValueOnce({ selectedConversions: [] });
      
      const run = await importRun();
      await run();
      
      expect(mockConsoleLog).toHaveBeenCalledWith('No conversions selected. Exiting.');
    });

    it('should handle undefined conversions from prompt', async () => {
      mockInquirerPrompt.mockResolvedValueOnce({ selectedConversions: undefined });
      
      const run = await importRun();
      await run();
      
      expect(mockConsoleLog).toHaveBeenCalledWith('No conversions selected. Exiting.');
    });
  });

  describe('File Processing', () => {
    beforeEach(() => {
      mockYargsChain.argv = Promise.resolve({
        conversions: ['size'],
        path: 'test.html',
        ignoreGit: false,
        'ignore-git': false,
        _: [],
        $0: 'cli',
      });
    });

    it('should process files with conversions', async () => {
      mockGlob.mockResolvedValue(['test.html']);
      mockReadFile.mockResolvedValue('<div class="w-4 h-4">Test</div>');
      
      const run = await importRun();
      await run();
      
      expect(mockGlob).toHaveBeenCalledWith('test.html', {
        nodir: true,
        ignore: ['node_modules/**'],
      });
      expect(mockReadFile).toHaveBeenCalledWith('test.html', 'utf-8');
      expect(mockSpinner.start).toHaveBeenCalled();
    });

    it('should write file when content changes', async () => {
      mockGlob.mockResolvedValue(['test.html']);
      mockReadFile.mockResolvedValue('<div class="w-4 h-4">Test</div>');
      
      const run = await importRun();
      await run();
      
      expect(mockWriteFile).toHaveBeenCalledWith(
        'test.html',
        '<div class="size-4">Test</div>',
        'utf-8'
      );
      expect(mockSpinner.succeed).toHaveBeenCalledWith('Updated test.html');
    });

    it('should not write file when content does not change', async () => {
      mockGlob.mockResolvedValue(['test.html']);
      mockReadFile.mockResolvedValue('<div class="text-red-500">Test</div>');
      
      const run = await importRun();
      await run();
      
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('should handle file read errors', async () => {
      mockGlob.mockResolvedValue(['test.html']);
      mockReadFile.mockRejectedValue(new Error('File read error'));
      
      const run = await importRun();
      await run();
      
      expect(mockConsoleError).toHaveBeenCalledWith(new Error('File read error'));
      expect(mockSpinner.fail).toHaveBeenCalledWith('Failed to process test.html');
    });

    it('should handle file write errors', async () => {
      mockGlob.mockResolvedValue(['test.html']);
      mockReadFile.mockResolvedValue('<div class="w-4 h-4">Test</div>');
      mockWriteFile.mockRejectedValue(new Error('File write error'));
      
      const run = await importRun();
      await run();
      
      expect(mockConsoleError).toHaveBeenCalledWith(new Error('File write error'));
      expect(mockSpinner.fail).toHaveBeenCalledWith('Failed to process test.html');
    });

    it('should process multiple files', async () => {
      mockGlob.mockResolvedValue(['test1.html', 'test2.html']);
      mockReadFile
        .mockResolvedValue('<div class="text-red-500">Test default</div>') // Default fallback
        .mockResolvedValueOnce('<div class="w-4 h-4">Test1</div>')
        .mockResolvedValueOnce('<div class="w-2 h-2">Test2</div>');
      
      const run = await importRun();
      await run();
      
      // Check that the specific files were called with the right arguments
      expect(mockReadFile).toHaveBeenCalledWith('test1.html', 'utf-8');
      expect(mockReadFile).toHaveBeenCalledWith('test2.html', 'utf-8');
      expect(mockWriteFile).toHaveBeenCalledTimes(2);
      expect(mockWriteFile).toHaveBeenNthCalledWith(
        1,
        'test1.html',
        '<div class="size-4">Test1</div>',
        'utf-8'
      );
      expect(mockWriteFile).toHaveBeenNthCalledWith(
        2,
        'test2.html',
        '<div class="size-2">Test2</div>',
        'utf-8'
      );
    });

    it('should apply multiple conversions to same file', async () => {
      mockYargsChain.argv = Promise.resolve({
        conversions: ['size', 'margin'],
        path: 'test.html',
        ignoreGit: false,
        'ignore-git': false,
        _: [],
        $0: 'cli',
      });
      
      mockGlob.mockResolvedValue(['test.html']);
      mockReadFile.mockResolvedValue('<div class="w-4 h-4 mx-2 my-2">Test</div>');
      
      const run = await importRun();
      await run();
      
      expect(mockWriteFile).toHaveBeenCalledWith(
        'test.html',
        '<div class="size-4 m-2">Test</div>',
        'utf-8'
      );
    });

    it('should update spinner text for each file', async () => {
      mockGlob.mockResolvedValue(['test1.html', 'test2.html']);
      mockReadFile
        .mockResolvedValueOnce('<div class="w-4 h-4">Test1</div>')
        .mockResolvedValueOnce('<div>Test2</div>');
      
      const run = await importRun();
      await run();
      
      expect(mockSpinner.text).toBe('Processing file: test2.html');
    });

    it('should handle empty file list', async () => {
      mockGlob.mockResolvedValue([]);
      
      const run = await importRun();
      await run();
      
      expect(mockReadFile).not.toHaveBeenCalled();
      expect(mockWriteFile).not.toHaveBeenCalled();
    });
  });

  describe('Complete Integration Scenarios', () => {
    it('should handle complete workflow with React environment and user confirmation', async () => {
      mockDetectEnvironment.mockResolvedValue('React');
      
      // Override the inquirer mock to handle both prompts
      mockInquirerPrompt.mockImplementation(async (questions: any) => {
        const question = Array.isArray(questions) ? questions[0] : questions;
        
        if (question.name === 'continue') {
          return { continue: true };
        } else if (question.name === 'selectedConversions') {
          return { selectedConversions: ['size', 'color-opacity'] };
        }
        
        return {};
      });
      
      mockGlob.mockResolvedValue(['component.tsx']);
      mockReadFile.mockResolvedValue('<div class="w-4 h-4 bg-red-500 bg-opacity-50">Test</div>');
      
      const run = await importRun();
      await run();
      
      expect(mockDetectEnvironment).toHaveBeenCalled();
      // Verify the specific calls we care about rather than exact count
      expect(mockInquirerPrompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'confirm',
          name: 'continue',
          message: expect.stringContaining('React environment detected'),
        }),
      ]);
      expect(mockInquirerPrompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'checkbox',
          name: 'selectedConversions',
          message: expect.stringContaining('Select the conversions to apply'),
        }),
      ]);
      expect(mockWriteFile).toHaveBeenCalledWith(
        'component.tsx',
        '<div class="size-4 bg-red-500/50">Test</div>',
        'utf-8'
      );
    });

    it('should handle non-interactive mode with provided conversions', async () => {
      Object.defineProperty(process.stdout, 'isTTY', { value: false });
      
      mockYargsChain.argv = Promise.resolve({
        conversions: ['gap'],
        path: 'styles.css',
        ignoreGit: true,
        'ignore-git': true,
        _: [],
        $0: 'cli',
      });
      
      mockGlob.mockResolvedValue(['styles.css']);
      mockReadFile.mockResolvedValue('<div class="flex space-x-4 space-y-4">Test</div>');
      
      const run = await importRun();
      await run();
      
      expect(mockInquirerPrompt).not.toHaveBeenCalled();
      expect(mockWriteFile).toHaveBeenCalledWith(
        'styles.css',
        '<div class="flex gap-4">Test</div>',
        'utf-8'
      );
    });
  });
});
