import { strategy as erc20BalanceOfStrategy } from '../erc20-balance-of';
import { Score } from '../../utils/types';

export const author = 'samuveth';
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

  Object.keys(score).forEach((key) => {
    if (score[key] >= options.minBalance) score[key] = score[key];
    else score[key] = 0;
  });

  return score;
}
