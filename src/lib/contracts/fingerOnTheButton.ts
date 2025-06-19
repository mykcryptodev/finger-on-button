import { getContract } from 'viem';
import { usePublicClient, useWalletClient } from 'wagmi';
import { abi } from '~/constants/abi';
import { FINGER_ON_THE_BUTTON_CONTRACT_ADDRESS, CHAIN } from '~/constants';

/**
 * Creates a type-safe contract instance for the Finger on the Button contract
 */
export function getFingerOnTheButtonContract(
  client: Parameters<typeof getContract>[0]['client']
) {
  return getContract({
    address: FINGER_ON_THE_BUTTON_CONTRACT_ADDRESS,
    abi: abi,
    client,
  });
}

/**
 * Custom hook to use the Finger on the Button contract with Wagmi
 * Provides both read and write capabilities
 */
export function useFingerOnTheButtonContract() {
  const publicClient = usePublicClient({ chainId: CHAIN.id });
  const { data: walletClient } = useWalletClient({ chainId: CHAIN.id });

  if (!publicClient) return null;

  const contract = getContract({
    address: FINGER_ON_THE_BUTTON_CONTRACT_ADDRESS,
    abi: abi,
    client: walletClient 
      ? { public: publicClient, wallet: walletClient }
      : publicClient,
  });

  return contract;
}

/**
 * Type exports for better TypeScript support
 */
export type FingerOnTheButtonContract = ReturnType<typeof getFingerOnTheButtonContract>; 