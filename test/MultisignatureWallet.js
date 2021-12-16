const { EtherscanProvider } = require('@ethersproject/providers');
const { expect } = require('chai');
const { ethers } = require('hardhat');


describe('Multisignature Wallet', () => {
    let owner1, owner2, owner3, notOwner;
    let owners;
    let MSW, msw;
    const NUM_REQUIRED_APPROVALS = 2;

    beforeEach(async () => {
        [owner1, owner2, owner3, notOwner, _] = await ethers.getSigners();
        owners = [owner1.address, owner2.address, owner3.address];

        MSW = await ethers.getContractFactory('MultisignatureWallet');
        msw = await MSW.deploy(owners, NUM_REQUIRED_APPROVALS);
    });

    describe("Constructor", () => {
        it('Should assign the correct addresses as owners', async () => {      
            expect(await msw.owners(0)).to.equal(owner1.address);
            expect(await msw.owners(1)).to.equal(owner2.address);
            expect(await msw.owners(2)).to.equal(owner3.address);
        });
    
        it('Should assign the correct number of required approvals', async () => { 
            expect(await msw.numRequiredApprovals()).to.equal(NUM_REQUIRED_APPROVALS);
        });

        it('Number of owners should be correct', async () => { 
            expect((await msw.getOwners()).length).to.equal(owners.length);
        });

        it("should revert if no owners", async () => {
            await expect(MSW.deploy([], NUM_REQUIRED_APPROVALS)).to.be.reverted;
        });

        it("should revert if number of required approvals > number of owners", async () => {
            await expect(MSW.deploy(owners, owners.length + 1)).to.be.reverted;
        });

        it("should revert if owners not unique", async () => {
            let ownersWithRepeat = [owner1.address, owner1.address, owner3.address];
            await expect(MSW.deploy(ownersWithRepeat, NUM_REQUIRED_APPROVALS)).to.be.reverted;
        });  
    });

    describe("Transaction Process", () => {

        beforeEach(() => {
            to = notOwner.address;
            value = ethers.utils.parseEther("2.0");
            data = "0x00";
        });

        describe("Propose Tx", () => {
            it("should start with 0 proposals", async () => {
                expect(await msw.getTxCount()).to.equal(0);
            });

            it("should create proposal with correct values", async () => {
                await msw.proposeTx(to, value, data);
                const [_to, _value, _data, _executed, _numApprovals] = await msw.getTx(0);

                expect(to).to.equal(_to)
                expect(value).to.equal(_value)
                expect(data).to.equal(_data)
                expect(_executed).to.equal(false)
                expect(_numApprovals).to.equal(0)
            });

            it("should reject if not owner", async () => {
                await expect(msw.connect(notOwner).proposeTx(to, value, data)).to.be.revertedWith("only owners can access this function");
            });
        });

        describe("Approve Tx", () => {
            beforeEach(async () => {
                await msw.proposeTx(to, value, data);
            });

            it("should approve Tx", async () => {
                await msw.approveTx(0);
                const [_to, _value, _data, _executed, _numApprovals] = await msw.getTx(0);
                expect(_numApprovals).to.equal(1)
            });

            it("should reject if not owner", async () => {
                await expect(msw.connect(notOwner).approveTx(0)).to.be.revertedWith("only owners can access this function");
            });

            it("should reject if tx does not exist", async () => {
                await expect(msw.approveTx(1)).to.be.revertedWith("tx does not exist");
            });

            it("should reject if already approved by owner", async () => {
                await msw.approveTx(0);
                await expect(msw.approveTx(0)).to.be.revertedWith("Tx has already been approved by this owner");
            });    
        });

        describe("Executing Tx", () => {
            beforeEach(async () => {
                await msw.deposit({value: ethers.utils.parseEther("2.0")});
                await msw.proposeTx(to, value, data);
                await msw.approveTx(0);
                await msw.connect(owner2).approveTx(0);
              });
            
            it("should execute", async () => {
                await msw.executeTx(0);
                const tx = await msw.getTx(0);
                expect(tx.executed).to.equal(true);
            });

            it("should reject is already executed", async () => {
                await msw.executeTx(0);
                await expect(msw.executeTx(0)).to.be.revertedWith("tx already executed");
            });

            it("should reject if not owner", async () => {
                await expect(msw.connect(notOwner).executeTx(0)).to.be.revertedWith("only owners can access this function");
            });

            it("should reject if tx does not exist", async () => {
                await expect(msw.executeTx(1)).to.be.revertedWith("tx does not exist");
            });
        });

        describe("Cancel Approval", () => {
            beforeEach(async () => {
            await msw.proposeTx(to, value, data);
            await msw.approveTx(0);                
            });

            it("should cancel approval", async () => {
                expect(await msw.hasApproved(0, owner1.address)).to.equal(true);
                await msw.cancelApproval(0);
                expect(await msw.hasApproved(0, owner1.address)).to.equal(false);
            });

            it("should reject if not owner", async () => {
                await expect(msw.connect(notOwner).cancelApproval(0)).to.be.revertedWith("only owners can access this function");
            });

            it("should reject if tx does not exist", async () => {
                await expect(msw.cancelApproval(1)).to.be.revertedWith("tx does not exist");
            });
        });
    });
});
