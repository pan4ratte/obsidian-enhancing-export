import type { ExportSetting } from './settings';

/*
 * Variables
 * - ${attachmentFolderPath}  --> obsidian' settings.
 *
 *   /User/aaa/Documents/test.pdf
 * - ${outputDir}             --> /User/aaa/Documents/
 * - ${outputPath}            --> /User/aaa/Documents/test.pdf
 * - ${outputFileName}        --> test
 * - ${outputFileFullName}    --> test.pdf
 *
 *   /User/aaa/Documents/test.pdf
 * - ${currentDir}            --> /User/aaa/Documents/
 * - ${currentPath}           --> /User/aaa/Documents/test.pdf
 * - ${currentFileName}       --> test
 * - ${CurrentFileFullName}   --> test.pdf
 */

/*
 * Two things every template that carries images says, and one every template
 * that renders a note for reading says.
 *
 * `${embedDirs}` is the folder of every file the note embeds, which is the only
 * one of the three that follows the vault: Obsidian will keep a note's
 * attachments in a folder of their own beside it, and neither the note's folder
 * nor the vault-wide attachment folder is then where the image is. It is written
 * conditionally because a note that embeds nothing would otherwise hand pandoc
 * an empty path.
 *
 * The extension is the piece of Obsidian's markdown that pandoc's reader leaves
 * off and that its writers can carry: `==highlighted==` text. Written as the
 * template editor's own *Markdown extensions* row writes it — the flag last in
 * the extra arguments, since pandoc takes the last `-f` it is given — so the row
 * opens with it ticked.
 *
 * `alerts` is deliberately not here, though the row still offers it. Pandoc
 * reads GitHub's callouts, which are spelled `> [!NOTE]`; Obsidian writes
 * `> [!note]`, and pandoc leaves that as the plain blockquote it was. Switching
 * it on would cost every user pandoc 3.2 and hand back nothing.
 */
const RESOURCE_PATHS = '--resource-path="${currentDir}" --resource-path="${attachmentFolderPath}"';
const EMBED_DIRS = '${ embedDirs ? `--resource-path="${embedDirs}"` : ` ` }';
const IMAGE_PATHS = `${RESOURCE_PATHS} ${EMBED_DIRS}`;
/**
 * Two things every template that renders a note for reading starts with.
 *
 * `![[Another note]]` is a transclusion — Obsidian shows that note's text in
 * place — and pandoc reads it as an image that is not there. The filter writes
 * the note in; the plugin resolves which note it is, since that is Obsidian's
 * to answer. It runs first, so everything below sees what it wrote in.
 *
 * A template that writes markdown is left out: an export from a vault to a
 * vault wants the embed left as the embed it is.
 */
const OBSIDIAN_SYNTAX = '--lua-filter="${luaDir}/embeds.lua" -f ${fromFormat}+mark';

/** Reassembles a `$$…$$` block the reader broke up over a LaTeX environment. */
const MATH_BLOCK = '--lua-filter="${luaDir}/math_block.lua"';

export default {
  'Markdown': {
    name: 'Markdown',
    type: 'pandoc',
    arguments: `-f \${fromFormat} ${RESOURCE_PATHS} --lua-filter="\${luaDir}/markdown.lua" -s -o "\${outputPath}" -t commonmark_x-attributes`,
    extension: '.md',
  },
  'Markdown (GFM)': {
    name: 'Markdown (GFM)',
    type: 'pandoc',
    arguments: `-f \${fromFormat} ${RESOURCE_PATHS} --lua-filter="\${luaDir}/markdown.lua" -s -o "\${outputPath}" -t gfm`,
    extension: '.md',
  },
  'Markdown (Hugo)': {
    name: 'Markdown (Hugo)',
    type: 'pandoc',
    arguments: `-f \${fromFormat} ${RESOURCE_PATHS} --lua-filter="\${luaDir}/markdown+hugo.lua" -s -o "\${outputPath}" -t commonmark_x-attributes`,
    extension: '.md',
  },
  'Html': {
    name: 'Html',
    type: 'pandoc',
    // `-V pagetitle` rather than `-M title`: the page needs a title, but a note
    // that gives itself one in its frontmatter has said what it is, and
    // `--metadata` would overrule it.
    arguments: `-f \${fromFormat} ${IMAGE_PATHS} ${MATH_BLOCK} --embed-resources --standalone -V pagetitle="\${currentFileName}" -s -o "\${outputPath}" -t html`,
    customArguments: `--mathjax="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg-full.js" ${OBSIDIAN_SYNTAX}`,
    extension: '.html',
  },
  'TextBundle': {
    name: 'TextBundle',
    type: 'pandoc',
    arguments: `-f \${fromFormat} ${RESOURCE_PATHS} --lua-filter="\${luaDir}/markdown.lua" -V media_dir="\${outputDir}/\${outputFileName}.textbundle/assets" -s -o "\${outputDir}/\${outputFileName}.textbundle/text.md" -t commonmark_x-attributes`,
    extension: '.md',
  },
  'Typst': {
    name: 'Typst',
    type: 'pandoc',
    arguments: `-f \${fromFormat} ${RESOURCE_PATHS} --lua-filter="\${luaDir}/markdown.lua" -s -o "\${outputPath}" -t typst`,
    customArguments: OBSIDIAN_SYNTAX,
    extension: '.typ',
  },
  'PDF': {
    name: 'PDF',
    type: 'pandoc',
    // `math_block` before `pdf`: the first puts a broken `$$…$$` back together,
    // the second is what the engine then needs made of it.
    arguments: `-f \${fromFormat} ${IMAGE_PATHS} ${MATH_BLOCK} --lua-filter="\${luaDir}/pdf.lua" \${ options.textemplate ? \`--resource-path="\${pluginDir}/textemplate" --template="\${options.textemplate}"\` : \` \` } -o "\${outputPath}" -t pdf`,
    // XeLaTeX rather than pdfLaTeX: pdfLaTeX cannot set a character it has no
    // 8-bit font for, so a note with Cyrillic, CJK or an emoji in it does not
    // export at all. XeLaTeX uses the system's own fonts.
    customArguments: `--pdf-engine=xelatex ${OBSIDIAN_SYNTAX}`,
    optionsMeta: {
      'textemplate': 'preset:textemplate', // reference from `PresetOptionsMeta` in `src/settings.ts`
    },
    extension: '.pdf',
  },
  'Beamer slides (.pdf)': {
    name: 'Beamer slides',
    type: 'pandoc',
    arguments: `-f \${fromFormat} ${IMAGE_PATHS} ${MATH_BLOCK} -s -o "\${outputPath}" -t beamer`,
    customArguments: `--pdf-engine=xelatex ${OBSIDIAN_SYNTAX}`,
    extension: '.pdf',
  },
  'Reveal.js slides (.html)': {
    name: 'Reveal.js slides',
    type: 'pandoc',
    // One file that opens in a browser. reveal.js itself is still fetched from
    // its CDN — `--embed-resources` carries the note's own images, not the
    // library laying them out.
    arguments: `-f \${fromFormat} ${IMAGE_PATHS} ${MATH_BLOCK} --embed-resources --standalone -s -o "\${outputPath}" -t revealjs`,
    customArguments: OBSIDIAN_SYNTAX,
    extension: '.html',
  },
  'Word (.docx)': {
    name: 'Word (.docx)',
    type: 'pandoc',
    arguments: `-f \${fromFormat} ${IMAGE_PATHS} ${MATH_BLOCK} -o "\${outputPath}" -t docx`,
    customArguments: OBSIDIAN_SYNTAX,
    extension: '.docx',
  },
  'OpenOffice': {
    name: 'OpenOffice',
    type: 'pandoc',
    arguments: `-f \${fromFormat} ${IMAGE_PATHS} ${MATH_BLOCK} -o "\${outputPath}" -t odt`,
    customArguments: OBSIDIAN_SYNTAX,
    extension: '.odt',
  },
  'RTF': {
    name: 'RTF',
    type: 'pandoc',
    arguments: `-f \${fromFormat} ${RESOURCE_PATHS} -s -o "\${outputPath}" -t rtf`,
    extension: '.rtf',
  },
  'Epub': {
    name: 'Epub',
    type: 'pandoc',
    arguments: `-f \${fromFormat} ${IMAGE_PATHS} ${MATH_BLOCK} -o "\${outputPath}" -t epub`,
    customArguments: OBSIDIAN_SYNTAX,
    extension: '.epub',
  },
  'Latex': {
    name: 'Latex',
    type: 'pandoc',
    arguments: `-f \${fromFormat} ${IMAGE_PATHS} \${ options.textemplate ? \`--resource-path="\${pluginDir}/textemplate" --template="\${options.textemplate}"\` : \` \` } --extract-media="\${outputDir}" -s -o "\${outputPath}" -t latex`,
    customArguments: OBSIDIAN_SYNTAX,
    optionsMeta: {
      'textemplate': 'preset:textemplate', // reference from `PresetOptionsMeta` in `src/settings.ts`
    },
    extension: '.tex',
  },
  'LaTeX fragment (.tex)': {
    name: 'LaTeX fragment',
    type: 'pandoc',
    // No `-s`: the body alone, for pasting into a document that already has a
    // preamble — an Overleaf project, a journal's class file.
    arguments: `-f \${fromFormat} ${IMAGE_PATHS} --extract-media="\${outputDir}" -o "\${outputPath}" -t latex`,
    customArguments: OBSIDIAN_SYNTAX,
    extension: '.tex',
  },
  'Media Wiki': {
    name: 'Media Wiki',
    type: 'pandoc',
    arguments: `-f \${fromFormat} ${RESOURCE_PATHS} -s -o "\${outputPath}" -t mediawiki`,
    extension: '.mediawiki',
  },
  'reStructuredText': {
    name: 'reStructuredText',
    type: 'pandoc',
    arguments: `-f \${fromFormat} ${RESOURCE_PATHS} -s -o "\${outputPath}" -t rst`,
    extension: '.rst',
  },
  'Textile': {
    name: 'Textile',
    type: 'pandoc',
    arguments: `-f \${fromFormat} ${RESOURCE_PATHS} -s -o "\${outputPath}" -t textile`,
    extension: '.textile',
  },
  'OPML': {
    name: 'OPML',
    type: 'pandoc',
    arguments: `-f \${fromFormat} ${RESOURCE_PATHS} -s -o "\${outputPath}" -t opml`,
    extension: '.opml',
  },
  'Plain text (.txt)': {
    name: 'Plain text',
    type: 'pandoc',
    arguments: `-f \${fromFormat} ${RESOURCE_PATHS} -s -o "\${outputPath}" -t plain`,
    customArguments: OBSIDIAN_SYNTAX,
    extension: '.txt',
  },
  'Bibliography (.bib)': {
    name: 'Bibliography',
    type: 'pandoc',
    // The note itself is not named here: `export.ts` puts `"${currentPath}"`
    // ahead of these arguments already, and naming it twice had pandoc read the
    // note twice.
    arguments: `-f \${fromFormat} ${RESOURCE_PATHS} --lua-filter="\${luaDir}/citefilter.lua" -o "\${outputPath}" --to=bibtex`,
    extension: '.bib',
  },
  'PowerPoint (.pptx)': {
    name: 'PowerPoint (.pptx)',
    type: 'pandoc',
    arguments: `-f \${fromFormat} ${IMAGE_PATHS} ${MATH_BLOCK} -o "\${outputPath}" -t pptx`,
    customArguments: OBSIDIAN_SYNTAX,
    extension: '.pptx',
  },
  'Custom': {
    name: 'Custom',
    type: 'custom',
    command: 'your command',
    targetFileExtensions: '.ext',
  },
} satisfies Record<string, ExportSetting> as Record<string, ExportSetting>;
