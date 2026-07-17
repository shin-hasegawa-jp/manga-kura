# Web開発ルール

## 検証コマンド

- Lint（ESLint・自動修正）: `npm run lint`
- Format（自動整形）: `npm run format`
- 型チェック: `npm run type-check`
- 単体テスト: `npm run test:unit`

`apps/web`を変更したら、上記をすべて実行し、正常終了を確認する。

## コーディングルール

- `as`による型アサーションや型キャストを使用しない。
- `!`による非nullアサーションや初期化アサーションを使用しない。
- 実行時の型検証にはValibotを使用する。

## テスト方針

- Frontendは関数のunitテストのみ実装する。
- コンポーネント単位のテストは実装しない。
