# Hardhat Standards

Detected via `hardhat.config.ts` or `hardhat.config.js`. JavaScript/TypeScript-based Ethereum development environment.

## When to Use

- TypeScript-heavy dev team — Hardhat plays well with TS toolchain
- Need a rich plugin ecosystem (Hardhat plugins for almost everything)
- Want to write deploy scripts + tests in JS/TS
- Integration with frontend tooling (Next.js + ethers/viem)

For pure Solidity testing + speed, **Foundry** is faster + has cleaner test syntax. Many teams use both: Hardhat for deploy + ops, Foundry for tests.

## Setup

```bash
npm install --save-dev hardhat
npx hardhat init        # generates config + sample contracts
```

```ts
// hardhat.config.ts
import "@nomicfoundation/hardhat-toolbox";

const config = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL!,
      accounts: [process.env.DEPLOYER_KEY!],
    },
    mainnet: {
      url: process.env.MAINNET_RPC_URL!,
      accounts: [process.env.DEPLOYER_KEY!],
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY!,
  },
};

export default config;
```

`@nomicfoundation/hardhat-toolbox` bundles ethers v6, chai-matchers, gas-reporter, verify, ignition.

## Project Structure

```
contracts/                # Solidity source
├── Token.sol
└── interfaces/
test/                      # JS/TS tests (Mocha + Chai)
├── Token.test.ts
scripts/                   # Deploy + admin scripts
├── deploy.ts
ignition/                  # Hardhat Ignition modules (modern deploy)
└── modules/
hardhat.config.ts
```

## Tests (Mocha + Chai)

```ts
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Token", function () {
  async function deployFixture() {
    const [owner, alice, bob] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("Token");
    const token = await Token.deploy("MyToken", "MTK", 1_000_000n * 10n ** 18n);
    return { token, owner, alice, bob };
  }

  it("assigns initial supply to deployer", async function () {
    const { token, owner } = await loadFixture(deployFixture);
    expect(await token.balanceOf(owner.address)).to.equal(1_000_000n * 10n ** 18n);
  });

  it("reverts when non-owner tries to mint", async function () {
    const { token, alice } = await loadFixture(deployFixture);
    await expect(token.connect(alice).mint(alice.address, 100n))
      .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
  });
});
```

`loadFixture` snapshots EVM state — much faster than redeploying for each test.

## Hardhat Ignition (Modern Deploy)

`ignition/modules/Token.ts`:
```ts
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("Token", (m) => {
  const initialSupply = m.getParameter("initialSupply", 1_000_000n * 10n ** 18n);
  const token = m.contract("Token", ["MyToken", "MTK", initialSupply]);
  return { token };
});
```

```bash
npx hardhat ignition deploy ignition/modules/Token.ts --network sepolia
```

Ignition is **declarative** — you describe what should exist, it figures out what to deploy + handles re-runs idempotently.

## Old-Style Deploy Scripts (Still Common)

```ts
// scripts/deploy.ts
import { ethers } from "hardhat";

async function main() {
  const Token = await ethers.getContractFactory("Token");
  const token = await Token.deploy("MyToken", "MTK", 1_000_000n * 10n ** 18n);
  await token.waitForDeployment();
  console.log("Token deployed to:", await token.getAddress());
}

main().catch((e) => { console.error(e); process.exit(1); });
```

```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

## Forking Mainnet

Test against real mainnet state without using real ETH:

```ts
networks: {
  hardhat: {
    forking: {
      url: process.env.MAINNET_RPC_URL!,
      blockNumber: 19000000,    // pin block for reproducibility
    },
  },
},
```

Now you can interact with deployed contracts (Uniswap, USDC, etc.) in your tests.

## Verification (Etherscan)

```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS> "MyToken" "MTK" 1000000000000000000000000
```

Compiles, matches bytecode, uploads source to Etherscan. Critical for users to read your contract.

## Gas Reporting

```ts
// hardhat.config.ts
gasReporter: {
  enabled: true,
  currency: "USD",
  coinmarketcap: process.env.CMC_API_KEY,
},
```

Test output shows gas costs per function — track regressions.

## Hardhat Network (Local)

```bash
npx hardhat node       # starts local EVM with 20 funded accounts
```

Same as forking mainnet but starts fresh. Use for unit tests + local frontend dev.

## Plugins (Useful Ones)

| Plugin | Purpose |
|---|---|
| `@nomicfoundation/hardhat-toolbox` | Bundle of essentials |
| `@nomicfoundation/hardhat-ignition` | Declarative deploys |
| `hardhat-deploy` | Older deploy framework (deterministic addresses, etc.) |
| `hardhat-gas-reporter` | Gas costs in test output |
| `solidity-coverage` | Code coverage for tests |
| `@nomicfoundation/hardhat-verify` | Etherscan verification |
| `@openzeppelin/hardhat-upgrades` | Upgradeable contracts via proxy |
| `hardhat-storage-layout` | Inspect contract storage layout |

## Best Practices

- **Pin Solidity version** in config + contracts — no `^0.8.0`
- **Use Ignition** for new projects — declarative, idempotent
- **Test against forked mainnet** for integration scenarios
- **Pin block number** in forking config — reproducible tests
- **Use `loadFixture`** in tests — much faster than redeploying
- **OpenZeppelin** for standard contracts (ERC20, ERC721, AccessControl)
- **`viaIR: true`** for complex contracts — better optimization, sometimes required for stack-too-deep
- **Run `hardhat verify`** immediately after deploy — easier when you remember constructor args

## Common Pitfalls

- Forgetting `--network <name>` → deploys to default Hardhat Network (lost when process exits)
- Constructor args mismatch in verify → upload fails silently or with cryptic error
- Hardcoded RPC URLs or private keys → check env vars + `.env` excluded from git
- Reusing deploy script for upgrade → use OpenZeppelin upgrades plugin
- Snapshot-based fixtures don't persist across test files → use `loadFixture` per describe
- Old `hardhat-waffle` syntax (`.to.emit(...)`) in chai-matchers → migrate to `@nomicfoundation/hardhat-chai-matchers`

## Resources

- Docs: https://hardhat.org/docs
- Plugins: https://hardhat.org/plugins
- Ignition: https://hardhat.org/ignition
- ethers v6: https://docs.ethers.org/v6
- OpenZeppelin: https://docs.openzeppelin.com/contracts
