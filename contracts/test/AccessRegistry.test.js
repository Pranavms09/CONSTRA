import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;

describe("AccessRegistry", function () {
  let registry, owner, auditor, supervisor, stranger;

  beforeEach(async function () {
    [owner, auditor, supervisor, stranger] = await ethers.getSigners();
    registry = await ethers.deployContract("AccessRegistry");
    await registry.waitForDeployment();
  });

  it("lets the owner grant roles and emits RoleSet", async function () {
    await expect(registry.setRole(auditor.address, 3)).to.emit(registry, "RoleSet").withArgs(auditor.address, 3, owner.address);
    expect(await registry.roleOf(auditor.address)).to.equal(3);
  });

  it("lets an auditor grant and revoke other roles", async function () {
    await registry.setRole(auditor.address, 3);
    await registry.connect(auditor).setRole(supervisor.address, 1);
    expect(await registry.roleOf(supervisor.address)).to.equal(1);
    await registry.connect(auditor).setRole(supervisor.address, 0);
    expect(await registry.roleOf(supervisor.address)).to.equal(0);
  });

  it("rejects non-auditors, invalid roles, zero address and self-revocation", async function () {
    await registry.setRole(supervisor.address, 1);
    await expect(registry.connect(supervisor).setRole(stranger.address, 3)).to.be.revertedWith("Not an auditor");
    await expect(registry.connect(stranger).setRole(stranger.address, 3)).to.be.revertedWith("Not an auditor");
    await expect(registry.setRole(stranger.address, 4)).to.be.revertedWith("Invalid role");
    await expect(registry.setRole(ethers.ZeroAddress, 1)).to.be.revertedWith("Zero address");
    await registry.setRole(auditor.address, 3);
    await expect(registry.connect(auditor).setRole(auditor.address, 0)).to.be.revertedWith("Cannot revoke yourself");
  });

  it("restricts ownership transfer to the owner", async function () {
    await expect(registry.connect(stranger).transferOwnership(stranger.address)).to.be.revertedWith("Only owner");
    await registry.transferOwnership(auditor.address);
    expect(await registry.owner()).to.equal(auditor.address);
  });
});
