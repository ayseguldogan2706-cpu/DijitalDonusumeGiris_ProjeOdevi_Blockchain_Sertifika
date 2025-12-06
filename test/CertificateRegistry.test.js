const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CertificateRegistry", function () {
    let registry;
    let owner;
    let otherAccount;

    beforeEach(async function () {
        // Get test accounts
        [owner, otherAccount] = await ethers.getSigners();

        // Deploy the contract before each test
        const Registry = await ethers.getContractFactory("CertificateRegistry");
        registry = await Registry.deploy();
    });

    it("Should issue and verify a certificate", async function () {
        const id = ethers.id("cert-1");
        const holderHash = ethers.keccak256(ethers.toUtf8Bytes("StudentData"));

        // Issue
        await registry.issue(id, holderHash, "Blockchain Course", "KTUN", 0);

        // Verify
        const result = await registry.verify(id, holderHash);
        expect(result.valid).to.equal(true);
        expect(result.title).to.equal("Blockchain Course");
    });

    it("Should revoke a certificate", async function () {
        const id = ethers.id("cert-2");
        const holderHash = ethers.keccak256(ethers.toUtf8Bytes("StudentData"));

        // Issue
        await registry.issue(id, holderHash, "Blockchain Course", "KTUN", 0);

        // Revoke
        await registry.revoke(id);

        // Verify (Should be revoked)
        const result = await registry.verify(id, holderHash);
        expect(result.valid).to.equal(false);
        expect(result.isRevoked).to.equal(true);
    });

    it("Should fail if non-owner tries to issue", async function () {
        const id = ethers.id("cert-hack");
        const holderHash = ethers.keccak256(ethers.toUtf8Bytes("HackerData"));

        // Try to issue with a different account (otherAccount)
        await expect(
            registry.connect(otherAccount).issue(id, holderHash, "Fake Cert", "Hacker", 0)
        ).to.be.revertedWith("not owner");
    });
});