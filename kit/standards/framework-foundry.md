# Foundry Standards

Detected via `foundry.toml`. Rust-based, **blazingly fast** Solidity development framework.

## When to Use

- Want **fast** test execution (10-100x faster than Hardhat for compute-heavy tests)
- Prefer writing **tests in Solidity** itself (no JS context switch)
- Need built-in fuzz testing + invariant testing
- Doing serious DeFi / protocol development — Foundry is the security-team favorite

Many teams: Hardhat for deploys + frontend integration, **Foundry for testing**.

## Setup

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup     # installs forge, cast, anvil, chisel
forge init my-project
```

```
my-project/
├── foundry.toml
├── src/                  # Solidity contracts
│   └── Token.sol
├── test/                 # Solidity tests
│   └── Token.t.sol
├── script/               # Deploy scripts (in Solidity!)
│   └── Token.s.sol
└── lib/                  # Dependencies (git submodules)
```

## foundry.toml

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.24"
optimizer = true
optimizer_runs = 200
via_ir = true

[fuzz]
runs = 1000

[invariant]
runs = 256
depth = 256

[rpc_endpoints]
mainnet = "${MAINNET_RPC_URL}"
sepolia = "${SEPOLIA_RPC_URL}"

[etherscan]
mainnet = { key = "${ETHERSCAN_API_KEY}" }
```

## Tests

```solidity
// test/Token.t.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/Token.sol";

contract TokenTest is Test {
    Token token;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        token = new Token("MyToken", "MTK", 1_000_000 ether);
    }

    function test_InitialBalance() public {
        assertEq(token.balanceOf(address(this)), 1_000_000 ether);
    }

    function test_Transfer() public {
        token.transfer(alice, 100 ether);
        assertEq(token.balanceOf(alice), 100 ether);
    }

    function test_RevertWhen_InsufficientBalance() public {
        vm.expectRevert();
        vm.prank(alice);
        token.transfer(bob, 1 ether);    // alice has 0
    }
}
```

Run:
```bash
forge test                          # run all
forge test --match-test Transfer    # filter
forge test -vvvv                    # verbose (4 v's = full traces)
forge test --gas-report             # gas costs per fn
```

## Fuzz Tests (Property-Based)

```solidity
function testFuzz_Transfer(uint256 amount) public {
    amount = bound(amount, 0, 1_000_000 ether);     // constrain to valid range
    token.transfer(alice, amount);
    assertEq(token.balanceOf(alice), amount);
}
```

`bound(value, min, max)` is Foundry's recommended way to constrain fuzz inputs. Runs N random samples (configured via `[fuzz].runs`).

## Invariant Tests (Stateful Fuzz)

```solidity
contract TokenInvariants is Test {
    Token token;
    Handler handler;        // a contract that performs random actions

    function setUp() public {
        token = new Token("MTK", "MTK", 1_000_000 ether);
        handler = new Handler(token);
        targetContract(address(handler));
    }

    function invariant_TotalSupplyConstant() public {
        assertEq(token.totalSupply(), 1_000_000 ether);
    }
}
```

Foundry runs random sequences of Handler actions, checks invariants hold. Catches subtle bugs that simple fuzz misses.

## Forking + Mainnet Tests

```solidity
contract MainnetForkTest is Test {
    function setUp() public {
        vm.createSelectFork("mainnet", 19000000);
    }

    function test_RealUSDC() public {
        IERC20 usdc = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
        // interact with real mainnet contracts
    }
}
```

Or via CLI: `forge test --fork-url $MAINNET_RPC_URL --fork-block-number 19000000`.

## Cheatcodes (vm.*)

Foundry's `vm` (from `forge-std/Test.sol`) gives test superpowers:

```solidity
vm.prank(alice);                            // next call from alice
vm.startPrank(alice); vm.stopPrank();        // multiple calls from alice
vm.deal(alice, 10 ether);                   // set ETH balance
vm.warp(block.timestamp + 1 days);           // skip time
vm.roll(block.number + 100);                 // skip blocks
vm.expectRevert(MyError.selector);           // expect specific error
vm.expectEmit(true, true, false, true);       // expect specific event
emit Transfer(alice, bob, 100);              // event to match

uint256 snapshot = vm.snapshot();
// ... do stuff
vm.revertTo(snapshot);                       // undo all state changes

vm.label(alice, "Alice");                    // friendly name in traces
vm.envUint("FORK_BLOCK");                    // read env var
vm.skip(true);                                // skip this test
```

## Deploy Scripts (Solidity!)

```solidity
// script/Token.s.sol
import "forge-std/Script.sol";
import "../src/Token.sol";

contract DeployToken is Script {
    function run() external returns (Token) {
        uint256 deployerKey = vm.envUint("DEPLOYER_KEY");
        vm.startBroadcast(deployerKey);
        Token token = new Token("MyToken", "MTK", 1_000_000 ether);
        vm.stopBroadcast();
        return token;
    }
}
```

```bash
forge script script/Token.s.sol --rpc-url sepolia --broadcast --verify
```

## cast (CLI Tool)

```bash
# Read contract state
cast call 0x... "balanceOf(address)" 0x... --rpc-url mainnet

# Send tx
cast send 0x... "transfer(address,uint256)" 0xrecipient 100 \
    --private-key $KEY --rpc-url mainnet

# Decode ABI
cast 4byte 0xa9059cbb        # → "transfer(address,uint256)"

# Convert units
cast --to-wei 1.5 ether       # → 1500000000000000000
cast --from-wei 1500000000000000000 ether

# Storage layout
cast storage 0x... 0 --rpc-url mainnet
```

`cast` is invaluable for one-off interactions, debugging mainnet contracts, deployment verification.

## anvil (Local Node)

```bash
anvil               # local Ethereum node, 10 prefunded accounts
anvil --fork-url $MAINNET_RPC_URL --fork-block-number 19000000
```

Same role as `hardhat node` — local EVM. Faster startup than Hardhat Network.

## Coverage

```bash
forge coverage --report lcov
# → opens in vscode via Coverage Gutters extension
```

Aim for >90% line coverage on critical contracts. **100% line coverage doesn't mean correct** — pair with invariant tests.

## Best Practices

- **Pin Solidity version + Foundry version** (`foundry.toml` + `.foundry-version` file or `foundryup --version <commit>`)
- **Use fuzz tests aggressively** — `testFuzz_*` for any function with numeric inputs
- **Invariant tests for protocol-level safety** — total supply, account balances sum, etc.
- **Forge-std** library has handy utilities — `makeAddr`, `expectRevert`, `bound`
- **Use `vm.label`** for readable traces in tests
- **`-vvvv` traces** when debugging — shows every internal call + decoded args
- **`forge fmt`** for consistent formatting
- **`forge inspect <Contract> storageLayout`** to check storage slot ordering before upgrades

## Common Pitfalls

- Fuzz tests without `bound()` → input range too wide, no useful coverage
- Missing `vm.label()` → traces show raw addresses, hard to read
- Forgetting `--broadcast` on `forge script` → simulates only, no actual deploy
- Using `block.timestamp` in tests without `vm.warp` → unpredictable
- Solidity tests slower than expected? Check `via_ir` setting — it slows compile, speeds runtime
- `forge install` clones a submodule — commit `.gitmodules` + the submodule pin

## Foundry vs Hardhat Cheatsheet

| Task | Foundry | Hardhat |
|---|---|---|
| Run tests | `forge test` | `npx hardhat test` |
| Deploy | `forge script ... --broadcast` | `npx hardhat ignition deploy` |
| Local node | `anvil` | `npx hardhat node` |
| Verify | `forge verify-contract` | `npx hardhat verify` |
| Console | `chisel` | `npx hardhat console` |
| Fork test | `--fork-url + --fork-block-number` | `forking` config |

## Resources

- Book: https://book.getfoundry.sh
- GitHub: https://github.com/foundry-rs/foundry
- forge-std: https://github.com/foundry-rs/forge-std
- Awesome Foundry: https://github.com/crisgarner/awesome-foundry
