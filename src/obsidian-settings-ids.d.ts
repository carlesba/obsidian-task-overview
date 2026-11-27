export {};

// `id` is public since Obsidian 1.14.0 but is absent from the typings published to npm.
// https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts
declare module "obsidian" {
	interface SettingDefinitionBase {
		id?: string;
	}

	interface SettingDefinitionGroup {
		id?: string;
	}

	interface SettingDefinitionPage {
		id?: string;
	}
}
