/* scripts/deploy.js */
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const CertificateRegistry = await hre.ethers.getContractFactory("CertificateRegistry");
    const registry = await CertificateRegistry.deploy();

    await registry.waitForDeployment();
    const address = registry.target;

    console.log("CertificateRegistry deployed to:", address);

    // --- THIS IS THE CRITICAL PART FOR DOCKER ---
    const addressPath = path.join(__dirname, "../client/contractAddress.txt");
    fs.writeFileSync(addressPath, address);
    console.log("Address saved to:", addressPath);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});