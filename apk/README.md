# Pasta do APK Android (`racha-live-android.apk`)

Este projeto está pronto para gerar o `.apk` nativo do Android via **Capacitor** (`/android`) e **GitHub Actions** (`.github/workflows/build-apk.yml`).

## Como gerar e baixar o `.apk` automaticamente pelo GitHub
1. Envie esta pasta inteira para o seu repositório no GitHub.
2. (Opcional) Em **Settings → Secrets and variables → Actions → Variables**, adicione `VITE_WS_URL` com a URL `wss://...` do seu backend (você também pode alterar a URL direto dentro do app clicando na engrenagem `⚙️`).
3. Assim que fizer o `git push`, o GitHub Actions compila automaticamente o Android e gera o arquivo **`racha-live-android.apk`** na aba **Releases** (`android-apk-latest`) e em **Actions → Artifacts**.
4. Baixe o `.apk` no seu celular Android e instale!

## Como gerar o `.apk` manualmente no PC (com Android Studio / JDK 21)
```bash
npm install
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```
O APK compilado sairá em: `android/app/build/outputs/apk/debug/app-debug.apk`
