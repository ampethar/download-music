const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

function info(msg) {
  console.log(`${COLORS.cyan}[INFO]${COLORS.reset} ${msg}`);
}

function success(msg) {
  console.log(`${COLORS.green}[OK]${COLORS.reset} ${msg}`);
}

function warn(msg) {
  console.log(`${COLORS.yellow}[WARN]${COLORS.reset} ${msg}`);
}

function error(msg) {
  console.error(`${COLORS.red}[ERROR]${COLORS.reset} ${msg}`);
}

function header(msg) {
  console.log(`\n${COLORS.bold}${msg}${COLORS.reset}\n`);
}

function dim(msg) {
  console.log(`${COLORS.gray}${msg}${COLORS.reset}`);
}

function progress(current, total, msg) {
  console.log(`\n${COLORS.cyan}[${current}/${total}]${COLORS.reset} ${msg}`);
}

module.exports = { info, success, warn, error, header, dim, progress };
