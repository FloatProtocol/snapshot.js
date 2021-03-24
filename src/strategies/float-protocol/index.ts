import { formatUnits } from '@ethersproject/units';
import { BigNumber } from '@ethersproject/bignumber';
import { multicall } from '../../utils';
import { Score } from '../../utils/types';

const ONE = BigNumber.from('1000000000000000000');

// Based on frax-finance's clever little strategy
export const author = 'FloatProtocol';
export const version = '0.0.1';

const DECIMALS = 18;

const abi = [
  {
    constant: true,
    inputs: [
      {
        internalType: 'address',
        name: 'account',
        type: 'address'
      }
    ],
    name: 'balanceOf',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256'
      }
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'account',
        type: 'address'
      }
    ],
    name: 'earned',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'totalSupply',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'getReserves',
    outputs: [
      {
        internalType: 'uint112',
        name: '_reserve0',
        type: 'uint112'
      },
      {
        internalType: 'uint112',
        name: '_reserve1',
        type: 'uint112'
      },
      {
        internalType: 'uint32',
        name: '_blockTimestampLast',
        type: 'uint32'
      }
    ],
    stateMutability: 'view',
    type: 'function',
    constant: true
  },
  {
    inputs: [],
    name: 'token0',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  }
];

const chunk = (arr, size) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
    arr.slice(i * size, i * size + size)
  );

export async function strategy(
  space,
  network,
  provider,
  addresses,
  options,
  snapshot
): Promise<Score> {
  const blockTag = typeof snapshot === 'number' ? snapshot : 'latest';

  // Fetch BANK Balance
  const bankQuery = addresses.map((address: any) => [
    options.bank,
    'balanceOf',
    [address]
  ]);

  // Fetch unstaked Uniswap LP balance
  const unstakedUniLPBankEthQuery = addresses.map((address: any) => [
    options.uniswapBankEthPair,
    'balanceOf',
    [address]
  ]);

  // Fetch unstaked Sushi LP Balance
  const unstakedSushiLPBankEthQuery = addresses.map((address: any) => [
    options.sushiPhase2Pool,
    'balanceOf',
    [address]
  ]);

  // Fetch staked Sushi LP Balance
  const stakedSushiLPBankEthQuery = addresses.map((address: any) => [
    options.sushiPhase2Pool,
    'balanceOf',
    [address]
  ]);

  // // Fetch unclaimed BANK
  // const unclaimedBankQueries = Object.values(
  //   options.pools
  // ).flatMap((pool: any) =>
  //   addresses.map((address: any) => [pool, 'earned', [address]])
  // );

  const response = await multicall(
    network,
    provider,
    abi,
    [
      [options.uniswapBankEthPair, 'token0'],
      [options.uniswapBankEthPair, 'getReserves'],
      [options.uniswapBankEthPair, 'totalSupply'],
      [options.sushiswapBankEthPair, 'token0'],
      [options.sushiswapBankEthPair, 'getReserves'],
      [options.sushiswapBankEthPair, 'totalSupply'],
      ...bankQuery,
      ...unstakedUniLPBankEthQuery,
      ...unstakedSushiLPBankEthQuery,
      ...stakedSushiLPBankEthQuery,
      // ...unclaimedBankQueries // This is too perfomance heavy.
    ],
    { blockTag }
  );
  const [
    uniLPBankEth_token0,
    uniLPBankEth_getReserves,
    uniLPBankEth_totalSupply,
    sushiLPBankEth_token0,
    sushiLPBankEth_getReserves,
    sushiLPBankEth_totalSupply,
    ...addressQueries
  ] = response;

  // Uniswap BANK-ETH
  // ----------------------------------------
  const uniLPBankEth_reservesBANK_E0 =
    uniLPBankEth_token0[0] == options.bank
      ? uniLPBankEth_getReserves[0]
      : uniLPBankEth_getReserves[1];
  const uni_BankEth_totalSupply_E0 = uniLPBankEth_totalSupply[0];
  const uniLPBankEth_bankPerLP_E18 = uniLPBankEth_reservesBANK_E0
    .mul(ONE)
    .div(uni_BankEth_totalSupply_E0);

  // SushiSwap BANK-ETH
  // ----------------------------------------
  const sushiLPBankEth_reservesBANK_E0 =
    sushiLPBankEth_token0[0] == options.bank
      ? sushiLPBankEth_getReserves[0]
      : sushiLPBankEth_getReserves[1];
  const sushi_BankEth_totalSupply_E0 = sushiLPBankEth_totalSupply[0];
  const sushiLPBankEth_bankPerLP_E18 = sushiLPBankEth_reservesBANK_E0
    .mul(ONE)
    .div(sushi_BankEth_totalSupply_E0);

  const chunks = chunk(addressQueries, addresses.length);
  const [
    bankBalances,
    unstakedUniLPBalances,
    unstakedSushiLPBalances,
    stakedSushiLPBalances,
    ...earnedBankBalanceSheets
  ] = chunks;

  return Object.fromEntries(
    Array(addresses.length)
      .fill('x')
      .map((_, i) => {
        const heldBank = bankBalances[i][0];
        const unstakedULP = unstakedUniLPBalances[i][0];
        const unstakedSLP = unstakedSushiLPBalances[i][0];
        const stakedSLP = stakedSushiLPBalances[i][0];

        // console.log(`==================${addresses[i]}==================`);
        // console.log('Held BANK: ', heldBank.div(ONE).toString());
        // console.log(
        //   'Unstaked Uni BANK-ETH LP: ',
        //   unstakedULP.div(ONE).toString()
        // );
        // console.log(
        //   'Unstaked Sushi BANK-ETH LP: ',
        //   unstakedSLP.div(ONE).toString()
        // );
        // console.log(
        //   'Staked Sushi BANK-ETH LP: ',
        //   stakedSLP.div(ONE).toString()
        // );
        // let idx = 0;
        // for (const name of Object.keys(options.pools)) {
        //   console.log(`Earned in ${name} Pool: ${earnedBankBalanceSheets[idx][i][0].div(ONE).toString()}`);
        //   idx++;
        // }
        
        // console.log('------');
        // console.log(
        //   'BANK per Uni BANK-ETH LP: ',
        //   uniLPBankEth_bankPerLP_E18.toString()
        // );
        // console.log(
        //   'BANK per Sushi BANK-ETH LP: ',
        //   sushiLPBankEth_bankPerLP_E18.toString()
        // );
        // console.log(``);

        let totalBank = heldBank
          // BANK share in free Uni BANK-ETH LP
          .add(unstakedULP.mul(uniLPBankEth_bankPerLP_E18).div(ONE))
          // BANK share in free Sushi BANK-ETH LP
          .add(unstakedSLP.mul(sushiLPBankEth_bankPerLP_E18).div(ONE))
          // BANK share in farmed Sushi BANK-ETH LP
          .add(stakedSLP.mul(sushiLPBankEth_bankPerLP_E18).div(ONE));

        // Add any earned bank
        earnedBankBalanceSheets.forEach((poolBalances) => {
          const earnedFromPool = poolBalances[i][0];
          totalBank = totalBank.add(earnedFromPool);
        });

        return [
          addresses[i],
          parseFloat(formatUnits(totalBank.toString(), DECIMALS))
        ];
      })
  );
}
