import { createClient } from '~/utils/supabase/client'
import { CHAIN, FINGER_ON_THE_BUTTON_CONTRACT_ADDRESS } from '~/constants'
import { abi } from '~/constants/abi'
import { encodeFunctionData, parseEther } from 'viem'

export interface ThirdwebDepositInfo {
  queueId: string
  transactionHash?: string
  status: 'queued' | 'sent' | 'mined' | 'failed'
  gameId: string
  fid: number
  amount: string
}

export class ThirdwebDepositService {
  private supabase = createClient()
  private engineUrl = process.env.NEXT_PUBLIC_THIRDWEB_ENGINE_URL || 'https://engine.thirdweb.com'
  
  /**
   * Make a deposit using thirdweb Engine v3
   */
  async makeDeposit(
    gameId: string,
    fid: number,
    entryFee: bigint,
    walletAddress: string
  ): Promise<string | null> {
    try {
      console.log('[ThirdwebDepositService] Making deposit via Engine v3:', {
        gameId,
        fid,
        entryFee: entryFee.toString(),
        walletAddress
      })

      // Prepare the function signature and parameters
      const functionSignature = 'function deposit(uint256 fid, string memory gameId) payable'
      const params = [fid.toString(), gameId]
      
      // Make the API call to thirdweb Engine v3
      const response = await fetch(`${this.engineUrl}/v1/write/contract`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.THIRDWEB_VAULT_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'x-client-id': process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || '',
          'x-secret-key': process.env.THIRDWEB_SECRET_KEY || '',
          'X-Secret-Key': process.env.THIRDWEB_VAULT_ADMIN_KEY || '',
        },
        body: JSON.stringify({
          executionOptions: {
            chainId: CHAIN.id.toString(),
            from: walletAddress,
            value: entryFee.toString() // Send ETH value with the transaction
          },
          params: [
            {
              contractAddress: FINGER_ON_THE_BUTTON_CONTRACT_ADDRESS,
              method: functionSignature,
              params: params
            }
          ]
        })
      })

      if (!response.ok) {
        const error = await response.text()
        console.error('[ThirdwebDepositService] Engine API error:', error)
        throw new Error(`Engine API error: ${error}`)
      }

      const result = await response.json()
      console.log('[ThirdwebDepositService] Engine response:', result)
      
      // Engine v3 returns a transaction queue ID
      return result.queueId || result.result?.queueId || null
    } catch (error) {
      console.error('[ThirdwebDepositService] Error making deposit:', error)
      throw error
    }
  }

  /**
   * Check transaction status using thirdweb Engine v3
   */
  async checkTransactionStatus(queueId: string): Promise<{
    status: 'queued' | 'sent' | 'mined' | 'failed'
    transactionHash?: string
    blockNumber?: number
  }> {
    try {
      const response = await fetch(`${this.engineUrl}/v1/transaction/${queueId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.THIRDWEB_VAULT_ACCESS_TOKEN}`,
          'x-secret-key': process.env.THIRDWEB_SECRET_KEY || '',
          'X-Secret-Key': process.env.THIRDWEB_VAULT_ADMIN_KEY || '',
          'x-client-id': process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || ''
        }
      })

      if (!response.ok) {
        throw new Error('Failed to check transaction status')
      }

      const result = await response.json()
      console.log('[ThirdwebDepositService] Transaction status:', result)
      
      // Map thirdweb status to our status types
      let status: 'queued' | 'sent' | 'mined' | 'failed' = 'queued'
      if (result.status === 'success' || result.status === 'mined') {
        status = 'mined'
      } else if (result.status === 'failed' || result.status === 'reverted') {
        status = 'failed'
      } else if (result.status === 'sent' || result.status === 'pending') {
        status = 'sent'
      }
      
      return {
        status,
        transactionHash: result.transactionHash || result.txHash,
        blockNumber: result.blockNumber
      }
    } catch (error) {
      console.error('[ThirdwebDepositService] Error checking status:', error)
      return { status: 'failed' }
    }
  }

  /**
   * Wait for transaction to be mined
   */
  async waitForTransaction(
    queueId: string,
    maxAttempts = 30,
    delayMs = 2000
  ): Promise<{
    success: boolean
    transactionHash?: string
    blockNumber?: number
  }> {
    for (let i = 0; i < maxAttempts; i++) {
      const status = await this.checkTransactionStatus(queueId)
      
      console.log(`[ThirdwebDepositService] Transaction status (attempt ${i + 1}):`, status)
      
      if (status.status === 'mined') {
        return {
          success: true,
          transactionHash: status.transactionHash,
          blockNumber: status.blockNumber
        }
      }
      
      if (status.status === 'failed') {
        return { success: false }
      }
      
      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
    
    return { success: false }
  }

  /**
   * Record the deposit in Supabase
   */
  async recordDeposit(
    sessionId: string,
    fid: number,
    transactionHash: string,
    amount: string,
    blockNumber: number
  ): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .rpc('record_player_deposit', {
          p_session_id: sessionId,
          p_fid: fid,
          p_tx_hash: transactionHash,
          p_amount: amount,
          p_block_number: blockNumber
        })

      if (error) {
        console.error('[ThirdwebDepositService] Error recording deposit:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('[ThirdwebDepositService] Error recording deposit:', error)
      return false
    }
  }

  /**
   * Check if a player has deposited for a game (same as original)
   */
  async hasPlayerDeposited(sessionId: string, fid: number): Promise<boolean> {
    try {
      console.log('[ThirdwebDepositService] Checking deposit status for:', { sessionId, fid })
      
      // First try the RPC function
      const { data, error } = await this.supabase
        .rpc('can_player_join_game', {
          p_session_id: sessionId,
          p_fid: fid
        })

      if (error) {
        console.error('[ThirdwebDepositService] Error checking deposit status:', error)
        
        // If RPC function doesn't exist, check directly in game_players table
        if (error.message?.includes('function') || error.message?.includes('does not exist')) {
          console.log('[ThirdwebDepositService] RPC function not found, checking game_players directly')
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

      console.log('[ThirdwebDepositService] Can player join game result:', data)
      return data || false
    } catch (error) {
      console.error('[ThirdwebDepositService] Error checking deposit status:', error)
      return false
    }
  }
} 