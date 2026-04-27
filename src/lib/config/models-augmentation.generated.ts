// AUTO-GENERATED — DO NOT EDIT BY HAND.
// Run `npm run sync-models` to regenerate.
// Source: https://models.dev/api.json (MIT). Per-field merger lives at the
// bottom of src/lib/config/models.ts.

export type ModelAugmentation = {
	contextWindow?: string;
	knowledgeCutoff?: string;
	/** Subset of ModelCapabilities — only fields models.dev tracks. */
	capabilities?: { thinking?: boolean; tools?: boolean; files?: boolean; vision?: boolean };
	costInputUsdPerMillion?: number;
	costOutputUsdPerMillion?: number;
	modelsDevReleaseDate?: string;
	modelsDevLastUpdated?: string;
	modelsDevSourceProvider?: string;
};

export const augmentation: Record<string, ModelAugmentation> = {
	"gemini-2.5-flash": {
		"contextWindow": "1M",
		"knowledgeCutoff": "2025-01-01",
		"costInputUsdPerMillion": 0.3,
		"costOutputUsdPerMillion": 2.5,
		"modelsDevReleaseDate": "2025-03-20",
		"modelsDevLastUpdated": "2025-06-05",
		"modelsDevSourceProvider": "Google",
		"capabilities": {
			"thinking": true,
			"tools": true,
			"files": true,
			"vision": true
		}
	},
	"gemini-2.5-flash-lite": {
		"contextWindow": "1M",
		"knowledgeCutoff": "2025-01-01",
		"costInputUsdPerMillion": 0.1,
		"costOutputUsdPerMillion": 0.4,
		"modelsDevReleaseDate": "2025-06-17",
		"modelsDevLastUpdated": "2025-06-17",
		"modelsDevSourceProvider": "Google",
		"capabilities": {
			"thinking": true,
			"tools": true,
			"files": true,
			"vision": true
		}
	},
	"gemini-2.5-pro": {
		"contextWindow": "1M",
		"knowledgeCutoff": "2025-01-01",
		"costInputUsdPerMillion": 1.25,
		"costOutputUsdPerMillion": 10,
		"modelsDevReleaseDate": "2025-03-20",
		"modelsDevLastUpdated": "2025-06-05",
		"modelsDevSourceProvider": "Google",
		"capabilities": {
			"thinking": true,
			"tools": true,
			"files": true,
			"vision": true
		}
	},
	"meta-llama-3.3-70b": {
		"contextWindow": "100K",
		"knowledgeCutoff": "2023-12-01",
		"costInputUsdPerMillion": 0.9,
		"costOutputUsdPerMillion": 0.9,
		"modelsDevReleaseDate": "2024-12-06",
		"modelsDevLastUpdated": "2026-03-17",
		"modelsDevSourceProvider": "Scaleway",
		"capabilities": {
			"thinking": false,
			"tools": true,
			"files": true,
			"vision": false
		}
	},
	"meta-llama-3.3-70b-fast": {
		"contextWindow": "131K",
		"knowledgeCutoff": "2023-12-01",
		"costInputUsdPerMillion": 0.59,
		"costOutputUsdPerMillion": 0.79,
		"modelsDevReleaseDate": "2024-12-06",
		"modelsDevLastUpdated": "2024-12-06",
		"modelsDevSourceProvider": "Groq",
		"capabilities": {
			"thinking": false,
			"tools": true,
			"files": false,
			"vision": false
		}
	},
	"meta-llama-3.1-8b": {
		"contextWindow": "131K",
		"knowledgeCutoff": "2023-12-01",
		"costInputUsdPerMillion": 0.05,
		"costOutputUsdPerMillion": 0.08,
		"modelsDevReleaseDate": "2024-07-23",
		"modelsDevLastUpdated": "2024-07-23",
		"modelsDevSourceProvider": "Groq",
		"capabilities": {
			"thinking": false,
			"tools": true,
			"files": false,
			"vision": false
		}
	},
	"meta-llama-4-scout-fast": {
		"contextWindow": "131K",
		"knowledgeCutoff": "2024-08-01",
		"costInputUsdPerMillion": 0.11,
		"costOutputUsdPerMillion": 0.34,
		"modelsDevReleaseDate": "2025-04-05",
		"modelsDevLastUpdated": "2025-04-05",
		"modelsDevSourceProvider": "Groq",
		"capabilities": {
			"thinking": false,
			"tools": true,
			"files": false,
			"vision": true
		}
	},
	"meta-llama-4-maverick": {
		"contextWindow": "131K",
		"knowledgeCutoff": "2025-01-01",
		"costInputUsdPerMillion": 0.15,
		"costOutputUsdPerMillion": 0.6,
		"modelsDevReleaseDate": "2025-01-01",
		"modelsDevLastUpdated": "2025-01-01",
		"modelsDevSourceProvider": "Helicone",
		"capabilities": {
			"thinking": false,
			"tools": true,
			"files": false,
			"vision": true
		}
	},
	"meta-llama-4-scout": {
		"contextWindow": "131K",
		"knowledgeCutoff": "2025-01-01",
		"costInputUsdPerMillion": 0.08,
		"costOutputUsdPerMillion": 0.3,
		"modelsDevReleaseDate": "2025-01-01",
		"modelsDevLastUpdated": "2025-01-01",
		"modelsDevSourceProvider": "Helicone",
		"capabilities": {
			"thinking": false,
			"tools": true,
			"files": false,
			"vision": true
		}
	},
	"claude-opus-4": {
		"contextWindow": "200K",
		"knowledgeCutoff": "2025-05-01",
		"costInputUsdPerMillion": 15,
		"costOutputUsdPerMillion": 75,
		"modelsDevReleaseDate": "2025-05-14",
		"modelsDevLastUpdated": "2025-05-14",
		"modelsDevSourceProvider": "Helicone",
		"capabilities": {
			"thinking": true,
			"tools": true,
			"files": false,
			"vision": true
		}
	},
	"claude-sonnet-4": {
		"contextWindow": "216K",
		"knowledgeCutoff": "2025-03-31",
		"costInputUsdPerMillion": 0,
		"costOutputUsdPerMillion": 0,
		"modelsDevReleaseDate": "2025-05-22",
		"modelsDevLastUpdated": "2025-05-22",
		"modelsDevSourceProvider": "GitHub Copilot",
		"capabilities": {
			"thinking": true,
			"tools": true,
			"files": true,
			"vision": true
		}
	},
	"claude-haiku-3.5": {
		"contextWindow": "200K",
		"knowledgeCutoff": "2024-07-31",
		"costInputUsdPerMillion": 0.8,
		"costOutputUsdPerMillion": 4,
		"modelsDevReleaseDate": "2024-10-22",
		"modelsDevLastUpdated": "2024-10-22",
		"modelsDevSourceProvider": "OpenCode Zen",
		"capabilities": {
			"thinking": false,
			"tools": true,
			"files": true,
			"vision": true
		}
	},
	"gpt-oss-120b": {
		"contextWindow": "131K",
		"costInputUsdPerMillion": 0.15,
		"costOutputUsdPerMillion": 0.6,
		"modelsDevReleaseDate": "2025-08-05",
		"modelsDevLastUpdated": "2025-08-05",
		"modelsDevSourceProvider": "Groq",
		"capabilities": {
			"thinking": true,
			"tools": true,
			"files": false,
			"vision": false
		}
	},
	"gpt-oss-20b": {
		"contextWindow": "131K",
		"costInputUsdPerMillion": 0.075,
		"costOutputUsdPerMillion": 0.3,
		"modelsDevReleaseDate": "2025-08-05",
		"modelsDevLastUpdated": "2025-08-05",
		"modelsDevSourceProvider": "Groq",
		"capabilities": {
			"thinking": true,
			"tools": true,
			"files": false,
			"vision": false
		}
	},
	"gpt-4.1": {
		"contextWindow": "1M",
		"knowledgeCutoff": "2024-04-01",
		"costInputUsdPerMillion": 2,
		"costOutputUsdPerMillion": 8,
		"modelsDevReleaseDate": "2025-04-14",
		"modelsDevLastUpdated": "2025-04-14",
		"modelsDevSourceProvider": "OpenAI",
		"capabilities": {
			"thinking": false,
			"tools": true,
			"files": true,
			"vision": true
		}
	},
	"gpt-4o": {
		"contextWindow": "128K",
		"knowledgeCutoff": "2023-09-01",
		"costInputUsdPerMillion": 2.5,
		"costOutputUsdPerMillion": 10,
		"modelsDevReleaseDate": "2024-05-13",
		"modelsDevLastUpdated": "2024-08-06",
		"modelsDevSourceProvider": "OpenAI",
		"capabilities": {
			"thinking": false,
			"tools": true,
			"files": true,
			"vision": true
		}
	},
	"o3": {
		"contextWindow": "200K",
		"knowledgeCutoff": "2024-05-01",
		"costInputUsdPerMillion": 2,
		"costOutputUsdPerMillion": 8,
		"modelsDevReleaseDate": "2025-04-16",
		"modelsDevLastUpdated": "2025-04-16",
		"modelsDevSourceProvider": "OpenAI",
		"capabilities": {
			"thinking": true,
			"tools": true,
			"files": true,
			"vision": true
		}
	},
	"o4-mini": {
		"contextWindow": "200K",
		"knowledgeCutoff": "2024-05-01",
		"costInputUsdPerMillion": 1.1,
		"costOutputUsdPerMillion": 4.4,
		"modelsDevReleaseDate": "2025-04-16",
		"modelsDevLastUpdated": "2025-04-16",
		"modelsDevSourceProvider": "OpenAI",
		"capabilities": {
			"thinking": true,
			"tools": true,
			"files": true,
			"vision": true
		}
	},
	"deepseek-r1-free": {
		"contextWindow": "1M",
		"knowledgeCutoff": "2025-09-01",
		"costInputUsdPerMillion": 0.14,
		"costOutputUsdPerMillion": 0.28,
		"modelsDevReleaseDate": "2025-12-01",
		"modelsDevLastUpdated": "2026-02-28",
		"modelsDevSourceProvider": "DeepSeek",
		"capabilities": {
			"thinking": true,
			"tools": true,
			"files": true,
			"vision": false
		}
	},
	"deepseek-v3": {
		"contextWindow": "1M",
		"knowledgeCutoff": "2025-09-01",
		"costInputUsdPerMillion": 0.14,
		"costOutputUsdPerMillion": 0.28,
		"modelsDevReleaseDate": "2025-12-01",
		"modelsDevLastUpdated": "2026-02-28",
		"modelsDevSourceProvider": "DeepSeek",
		"capabilities": {
			"thinking": false,
			"tools": true,
			"files": true,
			"vision": false
		}
	},
	"mistral-small": {
		"contextWindow": "256K",
		"knowledgeCutoff": "2025-06-01",
		"costInputUsdPerMillion": 0.15,
		"costOutputUsdPerMillion": 0.6,
		"modelsDevReleaseDate": "2026-03-16",
		"modelsDevLastUpdated": "2026-03-16",
		"modelsDevSourceProvider": "Mistral",
		"capabilities": {
			"thinking": true,
			"tools": true,
			"files": true,
			"vision": true
		}
	},
	"mistral-large": {
		"contextWindow": "262K",
		"knowledgeCutoff": "2024-11-01",
		"costInputUsdPerMillion": 0.5,
		"costOutputUsdPerMillion": 1.5,
		"modelsDevReleaseDate": "2024-11-01",
		"modelsDevLastUpdated": "2025-12-02",
		"modelsDevSourceProvider": "Mistral",
		"capabilities": {
			"thinking": false,
			"tools": true,
			"files": true,
			"vision": true
		}
	},
	"codestral": {
		"contextWindow": "256K",
		"knowledgeCutoff": "2024-10-01",
		"costInputUsdPerMillion": 0.3,
		"costOutputUsdPerMillion": 0.9,
		"modelsDevReleaseDate": "2024-05-29",
		"modelsDevLastUpdated": "2025-01-04",
		"modelsDevSourceProvider": "Mistral",
		"capabilities": {
			"thinking": false,
			"tools": true,
			"files": false,
			"vision": false
		}
	},
	"qwen3-coder-free": {
		"contextWindow": "262K",
		"knowledgeCutoff": "2025-04-01",
		"costInputUsdPerMillion": 0.861,
		"costOutputUsdPerMillion": 3.441,
		"modelsDevReleaseDate": "2025-04",
		"modelsDevLastUpdated": "2025-04",
		"modelsDevSourceProvider": "Alibaba (China)",
		"capabilities": {
			"thinking": false,
			"tools": true,
			"files": false,
			"vision": false
		}
	},
	"qwen3-32b-fast": {
		"contextWindow": "131K",
		"knowledgeCutoff": "2024-11-08",
		"costInputUsdPerMillion": 0.29,
		"costOutputUsdPerMillion": 0.59,
		"modelsDevReleaseDate": "2024-12-23",
		"modelsDevLastUpdated": "2024-12-23",
		"modelsDevSourceProvider": "Groq",
		"capabilities": {
			"thinking": true,
			"tools": true,
			"files": false,
			"vision": false
		}
	},
	"qwen-2.5-max": {
		"contextWindow": "131K",
		"knowledgeCutoff": "2024-04-01",
		"costInputUsdPerMillion": 0.345,
		"costOutputUsdPerMillion": 1.377,
		"modelsDevReleaseDate": "2024-04-03",
		"modelsDevLastUpdated": "2025-01-25",
		"modelsDevSourceProvider": "Alibaba (China)",
		"capabilities": {
			"thinking": false,
			"tools": true,
			"files": false,
			"vision": false
		}
	},
	"nemotron-70b": {
		"contextWindow": "131K",
		"costInputUsdPerMillion": 1.2,
		"costOutputUsdPerMillion": 1.2,
		"modelsDevReleaseDate": "2024-10-12",
		"modelsDevLastUpdated": "2024-10-12",
		"modelsDevSourceProvider": "Kilo Gateway",
		"capabilities": {
			"thinking": false,
			"tools": true,
			"files": false,
			"vision": false
		}
	},
	"grok-3": {
		"contextWindow": "131K",
		"knowledgeCutoff": "2024-11-01",
		"costInputUsdPerMillion": 3,
		"costOutputUsdPerMillion": 15,
		"modelsDevReleaseDate": "2025-02-17",
		"modelsDevLastUpdated": "2025-02-17",
		"modelsDevSourceProvider": "xAI",
		"capabilities": {
			"thinking": false,
			"tools": true,
			"files": false,
			"vision": false
		}
	},
	"grok-3-mini": {
		"contextWindow": "131K",
		"knowledgeCutoff": "2024-11-01",
		"costInputUsdPerMillion": 0.3,
		"costOutputUsdPerMillion": 0.5,
		"modelsDevReleaseDate": "2025-02-17",
		"modelsDevLastUpdated": "2025-02-17",
		"modelsDevSourceProvider": "xAI",
		"capabilities": {
			"thinking": true,
			"tools": true,
			"files": false,
			"vision": false
		}
	},
	"kimi-k2": {
		"contextWindow": "262K",
		"knowledgeCutoff": "2024-08-01",
		"costInputUsdPerMillion": 0.6,
		"costOutputUsdPerMillion": 2.5,
		"modelsDevReleaseDate": "2025-11-06",
		"modelsDevLastUpdated": "2025-11-06",
		"modelsDevSourceProvider": "Moonshot AI",
		"capabilities": {
			"thinking": true,
			"tools": true,
			"files": false,
			"vision": false
		}
	},
	"command-r-plus": {
		"contextWindow": "128K",
		"knowledgeCutoff": "2024-06-01",
		"costInputUsdPerMillion": 2.5,
		"costOutputUsdPerMillion": 10,
		"modelsDevReleaseDate": "2024-08-30",
		"modelsDevLastUpdated": "2024-08-30",
		"modelsDevSourceProvider": "Cohere",
		"capabilities": {
			"thinking": false,
			"tools": true,
			"files": false,
			"vision": false
		}
	},
	"command-r": {
		"contextWindow": "128K",
		"knowledgeCutoff": "2024-06-01",
		"costInputUsdPerMillion": 0.15,
		"costOutputUsdPerMillion": 0.6,
		"modelsDevReleaseDate": "2024-08-30",
		"modelsDevLastUpdated": "2024-08-30",
		"modelsDevSourceProvider": "Cohere",
		"capabilities": {
			"thinking": false,
			"tools": true,
			"files": false,
			"vision": false
		}
	},
	"mixtral-8x7b": {
		"contextWindow": "32K",
		"knowledgeCutoff": "2024-01-01",
		"costInputUsdPerMillion": 0.7,
		"costOutputUsdPerMillion": 0.7,
		"modelsDevReleaseDate": "2023-12-11",
		"modelsDevLastUpdated": "2023-12-11",
		"modelsDevSourceProvider": "Mistral",
		"capabilities": {
			"thinking": false,
			"tools": true,
			"files": false,
			"vision": false
		}
	}
};
