export function assertDefined(value: unknown, message?: string): asserts value {
	if (value === undefined || value === null) {
		throw new Error(message ?? value + ' is not defined');
	}
}

export function assertNever(value: never, message?: string): never {
	throw new Error(message ?? value + ' is not never');
}

export function assert(condition: boolean, message?: string): asserts condition {
	if (!condition) {
		throw new Error(message ?? 'Assertion failed');
	}
}

export const fileNameAndExtension = (file: File): [name: string, extension: string] => {
	const split = file.name.split('.');
	const extension = split.pop() ?? '';
	const name = split.join('.');

	return [name, extension];
};
