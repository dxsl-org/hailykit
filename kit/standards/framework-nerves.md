# Nerves Standards

Detected via `:nerves` in `mix.exs` deps.

## What Nerves Is

Nerves is a framework for building **embedded Linux systems with Elixir**. Targets: Raspberry Pi, BeagleBone, custom hardware. You get the entire BEAM ecosystem (OTP supervision, hot-reload, Phoenix, LiveView) on devices.

Common use cases: IoT gateways, kiosks, signage, sensors, industrial controllers, robotics.

## Setup

Install Nerves bootstrap + target dependencies:
```bash
mix archive.install hex nerves_bootstrap
mix nerves.new my_device
cd my_device
export MIX_TARGET=rpi4   # or rpi3, bbb, x86_64, etc.
mix deps.get
```

`MIX_TARGET` env var switches between **host** (your laptop) and **target** (the device) builds.

## Project Structure

```
my_device/
├── config/
│   ├── config.exs
│   ├── host.exs          # Config for `mix run` on dev machine
│   └── target.exs        # Config for device builds
├── lib/
│   ├── my_device.ex
│   └── my_device/
│       ├── application.ex
│       └── workers/      # GenServers reading sensors, controlling GPIO, etc.
├── rootfs_overlay/        # Files baked into device filesystem
└── mix.exs
```

## Building Firmware

```bash
# On laptop, builds firmware for target
mix firmware

# Burn to SD card
mix burn

# Or upload over network (after first burn + network config)
mix upload my_device.local
```

`mix firmware` produces a `.fw` file. `mix burn` writes it to an inserted SD card. `mix upload` deploys over SSH to an already-running device — incremental, fast.

## Target Config

```elixir
# config/target.exs
import Config

config :nerves_runtime, :kernel, use_system_registry: false

# Wifi / Ethernet via VintageNet
config :vintage_net,
  config: [
    {"wlan0", %{
      type: VintageNetWiFi,
      vintage_net_wifi: %{
        networks: [%{key_mgmt: :wpa_psk, ssid: "MyWifi", psk: "password"}]
      },
      ipv4: %{method: :dhcp}
    }],
    {"eth0", %{type: VintageNetEthernet, ipv4: %{method: :dhcp}}}
  ]
```

## Hardware I/O

`circuits_gpio`, `circuits_i2c`, `circuits_spi`, `circuits_uart` are the standard libraries:

```elixir
# GPIO blink LED
{:ok, gpio} = Circuits.GPIO.open("GPIO17", :output)
Circuits.GPIO.write(gpio, 1)
:timer.sleep(500)
Circuits.GPIO.write(gpio, 0)

# I2C sensor read
{:ok, ref} = Circuits.I2C.open("i2c-1")
{:ok, <<temp::16>>} = Circuits.I2C.read(ref, 0x48, 2)
```

Wrap hardware access in supervised GenServers — restart on failure, isolate faults.

## Networking

VintageNet handles WiFi, Ethernet, cellular. Status:
```elixir
VintageNet.get(["interface", "wlan0", "connection"])
# → :internet | :lan | :disconnected
```

For mDNS (so you can SSH `my_device.local`): include `:mdns_lite` in deps.

## Updates

**A/B partitions** + fwup means you can update firmware atomically:
```bash
mix upload my_device.local
# On success → device reboots into new partition
# On failure → automatically falls back to previous partition
```

For fleet updates: **NervesHub** (free + paid tiers) — push firmware to many devices, target by tag, deploy gradually.

## Phoenix on Nerves

Yes, you can run a Phoenix server on a Pi:
```elixir
{:phoenix, "~> 1.7"},
{:nerves_pack, "~> 0.7"},  # Bundle of common Nerves deps
```

Use cases: local config UI on the device, status dashboard, REST API for external systems to query.

LiveView works too — touchscreen kiosks with realtime data are a great fit.

## Application Supervision

```elixir
defmodule MyDevice.Application do
  use Application

  def start(_type, _args) do
    children = [
      # Workers
      MyDevice.SensorReader,
      MyDevice.NetworkMonitor,
      # Cloud reporter (sends data to backend)
      {MyDevice.CloudReporter, interval: 60_000},
    ]
    Supervisor.start_link(children, strategy: :one_for_one, name: MyDevice.Supervisor)
  end
end
```

**Supervision is critical on embedded** — a hardware glitch should restart one worker, not bring down the whole system.

## Storage

- **Application data**: read-only rootfs by default; use `/data` partition (writable) for state
- **Persistent KV**: `cubdb` (pure Elixir, file-backed) or SQLite via `exqlite`
- **Time-series**: write to flash sparingly (wear) — buffer in RAM, flush periodically

## Debugging on Device

SSH into the device (Erlang shell):
```bash
ssh my_device.local
# Drops you into IEx, can call any function
iex(my_device@nerves-1234)1> Circuits.GPIO.write(gpio, 1)
```

Logs via `journalctl` (via `nerves_logging`) or `Logger.info` (shown in IEx + saved).

## Best Practices

- Use `MIX_TARGET=host` for unit tests — don't need actual hardware
- Mock hardware libs with `mox` in host mode — test logic without a Pi attached
- Store secrets in `priv/secrets/` (NOT committed) — bake into firmware at build time
- Use NervesHub or similar for fleet updates — don't manually `mix upload` 100 devices
- Watch RAM usage — Pi Zero has 512MB; large data sets must stream, not load
- Avoid heavy crypto on weak hardware — Pi Zero's HTTPS is slow

## Common Pitfalls

- Forgetting `MIX_TARGET` → tries to build for host, missing target deps
- Writing to read-only rootfs paths → silent fail; use `/data` or `/root`
- Long blocking calls in GenServer hardware reader → BEAM scheduler unhappy
- Not handling network disconnection → app crashes when WiFi drops
- Bloated firmware (>200MB) → very slow OTA updates
- Storing too much in flash → flash wear, eventual failure (use RAM buffer + periodic flush)

## Resources

- Docs: https://hexdocs.pm/nerves
- Nerves Hub: https://www.nerves-hub.org
- Circuits libraries: https://github.com/elixir-circuits
- "Build a Weather Station with Elixir and Nerves" book (Pragmatic Bookshelf)
