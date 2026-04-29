import type { Highlighter } from 'shiki';

let processorPromise: Promise<{ process: (text: string) => Promise<{ toString: () => string }> }> | null = null;
let highlighterPromise: Promise<Highlighter> | null = null;

function getProcessor() {
	if (!processorPromise) {
		processorPromise = Promise.all([
			import('unified'),
			import('remark-parse'),
			import('remark-gfm'),
			import('remark-math'),
			import('remark-rehype'),
			import('rehype-raw'),
			import('rehype-katex'),
			import('rehype-stringify'),
		]).then(([unified, remarkParse, remarkGfm, remarkMath, remarkRehype, rehypeRaw, rehypeKatex, rehypeStringify]) =>
			unified.unified()
				.use(remarkParse.default)
				.use(remarkGfm.default)
				.use(remarkMath.default)
				.use(remarkRehype.default, { allowDangerousHtml: true })
				.use(rehypeRaw.default)
				.use(rehypeKatex.default)
				.use(rehypeStringify.default)
		);
	}
	return processorPromise;
}

function getHighlighter() {
	if (!highlighterPromise) {
		highlighterPromise = import('shiki').then(({ createHighlighter }) =>
			createHighlighter({
				themes: ['github-dark', 'github-light'],
				langs: [
					'javascript', 'typescript', 'python', 'bash', 'shell',
					'json', 'html', 'css', 'sql', 'rust', 'go', 'java',
					'c', 'cpp', 'ruby', 'php', 'swift', 'kotlin', 'yaml',
					'markdown', 'xml', 'dockerfile', 'plaintext',
				],
			})
		);
	}
	return highlighterPromise;
}

export interface RenderOptions {
	// Master switch for auto-collapse. When false, code blocks always render
	// expanded regardless of length (the user can still toggle individual
	// blocks via the Expand / Collapse button).
	autoCollapse?: boolean;
	// Auto-collapse threshold. Code blocks with more than this many lines
	// collapse on initial render. Ignored when autoCollapse is false.
	collapseLines?: number;
	// True while the message is still streaming. The renderer adds a small
	// pulsing "Generating" indicator to the header of every collapsed code
	// block so the user knows the model is still writing inside an accordion
	// they can't see. The indicator only appears while collapsed AND
	// streaming — expanded blocks show the code being typed live, no
	// indicator needed.
	streaming?: boolean;
}

const DEFAULT_OPTIONS: Required<RenderOptions> = {
	autoCollapse: true,
	collapseLines: 10,
	streaming: false,
};

export async function renderMarkdown(text: string, opts: RenderOptions = {}): Promise<string> {
	const o = { ...DEFAULT_OPTIONS, ...opts };
	const [processor, highlighter] = await Promise.all([getProcessor(), getHighlighter()]);

	const file = await processor.process(text);
	let html = String(file);

	// Replace language-tagged code blocks
	const codeBlockRegex = /<pre><code class="language-(\w+)">([\s\S]*?)<\/code><\/pre>/g;
	html = html.replace(codeBlockRegex, (_match, lang: string, code: string) => {
		const decoded = decodeHtmlEntities(code);
		const loadedLangs = highlighter.getLoadedLanguages();
		const language = loadedLangs.includes(lang) ? lang : 'plaintext';
		const highlighted = highlighter.codeToHtml(decoded, {
			lang: language,
			themes: { light: 'github-light', dark: 'github-dark' },
			defaultColor: false,
		});
		return wrapCodeBlock(highlighted, lang, decoded, o);
	});

	// Replace plain code blocks (no language)
	const plainCodeBlockRegex = /<pre><code>([\s\S]*?)<\/code><\/pre>/g;
	html = html.replace(plainCodeBlockRegex, (_match, code: string) => {
		const decoded = decodeHtmlEntities(code);
		const highlighted = highlighter.codeToHtml(decoded, {
			lang: 'plaintext',
			themes: { light: 'github-light', dark: 'github-dark' },
			defaultColor: false,
		});
		return wrapCodeBlock(highlighted, 'code', decoded, o);
	});

	// Wrap tables with a copy container
	html = html.replace(/<table>([\s\S]*?)<\/table>/g, (_match, inner: string) => {
		const tableHtml = `<table>${inner}</table>`;
		return `<div class="md-table-wrap"><div class="md-table-header"><span class="md-table-label">Table</span><button class="md-table-copy" data-table>Copy</button></div><div class="md-table-body">${tableHtml}</div></div>`;
	});

	return html;
}

function wrapCodeBlock(
	highlighted: string,
	lang: string,
	rawCode: string,
	opts: Required<RenderOptions>
): string {
	const lineCount = rawCode.split('\n').length;
	const shouldAutoCollapse = opts.autoCollapse && lineCount > opts.collapseLines;
	const escapedCode = rawCode
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');

	// The "Generating" loader pill appears via CSS pseudo-elements when an
	// ancestor carries .streaming-active AND this block is .md-collapsed.
	// chat-view.svelte adds the class to the in-flight assistant message
	// wrapper so we don't have to inject markup that depends on a stale
	// streaming flag captured at render time. See markdown-renderer.svelte.
	return `<div class="md-code-wrap${shouldAutoCollapse ? ' md-collapsed' : ''}">
<div class="md-code-header">
<span class="md-code-lang">${lang}</span>
<div class="md-code-actions">
<button class="md-code-toggle" data-toggle>${shouldAutoCollapse ? '&#9654; Expand' : '&#9660; Collapse'}</button>
<button class="md-code-copy" data-copy data-code="${escapedCode}">Copy</button>
</div>
</div>
<div class="md-code-body">${highlighted}</div>
</div>`;
}

function decodeHtmlEntities(text: string): string {
	return text
		.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
		.replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");
}
