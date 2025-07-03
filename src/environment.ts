import { promises as fs } from 'fs';
import * as path from 'path';

export type Environment = 'Next.js' | 'React' | 'Angular' | 'Svelte' | 'Vue' | 'HTML/CSS' | 'Unknown';

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
    if (await checkFileExists(path.join(projectRoot, 'next.config.js')) || await checkFileExists(path.join(projectRoot, 'next.config.mjs'))) {
        return 'Next.js';
    }

    const packageJson = await readPackageJson(projectRoot);

    if (packageJson) {
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

        // Check for React (general)
        if (dependencies['react']) {
            return 'React';
        }
        // Check for Angular
        if (dependencies['@angular/core']) {
            return 'Angular';
        }
        // Check for Svelte
        if (dependencies['svelte']) {
            return 'Svelte';
        }
        // Check for Vue
        if (dependencies['vue']) {
            return 'Vue';
        }
    }

    // Default to HTML/CSS if no specific framework is detected but there are HTML/CSS files
    // This is a very basic check and can be improved.
    const htmlFiles = await fs.readdir(projectRoot).then(files => files.filter(file => file.endsWith('.html') || file.endsWith('.css')));
    if (htmlFiles.length > 0) {
        return 'HTML/CSS';
    }

    return 'Unknown';
}
