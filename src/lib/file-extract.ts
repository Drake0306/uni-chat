// Client-side file → text extraction. Used by the composer to turn PDFs and
// text/code files into plain text we can embed in the user's message before
// it goes to the LLM. Goal: file uploads work on every model uniformly,
// without needing per-provider native PDF/vision plumbing for the common
// case. Native PDF / vision can still be added on top later for layout-
// preserving sends on capable models.
//
// PDF.js (pdfjs-dist) is lazy-loaded on first PDF — adds ~300 KB gzipped to
// the bundle, but only when the user actually attaches one. Text files use
// the built-in File.text() API, no library needed.

import type { TextAttachment } from './types.js';

// Per-file soft cap on the source bytes. Keeps PDF.js parsing snappy and
// the eventual base64 payload (when we wire native PDF) within provider
// request-size limits.
export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
// Cumulative cap on source bytes across all files attached to a single
// message. Without this a user could pin 10 × 25 MB into one LLM call.
export const MAX_TOTAL_BYTES = 50 * 1024 * 1024; // 50 MB
// Cap on the EXTRACTED text length per file. A 25 MB code repo dumps to
// 25 MB of context; a 25 MB PDF often dumps to <100 KB. Source-byte caps
// don't catch the worst case for plain-text attachments. Roughly 125K
// tokens at 4 chars/token — already larger than most production context
// windows, so anything beyond is almost certainly a mistake.
export const MAX_EXTRACTED_CHARS_PER_FILE = 500_000;

// Code / config / data extensions we treat as plain text. Browser-reported
// MIME types are unreliable for source code (a .py file often comes through
// as application/octet-stream or empty), so we extension-match first.
const TEXT_EXTENSIONS = new Set([
	// Documents / markdown
	'txt', 'md', 'markdown', 'rst', 'log',
	// Data / config
	'json', 'jsonc', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'env',
	'csv', 'tsv', 'xml', 'html', 'htm', 'svg',
	// Web
	'css', 'scss', 'sass', 'less',
	// Scripting / systems
	'py', 'pyw', 'rb', 'php', 'pl', 'lua', 'r',
	'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'vue', 'svelte', 'astro',
	'go', 'rs', 'c', 'h', 'cpp', 'cc', 'cxx', 'hpp', 'hh', 'hxx',
	'java', 'kt', 'kts', 'scala', 'groovy', 'gradle',
	'swift', 'm', 'mm',
	'cs', 'fs', 'vb',
	'dart', 'ex', 'exs', 'erl', 'hrl', 'clj', 'cljs', 'cljc',
	'elm', 'hs', 'lhs', 'ml', 'mli',
	'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd',
	'sql', 'graphql', 'gql', 'proto',
	'dockerfile', 'makefile', 'cmake', 'mk',
	'tf', 'hcl', 'nix',
]);

// File names without extensions that are commonly source files.
const TEXT_FILENAMES = new Set([
	'dockerfile', 'makefile', 'rakefile', 'gemfile', 'procfile',
	'.gitignore', '.gitattributes', '.editorconfig', '.npmrc', '.nvmrc',
	'license', 'readme', 'changelog', 'authors',
]);

// Image formats accepted on vision-capable models. Kept in lockstep with
// the bucket's allowed_mime_types in migration 20260429180000_chat_attachments_storage.sql.
export const IMAGE_MIME_TYPES = [
	'image/png',
	'image/jpeg',
	'image/jpg',
	'image/webp',
	'image/gif',
	'image/heic',
	'image/heif',
];

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic', 'heif']);

export function isImageFile(file: File): boolean {
	if (file.type.startsWith('image/')) return true;
	const ext = getExtension(file.name);
	return IMAGE_EXTENSIONS.has(ext);
}

export type ExtractedFile = {
	name: string;
	mimeType: string;
	pageCount?: number; // PDFs only
	text: string;
	// Best-effort language hint for fenced code-block rendering — picked from
	// the extension. "" for prose/PDF/unknown.
	language: string;
};

// Single source of truth for the file picker's `accept` attribute. Generated
// from TEXT_EXTENSIONS + PDF + the text/* MIME catch-all (always allowed)
// plus images on vision-capable models. Adding an extension to the relevant
// set automatically updates the picker.
const TEXT_ACCEPT_PARTS = [
	'application/pdf',
	'text/*',
	...[...TEXT_EXTENSIONS].map((ext) => `.${ext}`),
	'.pdf',
];
const IMAGE_ACCEPT_PARTS = [...IMAGE_MIME_TYPES, ...[...IMAGE_EXTENSIONS].map((ext) => `.${ext}`)];

/**
 * Builds the `accept=` string for the file picker. Pass `supportsVision: true`
 * when the active model has `capabilities.vision === true` so the OS dialog
 * filter includes images; otherwise images are excluded and the runtime
 * checker also rejects them in handleFileSelect.
 */
export function getAttachmentAccept(supportsVision: boolean): string {
	return (supportsVision ? [...TEXT_ACCEPT_PARTS, ...IMAGE_ACCEPT_PARTS] : TEXT_ACCEPT_PARTS).join(',');
}

function getExtension(filename: string): string {
	const dot = filename.lastIndexOf('.');
	if (dot < 0) return '';
	return filename.slice(dot + 1).toLowerCase();
}

function isPdf(file: File): boolean {
	if (file.type === 'application/pdf') return true;
	return getExtension(file.name) === 'pdf';
}

function isTextFile(file: File): boolean {
	if (file.type.startsWith('text/')) return true;
	const ext = getExtension(file.name);
	if (ext && TEXT_EXTENSIONS.has(ext)) return true;
	const nameLc = file.name.toLowerCase();
	if (TEXT_FILENAMES.has(nameLc)) return true;
	return false;
}

export function isSupportedFile(file: File): boolean {
	return isPdf(file) || isTextFile(file);
}

// Best-effort language hint for fenced markdown — keeps syntax highlighting
// in the rendered message. Falls back to plaintext for prose / unknown.
// Kept in lockstep with TEXT_EXTENSIONS so accepted files don't render as
// plaintext when a more specific grammar is available.
function languageForExtension(ext: string): string {
	const map: Record<string, string> = {
		py: 'python', pyw: 'python',
		ts: 'typescript', tsx: 'tsx', mts: 'typescript', cts: 'typescript',
		js: 'javascript', jsx: 'jsx', mjs: 'javascript', cjs: 'javascript',
		vue: 'vue', svelte: 'svelte', astro: 'astro',
		rb: 'ruby', php: 'php', go: 'go', rs: 'rust',
		c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp', hh: 'cpp', hxx: 'cpp',
		java: 'java', kt: 'kotlin', kts: 'kotlin', scala: 'scala', groovy: 'groovy', gradle: 'groovy',
		swift: 'swift', dart: 'dart',
		cs: 'csharp', fs: 'fsharp', vb: 'vb',
		ex: 'elixir', exs: 'elixir', erl: 'erlang', hrl: 'erlang',
		clj: 'clojure', cljs: 'clojure', cljc: 'clojure',
		elm: 'elm', hs: 'haskell', lhs: 'haskell',
		ml: 'ocaml', mli: 'ocaml',
		lua: 'lua', r: 'r', pl: 'perl',
		sh: 'bash', bash: 'bash', zsh: 'bash', fish: 'bash',
		ps1: 'powershell', bat: 'bat', cmd: 'bat',
		json: 'json', jsonc: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml',
		xml: 'xml', html: 'html', htm: 'html', svg: 'xml',
		css: 'css', scss: 'scss', sass: 'sass', less: 'less',
		sql: 'sql', graphql: 'graphql', gql: 'graphql', proto: 'protobuf',
		md: 'markdown', markdown: 'markdown',
		dockerfile: 'dockerfile', makefile: 'makefile', cmake: 'cmake', mk: 'makefile',
		csv: 'csv', tsv: 'csv',
		tf: 'hcl', hcl: 'hcl', nix: 'nix',
	};
	return map[ext] ?? '';
}

// Lazy-loaded PDF.js — only paid for when a user attaches a PDF.
let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;
function loadPdfjs() {
	if (!pdfjsPromise) {
		pdfjsPromise = import('pdfjs-dist')
			.then(async (mod) => {
				// Worker setup. PDF.js needs its worker URL configured; using
				// the .mjs bundled with the package keeps this self-contained.
				const workerUrl = (await import('pdfjs-dist/build/pdf.worker.mjs?url'))
					.default;
				mod.GlobalWorkerOptions.workerSrc = workerUrl;
				return mod;
			})
			.catch((err) => {
				// Don't cache the rejected promise — without this, a transient
				// network failure on the first attach poisons the cache and
				// every subsequent attach fails the same way until reload.
				pdfjsPromise = null;
				throw err;
			});
	}
	return pdfjsPromise;
}

async function extractPdfText(file: File): Promise<{ text: string; pageCount: number }> {
	const pdfjs = await loadPdfjs();
	const buf = await file.arrayBuffer();
	let doc: import('pdfjs-dist').PDFDocumentProxy;
	try {
		doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
	} catch (err) {
		// Surface password-protected PDFs with an actionable message instead of
		// PDF.js's raw "No password given" / PasswordException string.
		const name = err instanceof Error ? err.name : '';
		if (name === 'PasswordException') {
			throw new Error(
				`${file.name} is password-protected — remove the password and try again.`
			);
		}
		throw err;
	}
	try {
		const pageCount = doc.numPages;
		const pages: string[] = [];
		for (let i = 1; i <= pageCount; i++) {
			const page = await doc.getPage(i);
			const textContent = await page.getTextContent();
			// Items can be TextItem (has .str + .hasEOL) or TextMarkedContent.
			// PDF.js sets hasEOL on items that end a logical text line; using it
			// preserves line breaks (and therefore code blocks, tables, lists)
			// instead of collapsing the whole page to one space-separated line.
			let pageText = '';
			for (const it of textContent.items) {
				if ('str' in it) {
					pageText += it.str;
					if ('hasEOL' in it && it.hasEOL) pageText += '\n';
					else pageText += ' ';
				}
			}
			pages.push(pageText.replace(/[ \t]+\n/g, '\n').trim());
		}
		return { text: pages.join('\n\n'), pageCount };
	} finally {
		// Release PDF.js's per-document memory deterministically instead of
		// waiting for GC. Important when the user attaches several large PDFs
		// or sends a long sequence of file-bearing messages.
		await doc.destroy();
	}
}

// Average chars per page below which we assume the PDF is mostly scans /
// images (and the LLM should hear about it). PDF.js extracts very little
// from image-only pages, so the embedded text would be near-useless.
const SCANNED_PDF_MIN_CHARS_PER_PAGE = 40;

export function looksLikeScannedPdf(file: ExtractedFile): boolean {
	if (!file.pageCount || file.pageCount === 0) return false;
	return file.text.length / file.pageCount < SCANNED_PDF_MIN_CHARS_PER_PAGE;
}

function enforceExtractedSize(name: string, text: string): void {
	if (text.length > MAX_EXTRACTED_CHARS_PER_FILE) {
		const k = (n: number) => Math.round(n / 1000).toLocaleString() + 'K';
		throw new Error(
			`${name} extracted ${k(text.length)} characters; per-file limit is ${k(MAX_EXTRACTED_CHARS_PER_FILE)}. Try a smaller file or split it.`
		);
	}
}

export async function extractFile(file: File): Promise<ExtractedFile> {
	if (file.size > MAX_FILE_BYTES) {
		const mb = (file.size / 1024 / 1024).toFixed(1);
		const limit = (MAX_FILE_BYTES / 1024 / 1024).toFixed(0);
		throw new Error(`${file.name} is too large (${mb} MB). Limit is ${limit} MB per file.`);
	}
	if (isPdf(file)) {
		const { text, pageCount } = await extractPdfText(file);
		enforceExtractedSize(file.name, text);
		return {
			name: file.name,
			mimeType: 'application/pdf',
			pageCount,
			text,
			language: '',
		};
	}
	if (isTextFile(file)) {
		// Strip leading UTF-8 BOM. Browsers report it as part of file.text();
		// keeping it would let it leak into JSON parsers downstream and
		// produce visible artifacts at the top of fenced blocks.
		const text = (await file.text()).replace(/^﻿/, '');
		enforceExtractedSize(file.name, text);
		const ext = getExtension(file.name);
		return {
			name: file.name,
			mimeType: file.type || 'text/plain',
			text,
			language: languageForExtension(ext),
		};
	}
	throw new Error(`Unsupported file type: ${file.name}`);
}

// Returns a backtick fence long enough to wrap `text` without colliding
// with any backtick run inside it. Without this, attaching a markdown file
// (or any source file with embedded code samples) would let the inner
// fence escape — the LLM and the renderer would both lose track of where
// the attachment begins and ends. Standard CommonMark trick: outer fence
// must have one MORE backtick than the longest run inside.
function safeFence(text: string): string {
	let max = 0;
	let run = 0;
	for (let i = 0; i < text.length; i++) {
		if (text.charCodeAt(i) === 96 /* ` */) {
			run++;
			if (run > max) max = run;
		} else {
			run = 0;
		}
	}
	return '`'.repeat(Math.max(3, max + 1));
}

// Detects messages whose `content` was assembled by an older composer (typed
// text + embedded "📎 **filename** (...)\n```...```" fenced blocks) and
// splits them back into the current { content, attachments } shape so legacy
// chats render with chips instead of dumping the raw fenced text.
//
// Pure read-time parse — never writes to the DB. If a message was stored
// after the attachments-column migration its `attachments` will already be
// populated and we never get called for it. If parsing fails for any reason
// we return null and the caller falls back to displaying the raw content
// (no regression vs. the previous behavior).
//
// Format being matched:
//   {typed text}\n\n📎 **filename.pdf** (5 pages, extracted text)\n
//   ```python\n
//   {body}\n
//   ```
//   (\n\n📎 **next.txt** ... repeats)
//
// The fence length is dynamic (`safeFence` in this same file used 3+
// backticks depending on the body), so the regex captures the opening
// fence and back-references it for the close.
export function parseLegacyAttachments(
	content: string
): { content: string; attachments: TextAttachment[] } | null {
	const firstMarker = content.indexOf('\n\n📎 **');
	if (firstMarker < 0) return null;

	const typed = content.slice(0, firstMarker);
	let rest = content.slice(firstMarker);
	const attachments: TextAttachment[] = [];

	// Each iteration consumes one attachment block from the start of `rest`.
	// Lookahead intentionally absent: `safeFence` ensures the outer fence is
	// always longer than any backtick run inside `f.text`, so the closing
	// fence is unambiguous via the `\3` back-reference. Earlier versions
	// required `(?=\n\n📎|\s*$)` which mis-rejected legacy messages whose
	// final block was followed by trailing prose ("…```\nthanks!").
	const blockRe = /^\n\n📎 \*\*(.+?)\*\*(?: \((\d+) pages?, extracted text\))?\n(`{3,})[^\n]*\n([\s\S]*?)\n\3/;
	while (rest.startsWith('\n\n📎 **')) {
		const m = blockRe.exec(rest);
		if (!m) break;
		const [whole, name, pageCountStr, , text] = m;
		attachments.push({
			kind: 'text',
			name,
			mimeType: name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'text/plain',
			...(pageCountStr ? { pageCount: parseInt(pageCountStr, 10) } : {}),
			text,
		});
		rest = rest.slice(whole.length);
	}

	if (attachments.length === 0) return null;
	return { content: typed, attachments };
}

// Build the markdown chunk that gets appended to the user's typed message
// before sending. Each file becomes a labeled fenced code block — keeps the
// LLM context clear about what's typed vs what's attached, and shiki syntax-
// highlights code files for the user too.
//
// Accepts either ExtractedFile (from extractFile) or the persisted Attachment
// shape (from types.ts) — both carry { name, text, pageCount? }, plus an
// optional language hint on ExtractedFile that we look up from the filename
// when missing so old persisted attachments still get syntax highlighting.
type AttachmentLike = {
	name: string;
	text: string;
	pageCount?: number;
	language?: string;
};

export function attachmentsToMarkdown(files: AttachmentLike[]): string {
	if (files.length === 0) return '';
	return files
		.map((f) => {
			const header = f.pageCount
				? `📎 **${f.name}** (${f.pageCount} page${f.pageCount === 1 ? '' : 's'}, extracted text)`
				: `📎 **${f.name}**`;
			const fence = safeFence(f.text);
			const lang = f.language ?? languageForExtension(getExtension(f.name));
			return `${header}\n${fence}${lang}\n${f.text}\n${fence}`;
		})
		.join('\n\n');
}
