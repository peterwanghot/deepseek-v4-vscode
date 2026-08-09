type CartItem = {
	id: string;
	name: string;
	price: number;
	quantity: number;
	tags?: string[];
};

export function calculateCartTotal(items: CartItem[], couponCode?: string): number {
	let total = 0;

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		total += item.price * item.quantity;
	}

	if (couponCode === 'SAVE10') {
		total = total - 10;
	}

	if (couponCode === 'HALF') {
		total = total / 2;
	}

	return Number(total.toFixed(2));
}

export function findPremiumItems(items: CartItem[]): CartItem[] {
	const result: CartItem[] = [];

	items.forEach(item => {
		if (item.tags && item.tags.indexOf('premium') !== -1 || item.price > 100) {
			result.push(item);
		}
	});

	return result;
}

export function formatReceipt(items: CartItem[], couponCode?: string): string {
	let output = 'Receipt\n';
	output += '-------\n';

	for (const item of items) {
		output += item.name + ' x ' + item.quantity + ' = $' + item.price * item.quantity + '\n';
	}

	output += '-------\n';
	output += 'Total: $' + calculateCartTotal(items, couponCode);

	return output;
}

const demoCart: CartItem[] = [
	{ id: 'keyboard', name: 'Keyboard', price: 89.99, quantity: 1, tags: ['office'] },
	{ id: 'monitor', name: 'Monitor', price: 249.5, quantity: 2, tags: ['premium'] },
	{ id: 'cable', name: 'USB-C Cable', price: 12.99, quantity: 3 }
];

console.log(formatReceipt(demoCart, 'SAVE10'));
