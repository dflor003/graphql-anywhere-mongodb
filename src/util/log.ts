import * as util from 'util';

export const log = (...args: any[]) => console.log(
  ...args.map(arg =>
    ['string', 'number', 'boolean'].includes(typeof arg)
      ? arg
      : util.inspect(arg, { depth: Infinity, colors: true })
  )
);
