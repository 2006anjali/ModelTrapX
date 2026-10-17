const hre = require("hardhat");
async function main() {
  const [funder] = await hre.ethers.getSigners();
  const tx = await funder.sendTransaction({
    to: "0x6A81deC3DF4c74d87548A151b27b028a3a15e588",
    value: hre.ethers.parseEther("100"),
  });
  await tx.wait();
  const bal = await hre.ethers.provider.getBalance("0x6A81deC3DF4c74d87548A151b27b028a3a15e588");
  console.log("Balance:", hre.ethers.formatEther(bal), "ETH");
}
main().catch((e) => { console.error(e); process.exit(1); });