import { strategy as erc20BalanceOfStrategy } from '../erc20-balance-of';
import { Score } from '../../utils/types';

export const author = 'jxde';
export const version = '0.1.0';

export async function strategy(
  space,
  network,
  provider,
  addresses,
  options,
  snapshot
): Promise<Score> {
  const score = await erc20BalanceOfStrategy(
    space,
    network,
    provider,
    addresses,
    options,
    snapshot
  );
  return Object.fromEntries(
    Object.entries(score).map((address: any) => [
      address[0],
      address[1] * options.coeff
    ])
  );
}
