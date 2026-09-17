#!/usr/bin/env node
import { access, copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginId = "task-overview";
const artifacts = ["main.js", "manifest.json", "styles.css"];
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function fail(message) {
	console.error(message);
	process.exit(1);
}

function parseArguments(argv) {
	let vault = process.env.OBSIDIAN_VAULT;
	let dryRun = false;

	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];

		if (argument === "--dry-run") {
			dryRun = true;
		} else if (argument === "--vault") {
			const value = argv[index + 1];

			if (!value || value.startsWith("-")) {
				fail("--vault needs a path");
			}

			vault = value;
			index += 1;
		} else if (argument.startsWith("--vault=")) {
			vault = argument.slice("--vault=".length);
		} else {
			fail(`Unknown argument ${argument}, expected --vault <path> or --dry-run`);
		}
	}

	return { vault, dryRun };
}

async function isDirectory(path) {
	try {
		return (await stat(path)).isDirectory();
	} catch {
		return false;
	}
}

async function missingArtifacts() {
	const missing = [];

	for (const artifact of artifacts) {
		try {
			await access(join(repoRoot, artifact));
		} catch {
			missing.push(artifact);
		}
	}

	return missing;
}

async function copyArtifacts(destination) {
	try {
		await mkdir(destination, { recursive: true });

		for (const artifact of artifacts) {
			await copyFile(join(repoRoot, artifact), join(destination, artifact));
		}
	} catch (error) {
		fail(`Could not write to ${destination}: ${error.message}`);
	}
}

const { vault, dryRun } = parseArguments(process.argv.slice(2));

if (!vault) {
	fail("No vault given, pass --vault <path> or set OBSIDIAN_VAULT");
}

const vaultRoot = resolve(vault);

if (!(await isDirectory(vaultRoot))) {
	fail(`No such directory ${vaultRoot}`);
}

if (!(await isDirectory(join(vaultRoot, ".obsidian")))) {
	fail(`${vaultRoot} holds no .obsidian directory, so it is not an Obsidian vault`);
}

const missing = await missingArtifacts();

if (missing.length > 0) {
	fail(`Missing ${missing.join(", ")} in ${repoRoot}, run npm run build first`);
}

const destination = join(vaultRoot, ".obsidian", "plugins", pluginId);

if (dryRun) {
	console.log(
		(await isDirectory(destination))
			? `Would copy into ${destination}`
			: `Would create ${destination} and copy into it`,
	);

	for (const artifact of artifacts) {
		console.log(`  ${artifact}`);
	}

	process.exit(0);
}

await copyArtifacts(destination);

console.log(`Copied ${artifacts.join(", ")} into ${destination}`);
