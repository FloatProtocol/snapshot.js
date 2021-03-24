import { Score } from "../../utils/types";

export const author = 'bonustrack';
export const version = '0.1.0';

export async function strategy(
  space,
  network,
  provider,
  addresses,
  options,
  snapshot
): Promise<Score> {
  return Object.fromEntries(addresses.map((address) => [address, 1]));
}
