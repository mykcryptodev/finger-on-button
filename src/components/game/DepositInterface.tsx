'use client'

import { useState, useCallback, useEffect } from 'react'
import { formatEther } from 'viem'
import { Button } from '~/components/ui/Button'
import { 
  useAccount, 
  useSendTransaction, 
  useWaitForTransactionReceipt,
  useConnect,
  useDisconnect,
  useChainId,
  useSwitchChain
} from 'wagmi'
import { CHAIN, FINGER_ON_THE_BUTTON_CONTRACT_ADDRESS } from '~/constants'
import { abi } from '~/constants/abi'
import { encodeFunctionData } from 'viem'
import { config } from '~/components/providers/WagmiProvider'
import { BaseError, UserRejectedRequestError } from 'viem'
import { truncateAddress } from '~/lib/truncateAddress'
import { createClient } from '~/utils/supabase/client'

interface DepositInterfaceProps {
  gameId: string
  sessionId: string
  fid: number
  entryFee: bigint
  onDepositComplete: () => void
}

export function DepositInterface({ gameId, sessionId, fid, entryFee, onDepositComplete }: DepositInterfaceProps) {
  const [recordingDeposit, setRecordingDeposit] = useState(false)
  const [recordError, setRecordError] = useState<string | null>(null)
  
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: isSwitchChainPending } = useSwitchChain()
  
  const {
    sendTransaction,
    data: txHash,
    error: sendTxError,
    isError: isSendTxError,
    isPending: isSendTxPending,
    reset: resetSendTx
  } = useSendTransaction()

  const { 
    isLoading: isConfirming, 
    isSuccess: isConfirmed,
    data: receipt
  } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  // Record deposit in Supabase when confirmed
  useEffect(() => {
    const recordDeposit = async () => {
      if (isConfirmed && receipt && txHash && !recordingDeposit) {
        setRecordingDeposit(true)
        setRecordError(null)
        
        try {
          const supabase = createClient()
          
          // Record the deposit
          const { error } = await supabase
            .rpc('record_player_deposit', {
              p_session_id: sessionId,
              p_fid: fid,
              p_tx_hash: txHash,
              p_amount: entryFee.toString(),
              p_block_number: Number(receipt.blockNumber)
            })

          if (error) {
            console.error('[DepositInterface] Error recording deposit:', error)
            setRecordError('Failed to record deposit. Please try again.')
            setRecordingDeposit(false)
            return
          }

          console.log('[DepositInterface] Deposit recorded successfully')
          
          // Wait a moment for the database to update
          setTimeout(() => {
            onDepositComplete()
          }, 1500)
        } catch (error) {
          console.error('[DepositInterface] Error recording deposit:', error)
          setRecordError('Failed to record deposit. Please try again.')
          setRecordingDeposit(false)
        }
      }
    }

    recordDeposit()
  }, [isConfirmed, receipt, txHash, sessionId, fid, entryFee, recordingDeposit, onDepositComplete])

  const handleDeposit = useCallback(() => {
    try {
      // Encode the deposit function call
      const data = encodeFunctionData({
        abi,
        functionName: 'deposit',
        args: [BigInt(fid), gameId]
      })

      sendTransaction({
        to: FINGER_ON_THE_BUTTON_CONTRACT_ADDRESS as `0x${string}`,
        data,
        value: entryFee
      })
    } catch (error) {
      console.error('[DepositInterface] Error sending transaction:', error)
    }
  }, [sendTransaction, fid, gameId, entryFee])

  const handleSwitchChain = useCallback(() => {
    switchChain({ chainId: CHAIN.id })
  }, [switchChain])

  const renderError = (error: Error | null) => {
    if (!error) return null
    if (error instanceof BaseError) {
      const isUserRejection = error.walk(
        (e) => e instanceof UserRejectedRequestError
      )

      if (isUserRejection) {
        return <div className="text-red-500 text-xs mt-1">Transaction rejected by user.</div>
      }
    }

    return <div className="text-red-500 text-xs mt-1">{error.message}</div>
  }

  // Check if on wrong chain
  const isWrongChain = isConnected && chainId !== CHAIN.id

  return (
    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-yellow-900">Entry Fee Required</h3>
          <p className="text-sm text-yellow-700 mt-1">
            Deposit {formatEther(entryFee)} ETH to join this game
          </p>
          <p className="text-xs text-yellow-600 mt-2">
            Game ID: {gameId}
          </p>
        </div>
        {address && (
          <div className="text-xs text-gray-600">
            {truncateAddress(address)}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {!isConnected ? (
          <>
            <Button
              onClick={() => connect({ connector: connectors[0] })}
              className="w-full"
            >
              Connect Wallet
            </Button>
            <div className="text-xs text-center text-gray-500">
              Connect your wallet to deposit the entry fee
            </div>
          </>
        ) : isWrongChain ? (
          <>
            <Button
              onClick={handleSwitchChain}
              disabled={isSwitchChainPending}
              isLoading={isSwitchChainPending}
              className="w-full"
            >
              Switch to {CHAIN.name}
            </Button>
            <div className="text-xs text-center text-gray-500">
              Please switch to {CHAIN.name} to continue
            </div>
          </>
        ) : (
          <>
            <Button
              onClick={handleDeposit}
              disabled={isSendTxPending || isConfirming || recordingDeposit}
              isLoading={isSendTxPending || isConfirming || recordingDeposit}
              className="w-full"
            >
              {isSendTxPending ? 'Confirm in Wallet...' : 
               isConfirming ? 'Processing...' : 
               recordingDeposit ? 'Recording Deposit...' :
               'Deposit Entry Fee'}
            </Button>
            
            {isSendTxError && renderError(sendTxError)}
            {recordError && <div className="text-red-500 text-xs mt-1">{recordError}</div>}
            
            {txHash && !isConfirmed && (
              <div className="text-xs text-gray-600 mt-2">
                <div>Transaction sent: {truncateAddress(txHash)}</div>
                <div>Waiting for confirmation...</div>
              </div>
            )}
            
            {isConfirmed && (
              <div className="text-xs text-green-600 mt-2">
                <div>✅ Deposit confirmed!</div>
                <div>Recording in game...</div>
              </div>
            )}

            <Button
              onClick={() => disconnect()}
              className="w-full mt-2 bg-gray-100 hover:bg-gray-200 text-gray-700"
            >
              Disconnect Wallet
            </Button>
          </>
        )}
      </div>
    </div>
  )
} 