import {cpSync, existsSync, mkdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const source = resolve(scriptDirectory, '../src/generated/prisma');
const destination = resolve(scriptDirectory, '../dist/generated/prisma');

if (!existsSync(source)) {
  throw new Error('Generated Prisma Client is missing. Run npm run db:generate before building the API.');
}

mkdirSync(dirname(destination), {recursive: true});
cpSync(source, destination, {recursive: true});
