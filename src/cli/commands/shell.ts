/**
 * Shell integration commands
 * @requirement REQ-FIX-006 - Shell CLI commands
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ShellInstaller } from '../../utils/shell-installer.js';

export function registerShellCommands(program: Command): void {
  const shell = program
    .command('shell')
    .description('Manage shell integration');

  // shell install
  shell
    .command('install')
    .description('Install shell integration (prompt, aliases, completion)')
    .option('--force', 'Force reinstall if already installed')
    .action(async (options: { force?: boolean }) => {
      const installer = new ShellInstaller();
      const spinner = ora('Installing shell integration...').start();

      try {
        const result = await installer.install({ force: options.force });

        if (result.success) {
          spinner.succeed('Shell integration installed!');
          console.log('');
          console.log(chalk.green('✅'), result.message);
          console.log('');
          console.log(chalk.bold('Shell:'), chalk.cyan(result.shellType));
          console.log(chalk.bold('Profile:'), chalk.cyan(result.profilePath));
          if (result.backupPath) {
            console.log(chalk.bold('Backup:'), chalk.gray(result.backupPath));
          }
          console.log('');
          console.log(chalk.yellow('⚠️  Restart your shell or run:'));
          console.log(chalk.cyan(`   source ${result.profilePath}`));
          console.log('');
          process.exit(0);
        } else {
          spinner.fail('Installation failed');
          console.log('');
          console.log(chalk.red('❌'), result.message);
          console.log('');
          process.exit(1);
        }
      } catch (error: any) {
        spinner.fail('Installation failed');
        console.log('');
        console.error(chalk.red('❌ Error:'), error.message);
        console.log('');
        process.exit(1);
      }
    });

  // shell uninstall
  shell
    .command('uninstall')
    .description('Remove shell integration')
    .action(async () => {
      const installer = new ShellInstaller();
      const spinner = ora('Removing shell integration...').start();

      try {
        const result = await installer.uninstall();

        if (result.success) {
          spinner.succeed('Shell integration removed');
          console.log('');
          console.log(chalk.green('✅'), result.message);
          if (result.backupPath) {
            console.log(chalk.gray('Backup saved:'), result.backupPath);
          }
          console.log('');
          process.exit(0);
        } else {
          spinner.warn(result.message);
          process.exit(0);
        }
      } catch (error: any) {
        spinner.fail('Uninstallation failed');
        console.log('');
        console.error(chalk.red('❌ Error:'), error.message);
        console.log('');
        process.exit(1);
      }
    });

  // shell status
  shell
    .command('status')
    .description('Check shell integration status')
    .action(async () => {
      const installer = new ShellInstaller();
      const status = await installer.status();

      console.log('');
      console.log(chalk.bold('🐚 Shell Integration Status'));
      console.log('');
      console.log(chalk.bold('Shell Type:'), chalk.cyan(status.shellType));
      console.log(chalk.bold('Profile:'), chalk.cyan(status.profilePath));
      console.log(chalk.bold('Status:'), status.installed ? chalk.green('✅ Installed') : chalk.yellow('⚠️  Not installed'));
      console.log('');
      
      if (!status.installed) {
        console.log(chalk.gray('Install with:'), chalk.cyan('ai-workflow shell install'));
        console.log('');
      }
    });

  // shell generate (existing feature, enhanced)
  shell
    .command('generate')
    .description('Generate shell integration code (without installing)')
    .action(async () => {
      const installer = new ShellInstaller();
      const shellType = installer.detectShell();
      const code = (installer as any).generateIntegrationCode(shellType);

      console.log('');
      console.log(chalk.bold(`Shell Integration Code (${shellType}):`));
      console.log('');
      console.log(code);
      console.log('');
      console.log(chalk.gray('To install manually:'));
      console.log(chalk.cyan(`  echo '${code}' >> ${installer.getProfilePath(shellType)}`));
      console.log('');
      console.log(chalk.gray('Or install automatically:'));
      console.log(chalk.cyan('  ai-workflow shell install'));
      console.log('');
    });
}

