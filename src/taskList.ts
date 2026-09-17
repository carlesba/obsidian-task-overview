import { App, Component, TFile } from "obsidian";
import { Task } from "./tasks";

export interface TaskListProps {
	app: App;
	owner: Component;
	container: HTMLElement;
	file: TFile;
	tasks: Task[];
	onTaskToggled: () => void;
}

export function renderTaskList(props: TaskListProps): void {
	props.container.empty();
}
