import { createClient } from '~/utils/supabase/client'
import { useFingerOnTheButtonContract } from '~/lib/contracts/fingerOnTheButton'
import { waitForTransactionReceipt, getPublicClient } from '@wagmi/core'
import { config } from '~/components/providers/WagmiProvider'
import { CHAIN } from '~/constants'
import { parseEventLogs } from 'viem'
import { abi } from '~/constants/abi'

export interface DepositInfo {
  tx_hash: string
  amount: string // in wei
  block_number: bigint
  depositor_address: string
  game_id: string
  fid: number
}

export class DepositService {
  private supabase = createClient()

  /**
   * Make a deposit to the smart contract for a game
   */
  async makeDeposit(
    contract: ReturnType<typeof useFingerOnTheButtonContract>,
    gameId: string,
    fid: number,
    entryFee: bigint
  ): Promise<string | null> {
    if (!contract || !('write' in contract)) {
      throw new Error('Wallet not connected')
    }

    try {
      // Make the deposit to the contract
      const hash = await contract.write.deposit(
        [BigInt(fid), gameId],
        { value: entryFee }
      )

      return hash
    } catch (error) {
      console.error('Error making deposit:', error)
      throw error
    }
  }

  /**
   * Wait for deposit confirmation and verify on-chain
   */
  async waitForDepositConfirmation(
    txHash: string,
    gameId: string,
    fid: number
  ): Promise<DepositInfo | null> {
    try {
      // Wait for transaction receipt
      const receipt = await waitForTransactionReceipt(config, {
        hash: txHash as `0x${string}`,
        chainId: CHAIN.id,
      })

      if (receipt.status !== 'success') {
        throw new Error('Transaction failed')
      }

      // Parse the deposit event from logs
      const logs = parseEventLogs({
        abi: abi,
        logs: receipt.logs,
        eventName: 'Deposited'
      })

      // Find the deposit event for this game and FID
      const depositEvent = logs.find(log => {
        return (log as any).args.gameId === gameId && (log as any).args.fid === BigInt(fid)
      })

      if (!depositEvent) {
        throw new Error('Deposit event not found in transaction')
      }

      const args = (depositEvent as any).args

      return {
        tx_hash: txHash,
        amount: args.amount.toString(),
        block_number: receipt.blockNumber,
        depositor_address: args.depositorAddress,
        game_id: args.gameId,
        fid: Number(args.fid)
      }
    } catch (error) {
      console.error('Error waiting for deposit confirmation:', error)
      return null
    }
  }

  /**
   * Record the deposit in Supabase
   */
  async recordDeposit(
    sessionId: string,
    depositInfo: DepositInfo
  ): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .rpc('record_player_deposit', {
          p_session_id: sessionId,
          p_fid: depositInfo.fid,
          p_tx_hash: depositInfo.tx_hash,
          p_amount: depositInfo.amount,
          p_block_number: Number(depositInfo.block_number)
        })

      if (error) {
        console.error('Error recording deposit:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error recording deposit:', error)
      return false
    }
  }

  /**
   * Check if a player has deposited for a game
   */
  async hasPlayerDeposited(sessionId: string, fid: number): Promise<boolean> {
    try {
      console.log('[DepositService] Checking deposit status for:', { sessionId, fid })
      
      // First try the RPC function
      const { data, error } = await this.supabase
        .rpc('can_player_join_game', {
          p_session_id: sessionId,
          p_fid: fid
        })

      if (error) {
        console.error('[DepositService] Error checking deposit status:', error)
        
        // If RPC function doesn't exist, check directly in game_players table
        if (error.message?.includes('function') || error.message?.includes('does not exist')) {
          console.log('[DepositService] RPC function not found, checking game_players directly')
          const { data: player } = await this.supabase
            .from('game_players')
            .select('deposit_verified_at')
            .eq('session_id', sessionId)
            .eq('fid', fid)
            .single()
          
          return !!player?.deposit_verified_at
        }
        
        return false
      }

      console.log('[DepositService] Can player join game result:', data)
      return data || false
    } catch (error) {
      console.error('[DepositService] Error checking deposit status:', error)
      return false
    }
  }

  /**
   * Get deposit info for a player in a game
   */
  async getPlayerDeposit(sessionId: string, fid: number) {
    try {
      const { data, error } = await this.supabase
        .from('game_players')
        .select('deposit_tx_hash, deposit_amount, deposit_verified_at, deposit_block_number')
        .eq('session_id', sessionId)
        .eq('fid', fid)
        .single()

      if (error || !data) return null

      return {
        txHash: data.deposit_tx_hash,
        amount: data.deposit_amount,
        verifiedAt: data.deposit_verified_at,
        blockNumber: data.deposit_block_number
      }
    } catch (error) {
      console.error('Error fetching deposit info:', error)
      return null
    }
  }

  /**
   * Verify existing deposits on-chain (for recovery/validation)
   */
  async verifyDepositOnChain(
    contract: ReturnType<typeof useFingerOnTheButtonContract>,
    gameId: string,
    playerAddress: string
  ): Promise<boolean> {
    if (!contract) return false

    try {
      // Check if player is in the game according to the contract
      const isInGame = await contract.read.isPlayerInGame([
        playerAddress as `0x${string}`,
        gameId
      ]) as boolean

      return isInGame
    } catch (error) {
      console.error('Error verifying deposit on-chain:', error)
      return false
    }
  }
} 