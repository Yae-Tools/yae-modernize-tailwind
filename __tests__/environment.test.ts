import { promises as fs } from 'fs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { detectEnvironment, getTailwindVersion, shouldShowTailwindWarning } from '../src/environment';

vi.mock('fs', () => ({
  promises: {
    access: vi.fn(),
    readFile: vi.fn(),
    readdir: vi.fn(),
  },
}));

describe('detectEnvironment', () => {
  const mockAccess = vi.mocked(fs.access);
  const mockReadFile = vi.mocked(fs.readFile);
  const mockReaddir = vi.mocked(fs.readdir);

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mocks to ensure no next.js config files exist unless explicitly tested
    mockAccess.mockImplementation((filePath) => {
      const pathStr = filePath.toString();
      if (pathStr.includes('next.config.js') || pathStr.includes('next.config.mjs')) {
        return Promise.reject();
      }
      return Promise.resolve();
    });
    // Default mock for package.json to be empty unless specified
    mockReadFile.mockResolvedValue(JSON.stringify({ dependencies: {}, devDependencies: {} }));
    // Default mock for readdir to be empty unless specified
    mockReaddir.mockResolvedValue([] as any);
  });

  it('should detect Next.js environment', async () => {
    mockAccess.mockImplementation((filePath) => {
      const pathStr = filePath.toString();
      if (pathStr.includes('next.config.js')) {
        return Promise.resolve();
      }
      return Promise.reject();
    });
    const env = await detectEnvironment('/test/project');
    expect(env).toBe('Next.js');
  });

  it('should detect React environment', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({
      dependencies: { react: '^18.0.0' },
    }));
    const env = await detectEnvironment('/test/project');
    expect(env).toBe('React');
  });

  it('should detect Angular environment', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({
      dependencies: { '@angular/core': '^15.0.0' },
    }));
    const env = await detectEnvironment('/test/project');
    expect(env).toBe('Angular');
  });

  it('should detect Svelte environment', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({
      dependencies: { svelte: '^4.0.0' },
    }));
    const env = await detectEnvironment('/test/project');
    expect(env).toBe('Svelte');
  });

  it('should detect Vue environment', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({
      dependencies: { vue: '^3.0.0' },
    }));
    const env = await detectEnvironment('/test/project');
    expect(env).toBe('Vue');
  });

  it('should detect HTML/CSS environment', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({})); // No package.json dependencies
    mockReaddir.mockResolvedValueOnce(['index.html', 'style.css'] as any);
    const env = await detectEnvironment('/test/project');
    expect(env).toBe('HTML/CSS');
  });

  it('should detect Unknown environment', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({})); // No package.json dependencies
    mockReaddir.mockResolvedValueOnce([] as any); // No HTML/CSS files
    const env = await detectEnvironment('/test/project');
    expect(env).toBe('Unknown');
  });

  it('should handle package.json with devDependencies', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({
      devDependencies: { react: '^18.0.0' },
    }));
    const env = await detectEnvironment('/test/project');
    expect(env).toBe('React');
  });

  it('should handle empty package.json', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({}));
    const env = await detectEnvironment('/test/project');
    expect(env).toBe('Unknown');
  });

  it('should handle invalid package.json', async () => {
    mockReadFile.mockResolvedValueOnce('invalid json');
    const env = await detectEnvironment('/test/project');
    expect(env).toBe('Unknown');
  });
});

describe('getTailwindVersion', () => {
  const mockAccess = vi.mocked(fs.access);
  const mockReadFile = vi.mocked(fs.readFile);

  beforeEach(() => {
    vi.clearAllMocks();
    mockAccess.mockResolvedValue(undefined);
  });

  it('should return tailwindcss version from dependencies', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({
      dependencies: { tailwindcss: '3.4.1' },
      devDependencies: {}
    }));
    
    const version = await getTailwindVersion('/test/project');
    expect(version).toBe('3.4.1');
  });

  it('should return tailwindcss version from devDependencies', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({
      dependencies: {},
      devDependencies: { tailwindcss: '^3.4.0' }
    }));
    
    const version = await getTailwindVersion('/test/project');
    expect(version).toBe('^3.4.0');
  });

  it('should prioritize dependencies over devDependencies', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({
      dependencies: { tailwindcss: '3.4.1' },
      devDependencies: { tailwindcss: '3.3.0' }
    }));
    
    const version = await getTailwindVersion('/test/project');
    expect(version).toBe('3.4.1');
  });

  it('should return null when tailwindcss is not found', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({
      dependencies: { react: '^18.0.0' },
      devDependencies: { typescript: '^4.0.0' }
    }));
    
    const version = await getTailwindVersion('/test/project');
    expect(version).toBe(null);
  });

  it('should return null when package.json does not exist', async () => {
    mockAccess.mockRejectedValueOnce(new Error('File not found'));
    
    const version = await getTailwindVersion('/test/project');
    expect(version).toBe(null);
  });

  it('should return null when package.json is invalid', async () => {
    mockReadFile.mockResolvedValueOnce('invalid json');
    
    const version = await getTailwindVersion('/test/project');
    expect(version).toBe(null);
  });
});

describe('shouldShowTailwindWarning', () => {
  it('should return true when version is null', () => {
    expect(shouldShowTailwindWarning(null)).toBe(true);
  });

  it('should return true when version is below 3.4', () => {
    expect(shouldShowTailwindWarning('3.3.0')).toBe(true);
    expect(shouldShowTailwindWarning('^3.3.5')).toBe(true);
    expect(shouldShowTailwindWarning('~3.2.1')).toBe(true);
    expect(shouldShowTailwindWarning('2.9.0')).toBe(true);
  });

  it('should return false when version is 3.4 or higher', () => {
    expect(shouldShowTailwindWarning('3.4.0')).toBe(false);
    expect(shouldShowTailwindWarning('^3.4.1')).toBe(false);
    expect(shouldShowTailwindWarning('~3.5.0')).toBe(false);
    expect(shouldShowTailwindWarning('4.0.0')).toBe(false);
    expect(shouldShowTailwindWarning('>=3.4.0')).toBe(false);
  });

  it('should return true when version format is unrecognizable', () => {
    expect(shouldShowTailwindWarning('invalid')).toBe(true);
    expect(shouldShowTailwindWarning('latest')).toBe(true);
    expect(shouldShowTailwindWarning('')).toBe(true);
    expect(shouldShowTailwindWarning('beta')).toBe(true);
  });

  it('should handle versions without patch numbers', () => {
    expect(shouldShowTailwindWarning('3.4')).toBe(false);
    expect(shouldShowTailwindWarning('3.3')).toBe(true);
    expect(shouldShowTailwindWarning('^3.4')).toBe(false);
  });
});