# Laboratório Songsterr — experimental

Página independente para validar busca de músicas, seleção de pistas e acompanhamento estimado por compasso. Nenhum arquivo da aplicação principal é substituído. Não importa módulos do Cifra Sync, não registra service worker, não usa IndexedDB/localStorage e não modifica a biblioteca pessoal. O service worker já instalado no site pode intermediar arquivos estáticos deste caminho; ele não é alterado pelo laboratório.

## Testar

1. Abra `lab/songsterr/` no endereço publicado.
2. Busque por artista e título, cole um link HTTPS de música do Songsterr ou use **Buscar faixa do Spotify** após conectar. Confira os resultados e selecione a música e a pista. **Testar Nirvana** continua como atalho. Busca e metadados passam pelo Jina Reader; as notas são consultadas diretamente do Songsterr. As revisões são lidas da fonte, sem IDs fixos de transcrição. O repositório não contém transcrições; as consultas são individuais e não recebem cookies ou credenciais do Spotify.
3. Para acompanhar Spotify, cadastre a URL adicional exibida na página em Redirect URIs do mesmo aplicativo no Spotify Developer. Não remova a URL principal. Cole o Client ID e conecte a sua conta autorizada. Não é necessário Client Secret.
4. Toque a gravação de estúdio correspondente e indique o início de um compasso. A segunda marcação ajusta a velocidade média. O destaque é estimado, não sincronizado por nota.
5. Desconectar afeta somente este teste. Marcas e token de acesso ficam em memória e são perdidos ao recarregar; apenas o estado temporário de autorização PKCE usa uma chave própria de sessionStorage (`cifrasync.songsterr-lab.pkce`), removida ao concluir/cancelar.

O teste somente lê o estado do Spotify e não controla sua reprodução. A marcação exige artista e título/versão correspondentes à música selecionada. Sufixos de remasterização são normalizados; ao vivo/acústico não são confundidos com estúdio. Trocar música ou pista apaga marcações da leitura anterior. Não há vídeo, som próprio, exportação, download ou cópia persistente da tablatura, fallback integrado à aplicação principal. A busca é manual neste laboratório; a troca no Spotify não escolhe uma transcrição automaticamente. Um arquivo acessível e CORS liberado não equivalem a uma API suportada ou licença de reutilização. Reavaliar estabilidade e condições da fonte antes de integrar à aplicação principal.

Leitor experimental: vozes separadas, corda/casa, notas abafadas/fantasma/ligadas e pausas. Não é uma transcrição gráfica completa: repetições, ornamentos e mudanças de andamento não são interpretados. Cordas numeradas a partir de 1 (aguda, topo); a quantidade e a afinação são as da pista selecionada. Pistas de bateria e voz são excluídas. Tablaturas de guitarra/baixo não são convertidas para cavaquinho.

Validação em navegador: fonte simulada original para exibição, duas marcas, pausa, artista incompatível, desconexão, preservação de chaves do aplicativo principal, ausência de banco/service worker próprio e ausência de credenciais nas requisições da fonte. Verificação da fonte pública real registrada na execução do teste, sem redistribuir o conteúdo.

## Laboratório ampliado

Cache temporário em memória para busca/metadados (10 minutos, até 50 consultas), sem persistir transcrições. HTTP 429 causa espera; falhas 401/403 da fonte não são contornadas. Requisições têm timeout e cancelamento; ao mudar rapidamente de resultado/pista, respostas antigas não substituem a seleção atual. Nenhuma chave Spotify segue para Jina Reader ou Songsterr.

Teste em navegador: busca textual e pela faixa do Spotify, abertura por link, rejeição de outro domínio, troca guitarra/baixo, limpeza de marcas, pausa, validação de identidade e preservação de dados pessoais. Testes de fonte real usam consultas individuais opcionais; a disponibilidade pode mudar.

### Executar os testes

Com Node e Playwright disponíveis: `node tests/browser.cjs`. Use `LAB_CHROMIUM_EXECUTABLE` para indicar um Chromium existente e `LAB_LIVE=1` para incluir as três consultas reais (Nirvana, Metallica e Red Hot Chili Peppers). Sem `LAB_LIVE`, as respostas são simuladas com dados originais de teste e não exigem login Spotify. O teste cria um contexto de navegador novo, sem usar sessão pessoal.
