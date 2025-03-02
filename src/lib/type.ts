const type = (s: unknown) => Object.prototype.toString.call(s).slice(8, -1).toLowerCase();

const types = ['String', 'Array', 'Undefined', 'Boolean', 'Number', 'Function', 'Symbol', 'Object'];

export const isFunction = (v: unknown): v is CallableFunction => type(v) === 'function';

export const isString = (v: unknown): v is string => type(v) === 'string';

export const isRegExp = (v: unknown): v is RegExp => type(v) === 'regexp';

export const typeFns = types.reduce<Record<string, (v: unknown) => boolean>>((acc, str) => {
  acc['is' + str] = (val: unknown) => type(val) === str.toLowerCase();
  return acc;
}, {});
