const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ReportRegistry", function () {
  const hash = "0x" + "ab".repeat(32);
  const otherHash = "0x" + "cd".repeat(32);

  async function deploy() {
    const [owner, other] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("ReportRegistry");
    const registry = await Registry.deploy();
    await registry.waitForDeployment();
    return { registry, owner, other };
  }

  it("registers a report hash and stores its metadata", async function () {
    const { registry, owner } = await deploy();
    await registry.registerReport(hash, "feature_scale_stress_v1", "v1 vs v2 demo");

    expect(await registry.isRegistered(hash)).to.equal(true);

    const record = await registry.getReport(hash);
    expect(record.submitter).to.equal(owner.address);
    expect(record.testSuite).to.equal("feature_scale_stress_v1");
    expect(record.metadata).to.equal("v1 vs v2 demo");
    expect(record.timestamp).to.be.gt(0);
  });

  it("emits an event when a report is registered", async function () {
    const { registry, owner } = await deploy();
    await expect(registry.registerReport(hash, "suite", "meta"))
      .to.emit(registry, "ReportRegistered")
      .withArgs(hash, owner.address);
  });

  it("rejects a hash that is already registered", async function () {
    const { registry } = await deploy();
    await registry.registerReport(hash, "suite", "meta");
    await expect(registry.registerReport(hash, "suite", "meta")).to.be.revertedWith(
      "Report already registered"
    );
  });

  it("rejects an empty hash", async function () {
    const { registry } = await deploy();
    await expect(
      registry.registerReport(ethers.ZeroHash, "suite", "meta")
    ).to.be.revertedWith("Empty hash");
  });

  it("reports an unknown hash as not registered", async function () {
    const { registry } = await deploy();
    expect(await registry.isRegistered(otherHash)).to.equal(false);
    await expect(registry.getReport(otherHash)).to.be.revertedWith("Report not found");
  });

  it("records the address of whoever submitted the hash", async function () {
    const { registry, other } = await deploy();
    await registry.connect(other).registerReport(otherHash, "suite", "meta");
    const record = await registry.getReport(otherHash);
    expect(record.submitter).to.equal(other.address);
  });
});
