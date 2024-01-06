export function assertDefined(value: unknown, message?: string): asserts value {
	if (value === undefined || value === null) {
		throw new Error(message ?? value + ' is not defined');
	}
}
