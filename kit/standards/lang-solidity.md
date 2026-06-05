# Solidity Standards

Solidity for Ethereum-compatible smart contracts. Target 0.8.x (current) — has built-in overflow checks + custom errors. Tooling via Hardhat (`hardhat.config.{ts,js}`) or Foundry (`foundry.toml`).

## Compiler

Pin compiler version explicitly:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;        // exact version, NOT ^0.8.0
```

Floating versions (`^0.8.0`) cause non-deterministic builds across environments — pin exact.

## Core Patterns

### Contracts

```solidity
contract Counter {
    uint256 public count;
    address public owner;

    event CountIncremented(address indexed by, uint256 newCount);

    error Unauthorized();

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    function increment() external {
        count += 1;
        emit CountIncremented(msg.sender, count);
    }

    function reset() external onlyOwner {
        count = 0;
    }
}
```

### Visibility (CRITICAL)

| Keyword | Access |
|---|---|
| `public` | Anyone (auto-creates getter for vars) |
| `external` | Anyone, but only via external call (cheaper than `public` for fn) |
| `internal` | Same contract + inheriting contracts |
| `private` | Same contract only |

**Default to most restrictive.** Public = world can call = risk if not intended.

### Data Types

```solidity
uint256 a = 100;
int256 b = -5;
bool isActive = true;
address payable wallet = payable(msg.sender);
bytes32 hash = keccak256(abi.encodePacked("hello"));
string memory name = "Alice";
uint256[] storage list = items;
mapping(address => uint256) public balances;
struct User { string name; uint256 age; }
```

`uint256` is the default size — smaller types (uint8/32/64) don't save gas in storage unless packed in a struct.

## Storage vs Memory vs Calldata

- **storage** — persistent, expensive, mutable across txs
- **memory** — temporary, function-scoped, cheap
- **calldata** — input args from external call, read-only, cheapest

```solidity
function process(string calldata name, uint256[] memory list) external {
    string memory local = name;       // copy calldata → memory
    list[0] = 42;                      // modify memory copy
}
```

For arrays/strings/bytes in function params, prefer `calldata` over `memory` when read-only — saves gas.

## Custom Errors (Cheaper Than `require`)

```solidity
error InsufficientBalance(uint256 available, uint256 required);

function withdraw(uint256 amount) external {
    if (balance < amount) revert InsufficientBalance(balance, amount);
    balance -= amount;
}
```

Custom errors are **gas-cheaper than `require("string")`** and carry typed data for debugging. Use them.

## Events

```solidity
event Transfer(address indexed from, address indexed to, uint256 value);

emit Transfer(msg.sender, recipient, amount);
```

`indexed` parameters are searchable in logs (up to 3 per event). Use for `address`, `uint`, `bytes32` fields you'll query.

## Modifiers

```solidity
modifier nonReentrant() {
    if (_locked) revert ReentrancyGuard();
    _locked = true;
    _;
    _locked = false;
}

function withdraw() external nonReentrant {
    // ...
}
```

Standard modifiers from OpenZeppelin: `Ownable`, `Pausable`, `ReentrancyGuard`.

## Inheritance + OpenZeppelin

Always reuse battle-tested contracts:

```solidity
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract MyToken is ERC20, Ownable {
    constructor() ERC20("MyToken", "MTK") Ownable(msg.sender) {
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
```

OpenZeppelin contracts are the de-facto safe baseline — never roll your own ERC20/ERC721/ERC1155.

## Security — OWASP for Smart Contracts

### Reentrancy

```solidity
// Bad: external call BEFORE state update
function withdraw() external {
    uint256 amount = balances[msg.sender];
    (bool ok, ) = msg.sender.call{value: amount}("");
    require(ok);
    balances[msg.sender] = 0;       // updated AFTER call — reentrancy hole!
}

// Good: Checks-Effects-Interactions pattern
function withdraw() external {
    uint256 amount = balances[msg.sender];
    balances[msg.sender] = 0;       // effects first
    (bool ok, ) = msg.sender.call{value: amount}("");
    require(ok);                     // interaction last
}
```

Use OpenZeppelin's `ReentrancyGuard` modifier for any function transferring ETH.

### Integer Overflow

Solidity 0.8+ has **built-in overflow checks** — reverts on overflow. Don't disable with `unchecked { }` unless you have a specific reason.

### Access Control

- Never expose admin functions with `public` visibility unintentionally
- Use `Ownable` or **role-based** access control (`AccessControl` from OpenZeppelin)
- Multi-sig (Gnosis Safe) for owner of important contracts in production

### Front-running / MEV

- Sensitive operations vulnerable to ordering attacks (e.g. swapping)
- Use commit-reveal schemes or off-chain order books for fairness
- Be aware of sandwich attacks on AMMs

## Gas Optimization

- Pack `uint8/16/32` into `uint256`-sized struct slots — saves storage gas
- Use `immutable` (set once in constructor) or `constant` over storage
- Cache storage reads in local memory if used > 1 time
- `unchecked { ++i; }` in for-loops (when you know overflow impossible)
- Prefer `external` over `public` when functions aren't called internally
- Custom errors over `require("string")`

## Testing

**Foundry** (preferred for new projects):

```solidity
// test/Counter.t.sol
import "forge-std/Test.sol";
import "../src/Counter.sol";

contract CounterTest is Test {
    Counter counter;

    function setUp() public { counter = new Counter(); }

    function testIncrement() public {
        counter.increment();
        assertEq(counter.count(), 1);
    }

    function testFuzz_Increment(uint8 times) public {
        for (uint i = 0; i < times; i++) counter.increment();
        assertEq(counter.count(), times);
    }
}
```

```bash
forge test
forge test --gas-report
forge coverage
```

Fuzz tests find edge cases automatically — use them liberally.

**Hardhat** (more JS-centric):
```js
const { expect } = require("chai");

describe("Counter", function () {
    it("increments", async function () {
        const counter = await ethers.deployContract("Counter");
        await counter.increment();
        expect(await counter.count()).to.equal(1);
    });
});
```

## Best Practices

- **Use OpenZeppelin** — never reinvent ERC20/ERC721/AccessControl
- **Audit** before any mainnet deploy with real money — Trail of Bits, OpenZeppelin Defender, Certora
- **Slither** + **Mythril** for static analysis — run in CI
- **Foundry fork tests** to test against real mainnet state
- **Pause mechanism** for emergency stops (`Pausable` from OpenZeppelin)
- **Multi-sig** owner for production admin functions
- **Timelocks** for upgradeable / sensitive operations

## Common Pitfalls

- Floating pragma → non-deterministic builds; pin exact version
- Missing reentrancy protection on external-call-followed-by-state-update functions
- Public functions that should be external/internal — exposes attack surface
- Trusting `tx.origin` for auth (should always use `msg.sender`)
- Hardcoded prices / oracles — use Chainlink + sanity bounds
- Forgetting events on state changes — off-chain monitoring impossible
- `unchecked { }` without justification — silently re-enables overflow risk
- Using `block.timestamp` for randomness — miner can manipulate

## Resources

- Solidity docs: https://docs.soliditylang.org
- OpenZeppelin contracts: https://docs.openzeppelin.com/contracts
- Foundry book: https://book.getfoundry.sh
- Hardhat: https://hardhat.org
- ConsenSys best practices: https://consensys.github.io/smart-contract-best-practices
- SWC registry (vulnerability catalog): https://swcregistry.io
