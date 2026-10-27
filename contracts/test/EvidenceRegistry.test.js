import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;

describe("EvidenceRegistry", function () {
  let EvidenceRegistry;
  let registry;
  let owner, nonOwner, newOwner;

  const sampleHash1 = ethers.keccak256(ethers.toUtf8Bytes("photo-evidence-1"));
  const sampleHash2 = ethers.keccak256(ethers.toUtf8Bytes("challan-evidence-2"));
  const sampleHash3 = ethers.keccak256(ethers.toUtf8Bytes("cert-evidence-3"));
  const zeroHash = ethers.ZeroHash;

  beforeEach(async function () {
    [owner, nonOwner, newOwner] = await ethers.getSigners();
    EvidenceRegistry = await ethers.getContractFactory("EvidenceRegistry");
    registry = await EvidenceRegistry.deploy();
    await registry.waitForDeployment();
  });

  it("should initialize owner correctly", async function () {
    expect(await registry.owner()).to.equal(owner.address);
  });

  describe("Single anchor", function () {
    it("should allow owner to anchor a hash and emit Anchored event", async function () {
      const tx = await registry.anchor(sampleHash1, 1);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      const [storedTime, kind] = await registry.verify(sampleHash1);
      expect(storedTime).to.equal(block.timestamp);
      expect(kind).to.equal(1);

      await expect(tx)
        .to.emit(registry, "Anchored")
        .withArgs(sampleHash1, 1, block.timestamp, owner.address);
      expect(await registry.anchoredBy(sampleHash1)).to.equal(owner.address);
    });

    it("should revert if non-anchorer tries to anchor", async function () {
      await expect(
        registry.connect(nonOwner).anchor(sampleHash1, 1)
      ).to.be.revertedWith("Not an anchorer");
    });

    it("should revert on invalid kind", async function () {
      await expect(registry.anchor(sampleHash1, 0)).to.be.revertedWith("Invalid kind");
      await expect(registry.anchor(sampleHash1, 4)).to.be.revertedWith("Invalid kind");
    });

    it("should revert if hash is zero", async function () {
      await expect(
        registry.anchor(zeroHash, 1)
      ).to.be.revertedWith("Zero hash");
    });

    it("should revert if hash is already anchored (duplicate)", async function () {
      await registry.anchor(sampleHash1, 1);
      await expect(
        registry.anchor(sampleHash1, 1)
      ).to.be.revertedWith("Already anchored");
    });
  });

  describe("Batch anchor (anchorMany)", function () {
    it("should allow owner to anchor batch of hashes", async function () {
      await registry.anchorMany([sampleHash1, sampleHash2], [1, 2]);

      const [time1, kind1] = await registry.verify(sampleHash1);
      const [time2, kind2] = await registry.verify(sampleHash2);

      expect(time1).to.be.gt(0);
      expect(kind1).to.equal(1);
      expect(time2).to.be.gt(0);
      expect(kind2).to.equal(2);
    });

    it("should revert if non-anchorer calls anchorMany", async function () {
      await expect(
        registry.connect(nonOwner).anchorMany([sampleHash1], [1])
      ).to.be.revertedWith("Not an anchorer");
    });

    it("should revert if lengths mismatch", async function () {
      await expect(
        registry.anchorMany([sampleHash1, sampleHash2], [1])
      ).to.be.revertedWith("Length mismatch");
    });

    it("should revert if batch size exceeds 50", async function () {
      const hashes = Array(51).fill(sampleHash1);
      const kinds = Array(51).fill(1);
      await expect(
        registry.anchorMany(hashes, kinds)
      ).to.be.revertedWith("Batch size must be 1-50");
    });

    it("should skip duplicates and zero hashes without reverting the batch", async function () {
      // First anchor sampleHash1
      await registry.anchor(sampleHash1, 1);
      const [originalTime] = await registry.verify(sampleHash1);

      // Now batch with sampleHash1 (duplicate), zeroHash, and sampleHash2 (new)
      const tx = await registry.anchorMany(
        [sampleHash1, zeroHash, sampleHash2],
        [1, 1, 2]
      );
      await tx.wait();

      // sampleHash1 should retain its original time
      const [time1] = await registry.verify(sampleHash1);
      expect(time1).to.equal(originalTime);

      // zeroHash should remain unanchored
      const [timeZero] = await registry.verify(zeroHash);
      expect(timeZero).to.equal(0);

      // sampleHash2 should be newly anchored
      const [time2, kind2] = await registry.verify(sampleHash2);
      expect(time2).to.be.gt(0);
      expect(kind2).to.equal(2);
    });
  });

  describe("Verification", function () {
    it("should return time 0 and kind 0 for unanchored hash", async function () {
      const [time, kind] = await registry.verify(sampleHash3);
      expect(time).to.equal(0);
      expect(kind).to.equal(0);
    });

    it("should return accurate stored timestamp and kind for anchored hash", async function () {
      await registry.anchor(sampleHash3, 3);
      const [time, kind] = await registry.verify(sampleHash3);
      expect(time).to.be.gt(0);
      expect(kind).to.equal(3);
    });
  });

  describe("Anchorer authorization", function () {
    it("lets an authorized auditor wallet anchor a certificate and records it as anchoredBy", async function () {
      await expect(registry.setAnchorer(nonOwner.address, true))
        .to.emit(registry, "AnchorerUpdated")
        .withArgs(nonOwner.address, true);
      await registry.connect(nonOwner).anchor(sampleHash3, 3);
      const [time, kind, by] = await registry.verify(sampleHash3);
      expect(time).to.be.gt(0);
      expect(kind).to.equal(3);
      expect(by).to.equal(nonOwner.address);
    });

    it("blocks revoked anchorers and non-owners managing anchorers", async function () {
      await registry.setAnchorer(nonOwner.address, true);
      await registry.setAnchorer(nonOwner.address, false);
      await expect(registry.connect(nonOwner).anchor(sampleHash1, 1)).to.be.revertedWith("Not an anchorer");
      await expect(registry.connect(nonOwner).setAnchorer(newOwner.address, true)).to.be.revertedWith("Only owner");
      await expect(registry.setAnchorer(ethers.ZeroAddress, true)).to.be.revertedWith("Zero address");
    });

    it("skips invalid kinds inside a batch", async function () {
      await registry.anchorMany([sampleHash1, sampleHash2], [9, 2]);
      expect((await registry.verify(sampleHash1))[0]).to.equal(0);
      expect((await registry.verify(sampleHash2))[1]).to.equal(2);
    });
  });

  describe("Ownership transfer", function () {
    it("should allow owner to transfer ownership", async function () {
      await expect(registry.transferOwnership(newOwner.address))
        .to.emit(registry, "OwnershipTransferred")
        .withArgs(owner.address, newOwner.address);

      expect(await registry.owner()).to.equal(newOwner.address);

      // Previous owner can no longer anchor
      await expect(
        registry.anchor(sampleHash1, 1)
      ).to.be.revertedWith("Not an anchorer");

      // New owner can anchor
      await expect(
        registry.connect(newOwner).anchor(sampleHash1, 1)
      ).to.not.be.reverted;
    });

    it("should revert if non-owner attempts to transfer ownership", async function () {
      await expect(
        registry.connect(nonOwner).transferOwnership(newOwner.address)
      ).to.be.revertedWith("Only owner");
    });

    it("should revert if new owner is zero address", async function () {
      await expect(
        registry.transferOwnership(ethers.ZeroAddress)
      ).to.be.revertedWith("New owner is zero address");
    });
  });
});
