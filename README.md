# Besu Private Tain

이 저장소는 이 서버 한 대에서 운영하는 Hyperledger Besu 기반 private network 설정입니다. 현재 목적은 운영 전 검증과 내부 테스트이며, `BPT`라는 native coin을 treasury 계정에서 배분하고 burn address로 회수하는 방식으로 발행과 소각 흐름을 흉내냅니다.

## 한눈에 보는 설계

- 실행 방식: Docker Compose
- Besu 이미지: `hyperledger/besu:26.5.0@sha256:f1dad21871b49bf54fce2a8c547d96cb7835005343af02eebd72da137723c3bc`
- 네트워크 이름: `besu-private-tain`
- Chain ID: `2026052501` (`0x78c31b95`)
- Native symbol: `BPT`
- Decimals: `18`
- Consensus: QBFT, 단일 validator
- Block period: `2s`
- Request timeout: `4s`
- Gas 정책: free gas (`min-gas-price=0`, `zeroBaseFee=true`)
- HTTP RPC: `http://127.0.0.1:8545`
- WebSocket RPC: `ws://127.0.0.1:8546`
- Metrics: `http://127.0.0.1:9545/metrics`

RPC, WebSocket, metrics는 컨테이너 내부에서는 `0.0.0.0`로 열지만, host port binding은 `127.0.0.1`로 제한합니다. 그래서 현재 서버 밖에서는 직접 접근할 수 없습니다.

## 주요 주소

| 역할 | 주소 |
| --- | --- |
| Treasury | `0x870428BB916477fEbFff5A3D6aaCbF6805Fd4c27` |
| Operator | `0xa06eCe6201ccbC0FF8cbDaE337175316944B9179` |
| Validator | `0x580acc8469029bced94d283b2d20ad9142703f94` |
| Burn address | `0x000000000000000000000000000000000000dEaD` |

Treasury와 operator의 private key는 `secrets/` 아래에 있고 git에 포함하지 않습니다. Validator node key와 Besu runtime data도 `data/` 아래에 있어 git에 포함하지 않습니다.

## Native BPT 발행과 소각 모델

이 체인은 Besu 자체를 fork해서 protocol-level mint/burn 기능을 추가한 구조가 아닙니다. 현재는 private network에서 native coin 잔액을 운영적으로 관리하는 단순 모델입니다.

Genesis에서 treasury 계정에 `1,000,000,000 BPT`가 처음 배정됩니다. 새 사용자에게 BPT를 발행하는 작업은 실제로는 treasury가 그 사용자 주소로 native BPT를 송금하는 것입니다.

```text
mint = treasury -> recipient 송금
```

BPT 소각은 holder가 burn address로 native BPT를 송금하는 방식입니다. burn address의 private key는 사용하지 않는 주소로 취급하므로, 그 주소로 이동한 BPT는 유통량에서 제외합니다.

```text
burn = holder -> 0x000000000000000000000000000000000000dEaD 송금
```

현재 유통량은 다음 식으로 계산합니다.

```text
circulating supply = initialSupply - treasuryBalance - burnAddressBalance
```

즉, 이 모델은 “발행/소각처럼 운영되는 native coin 회계”에 가깝습니다. 임의 주소 잔액을 protocol에서 직접 늘리거나 줄이는 기능, 강제 소각, issuer 권한 정책, upgrade 가능한 token logic이 필요하면 Besu native coin이 아니라 ERC-20 계층을 별도 contract로 올리는 편이 맞습니다.

## 실행 명령어

처음 구성하거나 의존성을 다시 설치할 때:

```bash
npm install
./ops/init-network.sh
```

노드 실행:

```bash
docker compose up -d
```

상태 확인:

```bash
./ops/health.sh
```

공급량 확인:

```bash
./ops/supply.sh
```

Native `BPT` 발행:

```bash
./ops/mint.sh 0xRecipientAddress 100
```

Native `BPT` 소각:

```bash
./ops/burn.sh treasury 10
./ops/burn.sh operator 10
```

잔액 확인이나 수동 전송이 필요하면 `ops/wallet.mjs`를 직접 사용할 수 있습니다.

```bash
node ops/wallet.mjs balance treasury
node ops/wallet.mjs balance operator
node ops/wallet.mjs balance burn
node ops/wallet.mjs transfer treasury 0xRecipientAddress 100
```

## 운영상 주의할 점

- 현재는 단일 노드, 단일 validator 구성입니다. 프로세스나 서버가 멈추면 체인도 멈춥니다.
- 단일 validator QBFT는 Byzantine fault tolerance를 제공하지 않습니다. 여러 운영 주체가 공유하는 인프라로 쓰려면 validator를 추가해야 합니다.
- `secrets/*.key`, `data/`, `config/networkFiles/`는 git에 올리지 않습니다.
- 외부 접근이 필요하면 RPC를 public `0.0.0.0`로 바로 열지 말고 Tailscale/VPN allowlist나 reverse proxy 접근 제어를 먼저 둡니다.
- Docker image는 digest로 고정되어 있습니다. 버전을 올릴 때는 새 tag와 digest를 함께 확인한 뒤 변경합니다.
- 자세한 네트워크 설계 메모는 `docs/network.md`를 참고합니다.
