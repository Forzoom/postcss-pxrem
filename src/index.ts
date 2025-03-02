import { pxRegex } from './lib/pixel-unit-regex';
import * as filterPropList from './lib/filter-prop-list';
import { isFunction, isString, isRegExp } from './lib/type';
import type { Declaration, Input, PluginCreator } from 'postcss';

interface Options {
  rootValue: number | ((input: Input) => number);
  unitPrecision: number;
  propList: string[];
  selectorBlackList: Array<string | RegExp>;
  replace: boolean;
  mediaQuery: boolean;
  minPixelValue: number;
  exclude: string | RegExp | ((file: string) => boolean) | undefined;
  unit: string;
}

const defaults: Options = {
  rootValue: 16,
  unitPrecision: 5,
  selectorBlackList: [],
  propList: ['font', 'font-size', 'line-height', 'letter-spacing', 'word-spacing'],
  replace: true,
  mediaQuery: false,
  minPixelValue: 0,
  exclude: undefined,
  unit: 'px',
};

interface LegacyOptions {
  /** @deprecated use `rootValue` instead */
  root_value: Options['rootValue'];
  /** @deprecated use `unitPrecision` instead */
  unit_precision: Options['unitPrecision'];
  /** @deprecated use `selectorBlackList` instead */
  selector_black_list: Options['selectorBlackList'];
  /** @deprecated use `propList` instead */
  prop_white_list: Options['propList'];
  /** @deprecated use `mediaQuery` instead */
  media_query: Options['mediaQuery'];
  /** @deprecated use `propList` instead */
  propWhiteList: Options['propList'];
}

const legacyOptions = {
  root_value: 'rootValue',
  unit_precision: 'unitPrecision',
  selector_black_list: 'selectorBlackList',
  prop_white_list: 'propList',
  media_query: 'mediaQuery',
  propWhiteList: 'propList',
};

/**
 * in-place 替换
 * @param options
 * @returns
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function convertLegacyOptions(options: Record<string, any>) {
  if (typeof options !== 'object') return;
  if (
    ((typeof options['prop_white_list'] !== 'undefined' && options['prop_white_list'].length === 0) ||
      (typeof options.propWhiteList !== 'undefined' && options.propWhiteList.length === 0)) &&
    typeof options.propList === 'undefined'
  ) {
    options.propList = ['*'];
    delete options['prop_white_list'];
    delete options.propWhiteList;
  }
  Object.keys(legacyOptions).forEach(key => {
    if (Reflect.has(options, key)) {
      // @ts-expect-error -- 临时处理
      options[legacyOptions[key]] = options[key];
      delete options[key];
    }
  });
}

function createPxReplace(rootValue: number, unitPrecision: number, minPixelValue: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (m: string, $1: any) => {
    if (!$1) return m;
    const pixels = parseFloat($1);
    if (pixels < minPixelValue) return m;
    const fixedVal = toFixed(pixels / rootValue, unitPrecision);
    return fixedVal + 'rem';
  };
}

function toFixed(number: number, precision: number) {
  const multiplier = Math.pow(10, precision + 1),
    wholeNumber = Math.floor(number * multiplier);
  return (Math.round(wholeNumber / 10) * 10) / multiplier;
}

function declarationExists(decls: Declaration[], prop: string, value: string) {
  return decls.some(decl => decl.prop === prop && decl.value === value);
}

function blacklistedSelector(blacklist: (string | RegExp)[], selector: string) {
  if (typeof selector !== 'string') return;
  return blacklist.some(regex => {
    if (typeof regex === 'string') {
      return selector.indexOf(regex) !== -1;
    }
    return selector.match(regex);
  });
}

function createPropListMatcher(propList: string[]) {
  const hasWild = propList.indexOf('*') > -1;
  const matchAll = hasWild && propList.length === 1;
  const lists = {
    exact: filterPropList.exact(propList),
    contain: filterPropList.contain(propList),
    startWith: filterPropList.startWith(propList),
    endWith: filterPropList.endWith(propList),
    notExact: filterPropList.notExact(propList),
    notContain: filterPropList.notContain(propList),
    notStartWith: filterPropList.notStartWith(propList),
    notEndWith: filterPropList.notEndWith(propList),
  };
  return (prop: string) => {
    if (matchAll) return true;
    return (
      (hasWild ||
        lists.exact.indexOf(prop) > -1 ||
        lists.contain.some(function (m) {
          return prop.indexOf(m) > -1;
        }) ||
        lists.startWith.some(function (m) {
          return prop.indexOf(m) === 0;
        }) ||
        lists.endWith.some(function (m) {
          return prop.indexOf(m) === prop.length - m.length;
        })) &&
      !(
        lists.notExact.indexOf(prop) > -1 ||
        lists.notContain.some(function (m) {
          return prop.indexOf(m) > -1;
        }) ||
        lists.notStartWith.some(function (m) {
          return prop.indexOf(m) === 0;
        }) ||
        lists.notEndWith.some(function (m) {
          return prop.indexOf(m) === prop.length - m.length;
        })
      )
    );
  };
}

const plugin: PluginCreator<Partial<Options & LegacyOptions>> = (options = {}) => {
  convertLegacyOptions(options);
  const opts: Options = Object.assign({}, defaults, options);
  const satisfyPropList = createPropListMatcher(opts.propList);
  const exclude = opts.exclude;

  return {
    postcssPlugin: 'postcss-pxrem',
    prepare() {
      let isExcludeFile = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let pxReplace: (m: string, $1: any) => string = () => '';

      return {
        Once(css) {
          const source = css.source!; // 暂时判定为有内容
          const filePath = source.input.file!;
          if (
            exclude &&
            ((isFunction(exclude) && exclude(filePath)) ||
              (isString(exclude) && filePath.indexOf(exclude) !== -1) ||
              ((isString(exclude) || isRegExp(exclude)) && filePath.match(exclude) !== null))
          ) {
            isExcludeFile = true;
          } else {
            isExcludeFile = false;
          }

          const rootValue = typeof opts.rootValue === 'function' ? opts.rootValue(source.input) : opts.rootValue;
          pxReplace = createPxReplace(rootValue, opts.unitPrecision, opts.minPixelValue);
        },
        Declaration(decl) {
          if (isExcludeFile) return;

          if (
            decl.value.indexOf(opts.unit) === -1 ||
            !satisfyPropList(decl.prop) ||
            // @ts-expect-error -- 临时处理
            blacklistedSelector(opts.selectorBlackList, decl.parent!.selector)
          )
            return;

          const value = decl.value.replace(pxRegex(opts.unit), pxReplace);

          // if rem unit already exists, do not add or replace
          // @ts-expect-error -- 暂时处理
          if (declarationExists(decl.parent, decl.prop, value)) return;

          if (opts.replace) {
            decl.value = value;
          } else {
            decl.cloneAfter({ value: value });
          }
        },
        AtRule(atRule) {
          if (isExcludeFile) return;

          if (opts.mediaQuery && atRule.name === 'media') {
            if (atRule.params.indexOf(opts.unit) === -1) return;
            atRule.params = atRule.params.replace(pxRegex(opts.unit), pxReplace);
          }
        },
      };
    },
  };
};

plugin.postcss = true;

export = plugin;
