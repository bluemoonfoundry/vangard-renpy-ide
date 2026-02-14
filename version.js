import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// In ES Modules, __dirname is not defined by default, so we recreate it
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.join(__dirname, 'package.json');
const packageLockPath = path.join(__dirname, 'package-lock.json');

const args = process.argv.slice(2);
const mode = args[0];
const customVersion = args[1];

if (!mode) {
  console.error('Error: Missing argument. Usage: node version.js [patch|minor|major|set]');
  process.exit(1);
}

function updateFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(data);
    const currentVersion = json.version;

    let [major, minor, patch] = currentVersion.split('.').map(Number);
    let newVersion = currentVersion;

    switch (mode) {
      case 'patch':
        patch++;
        newVersion = `${major}.${minor}.${patch}`;
        break;
      case 'minor':
        minor++;
        patch = 0;
        newVersion = `${major}.${minor}.${patch}`;
        break;
      case 'major':
        major++;
        minor = 0;
        patch = 0;
        newVersion = `${major}.${minor}.${patch}`;
        break;
      case 'set':
        if (!customVersion) {
          console.error('Error: "set" requires a version number.');
          process.exit(1);
        }
        newVersion = customVersion;
        break;
      default:
        console.error(`Error: Unknown mode "${mode}"`);
        process.exit(1);
    }

    json.version = newVersion;
    // Write back with 2-space indentation and a newline at the end
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n');
    
    if (path.basename(filePath) === 'package.json') {
      console.log(`✅ Version updated: ${currentVersion} -> ${newVersion}`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${path.basename(filePath)}:`, error.message);
  }
}

updateFile(packageJsonPath);
updateFile(packageLockPath);