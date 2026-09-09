# Windows版の更新

1. 変更を実装し、`npm test` と `npm run test:smoke` を実行します。
2. `npm version patch --no-git-tag-version`（または minor / major）でバージョンを更新します。アプリ内のバージョン表示・設定レポートも同じバージョンに更新してください。
3. `RELEASE-NOTES.md` を更新してコミットし、そのコミットに新しいバージョンの注釈付きタグを作成します（例：`git tag -a v1.0.1 -m v1.0.1`）。`git push origin main --follow-tags` で送信します。
4. GitHub ActionsがWindows版をビルドし、EXEのアップロード完了後にリリースを公開します。

更新確認先は `updates.cjs` の `REPOSITORY` です。配布先がソースリポジトリと異なる場合、配布先のContents書き込み権限を持つトークンをソース側のActions secret `RELEASE_TOKEN` に設定してください。トークンをアプリやソースに埋め込まないでください。

公開配布先には正式な `v1.0.1` 形式のリリースと `OBS-Mic-Tuner-1.0.1-Windows.exe` 形式の添付ファイルが必要です。下書き・プレリリース・EXEのないリリースは更新表示の対象外です。単なるソースのコミットでは更新ボタンは出ません。

ローカルで公開する場合は `npm run build`、`node scripts/package-preview.cjs` の順で実行します。生成された `dist/OBS-Mic-Tuner-<version>/` の中身を `dist/OBS-Mic-Tuner-<version>-Windows.zip` に圧縮し、`node scripts/publish-release.cjs` を実行します。既存リリースを上書きせず、新しいバージョンを使用してください。
