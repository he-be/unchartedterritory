# Uncharted Territory - ゲームプレイガイド

## 🚀 はじめに

Uncharted Territory は現在APIのみで提供されているため、curl やPostman等のHTTPクライアントでゲームをプレイします。この文書では、実際のゲームプレイの流れを step-by-step で解説します。

## 🛠 前提条件

```bash
# サーバー起動
npm install
npm run dev  # localhost:3000 で起動
```

## 🌟 基本的なゲームプレイフロー

### Step 1: 新規ゲーム作成

```bash
curl -X POST http://localhost:3000/api/game/new
```

**レスポンス例:**
```json
{
  "gameId": "game_1719248123456",
  "message": "New game created",
  "initialState": {
    "playerId": "Commander",
    "credits": 100000,
    "startingSector": "Argon Prime",
    "shipCount": 1
  }
}
```

**📝 説明:**
- ゲームID をメモしておく（以降のAPI呼び出しで使用）
- 初期資金 100,000 クレジット
- 偵察機 "Discovery" 1隻からスタート

---

### Step 2: 現在の状況確認

```bash
curl http://localhost:3000/api/game/game_1719248123456/state
```

**レスポンス例:**
```json
{
  "gameId": "game_1719248123456",
  "gameTime": 0,
  "player": {
    "name": "Commander",
    "credits": 100000,
    "ships": [
      {
        "id": "scout_01",
        "name": "Discovery",
        "type": "scout",
        "position": { "x": 0, "y": 0 },
        "sectorId": "sector_0",
        "isMoving": false,
        "cargo": []
      }
    ],
    "discoveredSectors": ["sector_0"]
  },
  "discoveredSectors": [
    {
      "id": "sector_0",
      "name": "Argon Prime",
      "stations": [...],
      "gates": [...]
    }
  ],
  "recentEvents": []
}
```

**📝 重要な情報:**
- 船舶ID: `scout_01`
- 現在セクター: `sector_0` (Argon Prime)
- 発見済みセクター: 1個のみ
- 船舶位置: セクター中央 (0, 0)

---

### Step 3: 開始セクターの詳細調査

```bash
curl http://localhost:3000/api/game/game_1719248123456/sectors/sector_0
```

**レスポンス例:**
```json
{
  "id": "sector_0",
  "name": "Argon Prime",
  "stations": [
    {
      "id": "sector_0_station_0",
      "name": "TRADING_PORT 00",
      "type": "trading_port",
      "position": { "x": 2500, "y": -1200 },
      "wares": [
        {
          "wareId": "ore",
          "quantity": 150,
          "maxQuantity": 500,
          "buyPrice": 48,
          "sellPrice": 53
        },
        {
          "wareId": "microchips", 
          "quantity": 80,
          "maxQuantity": 500,
          "buyPrice": 190,
          "sellPrice": 210
        }
      ]
    },
    {
      "id": "sector_0_station_1", 
      "name": "MINE 01",
      "type": "mine",
      "position": { "x": -3000, "y": 1500 },
      "wares": [
        {
          "wareId": "ore",
          "quantity": 300,
          "maxQuantity": 1000,
          "buyPrice": 0,
          "sellPrice": 40
        }
      ]
    }
  ],
  "gates": [
    {
      "id": "gate_0_to_1",
      "position": { "x": 4500, "y": 4500 },
      "connectsTo": "sector_1"
    }
  ]
}
```

**📝 分析:**
- **交易機会発見**: 鉱山で鉱石40Crで購入 → 交易港で48Crで売却可能
- **利益**: 8Cr/unit の利益（20%利益率）
- **探索**: 未発見のゲートあり (`gate_0_to_1`)

---

### Step 4: 最初の交易 - 鉱石を購入

まず鉱山に移動:

```bash
curl -X POST http://localhost:3000/api/game/game_1719248123456/ships/scout_01/commands \
  -H "Content-Type: application/json" \
  -d '{
    "type": "move",
    "target": "sector_0_station_1"
  }'
```

**レスポンス:**
```json
{
  "success": true,
  "ship": {
    "id": "scout_01",
    "name": "Discovery",
    "position": { "x": 0, "y": 0 },
    "isMoving": true,
    "destination": { "x": -3000, "y": 1500 }
  },
  "events": [
    {
      "type": "movement",
      "message": "Discovery started moving to sector_0_station_1"
    }
  ]
}
```

移動完了を確認（数秒後）:

```bash
curl http://localhost:3000/api/game/game_1719248123456/state
```

船舶が `"isMoving": false` になったら到着。

---

### Step 5: 鉱石購入

```bash
curl -X POST http://localhost:3000/api/game/game_1719248123456/ships/scout_01/trade \
  -H "Content-Type: application/json" \
  -d '{
    "stationId": "sector_0_station_1",
    "action": "buy",
    "wareId": "ore", 
    "quantity": 10
  }'
```

**レスポンス:**
```json
{
  "success": true,
  "ship": {
    "id": "scout_01",
    "name": "Discovery",
    "cargo": [
      {
        "wareId": "ore",
        "quantity": 10
      }
    ]
  },
  "player": {
    "credits": 99600
  },
  "events": [
    {
      "type": "trade",
      "message": "Discovery bought 10 ore for 400 Cr"
    }
  ]
}
```

**📝 取引結果:**
- 鉱石 10個購入: 400Cr消費
- 残りクレジット: 99,600Cr
- 積載: 鉱石 10個 (10/10 容量使用)

---

### Step 6: 交易港で売却

交易港に移動:

```bash
curl -X POST http://localhost:3000/api/game/game_1719248123456/ships/scout_01/commands \
  -H "Content-Type: application/json" \
  -d '{
    "type": "move",
    "target": "sector_0_station_0"
  }'
```

到着後、売却:

```bash
curl -X POST http://localhost:3000/api/game/game_1719248123456/ships/scout_01/trade \
  -H "Content-Type: application/json" \
  -d '{
    "stationId": "sector_0_station_0",
    "action": "sell",
    "wareId": "ore",
    "quantity": 10
  }'
```

**レスポンス:**
```json
{
  "success": true,
  "ship": {
    "cargo": []
  },
  "player": {
    "credits": 100080
  },
  "events": [
    {
      "type": "trade", 
      "message": "Discovery sold 10 ore for 480 Cr"
    }
  ]
}
```

**📝 利益計算:**
- 購入: 400Cr
- 売却: 480Cr  
- **純利益: 80Cr** 🎉

---

### Step 7: 新セクターの探索

```bash
curl -X POST http://localhost:3000/api/game/game_1719248123456/ships/scout_01/commands \
  -H "Content-Type: application/json" \
  -d '{
    "type": "explore"
  }'
```

**レスポンス:**
```json
{
  "success": true,
  "ship": {
    "isMoving": true,
    "currentCommand": {
      "type": "explore",
      "target": "gate_0_to_1"
    }
  },
  "events": [
    {
      "type": "movement",
      "message": "Discovery heading to unexplored gate"
    }
  ]
}
```

ゲートに到着すると新セクター発見:

```bash
# 数秒後に状態確認
curl http://localhost:3000/api/game/game_1719248123456/state
```

**レスポンス:**
```json
{
  "discoveredSectors": ["sector_0", "sector_1"],
  "recentEvents": [
    {
      "type": "discovery",
      "message": "Discovery discovered new sector: New Tokyo"
    }
  ]
}
```

---

### Step 8: 交易機会の分析

システムが自動で利益機会を計算:

```bash
curl http://localhost:3000/api/game/game_1719248123456/trade-opportunities
```

**レスポンス:**
```json
[
  {
    "wareId": "microchips",
    "from": {
      "stationId": "sector_1_station_2",
      "sectorId": "sector_1", 
      "price": 180
    },
    "to": {
      "stationId": "sector_0_station_0",
      "sectorId": "sector_0",
      "price": 210
    },
    "profitMargin": 30
  },
  {
    "wareId": "ore",
    "from": {
      "stationId": "sector_0_station_1", 
      "sectorId": "sector_0",
      "price": 40
    },
    "to": {
      "stationId": "sector_1_station_0",
      "sectorId": "sector_1", 
      "price": 55
    },
    "profitMargin": 15
  }
]
```

**📝 分析:**
- **最高利益**: マイクロチップ取引（30Cr/unit利益）
- **長距離**: セクター間移動が必要
- **リスク**: より多くの資金が必要

---

## 🚢 船舶拡張戦略

### 貿易船の購入

利益が貯まったら、より大きな貿易船を購入:

```bash
# 造船所を見つける
curl http://localhost:3000/api/game/game_1719248123456/sectors/sector_1

# 造船所がある場合の購入（将来実装）
# 現在のMVPでは購入機能は未実装
```

**注**: 現在のMVP版では船舶購入機能は未実装。将来のアップデートで追加予定。

---

## 📊 高度な戦略

### 1. 価格変動の理解

各ステーションの価格は在庫量で変動:

```
価格 = 最高価格 - ((最高価格 - 最低価格) * 在庫率)
```

- **在庫多い** → 安価格（購入チャンス）
- **在庫少ない** → 高価格（売却チャンス）

### 2. 生産サイクルの活用

60秒毎に各ステーションが生産活動:

- **鉱山**: 鉱石を継続生産
- **工場**: 原料消費して製品生産
- **価格変動**: 生産により在庫変化

### 3. 複数セクター戦略

- **探索範囲拡大**: より多くの交易機会
- **リスク分散**: 複数の交易ルート確保
- **情報収集**: 各セクターの特性把握

---

## 🛠 デバッグ・検証用コマンド

### プレイヤー資産確認

```bash
curl http://localhost:3000/api/game/game_1719248123456/player
```

**レスポンス:**
```json
{
  "name": "Commander",
  "credits": 100080,
  "ships": [...],
  "totalCargoValue": 0,
  "fleetStatus": [
    {
      "id": "scout_01",
      "name": "Discovery", 
      "type": "scout",
      "sectorName": "Argon Prime",
      "isMoving": false,
      "cargoFull": 0
    }
  ]
}
```

### 発見済みセクター一覧

```bash
curl http://localhost:3000/api/game/game_1719248123456/sectors
```

### ヘルス状態確認

```bash
curl http://localhost:3000/health
```

---

## ⚠️ よくある問題と対策

### 1. 「Ship too far from station」エラー

**原因**: 船舶がステーションから200m以上離れている

**対策**: 
```bash
# 移動コマンドで接近
curl -X POST .../commands -d '{"type": "move", "target": "station_id"}'
```

### 2. 「Ship is currently moving」エラー

**原因**: 移動中の船舶に移動・探索コマンド送信

**対策**: 到着まで待機、または交易コマンドのみ実行可能

### 3. 「Not enough credits」エラー

**原因**: 購入資金不足

**対策**: 小さな取引で資金を増やす、または安い商品を選択

### 4. 「Station cannot buy more」エラー

**原因**: ステーションの在庫が満杯

**対策**: 他のステーションを探す、または時間をおいて生産消費を待つ

---

## 🎯 ゲーム目標の例

### 初心者目標
1. **最初の取引完了**: 任意の商品で利益を上げる
2. **新セクター発見**: 探索コマンドで未知領域発見
3. **10,000Cr達成**: 継続的な取引で資産増加

### 中級者目標  
1. **全セクター発見**: 8個すべてのセクターを探索
2. **50,000Cr達成**: 効率的な取引ルート確立
3. **高価値商品取引**: マイクロチップ等の高利益商品

### 上級者目標
1. **資産倍増**: 100,000Cr → 200,000Cr
2. **複数ルート並行**: 異なるセクター間での取引
3. **市場分析**: 価格変動パターンの理解と活用

---

## 🔧 カスタムスクリプト例

### Bash での自動取引スクリプト

```bash
#!/bin/bash
GAME_ID="game_1719248123456"
SHIP_ID="scout_01"
BASE_URL="http://localhost:3000/api/game/$GAME_ID"

# 状態確認関数
check_ship_status() {
  curl -s "$BASE_URL/state" | jq -r ".player.ships[0].isMoving"
}

# 移動待機関数  
wait_for_arrival() {
  while [ "$(check_ship_status)" = "true" ]; do
    echo "Moving..."
    sleep 2
  done
  echo "Arrived!"
}

# 基本的な取引フロー
echo "=== Automated Trading Demo ==="

# 1. 鉱山に移動
echo "Moving to mine..."
curl -X POST "$BASE_URL/ships/$SHIP_ID/commands" \
  -H "Content-Type: application/json" \
  -d '{"type": "move", "target": "sector_0_station_1"}'

wait_for_arrival

# 2. 鉱石購入
echo "Buying ore..."
curl -X POST "$BASE_URL/ships/$SHIP_ID/trade" \
  -H "Content-Type: application/json" \
  -d '{"stationId": "sector_0_station_1", "action": "buy", "wareId": "ore", "quantity": 5}'

# 3. 交易港に移動
echo "Moving to trading port..."
curl -X POST "$BASE_URL/ships/$SHIP_ID/commands" \
  -H "Content-Type: application/json" \
  -d '{"type": "move", "target": "sector_0_station_0"}'

wait_for_arrival

# 4. 売却
echo "Selling ore..."
curl -X POST "$BASE_URL/ships/$SHIP_ID/trade" \
  -H "Content-Type: application/json" \
  -d '{"stationId": "sector_0_station_0", "action": "sell", "wareId": "ore", "quantity": 5}'

echo "=== Trading completed! ==="

# 最終状態確認
curl "$BASE_URL/player" | jq '.credits'
```

---

## 📝 まとめ

Uncharted Territory は現在 API のみでプレイ可能ですが、基本的な経済シミュレーションゲームとして十分楽しめます：

1. **探索**: 新しいセクターとステーションの発見
2. **分析**: 価格差と取引機会の特定  
3. **取引**: 戦略的な商品売買による利益追求
4. **拡張**: より大規模で効率的な取引の実現

フロントエンド実装により、将来的にはより直感的で視覚的なゲーム体験が提供される予定です。現在の API ベースでのプレイが、ゲームメカニズムの理解と戦略立案の練習になります。

**楽しいゲームプレイを！** 🚀