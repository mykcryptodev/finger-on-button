// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../src/FingerOnTheButton.sol";

contract FingerOnButtonTest is Test {
    FingerOnButton public fingerOnButton;
    
    address public constant ADMIN = 0x324aa2866E93eA60D1B974A9263a77Df1cb18b07;
    uint256 public constant ENTRY_FEE = 0.00001 ether;
    
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public user3 = makeAddr("user3");
    address public nonAdmin = makeAddr("nonAdmin");
    
    function setUp() public {
        fingerOnButton = new FingerOnButton();
        
        // Give users some ETH
        vm.deal(user1, 1 ether);
        vm.deal(user2, 1 ether);
        vm.deal(user3, 1 ether);
        vm.deal(nonAdmin, 1 ether);
        vm.deal(ADMIN, 1 ether);
    }

    function testConstants() public {
        assertEq(fingerOnButton.ADMIN(), ADMIN);
        assertEq(fingerOnButton.ENTRY_FEE(), ENTRY_FEE);
    }

    function testSuccessfulDeposit() public {
        uint256 fid = 12345;
        string memory gameId = "game1";
        
        vm.prank(user1);
        vm.expectEmit(true, false, false, true);
        emit FingerOnButton.Deposited(fid, ENTRY_FEE, user1, gameId, 0);
        
        fingerOnButton.deposit{value: ENTRY_FEE}(fid, gameId);
        
        // Check state updates
        assertEq(fingerOnButton.gameTotalDeposits(gameId), ENTRY_FEE);
        assertTrue(fingerOnButton.isPlayerInGame(user1, gameId));
        
        // Check deposit was stored correctly
        FingerOnButton.Deposit[] memory deposits = fingerOnButton.getGameDeposits(gameId);
        assertEq(deposits.length, 1);
        assertEq(deposits[0].fid, fid);
        assertEq(deposits[0].amount, ENTRY_FEE);
        assertEq(deposits[0].depositorAddress, user1);
        assertEq(deposits[0].gameId, gameId);
    }

    function testDepositWrongAmount() public {
        uint256 fid = 12345;
        string memory gameId = "game1";
        
        vm.prank(user1);
        vm.expectRevert("Deposit amount must be equal to the entry fee");
        fingerOnButton.deposit{value: ENTRY_FEE + 1}(fid, gameId);
        
        vm.prank(user1);
        vm.expectRevert("Deposit amount must be equal to the entry fee");
        fingerOnButton.deposit{value: ENTRY_FEE - 1}(fid, gameId);
        
        vm.prank(user1);
        vm.expectRevert("Deposit amount must be equal to the entry fee");
        fingerOnButton.deposit{value: 0}(fid, gameId);
    }

    function testMultipleDepositsInSameGame() public {
        string memory gameId = "game1";
        
        // First deposit
        vm.prank(user1);
        fingerOnButton.deposit{value: ENTRY_FEE}(111, gameId);
        
        // Second deposit by different user
        vm.prank(user2);
        fingerOnButton.deposit{value: ENTRY_FEE}(222, gameId);
        
        // Third deposit by first user again
        vm.prank(user1);
        fingerOnButton.deposit{value: ENTRY_FEE}(333, gameId);
        
        // Check total deposits
        assertEq(fingerOnButton.gameTotalDeposits(gameId), ENTRY_FEE * 3);
        
        // Check both users are marked as in game
        assertTrue(fingerOnButton.isPlayerInGame(user1, gameId));
        assertTrue(fingerOnButton.isPlayerInGame(user2, gameId));
        
        // Check deposits array
        FingerOnButton.Deposit[] memory deposits = fingerOnButton.getGameDeposits(gameId);
        assertEq(deposits.length, 3);
        assertEq(deposits[0].fid, 111);
        assertEq(deposits[1].fid, 222);
        assertEq(deposits[2].fid, 333);
    }

    function testMultipleGames() public {
        string memory game1 = "game1";
        string memory game2 = "game2";
        
        // Deposits in game1
        vm.prank(user1);
        fingerOnButton.deposit{value: ENTRY_FEE}(111, game1);
        
        vm.prank(user2);
        fingerOnButton.deposit{value: ENTRY_FEE}(222, game1);
        
        // Deposits in game2
        vm.prank(user1);
        fingerOnButton.deposit{value: ENTRY_FEE}(333, game2);
        
        vm.prank(user3);
        fingerOnButton.deposit{value: ENTRY_FEE}(444, game2);
        
        // Check game totals
        assertEq(fingerOnButton.gameTotalDeposits(game1), ENTRY_FEE * 2);
        assertEq(fingerOnButton.gameTotalDeposits(game2), ENTRY_FEE * 2);
        
        // Check player game participation
        assertTrue(fingerOnButton.isPlayerInGame(user1, game1));
        assertTrue(fingerOnButton.isPlayerInGame(user2, game1));
        assertFalse(fingerOnButton.isPlayerInGame(user3, game1));
        
        assertTrue(fingerOnButton.isPlayerInGame(user1, game2));
        assertFalse(fingerOnButton.isPlayerInGame(user2, game2));
        assertTrue(fingerOnButton.isPlayerInGame(user3, game2));
        
        // Check game deposits
        FingerOnButton.Deposit[] memory game1Deposits = fingerOnButton.getGameDeposits(game1);
        FingerOnButton.Deposit[] memory game2Deposits = fingerOnButton.getGameDeposits(game2);
        
        assertEq(game1Deposits.length, 2);
        assertEq(game2Deposits.length, 2);
        
        assertEq(game1Deposits[0].fid, 111);
        assertEq(game1Deposits[1].fid, 222);
        assertEq(game2Deposits[0].fid, 333);
        assertEq(game2Deposits[1].fid, 444);
    }

    function testWithdrawGameFundsAsAdmin() public {
        string memory gameId = "game1";
        address payable recipient = payable(makeAddr("recipient"));
        
        // Make some deposits first
        vm.prank(user1);
        fingerOnButton.deposit{value: ENTRY_FEE}(111, gameId);
        
        vm.prank(user2);
        fingerOnButton.deposit{value: ENTRY_FEE}(222, gameId);
        
        uint256 expectedAmount = ENTRY_FEE * 2;
        uint256 recipientBalanceBefore = recipient.balance;
        
        // Withdraw as admin
        vm.prank(ADMIN);
        vm.expectEmit(true, false, false, true);
        emit FingerOnButton.GameFundsWithdrawn(gameId, recipient, expectedAmount);
        
        fingerOnButton.withdrawGameFunds(gameId, recipient);
        
        // Check recipient received funds
        assertEq(recipient.balance, recipientBalanceBefore + expectedAmount);
        
        // Check game total is reset
        assertEq(fingerOnButton.gameTotalDeposits(gameId), 0);
    }

    function testWithdrawGameFundsAsNonAdmin() public {
        string memory gameId = "game1";
        address payable recipient = payable(makeAddr("recipient"));
        
        vm.prank(nonAdmin);
        vm.expectRevert("Caller is not the admin");
        fingerOnButton.withdrawGameFunds(gameId, recipient);
    }

    function testWithdrawGameFundsNoFunds() public {
        string memory gameId = "nonexistent-game";
        address payable recipient = payable(makeAddr("recipient"));
        
        vm.prank(ADMIN);
        vm.expectRevert("No funds to withdraw for this gameId");
        fingerOnButton.withdrawGameFunds(gameId, recipient);
    }

    function testWithdrawGameFundsZeroAddress() public {
        string memory gameId = "game1";
        
        // Make a deposit first
        vm.prank(user1);
        fingerOnButton.deposit{value: ENTRY_FEE}(111, gameId);
        
        vm.prank(ADMIN);
        vm.expectRevert("Recipient address cannot be zero");
        fingerOnButton.withdrawGameFunds(gameId, payable(address(0)));
    }

    function testWithdrawContractBalanceAsAdmin() public {
        // Send ETH directly to contract
        uint256 directAmount = 0.5 ether;
        vm.deal(address(fingerOnButton), directAmount);
        
        uint256 adminBalanceBefore = ADMIN.balance;
        
        vm.prank(ADMIN);
        fingerOnButton.withdrawContractBalance();
        
        assertEq(ADMIN.balance, adminBalanceBefore + directAmount);
        assertEq(address(fingerOnButton).balance, 0);
    }

    function testWithdrawContractBalanceAsNonAdmin() public {
        vm.prank(nonAdmin);
        vm.expectRevert("Caller is not the admin");
        fingerOnButton.withdrawContractBalance();
    }

    function testWithdrawContractBalanceNoBalance() public {
        vm.prank(ADMIN);
        vm.expectRevert("Contract has no balance to withdraw");
        fingerOnButton.withdrawContractBalance();
    }

    function testGetGameDepositsEmptyGame() public {
        FingerOnButton.Deposit[] memory deposits = fingerOnButton.getGameDeposits("nonexistent-game");
        assertEq(deposits.length, 0);
    }

    function testReceiveAndFallback() public {
        uint256 amount = 0.1 ether;
        uint256 contractBalanceBefore = address(fingerOnButton).balance;
        
        // Test receive function
        (bool success,) = address(fingerOnButton).call{value: amount}("");
        assertTrue(success);
        assertEq(address(fingerOnButton).balance, contractBalanceBefore + amount);
        
        // Test fallback function
        (bool success2,) = address(fingerOnButton).call{value: amount}("0x1234");
        assertTrue(success2);
        assertEq(address(fingerOnButton).balance, contractBalanceBefore + (amount * 2));
    }

    function testDepositIdIncrements() public {
        string memory gameId = "game1";
        
        // First deposit should have ID 0
        vm.prank(user1);
        vm.expectEmit(true, false, false, true);
        emit FingerOnButton.Deposited(111, ENTRY_FEE, user1, gameId, 0);
        fingerOnButton.deposit{value: ENTRY_FEE}(111, gameId);
        
        // Second deposit should have ID 1
        vm.prank(user2);
        vm.expectEmit(true, false, false, true);
        emit FingerOnButton.Deposited(222, ENTRY_FEE, user2, gameId, 1);
        fingerOnButton.deposit{value: ENTRY_FEE}(222, gameId);
        
        // Third deposit in different game should have ID 2
        vm.prank(user3);
        vm.expectEmit(true, false, false, true);
        emit FingerOnButton.Deposited(333, ENTRY_FEE, user3, "game2", 2);
        fingerOnButton.deposit{value: ENTRY_FEE}(333, "game2");
    }

    function testReentrancyProtection() public {
        string memory gameId = "game1";
        
        // Make a deposit
        vm.prank(user1);
        fingerOnButton.deposit{value: ENTRY_FEE}(111, gameId);
        
        // Withdraw funds (this should reset gameTotalDeposits to 0 before transferring)
        address payable recipient = payable(makeAddr("recipient"));
        vm.prank(ADMIN);
        fingerOnButton.withdrawGameFunds(gameId, recipient);
        
        // Trying to withdraw again should fail
        vm.prank(ADMIN);
        vm.expectRevert("No funds to withdraw for this gameId");
        fingerOnButton.withdrawGameFunds(gameId, recipient);
    }

    // Fuzz testing
    function testFuzzDeposit(uint256 fid, uint32 gameIdSeed) public {
        vm.assume(fid > 0 && fid < type(uint256).max);
        string memory gameId = string(abi.encodePacked("game", vm.toString(gameIdSeed)));
        
        vm.prank(user1);
        fingerOnButton.deposit{value: ENTRY_FEE}(fid, gameId);
        
        assertTrue(fingerOnButton.isPlayerInGame(user1, gameId));
        assertEq(fingerOnButton.gameTotalDeposits(gameId), ENTRY_FEE);
        
        FingerOnButton.Deposit[] memory deposits = fingerOnButton.getGameDeposits(gameId);
        assertEq(deposits.length, 1);
        assertEq(deposits[0].fid, fid);
    }
}
