# Besu Private Tain

이 저장소는 이 서버 한 대에서 운영하는 Hyperledger Besu 기반 private network 설정입니다. 현재 체인은 gas를 무료로 두고, 실제 자산은 upgradeable ERC-20 contract인 `BPT`가 담당하도록 구성되어 있습니다.

## 한눈에 보는 설계

- 실행 방식: Docker Compose
- Besu 이미지: `hyperledger/besu:26.5.0@sha256:f1dad21871b49bf54fce2a8c547d96cb7835005343af02eebd72da137723c3bc`
- 네트워크 이름: `besu-private-tain`
- Chain ID: `2026052501` (`0x78c31b95`)
- Consensus: QBFT, 단일 validator
- Block period: `2s`
- Request timeout: `4s`
- Gas 정책: free gas (`min-gas-price=0`, `zeroBaseFee=true`)
- Native coin 용도: 사용하지 않음. genesis native allocation은 비어 있음
- 자산 모델: UUPS upgradeable ERC-20 `BPT`
- HTTP RPC: `http://127.0.0.1:8545`
- WebSocket RPC: `ws://127.0.0.1:8546`
- Metrics: `http://127.0.0.1:9545/metrics`

RPC, WebSocket, metrics는 컨테이너 내부에서는 `0.0.0.0`로 열지만, host port binding은 `127.0.0.1`로 제한합니다. 그래서 현재 서버 밖에서는 직접 접근할 수 없습니다.

## 주요 주소

| 역할 | 주소 |
| --- | --- |
| Treasury / Admin / Upgrader | `0x870428BB916477fEbFff5A3D6aaCbF6805Fd4c27` |
| Operator / Minter / Burner | `0xa06eCe6201ccbC0FF8cbDaE337175316944B9179` |
| Validator | `0x17948b3ea9b2dccd9af88b8e8fdbc25d28166f3a` |
| BPT proxy | `0x78ACb3b334036b644387CA28B9b944F7888af67C` |
| BPT implementation | `0xB193E9d08277aF3ADD8FE66d3Fb734E0221cb9A1` |

Treasury, operator private key는 `secrets/` 아래에 있고 git에 포함하지 않습니다. Validator node key와 Besu runtime data도 `data/` 아래에 있어 git에 포함하지 않습니다.

## BPT 발행과 소각 모델

`BPT`는 Besu native coin이 아니라 ERC-20 contract입니다. 이 체인의 native coin은 gas에도 자산에도 쓰지 않습니다. 대신 gas price가 0이라 native balance가 0인 계정도 contract transaction을 보낼 수 있습니다.

`BPTToken`은 OpenZeppelin upgradeable contract를 사용합니다.

- `DEFAULT_ADMIN_ROLE`: treasury
- `UPGRADER_ROLE`: treasury
- `MINTER_ROLE`: operator
- `BURNER_ROLE`: operator
- 초기 totalSupply: `0 BPT`

발행은 operator가 ERC-20 `mint(address,uint256)`를 호출해서 수행합니다.

```text
mint = operator -> BPTToken.mint(recipient, amount)
```

소각은 두 방식이 있습니다.

```text
self burn = holder -> BPTToken.burn(amount)
role burn = operator -> BPTToken.burnByRole(holder, amount)
```

현재 공급량은 ERC-20 `totalSupply()` 값입니다. 기존 native treasury balance, burn address balance 방식은 더 이상 사용하지 않습니다.

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

ERC-20 BPT 배포:

```bash
./ops/deploy-token.sh
```

상태 확인:

```bash
./ops/health.sh
```

공급량 확인:

```bash
./ops/supply.sh
```

`BPT` 발행:

```bash
./ops/mint.sh 0xRecipientAddress 100
./ops/mint.sh operator 100
```

`BPT` 소각:

```bash
./ops/burn.sh operator 10
./ops/burn.sh 0xHolderAddress 10
```

잔액 확인이나 수동 전송이 필요하면 `ops/wallet.mjs`를 직접 사용할 수 있습니다.

```bash
node ops/wallet.mjs balance treasury
node ops/wallet.mjs balance operator
node ops/wallet.mjs transfer operator 0xRecipientAddress 100
```

## 개발과 테스트

Solidity contract는 Hardhat으로 테스트합니다.

```bash
npm test
npm run compile
```

배포 결과는 다음 파일에 기록됩니다.

- `deployments/besu-private-tain.json`
- `docs/addresses.json`
- `.openzeppelin/unknown-2026052501.json`

## 운영상 주의할 점

- 현재는 단일 노드, 단일 validator 구성입니다. 프로세스나 서버가 멈추면 체인도 멈춥니다.
- 단일 validator QBFT는 Byzantine fault tolerance를 제공하지 않습니다. 여러 운영 주체가 공유하는 인프라로 쓰려면 validator를 추가해야 합니다.
- `secrets/*.key`, `data/`, `config/networkFiles/`, `.runtime-archive/`는 git에 올리지 않습니다.
- 외부 접근이 필요하면 RPC를 public `0.0.0.0`로 바로 열지 말고 Tailscale/VPN allowlist나 reverse proxy 접근 제어를 먼저 둡니다.
- Docker image는 digest로 고정되어 있습니다. 버전을 올릴 때는 새 tag와 digest를 함께 확인한 뒤 변경합니다.
- 자세한 네트워크 설계 메모는 `docs/network.md`를 참고합니다.
