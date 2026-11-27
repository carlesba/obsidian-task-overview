import { App, FuzzyMatch, FuzzySuggestModal, Menu, TFile, getIconIds, setIcon } from "obsidian";

export interface Choice {
	title: string;
	icon?: string;
	pick: () => void;
}

export function showChoices(anchor: HTMLElement, choices: Choice[]): void {
	const menu = new Menu();
	for (const choice of choices) {
		menu.addItem((item) => {
			item.setTitle(choice.title).onClick(choice.pick);
			if (choice.icon) item.setIcon(choice.icon);
		});
	}
	const { left, bottom } = anchor.getBoundingClientRect();
	menu.showAtPosition({ x: left, y: bottom });
}

export class IconPicker extends FuzzySuggestModal<string> {
	private pick: (icon: string) => void;

	constructor(app: App, pick: (icon: string) => void) {
		super(app);
		this.pick = pick;
		this.setPlaceholder("Search icons");
	}

	getItems(): string[] {
		return getIconIds();
	}

	getItemText(icon: string): string {
		return icon.replace(/^lucide-/, "");
	}

	renderSuggestion(match: FuzzyMatch<string>, el: HTMLElement): void {
		el.addClass("task-overview-icon-suggestion");
		setIcon(el.createSpan({ cls: "task-overview-icon-preview" }), match.item);
		super.renderSuggestion(match, el.createSpan());
	}

	onChooseItem(icon: string): void {
		this.pick(icon);
	}
}

export class NotePicker extends FuzzySuggestModal<TFile> {
	private pick: (note: TFile) => void;

	constructor(app: App, pick: (note: TFile) => void) {
		super(app);
		this.pick = pick;
		this.setPlaceholder("Search notes");
	}

	getItems(): TFile[] {
		return this.app.vault.getMarkdownFiles();
	}

	getItemText(note: TFile): string {
		return note.path;
	}

	onChooseItem(note: TFile): void {
		this.pick(note);
	}
}
