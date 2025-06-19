// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

contract FingerOnButton {
    struct Deposit {
        uint256 fid;
        uint256 amount;
        address depositorAddress;
        string gameId;
    }

    address public constant ADMIN = 0x324aa2866E93eA60D1B974A9263a77Df1cb18b07;
    uint256 public constant ENTRY_FEE = 0.00001 ether;
    Deposit[] public allDeposits;
    mapping(string => uint256) public gameTotalDeposits;
    mapping(string => Deposit[]) public gameDeposits;
    mapping(address user => mapping(string gameId => bool)) public isPlayerInGame;

    event Deposited(
        uint256 fid,
        uint256 amount,
        address indexed depositorAddress,
        string gameId,
        uint256 depositId
    );

    event GameFundsWithdrawn(
        string gameId,
        address indexed recipient,
        uint256 amount
    );

    modifier onlyAdmin() {
        require(msg.sender == ADMIN, "Caller is not the admin");
        _;
    }

    function deposit(uint256 fid, string calldata gameId) public payable {
        require(msg.value == ENTRY_FEE, "Deposit amount must be equal to the entry fee");

        uint256 depositId = allDeposits.length;
        allDeposits.push(Deposit({
            fid: fid,
            amount: msg.value,
            depositorAddress: msg.sender,
            gameId: gameId
        }));

        gameTotalDeposits[gameId] += msg.value;
        gameDeposits[gameId].push(Deposit({
            fid: fid,
            amount: msg.value,
            depositorAddress: msg.sender,
            gameId: gameId
        }));

        isPlayerInGame[msg.sender][gameId] = true;

        emit Deposited(fid, msg.value, msg.sender, gameId, depositId);
    }

    function withdrawGameFunds(string calldata gameId, address payable recipient) public onlyAdmin {
        uint256 amountToWithdraw = gameTotalDeposits[gameId];
        require(amountToWithdraw > 0, "No funds to withdraw for this gameId");
        require(recipient != address(0), "Recipient address cannot be zero");

        gameTotalDeposits[gameId] = 0; // Prevent re-entrancy
        
        (bool success, ) = recipient.call{value: amountToWithdraw}("");
        require(success, "Failed to send Ether");

        emit GameFundsWithdrawn(gameId, recipient, amountToWithdraw);
    }

    // Helper function to allow admin to withdraw any ETH sent directly to the contract
    // This is not for game-specific funds, but for any ETH accidentally sent to the contract address.
    function withdrawContractBalance() public onlyAdmin {
        uint256 balance = address(this).balance;
        require(balance > 0, "Contract has no balance to withdraw");
        
        (bool success, ) = ADMIN.call{value: balance}("");
        require(success, "Failed to withdraw contract balance");
    }

    function getGameDeposits(string calldata gameId) public view returns (Deposit[] memory) {
        return gameDeposits[gameId];
    }

    // Fallback function to accept direct ETH transfers if necessary
    receive() external payable {}
    fallback() external payable {}
}