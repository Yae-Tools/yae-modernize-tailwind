import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { promises as fs } from 'fs';
import { glob } from 'glob';
import inquirer from 'inquirer';
import { CONVERSIONS } from './conversions.js';
import { simpleGit } from 'simple-git';
import { detectEnvironment } from './environment.js';
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
  .help()
  .argv;

async function run() {
const logo =`
 ██╗   ██╗ █████╗ ███████╗      ███╗   ███╗ ██████╗ ██████╗ ███████╗██████╗ ███╗   ██╗██╗███████╗███████╗
 ╚██╗ ██╔╝██╔══██╗██╔════╝      ████╗ ████║██╔═══██╗██╔══██╗██╔════╝██╔══██╗████╗  ██║██║╚══███╔╝██╔════╝
  ╚████╔╝ ███████║█████╗  █████╗██╔████╔██║██║   ██║██║  ██║█████╗  ██████╔╝██╔██╗ ██║██║  ███╔╝ █████╗  
   ╚██╔╝  ██╔══██║██╔══╝  ╚════╝██║╚██╔╝██║██║   ██║██║  ██║██╔══╝  ██╔══██╗██║╚██╗██║██║ ███╔╝  ██╔══╝  
    ██║   ██║  ██║███████╗      ██║ ╚═╝ ██║╚██████╔╝██████╔╝███████╗██║  ██║██║ ╚████║██║███████╗███████╗
    ╚═╝   ╚═╝  ╚═╝╚══════╝      ╚═╝     ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝╚══════╝╚══════╝
                                     
                                                  ......                
                                              .-++++++++++-.            
                                            .++++++++++++++=.       .. 
                                            .-..  ..:+++++++++=:...:=:  
                                            .        .:++++++++=====:   
                                          ....         .:-=++====-:.    
                                      .:-=+++++=-:.        .....        
                                    :+++++++++++++:.        .          
                                    :=-...:=+++++++++:..  ..-.          
                                  ..       .=+++++++++=====.           
                                              .-++++++++==-.            
                                              .....::.....       

                                      Tailwind CSS Class Converter
`

  console.log(chalk.blue(logo));
  console.log(chalk.bold.bgRedBright.yellow("Warning: For full compatibility, especially with 'size' conversions, ensure your project uses Tailwind CSS v3.4 or later."));
  console.log(""); // Add an empty line for spacing

  let { conversions, path, ignoreGit, 'ignore-git': ignoreGitKebab } = await argv;
  ignoreGit = typeof ignoreGit !== 'undefined' ? ignoreGit : ignoreGitKebab;

  const currentDir = process.cwd();
  const detectedEnv = await detectEnvironment(currentDir);

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
      process.exit(0);
    }
  }

  const git = simpleGit();
  try {
    const status = await git.status();
    if (!status.isClean() && !ignoreGit) {
      console.error(chalk.red('Error: Git repository is not clean. Please commit or stash your changes before running the converter, or use --ignore-git to override.'));
      process.exit(1);
    }
  } catch (error) {
    console.warn(chalk.yellow('Warning: Not a Git repository or Git not installed. Skipping Git clean check.'));
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
      console.log(chalk.yellow('No conversions selected. Please specify conversions with the -c flag or run in an interactive terminal.'));
      return;
    }
  }

  if (!conversions || conversions.length === 0) {
    console.log(chalk.red('No conversions selected. Exiting.'));
    return;
  }

  const files = await glob(path, { nodir: true, ignore: ['node_modules/**'] });

  const spinner = ora(chalk.cyan('Processing files...')).start();

  for (const file of files) {
    try {
      spinner.text = chalk.cyan(`Processing file: ${file}`);
      let content = await fs.readFile(file, 'utf-8');
      let changed = false;

      for (const conversion of conversions) {
        const conversionFunction = CONVERSIONS[conversion as keyof typeof CONVERSIONS];
        const { newContent, changed: conversionChanged } = conversionFunction(content);
        content = newContent;
        if (conversionChanged) {
          changed = true;
        }
      }

      if (changed) {
        await fs.writeFile(file, content, 'utf-8');
        spinner.succeed(chalk.green(`Updated ${file}`));
        spinner.start(chalk.cyan('Processing next file...')); // Restart spinner for next file
      }
    } catch (error) {
      console.error(error);
      spinner.fail(chalk.red(`Failed to process ${file}`));
      spinner.start(chalk.cyan('Processing next file...')); // Restart spinner for next file
    }
  }

  spinner.succeed(chalk.green('Conversion complete!'));
}

export { run };

// Only run if this file is executed directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch(console.error);
}
