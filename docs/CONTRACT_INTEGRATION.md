# Smart Contract Integration with Supabase Games

This document explains how the Finger on the Button smart contract is integrated with the Supabase game system.

## Overview

Games created in Supabase now require players to deposit ETH to the smart contract before they can join. This ensures:
1. Players have skin in the game
2. Prize pools are automatically managed on-chain
3. Game IDs are consistent between Supabase and the smart contract

## Flow

### 1. Game Creation
- Games are created in Supabase with a unique `id` (UUID)
- This same `id` is used as the `gameId` in the smart contract
- Each game has a `requires_deposit` flag (default: true)
- The entry fee is read from the contract's `ENTRY_FEE()` constant

### 2. Joining a Game
When a player tries to join a game:

1. **Check Deposit Status**: The system checks if the player has already deposited for this game
2. **Show Deposit Modal**: If no deposit found and game requires deposit, show the deposit modal
3. **Make Deposit**: Player deposits the entry fee to the contract using `deposit(fid, gameId)`
4. **Wait for Confirmation**: System waits for transaction confirmation
5. **Record in Supabase**: Once confirmed, the deposit is recorded in Supabase
6. **Join Game**: Player is now allowed to join the game

### 3. Database Schema

New columns added to track deposits:

**game_players table:**
- `deposit_tx_hash` - Transaction hash of the deposit
- `deposit_amount` - Amount deposited (in wei)
- `deposit_verified_at` - When the deposit was verified
- `deposit_block_number` - Block number of the deposit

**game_sessions table:**
- `requires_deposit` - Whether the game requires a deposit
- `entry_fee_wei` - Entry fee amount in wei

### 4. Smart Contract Functions Used

- `ENTRY_FEE()` - Get the required entry fee
- `deposit(fid, gameId)` - Make a deposit for a game
- `isPlayerInGame(address, gameId)` - Check if player has deposited
- `getGameDeposits(gameId)` - Get all deposits for a game

### 5. Security Considerations

- Deposits are verified on-chain before allowing game access
- Transaction receipts are checked for success status
- Event logs are parsed to ensure correct deposit parameters
- RLS policies ensure players can only update their state if deposited

## Code Structure

### Key Files

1. **`src/lib/game/depositService.ts`** - Handles all deposit-related operations
2. **`src/components/game/DepositModal.tsx`** - UI for making deposits
3. **`src/lib/contracts/fingerOnTheButton.ts`** - Contract interface setup
4. **`supabase/migrations/20240101000006_add_contract_deposit_tracking.sql`** - Database schema

### Services

**DepositService** provides:
- `makeDeposit()` - Submit deposit transaction
- `waitForDepositConfirmation()` - Wait for on-chain confirmation
- `recordDeposit()` - Save deposit info to Supabase
- `hasPlayerDeposited()` - Check if player has deposited
- `verifyDepositOnChain()` - Verify deposit directly from contract

## Testing

To test the integration:

1. Create a new game
2. Try to join without depositing (should show deposit modal)
3. Make a deposit
4. Verify you can now access the game
5. Check that deposit info is recorded in Supabase

## Future Enhancements

1. **Automatic Prize Distribution**: Winner automatically receives the prize pool
2. **Variable Entry Fees**: Different games could have different entry fees
3. **Refunds**: Handle refunds for cancelled games
4. **Multi-token Support**: Accept different tokens as entry fees 