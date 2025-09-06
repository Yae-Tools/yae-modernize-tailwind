import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { glob } from 'glob';
import inquirer from 'inquirer';
import { CONVERSIONS } from './conversions.js';
import { simpleGit } from 'simple-git';
import { detectEnvironment, getTailwindVersion, shouldShowTailwindWarning } from './environment.js';
import { exitMessage } from './util/exitMessage.js';
import { ParallelProcessor } from './util/parallelProcessor.js';
import { ErrorHandler } from './util/errorHandler.js';
import chalk from 'chalk';
import ora from 'ora';

const argv = yargs(hideBin(process.argv))
  .option('conversions', {
    alias: 'c',
    type: 'array',
    description: 'A list of conversions to run',
    choices: Object.keys(CONVERSIONS),
  })
  .option('path', {
    alias: 'p',
    type: 'string',
    description: 'The path to the files to convert',
    default: './**/*.{js,jsx,ts,tsx,html,css,svelte}', // Default to common file types in current directory
  })
  .option('ignore-git', {
    type: 'boolean',
    default: false,
    description: 'Ignore Git clean check',
  })
  .option('max-memory', {
    alias: 'm',
    type: 'number',
    description: 'Maximum memory usage in MB (default: auto-detect based on system memory)',
  })
  .help().argv;

async function run() {
  const logo = `
 ██╗   ██╗ █████╗ ███████╗      ███╗   ███╗ ██████╗ ██████╗ ███████╗██████╗ ███╗   ██╗██╗███████╗███████╗
 ╚██╗ ██╔╝██╔══██╗██╔════╝      ████╗ ████║██╔═══██╗██╔══██╗██╔════╝██╔══██╗████╗  ██║██║╚══███╔╝██╔════╝
  ╚████╔╝ ███████║█████╗  █████╗██╔████╔██║██║   ██║██║  ██║█████╗  ██████╔╝██╔██╗ ██║██║  ███╔╝ █████╗  
   ╚██╔╝  ██╔══██║██╔══╝  ╚════╝██║╚██╔╝██║██║   ██║██║  ██║██╔══╝  ██╔══██╗██║╚██╗██║██║ ███╔╝  ██╔══╝  
    ██║   ██║  ██║███████╗      ██║ ╚═╝ ██║╚██████╔╝██████╔╝███████╗██║  ██║██║ ╚████║██║███████╗███████╗
    ╚═╝   ╚═╝  ╚═╝╚══════╝      ╚═╝     ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝╚══════╝╚══════╝
             
                                                  ██████       
                                                  █████████   ██
                                                █    █████████ 
                                              █████    █████   
                                            █████████    █     
                                            ██   █████████      
                                                  ██████       
                  
                                      Tailwind CSS Class Converter
`;

  console.log(chalk.cyan(logo));

  let {
    conversions,
    path,
    ignoreGit,
    'ignore-git': ignoreGitKebab,
    maxMemory,
    'max-memory': maxMemoryKebab,
  } = await argv;
  ignoreGit = typeof ignoreGit !== 'undefined' ? ignoreGit : ignoreGitKebab;
  maxMemory = typeof maxMemory !== 'undefined' ? maxMemory : maxMemoryKebab;

  const currentDir = process.cwd();
  const detectedEnv = await detectEnvironment(currentDir);

  // Check Tailwind CSS version and show warning if needed
  const tailwindVersion = await getTailwindVersion(currentDir);
  if (shouldShowTailwindWarning(tailwindVersion)) {
    console.log(
      "\x1b[31m⚠️  Warning: For full compatibility, especially with 'size' conversions, ensure your project uses Tailwind CSS v3.4 or later.\x1b[0m",
    );
    console.log(''); // Add an empty line for spacing
  }

  if (detectedEnv !== 'Unknown' && process.stdout.isTTY) {
    const confirmEnv = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'continue',
        message: chalk.blue(`${detectedEnv} environment detected. Press Y to continue...`),
        default: true,
      },
    ]);
    if (!confirmEnv.continue) {
      console.log(chalk.red('Operation cancelled by user.'));
      exitMessage();
    }
  }

  const git = simpleGit();
  try {
    const status = await git.status();
    if (!status.isClean() && !ignoreGit) {
      console.error(
        chalk.red(
          'Error: Git repository is not clean. Please commit or stash your changes before running the converter, or use --ignore-git to override.',
        ),
      );
      exitMessage();
    }
  } catch {
    console.warn(
      chalk.yellow('Warning: Not a Git repository or Git not installed. Skipping Git clean check.'),
    );
  }

  if (!conversions || conversions.length === 0) {
    if (process.stdout.isTTY) {
      const answers = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'selectedConversions',
          message: chalk.blue('Select the conversions to apply:'),
          choices: Object.keys(CONVERSIONS),
        },
      ]);
      conversions = answers.selectedConversions;
    } else {
      console.log(
        chalk.yellow(
          'No conversions selected. Please specify conversions with the -c flag or run in an interactive terminal.',
        ),
      );
      console.log(
        chalk.yellow(
          'Example: `npx yae-modernize-tailwind -c size,spacing,typography -p "./src/**/*.{js,jsx,ts,tsx,html,css,svelte}"`',
        ),
      );
      exitMessage();
      return;
    }
  }

  if (!conversions || conversions.length === 0) {
    console.log(chalk.red('No conversions selected. Exiting.'));
    exitMessage();
    return;
  }

  const files = await glob(path, { nodir: true, ignore: ['node_modules/**'] });

  if (files.length === 0) {
    console.log(chalk.yellow('No files found matching the specified pattern.'));
    exitMessage();
    return;
  }

  console.log(chalk.blue(`Found ${files.length} files to process...`));

  const spinner = ora(chalk.cyan('Initializing processing...')).start();

  try {
    // Set up progress callback
    const progressCallback = (processed: number, total: number, currentFile: string) => {
      const percentage = ((processed / total) * 100).toFixed(1);
      spinner.text = chalk.cyan(`Processing [${percentage}%]: ${currentFile}`);
    };

    // Update conversion functions to accept filePath parameter
    const enhancedConversions = Object.fromEntries(
      Object.entries(CONVERSIONS).map(([key, fn]) => [
        key,
        (content: string, filePath?: string) => fn(content, filePath),
      ]),
    );

    // Use auto-processing mode for optimal performance
    const results = await ParallelProcessor.autoProcessFiles(
      files,
      conversions,
      enhancedConversions,
      progressCallback,
      maxMemory,
    );

    spinner.stop();

    // Process results
    const successCount = results.filter((r) => r.success).length;
    const changeCount = results.reduce((sum, r) => sum + (r.changes || 0), 0);
    const errorCount = results.filter((r) => !r.success).length;

    console.log('');
    if (errorCount === 0) {
      console.log(chalk.green(`✅ Successfully processed ${successCount} files`));
      if (changeCount > 0) {
        console.log(chalk.blue(`🔧 Applied changes to ${changeCount} files`));
      } else {
        console.log(chalk.blue('📝 No changes were needed'));
      }
    } else {
      console.log(
        chalk.yellow(`⚠️  Processed ${successCount} files successfully, ${errorCount} failed`),
      );
      if (changeCount > 0) {
        console.log(chalk.blue(`🔧 Applied changes to ${changeCount} files`));
      }
    }

    // Display detailed error report
    const errorReport = ErrorHandler.generateReport();
    console.log(errorReport);
  } catch (error) {
    spinner.fail(chalk.red('Processing failed with fatal error'));

    if (error instanceof Error) {
      console.error(chalk.red(`Error: ${error.message}`));
    } else {
      console.error(chalk.red('An unknown error occurred'));
    }

    process.exit(1);
  }
  exitMessage();
  return;
}

export { run };

// Always run the CLI when this file is executed
run().catch(console.error);
