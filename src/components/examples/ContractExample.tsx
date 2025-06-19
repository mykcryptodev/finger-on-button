'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import { useFingerOnTheButtonContract } from '~/lib/contracts/fingerOnTheButton';

export function ContractExample() {
  const { address } = useAccount();
  const contract = useFingerOnTheButtonContract();
  const [gameId, setGameId] = useState('game-001');
  const [fid, setFid] = useState('123');
  const [deposits, setDeposits] = useState<any[]>([]);
  const [totalDeposits, setTotalDeposits] = useState<bigint>(0n);
  const [isPlayerInGame, setIsPlayerInGame] = useState(false);
  const [entryFee, setEntryFee] = useState<bigint>(0n);

  // Example 1: Read contract constants
  useEffect(() => {
    async function fetchConstants() {
      if (!contract) return;
      
      try {
        // Read ENTRY_FEE constant
        const fee = await contract.read.ENTRY_FEE() as bigint;
        setEntryFee(fee);

        // Read ADMIN address
        const admin = await contract.read.ADMIN() as string;
        console.log('Contract admin:', admin);
      } catch (error) {
        console.error('Error fetching constants:', error);
      }
    }
    
    fetchConstants();
  }, [contract]);

  // Example 2: Read game-specific data
  const fetchGameData = async () => {
    if (!contract) return;

    try {
      // Get total deposits for a game
      const total = await contract.read.gameTotalDeposits([gameId]) as bigint;
      setTotalDeposits(total);

      // Get all deposits for a game
      const gameDeposits = await contract.read.getGameDeposits([gameId]) as any[];
      setDeposits(gameDeposits);

      // Check if player is in game
      if (address) {
        const inGame = await contract.read.isPlayerInGame([address, gameId]) as boolean;
        setIsPlayerInGame(inGame);
      }
    } catch (error) {
      console.error('Error fetching game data:', error);
    }
  };

  // Example 3: Write to contract - Make a deposit
  const makeDeposit = async () => {
    if (!contract || !address || !('write' in contract)) {
      console.error('Wallet not connected');
      return;
    }

    try {
      // First, simulate the transaction
      const { request } = await contract.simulate.deposit(
        [BigInt(fid), gameId],
        { value: entryFee }
      );

      // Then execute it
      const hash = await contract.write.deposit(
        [BigInt(fid), gameId],
        { value: entryFee }
      );

      console.log('Deposit transaction hash:', hash);
    } catch (error) {
      console.error('Error making deposit:', error);
    }
  };

  // Example 4: Estimate gas for a transaction
  const estimateDepositGas = async () => {
    if (!contract || !address) return;

    try {
      const gasEstimate = await contract.estimateGas.deposit(
        [BigInt(fid), gameId],
        { value: entryFee, account: address }
      );

      console.log('Estimated gas:', gasEstimate);
    } catch (error) {
      console.error('Error estimating gas:', error);
    }
  };

  // Example 5: Watch for deposit events
  useEffect(() => {
    if (!contract) return;

    const unwatch = contract.watchEvent.Deposited(
      {}, // Can add filters here like { depositorAddress: address }
      {
        onLogs: (logs) => {
          console.log('New deposits:', logs);
          // Refresh game data when new deposits occur
          fetchGameData();
        },
      }
    );

    return () => unwatch();
  }, [contract, gameId]);

  // Example 6: Get past events
  const fetchPastEvents = async () => {
    if (!contract) return;

    try {
      const events = await contract.getEvents.Deposited({
        fromBlock: 'latest',
        toBlock: 'latest',
      });

      console.log('Past deposit events:', events);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  // Example 7: Admin functions (only works if connected account is admin)
  const withdrawGameFunds = async (recipient: string) => {
    if (!contract || !address || !('write' in contract)) {
      console.error('Wallet not connected');
      return;
    }

    try {
      const hash = await contract.write.withdrawGameFunds([gameId, recipient as `0x${string}`]);
      console.log('Withdraw transaction hash:', hash);
    } catch (error) {
      console.error('Error withdrawing funds:', error);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-2xl font-bold">Contract Interaction Examples</h2>
      
      <div className="space-y-2">
        <p>Entry Fee: {formatEther(entryFee)} ETH</p>
        <p>Total Deposits in Game: {formatEther(totalDeposits)} ETH</p>
        <p>You are {isPlayerInGame ? '' : 'not '}in this game</p>
      </div>

      <div className="space-y-2">
        <input
          type="text"
          placeholder="Game ID"
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
          className="border p-2 rounded"
        />
        <input
          type="text"
          placeholder="FID"
          value={fid}
          onChange={(e) => setFid(e.target.value)}
          className="border p-2 rounded"
        />
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={fetchGameData} className="bg-blue-500 text-white px-4 py-2 rounded">
          Fetch Game Data
        </button>
        <button onClick={makeDeposit} className="bg-green-500 text-white px-4 py-2 rounded">
          Make Deposit
        </button>
        <button onClick={estimateDepositGas} className="bg-yellow-500 text-white px-4 py-2 rounded">
          Estimate Gas
        </button>
        <button onClick={fetchPastEvents} className="bg-purple-500 text-white px-4 py-2 rounded">
          Fetch Past Events
        </button>
      </div>

      <div className="mt-4">
        <h3 className="font-bold">Deposits:</h3>
        <ul className="space-y-1">
          {deposits.map((deposit, i) => (
            <li key={i} className="text-sm">
              FID: {deposit.fid.toString()}, Amount: {formatEther(deposit.amount)} ETH, 
              Address: {deposit.depositorAddress}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
} 