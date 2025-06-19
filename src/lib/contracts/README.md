# Finger on the Button Contract Usage

This directory contains the type-safe contract setup for interacting with the Finger on the Button smart contract using viem and wagmi.

## Setup

The contract is already configured with:
- Contract address: `0x41e0eee94bf1cda02d2116a00b67bf5cbcc662a9` on Base
- Full ABI with TypeScript type inference
- Integration with wagmi for wallet connections

## Usage

### 1. Import the hook in your component:

```typescript
import { useFingerOnTheButtonContract } from '~/lib/contracts/fingerOnTheButton';
```

### 2. Use the contract in your component:

```typescript
const contract = useFingerOnTheButtonContract();
```

### 3. Available Methods

#### Read Methods (always available):
- `contract.read.ENTRY_FEE()` - Get the entry fee amount
- `contract.read.ADMIN()` - Get the admin address
- `contract.read.gameTotalDeposits([gameId])` - Get total deposits for a game
- `contract.read.getGameDeposits([gameId])` - Get all deposits for a game
- `contract.read.isPlayerInGame([address, gameId])` - Check if player is in game

#### Write Methods (requires wallet connection):
- `contract.write.deposit([fid, gameId], { value })` - Make a deposit
- `contract.write.withdrawGameFunds([gameId, recipient])` - Withdraw game funds (admin only)
- `contract.write.withdrawContractBalance()` - Withdraw contract balance (admin only)

#### Event Methods:
- `contract.watchEvent.Deposited({}, { onLogs })` - Watch for new deposits
- `contract.getEvents.Deposited({ fromBlock, toBlock })` - Get past deposit events
- `contract.watchEvent.GameFundsWithdrawn({}, { onLogs })` - Watch for withdrawals

#### Utility Methods:
- `contract.simulate.deposit([fid, gameId], { value })` - Simulate a transaction
- `contract.estimateGas.deposit([fid, gameId], { value })` - Estimate gas

## Example Component

See `src/components/examples/ContractExample.tsx` for a complete example of all contract interactions.

## Type Safety

All contract methods are fully typed based on the ABI:
- Function parameters are type-checked
- Return values have proper types
- Events are typed with their log structure

## Error Handling

Always wrap contract calls in try-catch blocks:

```typescript
try {
  const result = await contract.read.gameTotalDeposits([gameId]);
} catch (error) {
  console.error('Contract error:', error);
}
```

## Wallet Connection

Write methods require a wallet connection. Check for wallet before writing:

```typescript
if (!contract || !('write' in contract)) {
  console.error('Please connect your wallet');
  return;
}
``` 