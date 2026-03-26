#!/usr/bin/env node
import readline from 'readline';
import { execSync, spawn } from 'child_process';
import { writeFileSync, existsSync } from 'fs';
import { randomBytes } from 'crypto';

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
};

const log = (msg) => console.log(msg);
const info = (msg) => console.log(`${C.cyan}${msg}${C.reset}`);
const success = (msg) => console.log(`${C.green}✓ ${msg}${C.reset}`);
const warn = (msg) => console.log(`${C.yellow}! ${msg}${C.reset}`);
const error = (msg) => console.error(`${C.red}✗ ${msg}${C.reset}`);
const bold = (msg) => `${C.bold}${msg}${C.reset}`;
const dim = (msg) => `${C.dim}${msg}${C.reset}`;

function prompt(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  log('');
  log(`${C.bold}${C.cyan}  Headless CRM${C.reset} ${dim('— scaffolder')}`);
  log('');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  let dir, db, port, apiKey;

  try {
    dir = (await prompt(rl, `  Project directory ${dim('(headless-crm)')}:  `)).trim() || 'headless-crm';

    const dbAnswer = (await prompt(rl, `  Database ${dim('postgres/sqlite')} ${dim('(sqlite)')}:  `)).trim().toLowerCase();
    db = dbAnswer.startsWith('p') ? 'postgres' : 'sqlite';

    const portAnswer = (await prompt(rl, `  Port ${dim('(3001)')}:  `)).trim();
    port = portAnswer || '3001';

    const keyAnswer = (await prompt(rl, `  Admin API key ${dim('(leave blank to generate)')}:  `)).trim();
    apiKey = keyAnswer || randomBytes(24).toString('hex');
  } finally {
    rl.close();
  }

  log('');

  // Validate port
  if (isNaN(Number(port)) || Number(port) < 1 || Number(port) > 65535) {
    error(`Invalid port: ${port}`);
    process.exit(1);
  }

  // Check directory
  if (existsSync(dir)) {
    error(`Directory "${dir}" already exists.`);
    process.exit(1);
  }

  // Clone repo
  info(`Cloning repository into ./${dir} ...`);
  try {
    execSync(`git clone https://github.com/Cam-Smith-One/Headless_CRM.git ${dir}`, { stdio: 'pipe' });
    success('Repository cloned.');
  } catch (e) {
    error('git clone failed. Ensure git is installed and the repository is accessible.');
    if (e.stderr) console.error(dim(e.stderr.toString()));
    process.exit(1);
  }

  // Write .env
  const dbUrl = db === 'postgres'
    ? 'postgresql://postgres:postgres@localhost:5432/headless_crm'
    : `file:${dir}/data.db`;

  const env = [
    `PORT=${port}`,
    `ADMIN_API_KEY=${apiKey}`,
    `DATABASE_URL=${dbUrl}`,
    `DATABASE_TYPE=${db}`,
    '',
  ].join('\n');

  try {
    writeFileSync(`${dir}/.env`, env);
    success('.env file created.');
  } catch (e) {
    error(`Failed to write .env: ${e.message}`);
    process.exit(1);
  }

  // npm install
  info('Installing dependencies (npm install) ...');
  try {
    execSync('npm install', { cwd: dir, stdio: 'inherit' });
    success('Dependencies installed.');
  } catch (e) {
    error('npm install failed.');
    process.exit(1);
  }

  // Done — print next steps
  log('');
  log(`${C.bold}${C.green}  All set!${C.reset}`);
  log('');
  log(`  ${bold('Next steps:')}`);
  log('');
  log(`    ${dim('$')} cd ${dir}`);

  if (db === 'postgres') {
    log(`    ${dim('$')} docker compose up -d`);
    log(`    ${dim('$')} npm run db:migrate && npm run db:seed`);
    log(`    ${dim('$')} npm start`);
    log('');
    warn('Make sure Docker is running before starting the database.');
  } else {
    log(`    ${dim('$')} npm start`);
  }

  log('');
  log(`  Admin API key: ${bold(apiKey)}`);
  log(`  Listening on:  ${bold(`http://localhost:${port}`)}`);
  log('');
}

main().catch((e) => {
  error(`Unexpected error: ${e.message}`);
  process.exit(1);
});
