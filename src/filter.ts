import { setIcon } from "obsidian";
import { TaskFilter } from "./tasks";

export interface FilterControlProps {
	container: HTMLElement;
	active: TaskFilter;
	counts: Record<TaskFilter, number>;
	onSelect: (filter: TaskFilter) => void;
}

const FILTER_OPTIONS: { filter: TaskFilter; icon: string; label: string }[] = [
	{ filter: "open", icon: "square", label: "Open" },
	{ filter: "closed", icon: "check-square", label: "Completed or cancelled" },
	{ filter: "all", icon: "list", label: "All" },
];

export function renderFilterControl(props: FilterControlProps): void {
	props.container.empty();

	for (const option of FILTER_OPTIONS) {
		const button = props.container.createDiv({ cls: "clickable-icon" });
		setIcon(button, option.icon);
		button.toggleClass("is-active", props.active === option.filter);
		button.setAttribute("aria-label", `${option.label} (${props.counts[option.filter]})`);
		button.addEventListener("click", () => props.onSelect(option.filter));
	}
}
