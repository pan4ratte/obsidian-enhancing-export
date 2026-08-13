import { renderTemplate, TemplateError } from '../../src/system/utils';

describe('substitution', () => {
  test('names, dotted paths and bracket access', () => {
    expect(renderTemplate('${a}/${b.c}/${b["d"]}', { a: '1', b: { c: '2', d: '3' } })).toBe('1/2/3');
  });

  test('a name is matched without regard to case', () => {
    expect(renderTemplate('${home}', { HOME: '/root' })).toBe('/root');
  });

  test('an exact name is preferred to one differing in case', () => {
    expect(renderTemplate('${Path}', { path: 'lower', Path: 'exact' })).toBe('exact');
  });

  test('a name nothing supplies survives as the text that asked for it', () => {
    expect(renderTemplate('Hi ${user}', {})).toBe('Hi ${user}');
  });

  test('a member of a missing name is falsy rather than an error', () => {
    expect(renderTemplate('${ options.textemplate ? `t` : `-` }', {})).toBe('-');
  });

  test('values keep the stringification a template literal gave them', () => {
    expect(renderTemplate('${n}|${z}|${arr}', { n: 0, z: null, arr: ['a', 'b'] })).toBe('0|null|a,b');
  });
});

describe('expressions', () => {
  test('ternary with nested template literals, both ways', () => {
    const tpl = 'pandoc ${ options.textemplate ? `--template="${options.textemplate}"` : `` }';
    expect(renderTemplate(tpl, { options: { textemplate: 'diss.tex' } })).toBe('pandoc --template="diss.tex"');
    expect(renderTemplate(tpl, { options: { textemplate: null } })).toBe('pandoc ');
  });

  test('?? falls through only on null and undefined', () => {
    expect(renderTemplate('${a ?? "fallback"}', { a: null })).toBe('fallback');
    expect(renderTemplate('${a ?? "fallback"}', { a: '' })).toBe('');
  });

  test('|| && and !', () => {
    expect(renderTemplate('${a || "x"}', { a: '' })).toBe('x');
    expect(renderTemplate('${a && "y"}', { a: '1' })).toBe('y');
    expect(renderTemplate('${!a}', { a: '' })).toBe('true');
  });

  test('comparison', () => {
    expect(renderTemplate('${fmt === "pdf" ? "yes" : "no"}', { fmt: 'pdf' })).toBe('yes');
    expect(renderTemplate('${fmt !== "pdf" ? "yes" : "no"}', { fmt: 'pdf' })).toBe('no');
  });

  test('parentheses group', () => {
    expect(renderTemplate('${(a || b) ? "1" : "0"}', { a: '', b: 'set' })).toBe('1');
  });
});

describe('text is copied through exactly', () => {
  test('backslashes are not escapes', () => {
    expect(renderTemplate('C:\\Users\\${who}', { who: 'Admin' })).toBe('C:\\Users\\Admin');
  });

  test('a stray backtick is text, not a literal', () => {
    expect(renderTemplate('a ` b ${x}', { x: '1' })).toBe('a ` b 1');
  });

  test('an unclosed ${ stands as written', () => {
    expect(renderTemplate('tail ${oops', {})).toBe('tail ${oops');
  });
});

describe('no code runs', () => {
  test('a call is refused outright', () => {
    expect(() => renderTemplate('${x.toUpperCase()}', { x: 'a' })).toThrow(TemplateError);
    expect(() => renderTemplate('${x()}', { x: 'a' })).toThrow(TemplateError);
  });

  test('the prototype chain is not reachable', () => {
    expect(renderTemplate('${x.constructor}', { x: 'a' })).toBe('undefined');
    expect(renderTemplate('${x.__proto__}', { x: 'a' })).toBe('undefined');
    expect(renderTemplate('${x["constructor"]}', { x: 'a' })).toBe('undefined');
  });

  test('a method is data that never crosses out', () => {
    expect(renderTemplate('${x.toUpperCase}', { x: 'a' })).toBe('undefined');
  });

  test('globals are just unknown names', () => {
    expect(renderTemplate('${process}', {})).toBe('${process}');
    expect(renderTemplate('${globalThis}', {})).toBe('${globalThis}');
    expect(renderTemplate('${require}', {})).toBe('${require}');
  });

  test('assignment is not syntax here', () => {
    expect(() => renderTemplate('${x = 1}', { x: 'a' })).toThrow(TemplateError);
  });

  test('a template cannot reach the variables object itself', () => {
    const vars = { x: 'a' };
    expect(renderTemplate('${x.constructor.constructor}', vars)).toBe('undefined');
  });

  // The payload the old engine would have run: `Function` reached off any value,
  // then called to hand back a global. Both halves of it are refused now.
  test('the classic escape is refused, not evaluated', () => {
    expect(() => renderTemplate('${x.constructor.constructor("return process")()}', { x: 'a' })).toThrow(TemplateError);
  });

  test('a payload smuggled in through a variable is never read as syntax', () => {
    expect(renderTemplate('${x}', { x: '${y.constructor.constructor("return process")()}' })).toBe(
      '${y.constructor.constructor("return process")()}'
    );
  });
});
