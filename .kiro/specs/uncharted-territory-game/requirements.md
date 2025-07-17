# Requirements Document

## Introduction

Uncharted Territory は、プレイヤーが自律的に動く経済圏に介入する「ルーター（航路設計者）」となる2D宇宙4Xゲームです。Mini Metro のシンプルな見た目、X4: Foundations の4X要素、Mount&Blade の成り上がり要素を組み合わせた、自動化された宇宙経済システムの中でプレイヤーが戦略的判断を行うゲームです。

## Requirements

### Requirement 1

**User Story:** プレイヤーとして、自動化された宇宙経済システムを観察し、交易船団を管理することで、経済活動に参加したい

#### Acceptance Criteria

1. WHEN ゲームが開始される THEN システムは初期セクター（Neter）に1隻の貨物船「Mercury」と100,000クレジットを提供する SHALL
2. WHEN プレイヤーが何も操作しない THEN 交易AIが自動的に船の交易活動を制御する SHALL
3. WHEN 交易が成功する THEN プレイヤーの資金が増加し、収支履歴に記録される SHALL
4. WHEN プレイヤーが船を選択する THEN その船の詳細情報（位置、速度、積荷、目的地）がリアルタイムで表示される SHALL

### Requirement 2

**User Story:** プレイヤーとして、複数のセクターにまたがる交易ネットワークを構築し、船団を拡張したい

#### Acceptance Criteria

1. WHEN プレイヤーが十分な資金を持つ THEN 造船所で新しい船を購入できる SHALL
2. WHEN 新しいセクターが解放される THEN プレイヤーはゲートを通じてそのセクターにアクセスできる SHALL
3. WHEN プレイヤーが不安定なゲートに投資する THEN そのゲートが安定化され、恒久的な航路として利用可能になる SHALL
4. WHEN 複数の船が異なるセクターで活動する THEN 各船の活動が統合された収益として計算される SHALL

### Requirement 3

**User Story:** プレイヤーとして、リアルタイムで変動する市場価格を監視し、交易機会を発見したい

#### Acceptance Criteria

1. WHEN ステーションが選択される THEN その在庫量と価格情報がリアルタイムで表示される SHALL
2. WHEN 商品の在庫率が変化する THEN 価格がS字カーブに基づいて非線形に変動する SHALL
3. WHEN 商品カテゴリが必需品（Food等）の場合 THEN 価格変動幅が±30%程度の小さい範囲に制限される SHALL
4. WHEN 商品カテゴリが工業材（Steel Plates、Hull Parts等）の場合 THEN 価格変動幅が±70%程度の標準的な範囲で変動する SHALL
5. WHEN 商品カテゴリがハイテク・奢侈品（Supercomputer、Progenitor cells等）の場合 THEN 価格変動幅が±200%程度の大きな範囲で変動する SHALL
6. WHEN 特定の商品が選択される THEN 宇宙マップ全体でその商品の価格がヒートマップで表示される SHALL
7. WHEN ステーションが選択される THEN そのサプライチェーンが視覚的にラインで表示される SHALL

### Requirement 4

**User Story:** プレイヤーとして、自動化された生産・消費システムの中で経済の流れを理解したい

#### Acceptance Criteria

1. WHEN 60秒が経過する THEN 各ステーションで生産・消費活動が自動的に発生する SHALL
2. WHEN 鉱山が稼働する THEN 原料（Ore、Silicon、Water、Carbon）が生産される SHALL
3. WHEN 精錬所が稼働する THEN 原料を消費して中間財（Steel plates、Silicon wafers等）が生産される SHALL
4. WHEN 工場が稼働する THEN 中間財を消費して完成品（Hull Parts、Food等）が生産される SHALL
5. WHEN 居住コロニーが稼働する THEN 完成品を消費し、労働力ボーナスを近隣ステーションに提供する SHALL

### Requirement 5

**User Story:** プレイヤーとして、Mini Metroにインスパイアされたシンプルで機能的なUIを使用したい

#### Acceptance Criteria

1. WHEN ゲーム画面が表示される THEN 中央エリアに既知宇宙全体がマップとして表示される SHALL
2. WHEN マウスホイールが操作される THEN マップが拡大・縮小される SHALL
3. WHEN 右クリックドラッグが行われる THEN マップがパンされる SHALL
4. WHEN 左パネルが表示される THEN 船団リスト、各船のステータス、収支ログが表示される SHALL
5. WHEN 右パネルが表示される THEN 選択されたステーションの詳細情報が表示される SHALL

### Requirement 6

**User Story:** プレイヤーとして、WebSocketを通じてリアルタイムでゲーム状態を同期したい

#### Acceptance Criteria

1. WHEN ゲームが開始される THEN WebSocket接続が確立される SHALL
2. WHEN サーバー側で経済シミュレーションが実行される THEN 1秒間隔で状態が更新される SHALL
3. WHEN クライアント側で表示が更新される THEN 33.33ms間隔で画面が描画される SHALL
4. WHEN プレイヤーがコマンドを実行する THEN ステートレスなコマンドがサーバーに送信される SHALL

### Requirement 7

**User Story:** プレイヤーとして、ゲーム状態が永続化され、セッション間でゲームを継続したい

#### Acceptance Criteria

1. WHEN ゲーム状態が変更される THEN Supabaseにデータが保存される SHALL
2. WHEN プレイヤーがゲームを再開する THEN 前回の状態から継続できる SHALL
3. WHEN Cloudflare認証が実行される THEN プレイヤーのアカウントが識別される SHALL
4. WHEN データが永続化される THEN プレイヤーの資産、船団、進行状況が保持される SHALL

### Requirement 8

**User Story:** プレイヤーとして、交易AIの個性や設定をカスタマイズしたい

#### Acceptance Criteria

1. WHEN プレイヤーが最低利益額を設定する THEN AIがその閾値以下の取引を実行しない SHALL
2. WHEN 交易AIが航路を評価する THEN 期待利益、航行時間、競合状況を考慮してスコアを計算する SHALL
3. WHEN 複数の船がアイドル状態になる THEN AIが航路を分散して割り当て、群衆行動を回避する SHALL
4. WHEN プレイヤーが船の交易AIをOFF/ONする THEN その船の自動交易が停止/再開される SHALL