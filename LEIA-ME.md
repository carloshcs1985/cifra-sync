# Cifra Sync

Web app pessoal: lê a música que está tocando no seu Spotify e rola a cifra junto com ela.
Funciona no iPhone como app de tela inicial. Sem servidor: tudo fica no seu aparelho.

Leva uns 15 minutos para colocar no ar, uma única vez.

---

## 1. Publicar o app (GitHub Pages, gratuito)

O Spotify só aceita apps em endereço HTTPS fixo. O GitHub Pages resolve isso de graça.

1. Entre em github.com (crie uma conta se não tiver).
2. Crie um repositório **público** chamado `cifra-sync` (botão **New**).
3. Na página do repositório, clique em **Add file → Upload files** e arraste **todo o conteúdo desta pasta**
   (index.html, app.js, core.js, styles.css, sw.js, manifest.webmanifest e a pasta icons). Clique em **Commit changes**.
4. Vá em **Settings → Pages**. Em *Branch*, escolha `main` e `/ (root)` e clique em **Save**.
5. Depois de 1 ou 2 minutos o app estará em:
   `https://SEU-USUARIO.github.io/cifra-sync/`

> O repositório público contém só o código. Suas cifras e seu login do Spotify **não** vão para o GitHub.

## 2. Criar o app no painel do Spotify

1. Acesse developer.spotify.com/dashboard e entre com a sua conta Premium.
2. **Create app**:
   - App name: `Cifra Sync` (qualquer nome)
   - App description: `Uso pessoal`
   - **Redirect URI**: o endereço do passo 1, **exatamente igual, com a barra no final**:
     `https://SEU-USUARIO.github.io/cifra-sync/`
   - Marque **Web API**, aceite os termos e salve.
3. Abra o app criado → **Settings** → copie o **Client ID**.
4. Ainda nas configurações, em **User Management**, adicione o seu nome e o e-mail da sua conta do Spotify.

## 3. Instalar no iPhone

A ordem importa: o app da tela inicial guarda os dados separado do Safari.

1. Abra o endereço do passo 1 no **Safari**.
2. Toque em **Compartilhar → Adicionar à Tela de Início**.
3. Abra o **Cifra Sync pela tela inicial**.
4. Toque em **☰ (menu)** → cole o **Client ID** → **Conectar ao Spotify** → autorize.

Pronto. Dê play em qualquer música no Spotify e ela aparece no Cifra Sync.

## 4. Uso no dia a dia

- **Música sem cifra:** toque em *Abrir no Cifra Club*, selecione e copie a cifra, volte e toque em *Colar cifra copiada*. Fica salva para sempre.
- **Rolagem exata:** toque em **● Marcar** e, com a música tocando, toque em cada linha quando ela começa (só o início de cada parte já basta). Depois, *Concluir*. Da próxima vez a rolagem segue essas marcações.
- **Repetir um trecho:** toque duas vezes numa linha e o Spotify volta até ela.
- **Pausar a rolagem:** é só arrastar a cifra; ela volta a acompanhar sozinha em alguns segundos.
- **Tom −/+** transpõe os acordes. **A−/A+** muda o tamanho. Celular deitado = letra maior.
- **Velocidade fixa** (menu): rolagem contínua sem depender do Spotify.
- **Backup:** menu → *Exportar backup*. Faça de vez em quando; as cifras ficam só no aparelho.

## 5. Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| Spotify mostra "INVALID_CLIENT: Invalid redirect URI" | O endereço cadastrado no painel está diferente | Menu → copie o *Redirect URI* mostrado no app e cole idêntico no painel |
| "Sua conta não está liberada no app" | Seu e-mail não está em User Management | Adicione-o no painel do Spotify |
| "Abra o Spotify em algum aparelho" ao tocar play | Nenhum aparelho ativo | Dê play uma vez no app do Spotify; depois os botões funcionam |
| Depois do login, ficou no Safari em vez do app | Comportamento do iOS com apps de tela inicial | Feche, abra pela tela inicial e conecte de novo. Se persistir, use direto pelo Safari |
| Pede para conectar de novo depois de meses | O Spotify expira a autorização periodicamente | Menu → Conectar ao Spotify |
| Cifra do Cifra Club não abriu (página não encontrada) | O endereço é montado a partir do nome da música | Use *Buscar no Google* |

## 6. Testar no computador (opcional)

Na pasta do app: `python3 -m http.server 8000`, abra `http://127.0.0.1:8000/` e cadastre também esse
endereço como Redirect URI no painel. O Spotify aceita `127.0.0.1`, mas não aceita `localhost`.

## Segurança e privacidade

- Login pelo fluxo PKCE do Spotify: não existe senha nem "client secret" no código.
- O token de acesso fica no armazenamento local do aparelho.
- Política de segurança de conteúdo (CSP) só permite falar com `api.spotify.com` e `accounts.spotify.com`.
- Nenhum servidor próprio, nenhum rastreador, nenhuma biblioteca de terceiros.
