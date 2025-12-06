/* client/index.js */
require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
// Account 0 Private Key
const ISSUER_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

function getContractAddress() {
    const addressPath = path.join(__dirname, "contractAddress.txt");
    if (!fs.existsSync(addressPath)) return null;
    return fs.readFileSync(addressPath, "utf8").trim();
}

async function main() {
    console.log("--- CLIENT STARTED ---");

    // Setup provider first
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(ISSUER_PRIVATE_KEY, provider);

    // 1. Wait for Valid Contract Address
    // We check for the file AND verify the contract exists on-chain.
    // If the file exists but the contract code is empty (0x), it means it's from an old chain session.
    let contractAddress = null;
    for (let i = 0; i < 60; i++) {
        const addr = getContractAddress();
        if (addr) {
            try {
                const code = await provider.getCode(addr);
                if (code !== "0x") {
                    console.log("Contract verified on chain!");
                    contractAddress = addr;
                    break;
                } else {
                    console.log(`Found address ${addr} but no code on chain (stale?). Waiting...`);
                }
            } catch (e) {
                console.log("Error checking code:", e.message);
            }
        }
        console.log(`Waiting for contract deployment... (${i + 1}/60)`);
        await new Promise(r => setTimeout(r, 2000));
    }

    if (!contractAddress) {
        console.error("Error: Contract address not found or not deployed after 2 minutes.");
        process.exit(1);
    }
    console.log(`Contract Address: ${contractAddress}`);

    // DEBUG: Check Balance
    const balance = await provider.getBalance(wallet.address);
    console.log(`Wallet Balance: ${ethers.formatEther(balance)} ETH`);

    const abi = [
        "function issue(bytes32 id, bytes32 holderHash, string title, string issuer, uint64 expiresAt) external",
        "function revoke(bytes32 id) external", // <--- THIS LINE IS MISSING IN YOUR FILE!
        "function verify(bytes32 id, bytes32 holderHash) external view returns (bool valid, bool isRevoked, uint64 issuedAt, uint64 expiresAt, string title, string issuer)"
    ];

    const contract = new ethers.Contract(contractAddress, abi, wallet);

    // 3. Prepare Data
    const studentName = "Ali Veli";
    const studentNo = "123456";
    const salt = ethers.randomBytes(32).toString('hex');
    const payload = `${studentNo}|${studentName.toUpperCase().trim()}|${salt}`;
    const holderHash = ethers.keccak256(ethers.toUtf8Bytes(payload));

    // Use Date.now() to ensure ID is always unique
    const certId = ethers.id("cert-" + Date.now());

    console.log("\n--- ISSUING CERTIFICATE ---");

    // Get current nonce from network (use 'pending' to include unconfirmed txs)
    let currentNonce = await provider.getTransactionCount(wallet.address, "pending");
    console.log("Current Nonce for Issue:", currentNonce);

    // 4. THE FIX: FORCE LEGACY TRANSACTION with explicit nonce
    let overrides = {
        gasLimit: 3000000,
        gasPrice: ethers.parseUnits("20", "gwei"),
        type: 0, // Legacy Transaction
        nonce: currentNonce
    };

    try {
        const tx = await contract.issue(
            certId,
            holderHash,
            "Blockchain 101",
            "Konya Teknik Univ",
            0,
            overrides
        );
        console.log("Transaction Hash:", tx.hash);

        console.log("Waiting for confirmation...");
        await tx.wait();
        console.log("SUCCESS: Certificate Issued.");
    } catch (err) {
        console.error("CRITICAL ERROR DURING ISSUE:");
        console.error(err);
        process.exit(1); // Stop here if issue fails
    }

    // 5. Verify
    console.log("\n--- VERIFYING CERTIFICATE ---");
    try {
        let result = await contract.verify(certId, holderHash);
        console.log("Is Valid?", result.valid);

        if (result.valid) {
            console.log("SUCCESS: Certificate is valid.");
        } else {
            console.log("FAILURE: Certificate invalid.");
        }

        // 6. Revoke
        console.log("\n--- REVOKING CERTIFICATE ---");

        // Manually increment nonce (issue tx used currentNonce, so revoke uses currentNonce + 1)
        currentNonce = currentNonce + 1;
        console.log("Current Nonce for Revoke:", currentNonce);
        overrides.nonce = currentNonce;

        const revokeTx = await contract.revoke(certId, overrides);
        console.log("Revoke Hash:", revokeTx.hash);
        await revokeTx.wait();
        console.log("SUCCESS: Certificate Revoked.");

        // 7. Verify Again (Should be invalid)
        console.log("\n--- VERIFYING AFTER REVOCATION ---");
        result = await contract.verify(certId, holderHash);
        console.log("Is Valid?", result.valid);
        console.log("Is Revoked?", result.isRevoked);

        if (!result.valid && result.isRevoked) {
            console.log("FINAL SUCCESS: Full Issue -> Verify -> Revoke cycle works!");
        } else {
            console.log("FAILURE: Revocation check failed.");
        }

    } catch (err) {
        console.error("VERIFY/REVOKE ERROR:", err);
    }
}

main().catch(console.error);