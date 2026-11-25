import { mkdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const MAX_JOKE_LENGTH = 199;
export const OUTPUT_FILENAME = "joke.txt";

export const JOKE =
  "Every all-hands Q&A opens with ten seconds of dead silence while 200 adults calculate if their question is worth updating their resume.";

export interface ValidationReport {
  readonly valid: boolean;
  readonly length: number;
  readonly maxLength: number;
  readonly errors: readonly string[];
}

export interface RunResult {
  readonly outputDir: string;
  readonly outputPath: string;
  readonly bytesWritten: number;
  readonly joke: string;
}

export function validateJoke(text: string): ValidationReport {
  if (typeof text !== "string") {
    return Object.freeze({
      valid: false,
      length: 0,
      maxLength: MAX_JOKE_LENGTH,
      errors: Object.freeze(["Joke must be a string."]),
    });
  }

  const errors: string[] = [];

  if (text.length === 0 || text.trim().length === 0) {
    errors.push("Joke must not be empty.");
  } else {
    if (text !== text.trim()) {
      errors.push("Joke must not have leading or trailing whitespace.");
    }
    if (/[\r\n\u2028\u2029]/.test(text)) {
      errors.push("Joke must be a single line with no line breaks.");
    }
    if (text.length > MAX_JOKE_LENGTH) {
      errors.push(
        `Joke must be under 200 characters (got ${text.length} characters).`,
      );
    }
    if (!/^[\x20-\x7E]+$/.test(text)) {
      errors.push("Joke must contain only printable ASCII characters.");
    }
  }

  return Object.freeze({
    valid: errors.length === 0,
    length: text.length,
    maxLength: MAX_JOKE_LENGTH,
    errors: Object.freeze(errors),
  });
}

export function resolveOutputDir(): string {
  const raw = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  if (raw.includes("\0")) {
    throw new Error("MAKEFUN_OUTPUT_DIR must not contain null bytes.");
  }

  const configured = raw.trim();
  return resolve(configured.length > 0 ? configured : "/output");
}

function ensureDirectory(dirPath: string): void {
  const existing = statSync(dirPath, { throwIfNoEntry: false });
  if (existing && !existing.isDirectory()) {
    throw new Error(
      `Output directory path exists and is not a directory: ${dirPath}`,
    );
  }
  mkdirSync(dirPath, { recursive: true });
}

export function run(): RunResult {
  const report = validateJoke(JOKE);
  if (!report.valid) {
    throw new Error(`Invalid joke entry: ${report.errors.join(" ")}`);
  }

  const outputDir = resolveOutputDir();
  ensureDirectory(outputDir);

  const outputPath = join(outputDir, OUTPUT_FILENAME);
  const existingFile = statSync(outputPath, { throwIfNoEntry: false });
  if (existingFile?.isDirectory()) {
    throw new Error(`Output file path is an existing directory: ${outputPath}`);
  }

  const payload = Buffer.from(JOKE, "utf8");
  writeFileSync(outputPath, payload);
  process.stdout.write(`${JOKE}\n`);

  return Object.freeze({
    outputDir,
    outputPath,
    bytesWritten: payload.byteLength,
    joke: JOKE,
  });
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }

  const currentPath = fileURLToPath(import.meta.url);
  try {
    return realpathSync(currentPath) === realpathSync(resolve(entry));
  } catch {
    return resolve(currentPath) === resolve(entry);
  }
}

if (isMainModule()) {
  try {
    run();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}