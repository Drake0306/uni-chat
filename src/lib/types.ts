export type Message = {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	reasoning?: string;
	isThinking?: boolean;
	modelName?: string;
	isError?: boolean;
};

export type Chat = {
	id: string;
	title: string;
	modelId?: string;
	companyId?: string;
	createdAt: string;
	updatedAt: string;
};
