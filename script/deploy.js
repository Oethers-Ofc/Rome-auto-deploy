const { ethers } = require("hardhat");

async function main() {
  const tokens = [
    { name: "TokenA", symbol: "TKA", supply: ethers.parseEther("1000000") },
    { name: "TokenB", symbol: "TKB", supply: ethers.parseEther("2000000") },
  ];

  for (const token of tokens) {
    const Token = await ethers.getContractFactory("Token");
    const contract = await Token.deploy(token.name, token.symbol, token.supply);
    await contract.waitForDeployment();

    console.log(`${token.name} deployed at:`, await contract.getAddress());
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

