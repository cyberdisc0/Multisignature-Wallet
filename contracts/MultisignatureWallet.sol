// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

contract MultisignatureWallet {
    event Deposit(address indexed sender, uint amount, uint balance);        
    event ProposeTx(address indexed owner, uint _txIndex, address _to, uint _value, bytes _data);        
    event ApproveTx(address owner, uint _txIndex);                            
    event CancelApproval(address owner, uint _txIndex);
    event ExecuteTx(address owner, uint _txIndex);

    address[] public owners; 
    uint public numRequiredApprovals;
    mapping(address => bool) public isOwner; 

    struct Tx{                  
        address to;              
        uint value;             
        bytes data;             
        uint numApprovals;      
        bool executed;          
    }

    Tx[] public proposals;   
    mapping(uint => mapping(address => bool)) public hasApproved;  


    constructor(address[] memory _owners, uint _numRequiredApprovals) {
        require(_owners.length > 0, "must have at least one owner");
        require(_numRequiredApprovals <= _owners.length, "required approvals must be less than or equal to the number of owners");
        require(_numRequiredApprovals > 0, "must require at least one approval");
        for(uint i = 0; i < _owners.length; i++){
            address owner = _owners[i];
            require(owner != address(0), "zero address cannot be owner");
            require(!isOwner[owner], "only one owner per address");
            isOwner[owner] = true;
            owners.push(owner);
        }
        numRequiredApprovals = _numRequiredApprovals;
    }

    receive() external payable {
        emit Deposit(msg.sender, msg.value, address(this).balance);
    }

    modifier onlyOwner() {
        require(isOwner[msg.sender] == true, "only owners can access this function");
        _;
    }

    modifier txExists(uint _txIndex){
        require(_txIndex < proposals.length, "tx does not exist");
        _;
        
    }

    modifier txNotExecuted(uint _txIndex){
        require(!proposals[_txIndex].executed, "tx already executed");
        _;
    }

    modifier txApproved(uint _txIndex){
        require(hasApproved[_txIndex][msg.sender]);
        _;
    }

    modifier txNotApproved(uint _txIndex){
        require(!hasApproved[_txIndex][msg.sender], "Tx has already been approved by this owner");
        _;
    }


    function getBalance() public view returns(uint) {
        return address(this).balance;
    }  

    function deposit() external payable {
        emit Deposit(msg.sender, msg.value, address(this).balance);
    }

    function proposeTx(address _to, uint _value, bytes memory _data) public onlyOwner {
        uint txIndex = proposals.length;
        proposals.push(Tx({
            to: _to,
            value: _value,
            data: _data, 
            numApprovals: 0,
            executed: false
        }));
        
        emit ProposeTx(msg.sender, txIndex, _to, _value, _data);
    }

    function approveTx(uint _txIndex) 
        public 
        onlyOwner
        txExists(_txIndex)
        txNotExecuted(_txIndex)
        txNotApproved(_txIndex)
    {
        Tx storage transaction = proposals[_txIndex];
        transaction.numApprovals += 1;
        hasApproved[_txIndex][msg.sender] = true;

        emit ApproveTx(msg.sender, _txIndex);
    }

    function cancelApproval(uint _txIndex)
        public
        onlyOwner
        txExists(_txIndex)
        txNotExecuted(_txIndex)
        txApproved(_txIndex)
    {
        hasApproved[_txIndex][msg.sender] = false;
        proposals[_txIndex].numApprovals--;
        emit CancelApproval(msg.sender, _txIndex);
    }

    function executeTx(uint _txIndex) 
        public 
        onlyOwner
        txExists(_txIndex)
        txNotExecuted(_txIndex)
    {
        Tx storage transaction = proposals[_txIndex];
        require(transaction.numApprovals >= numRequiredApprovals, "have not reached required number of approvals");
        transaction.executed = true;
        (bool sent, ) = transaction.to.call{value: transaction.value}(transaction.data);
        require(sent, "failed to send ether");
        emit ExecuteTx(msg.sender, _txIndex);
     }

    function getOwners() public view returns (address[] memory) {
        return owners;
    }
    
    function getTxCount() public view returns (uint) {
        return proposals.length;
    }

    function getTx(uint _txIndex)
        public
        view
        returns (
            address to,
            uint value,
            bytes memory data,
            bool executed,
            uint numConfirmations
        )
    {
        Tx storage transaction = proposals[_txIndex];

        return (
            transaction.to,
            transaction.value,
            transaction.data,
            transaction.executed,
            transaction.numApprovals
        );
    }
}
