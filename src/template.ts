/**
 * The expression language behind `${...}` in export templates.
 *
 * Templates used to be handed to the `Function` constructor, which made every
 * one of them arbitrary JavaScript running with the plugin's privileges — a
 * template pasted from a forum could read the vault or spawn a process. This
 * evaluates the same shapes without an engine: variables, member access,
 * strings, template literals, `!`, comparison, `&&`/`||`/`??` and `? :`.
 *
 * Nothing here calls anything. There is no syntax for a call, so no expression
 * can reach a method, a constructor or a global.
 */

type Node =
  | { k: 'lit'; v: unknown }
  | { k: 'id'; name: string }
  | { k: 'member'; obj: Node; prop: Node }
  | { k: 'tpl'; parts: Array<string | Node> }
  | { k: 'cond'; test: Node; yes: Node; no: Node }
  | { k: 'bin'; op: string; l: Node; r: Node }
  | { k: 'not'; arg: Node };

/** Thrown for syntax the old `Function` engine accepted and this one will not. */
export class TemplateError extends Error {}

// Reaching these off any value is how a sandbox is escaped, so they resolve to
// nothing rather than to the prototype chain.
const BLOCKED = new Set(['__proto__', 'constructor', 'prototype']);

const KEYWORDS: Record<string, unknown> = {
  true: true,
  false: false,
  null: null,
  undefined: undefined,
};

const isIdStart = (c: string) => /[A-Za-z_$]/.test(c);
const isIdPart = (c: string) => /[A-Za-z0-9_$]/.test(c);

class Parser {
  private i = 0;

  constructor(private readonly src: string) {}

  /** Parses the whole source as one expression, rejecting anything left over. */
  parse(): Node {
    const node = this.conditional();
    this.ws();
    if (this.i < this.src.length) {
      throw new TemplateError(`unexpected ${JSON.stringify(this.src[this.i])}`);
    }
    return node;
  }

  private ws() {
    while (this.i < this.src.length && /\s/.test(this.src[this.i])) {
      this.i++;
    }
  }

  private eat(op: string): boolean {
    this.ws();
    if (this.src.startsWith(op, this.i)) {
      // `??` must not match the `?` of a conditional, and `!` must not eat `!=`.
      this.i += op.length;
      return true;
    }
    return false;
  }

  private peek(op: string): boolean {
    this.ws();
    return this.src.startsWith(op, this.i);
  }

  private conditional(): Node {
    const test = this.nullish();
    if (!this.peek('??') && this.eat('?')) {
      const yes = this.conditional();
      if (!this.eat(':')) {
        throw new TemplateError('expected ":" in "? :"');
      }
      return { k: 'cond', test, yes, no: this.conditional() };
    }
    return test;
  }

  private nullish(): Node {
    let l = this.or();
    while (this.eat('??')) {
      l = { k: 'bin', op: '??', l, r: this.or() };
    }
    return l;
  }

  private or(): Node {
    let l = this.and();
    while (this.eat('||')) {
      l = { k: 'bin', op: '||', l, r: this.and() };
    }
    return l;
  }

  private and(): Node {
    let l = this.equality();
    while (this.eat('&&')) {
      l = { k: 'bin', op: '&&', l, r: this.equality() };
    }
    return l;
  }

  private equality(): Node {
    let l = this.unary();
    for (;;) {
      const op = ['===', '!==', '==', '!='].find(o => this.peek(o));
      if (!op) {
        return l;
      }
      this.eat(op);
      l = { k: 'bin', op, l, r: this.unary() };
    }
  }

  private unary(): Node {
    if (!this.peek('!=') && this.eat('!')) {
      return { k: 'not', arg: this.unary() };
    }
    return this.member();
  }

  private member(): Node {
    let obj = this.primary();
    for (;;) {
      if (this.peek('.')) {
        this.eat('.');
        this.ws();
        const start = this.i;
        while (this.i < this.src.length && isIdPart(this.src[this.i])) {
          this.i++;
        }
        if (start === this.i) {
          throw new TemplateError('expected a name after "."');
        }
        obj = { k: 'member', obj, prop: { k: 'lit', v: this.src.slice(start, this.i) } };
      } else if (this.peek('[')) {
        this.eat('[');
        const prop = this.conditional();
        if (!this.eat(']')) {
          throw new TemplateError('expected "]"');
        }
        obj = { k: 'member', obj, prop };
      } else if (this.peek('(')) {
        throw new TemplateError('calls are not allowed in a template');
      } else {
        return obj;
      }
    }
  }

  private primary(): Node {
    this.ws();
    if (this.i >= this.src.length) {
      throw new TemplateError('expression ended early');
    }

    const c = this.src[this.i];

    if (c === '(') {
      this.i++;
      const node = this.conditional();
      if (!this.eat(')')) {
        throw new TemplateError('expected ")"');
      }
      return node;
    }

    if (c === '`') {
      return this.template();
    }

    if (c === '"' || c === "'") {
      return { k: 'lit', v: this.quoted(c) };
    }

    if (/[0-9]/.test(c)) {
      const start = this.i;
      while (this.i < this.src.length && /[0-9.]/.test(this.src[this.i])) {
        this.i++;
      }
      return { k: 'lit', v: Number(this.src.slice(start, this.i)) };
    }

    if (isIdStart(c)) {
      const start = this.i;
      while (this.i < this.src.length && isIdPart(this.src[this.i])) {
        this.i++;
      }
      const name = this.src.slice(start, this.i);
      return name in KEYWORDS ? { k: 'lit', v: KEYWORDS[name] } : { k: 'id', name };
    }

    throw new TemplateError(`unexpected ${JSON.stringify(c)}`);
  }

  /** A `'...'` or `"..."` string, with the escapes JS gives those. */
  private quoted(quote: string): string {
    this.i++;
    let out = '';
    while (this.i < this.src.length && this.src[this.i] !== quote) {
      if (this.src[this.i] === '\\') {
        this.i++;
        out += unescape_(this.src[this.i] ?? '');
      } else {
        out += this.src[this.i];
      }
      this.i++;
    }
    if (this.i >= this.src.length) {
      throw new TemplateError('unterminated string');
    }
    this.i++;
    return out;
  }

  /** A nested `` `...${...}...` ``, which is how the shipped templates branch. */
  private template(): Node {
    this.i++;
    const parts: Array<string | Node> = [];
    let text = '';
    while (this.i < this.src.length && this.src[this.i] !== '`') {
      if (this.src[this.i] === '\\') {
        this.i++;
        text += unescape_(this.src[this.i] ?? '');
        this.i++;
      } else if (this.src.startsWith('${', this.i)) {
        parts.push(text);
        text = '';
        this.i += 2;
        parts.push(this.conditional());
        if (!this.eat('}')) {
          throw new TemplateError('expected "}"');
        }
      } else {
        text += this.src[this.i];
        this.i++;
      }
    }
    if (this.i >= this.src.length) {
      throw new TemplateError('unterminated template literal');
    }
    this.i++;
    parts.push(text);
    return { k: 'tpl', parts };
  }
}

const unescape_ = (c: string): string => ({ n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', '0': '\0' })[c] ?? c;

/**
 * What a name stands for. A name nothing supplies becomes the text that asked
 * for it, so an unknown `${user}` survives as `${user}` rather than as
 * `undefined` — and a branch testing it still sees something falsy-ish to
 * reject by way of its members.
 */
const lookup = (name: string, variables: Record<string, unknown>): unknown => {
  // `hasOwn` is ES2022 and the target is ES2021; the call form also survives a
  // variables object that happens to carry a key named `hasOwnProperty`.
  if (Object.prototype.hasOwnProperty.call(variables, name)) {
    return variables[name];
  }
  const lower = name.toLowerCase();
  const match = Object.keys(variables).find(k => k.toLowerCase() === lower);
  return match === undefined ? '${' + name + '}' : variables[match];
};

const evaluate = (node: Node, variables: Record<string, unknown>): unknown => {
  switch (node.k) {
    case 'lit':
      return node.v;
    case 'id':
      return lookup(node.name, variables);
    case 'not':
      return !evaluate(node.arg, variables);
    case 'tpl':
      return node.parts.map(p => (typeof p === 'string' ? p : stringify(evaluate(p, variables)))).join('');
    case 'cond':
      return evaluate(node.test, variables) ? evaluate(node.yes, variables) : evaluate(node.no, variables);
    case 'member': {
      const obj = evaluate(node.obj, variables);
      if (obj === null || obj === undefined) {
        return undefined;
      }
      const prop = propertyName(evaluate(node.prop, variables));
      if (prop === undefined || BLOCKED.has(prop)) {
        return undefined;
      }
      const value = (obj as Record<string, unknown>)[prop];
      // Only data crosses out. A method reached off a string or an array would
      // still need a call to do anything, and there is no call — but handing one
      // back would let it be stringified into a command.
      return typeof value === 'function' ? undefined : value;
    }
    case 'bin': {
      const l = evaluate(node.l, variables);
      switch (node.op) {
        case '??':
          return l ?? evaluate(node.r, variables);
        case '||':
          return l || evaluate(node.r, variables);
        case '&&':
          return l && evaluate(node.r, variables);
      }
      const r = evaluate(node.r, variables);
      switch (node.op) {
        case '===':
          return l === r;
        case '!==':
          return l !== r;
        // Kept loose on purpose: a metadata value is text, and `${n == 1}`
        // reading true against the number 1 is what a template writer means.
        case '==':
          return l == r;
        default:
          return l != r;
      }
    }
  }
};

/** The name `obj[...]` reaches for, or nothing where the key is not a name. */
const propertyName = (v: unknown): string | undefined => {
  if (typeof v === 'string') {
    return v;
  }
  return typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint' ? v.toString() : undefined;
};

/** What a value reads as on a command line, as a template literal would write it. */
const stringify = (v: unknown): string => {
  if (typeof v === 'string') {
    return v;
  }
  if (v === null || v === undefined) {
    return v === null ? 'null' : 'undefined';
  }
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') {
    return v.toString();
  }
  // Neither has text worth putting in a command, and a method must not be one
  // stringified argument away from being read back as anything.
  if (typeof v === 'function' || typeof v === 'symbol') {
    return '';
  }
  // `${embedDirs}` and the rest of the list-valued variables lean on this.
  if (Array.isArray(v)) {
    return v.map(stringify).join(',');
  }
  return Object.prototype.toString.call(v);
};

/** Finds the `}` closing a `${`, seeing past the strings and templates between. */
const closingBrace = (src: string, from: number): number => {
  let depth = 1;
  let i = from;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      i = skipString(src, i, c);
      continue;
    }
    if (c === '{') {
      depth++;
    } else if (c === '}') {
      if (--depth === 0) {
        return i;
      }
    }
    i++;
  }
  return -1;
};

/** Past the string starting at `i`, including any `${...}` a template nests. */
const skipString = (src: string, i: number, quote: string): number => {
  i++;
  while (i < src.length && src[i] !== quote) {
    if (src[i] === '\\') {
      i += 2;
      continue;
    }
    if (quote === '`' && src.startsWith('${', i)) {
      const end = closingBrace(src, i + 2);
      if (end < 0) {
        return src.length;
      }
      i = end + 1;
      continue;
    }
    i++;
  }
  return i + 1;
};

/**
 * `renderTemplate('Hi, ${name}', { name: 'John' })` returns `'Hi, John'`.
 *
 * Text outside `${...}` is copied through exactly as written — backslashes and
 * backticks included, which the old engine could not promise, since it had to
 * re-read the whole template as JavaScript source.
 */
export function renderTemplate(template: string, variables: Record<string, unknown> = {}): string {
  let out = '';
  let i = 0;

  while (i < template.length) {
    const start = template.indexOf('${', i);
    if (start < 0) {
      return out + template.slice(i);
    }
    out += template.slice(i, start);

    const end = closingBrace(template, start + 2);
    if (end < 0) {
      // No closing brace: nothing to render, so the text stands as written.
      return out + template.slice(start);
    }

    const source = template.slice(start + 2, end);
    out += stringify(evaluate(new Parser(source).parse(), variables));
    i = end + 1;
  }

  return out;
}
