import { promises as fs } from 'fs';
import * as path from 'path';

export type Environment =
  | 'Next.js'
  | 'React'
  | 'Angular'
  | 'Svelte'
  | 'Vue'
  | 'HTML/CSS'
  | 'Unknown';

async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readPackageJson(projectRoot: string): Promise<any | null> {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (await checkFileExists(packageJsonPath)) {
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    try {
      return JSON.parse(content);
    } catch (e) {
      return null;
    }
  }
  return null;
}

export async function detectEnvironment(projectRoot: string): Promise<Environment> {
  // Check for Next.js
  if (
    (await checkFileExists(path.join(projectRoot, 'next.config.js'))) ||
    (await checkFileExists(path.join(projectRoot, 'next.config.mjs')))
  ) {
    return 'Next.js';
  }

  const packageJson = await readPackageJson(projectRoot);

  if (packageJson) {
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    if (dependencies['react']) {
      return 'React';
    }
    if (dependencies['@angular/core']) {
      return 'Angular';
    }
    if (dependencies['svelte']) {
      return 'Svelte';
    }
    if (dependencies['vue']) {
      return 'Vue';
    }
  }

  // Default to HTML/CSS if no specific framework is detected but there are HTML/CSS files
  //TODO: This is a very basic check and can be improved.
  const htmlFiles = await fs
    .readdir(projectRoot)
    .then((files) => files.filter((file) => file.endsWith('.html') || file.endsWith('.css')));
  if (htmlFiles.length > 0) {
    return 'HTML/CSS';
  }

  return 'Unknown';
}

export async function getTailwindVersion(projectRoot: string): Promise<string | null> {
  const packageJson = await readPackageJson(projectRoot);

  if (packageJson) {
    // Check dependencies first, then devDependencies
    const dependencies = packageJson.dependencies || {};
    const devDependencies = packageJson.devDependencies || {};

    return dependencies['tailwindcss'] || devDependencies['tailwindcss'] || null;
  }

  return null;
}

export function shouldShowTailwindWarning(version: string | null): boolean {
  if (!version) {
    return true; // Show warning if Tailwind CSS is not found
  }

  // Parse version string (e.g., "^3.4.0", "~3.3.0", "3.4.1", ">=3.4.0")
  const versionMatch = version.match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!versionMatch) {
    return true; // Show warning if version format is unrecognizable
  }

  const [, major, minor] = versionMatch.map(Number);

  // Show warning if version is below 3.4
  return major < 3 || (major === 3 && minor < 4);
}
