import { TaskFilter } from "./tasks";

export interface FilterControlProps {
	container: HTMLElement;
	active: TaskFilter;
	counts: Record<TaskFilter, number>;
	onSelect: (filter: TaskFilter) => void;
}

export function renderFilterControl(props: FilterControlProps): void {
	props.container.empty();
}
