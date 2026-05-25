const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("BPTToken", function () {
  async function deployFixture() {
    const [treasury, operator, holder, outsider] = await ethers.getSigners();
    const BPTToken = await ethers.getContractFactory("BPTToken");
    const token = await upgrades.deployProxy(
      BPTToken,
      [treasury.address, operator.address],
      { kind: "uups", initializer: "initialize" }
    );
    await token.waitForDeployment();
    return { token, treasury, operator, holder, outsider };
  }

  it("initializes upgradeable ERC-20 metadata, roles, and zero supply", async function () {
    const { token, treasury, operator } = await deployFixture();

    expect(await token.name()).to.equal("Besu Private Tain");
    expect(await token.symbol()).to.equal("BPT");
    expect(await token.decimals()).to.equal(18n);
    expect(await token.totalSupply()).to.equal(0n);
    expect(await token.hasRole(await token.DEFAULT_ADMIN_ROLE(), treasury.address)).to.equal(true);
    expect(await token.hasRole(await token.UPGRADER_ROLE(), treasury.address)).to.equal(true);
    expect(await token.hasRole(await token.MINTER_ROLE(), operator.address)).to.equal(true);
    expect(await token.hasRole(await token.BURNER_ROLE(), operator.address)).to.equal(true);
  });

  it("allows only minters to mint", async function () {
    const { token, operator, holder, outsider } = await deployFixture();
    const amount = ethers.parseEther("100");

    await expect(token.connect(operator).mint(holder.address, amount))
      .to.emit(token, "Transfer")
      .withArgs(ethers.ZeroAddress, holder.address, amount);

    expect(await token.balanceOf(holder.address)).to.equal(amount);
    await expect(token.connect(outsider).mint(holder.address, amount)).to.be.reverted;
  });

  it("allows holders to self-burn and burn-role accounts to burn from another account", async function () {
    const { token, operator, holder, outsider } = await deployFixture();

    await token.connect(operator).mint(holder.address, ethers.parseEther("100"));
    await expect(token.connect(holder).burn(ethers.parseEther("10")))
      .to.emit(token, "Transfer")
      .withArgs(holder.address, ethers.ZeroAddress, ethers.parseEther("10"));
    await expect(token.connect(operator).burnByRole(holder.address, ethers.parseEther("25")))
      .to.emit(token, "Transfer")
      .withArgs(holder.address, ethers.ZeroAddress, ethers.parseEther("25"));

    expect(await token.balanceOf(holder.address)).to.equal(ethers.parseEther("65"));
    await expect(token.connect(outsider).burnByRole(holder.address, 1n)).to.be.reverted;
  });

  it("allows only upgraders to authorize implementation upgrades", async function () {
    const { token, treasury, outsider } = await deployFixture();
    const BPTToken = await ethers.getContractFactory("BPTToken");

    await expect(upgrades.upgradeProxy(await token.getAddress(), BPTToken.connect(outsider), { kind: "uups" }))
      .to.be.reverted;

    const upgraded = await upgrades.upgradeProxy(await token.getAddress(), BPTToken.connect(treasury), { kind: "uups" });
    expect(await upgraded.getAddress()).to.equal(await token.getAddress());
  });
});
