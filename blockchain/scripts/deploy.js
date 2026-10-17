const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const Registry = await hre.ethers.getContractFactory("ReportRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const address = await registry.getAddress();
  console.log("ReportRegistry deployed to:", address);

  const artifact = await hre.artifacts.readArtifact("ReportRegistry");
  const out = { address, abi: artifact.abi };
  fs.writeFileSync(
    path.join(__dirname, "..", "deployment.json"),
    JSON.stringify(out, null, 2)
  );
  console.log("Saved deployment.json");
}

main().catch((e) => { console.error(e); process.exit(1); });