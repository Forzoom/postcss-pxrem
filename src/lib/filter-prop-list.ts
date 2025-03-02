export const exact = (list: string[]) => list.filter(m => m.match(/^[^*!]+$/));
export const contain = (list: string[]) => list.filter(m => m.match(/^\*.+\*$/)).map(m => m.substr(1, m.length - 2));
export const endWith = (list: string[]) => list.filter(m => m.match(/^\*[^*]+$/)).map(m => m.substr(1));
export const startWith = (list: string[]) =>
  list.filter(m => m.match(/^[^*!]+\*$/)).map(m => m.substr(0, m.length - 1));
export const notExact = (list: string[]) => list.filter(m => m.match(/^![^*].*$/)).map(m => m.substr(1));
export const notContain = (list: string[]) =>
  list.filter(m => m.match(/^!\*.+\*$/)).map(m => m.substr(2, m.length - 3));
export const notEndWith = (list: string[]) => list.filter(m => m.match(/^!\*[^*]+$/)).map(m => m.substr(2));
export const notStartWith = (list: string[]) =>
  list.filter(m => m.match(/^![^*]+\*$/)).map(m => m.substr(1, m.length - 2));
