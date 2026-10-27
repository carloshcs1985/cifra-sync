# Laboratório Songsterr — experimental

Página independente para validar busca de músicas, seleção de pistas e acompanhamento estimado por compasso. Nenhum arquivo da aplicação principal é substituído. Não importa módulos do Cifra Sync, não registra service worker, não usa IndexedDB/localStorage e não modifica a biblioteca pessoal. O service worker já instalado no site pode intermediar arquivos estáticos deste caminho; ele não é alterado pelo laboratório.

## Testar

1. Abra `lab/songsterr/` no endereço publicado.
2. Busque por artista e título, cole um link HTTPS de música do Songsterr ou use **Buscar faixa do Spotify** após conectar. Na busca manual, selecione a música; na troca automática do Spotify, o laboratório recomenda uma versão e uma guitarra com notas. Outras versões e instrumentos continuam disponíveis. **Testar Nirvana** continua como atalho. Busca e metadados passam pelo Jina Reader; as notas são consultadas diretamente do Songsterr. As revisões são lidas da fonte, sem IDs fixos de transcrição. O repositório não contém transcrições; as consultas são individuais e não recebem cookies ou credenciais do Spotify.
3. Para acompanhar Spotify, cadastre a URL adicional exibida na página em Redirect URIs do mesmo aplicativo no Spotify Developer. Não remova a URL principal. Cole o Client ID e conecte a sua conta autorizada. Não é necessário Client Secret.
4. Toque a gravação correspondente e indique o início de um compasso. A segunda marcação ajusta a velocidade média. O destaque é estimado, não sincronizado por nota.
5. Desconectar afeta somente este teste. Marcas e token de acesso ficam em memória e são perdidos ao recarregar; apenas o estado temporário de autorização PKCE usa uma chave própria de sessionStorage (`cifrasync.songsterr-lab.pkce`), removida ao concluir/cancelar.

O teste somente lê o estado do Spotify e não controla sua reprodução. A marcação exige artista e título base correspondentes à música selecionada. A busca automática prioriza a mesma versão; sem ela, aceita uma tablatura geral ou de outra versão com aviso de possível diferença no arranjo. Ao vivo/live/unplugged/acústico e complementos após hífen não impedem a correspondência pelo título base. As marcações continuam vinculadas ao ID da gravação durante a sessão e são apagadas ao trocar a faixa. Trocar música ou pista apaga marcações da leitura anterior. Não há vídeo, som próprio, exportação, download ou cópia persistente da tablatura, fallback integrado à aplicação principal. A opção de buscar e abrir ao trocar de faixa vem ativada no laboratório e pode ser desligada. Entre resultados compatíveis, a seleção prioriza a versão e a popularidade, confere notas utilizáveis e abre uma recomendação. As alternativas ficam recolhidas em **Outras versões**. A consulta acontece uma vez por mudança de ID, e falhas não geram tentativas a cada polling. Um arquivo acessível e CORS liberado não equivalem a uma API suportada ou licença de reutilização. Reavaliar estabilidade e condições da fonte antes de integrar à aplicação principal.

Leitor experimental: vozes separadas, corda/casa, notas abafadas/fantasma/ligadas e pausas. Não é uma transcrição gráfica completa: repetições, ornamentos e mudanças de andamento não são interpretados. Cordas numeradas a partir de 1 (aguda, topo); a quantidade e a afinação são as da pista selecionada. Pistas de bateria e voz são excluídas. Tablaturas de guitarra/baixo não são convertidas para cavaquinho.

Validação em navegador: fonte simulada original para exibição, duas marcas, pausa, artista incompatível, desconexão, preservação de chaves do aplicativo principal, ausência de banco/service worker próprio e ausência de credenciais nas requisições da fonte. Verificação da fonte pública real registrada na execução do teste, sem redistribuir o conteúdo.

## Laboratório ampliado

Cache temporário em memória para busca/metadados (10 minutos, até 50 consultas), sem persistir transcrições. HTTP 429 causa espera; falhas 401/403 da fonte não são contornadas. Requisições têm timeout e cancelamento; ao mudar rapidamente de resultado/pista, respostas antigas não substituem a seleção atual. Nenhuma chave Spotify segue para Jina Reader ou Songsterr.

Teste em navegador: busca textual e pela faixa do Spotify, abertura por link, rejeição de outro domínio, troca guitarra/baixo, limpeza de marcas, pausa, validação de identidade e preservação de dados pessoais. Testes de fonte real usam consultas individuais opcionais; a disponibilidade pode mudar.

### Executar os testes

Com Node e Playwright disponíveis: `node tests/browser.cjs`. Use `LAB_CHROMIUM_EXECUTABLE` para indicar um Chromium existente e `LAB_LIVE=1` para incluir as consultas reais de Nirvana, Metallica, Red Hot Chili Peppers, Eagles, AC/DC, Evanescence e Eminem, além de recomendação automática com identidade Spotify simulada e fonte real. Sem `LAB_LIVE`, as respostas são simuladas com dados originais de teste e não exigem login Spotify. O teste cria um contexto de navegador novo, sem usar sessão pessoal.

## Troca automática e versões

Com Spotify conectado, o laboratório consulta mudanças de faixa aproximadamente a cada 3 segundos. A busca usa artista e título base; a preferência é mesma versão → tablatura geral → outra versão. Artista e composição continuam sendo conferidos. Uma busca manual, desligamento da opção ou nova faixa cancela a consulta anterior. Respostas atrasadas não podem substituir a leitura mais recente. Nenhuma tabela de tempos é herdada de outra gravação. Sem marcações pessoais, não há rolagem sincronizada, mesmo quando a tablatura foi aberta automaticamente.

Testes adicionais: transição automática entre músicas, não repetir consultas na mesma faixa, desligar/religar, versões repetidas e primeira versão sem notas, nenhuma música encontrada, resposta de metadados atrasada e fallback de ao vivo para tablatura geral. Casos unitários incluem Hotel California Live/MTV/Unplugged/Acústico, prioridade de versão exata, artista incorreto e preservação de parênteses que fazem parte do título. Execute `node --test tests/*.test.cjs`.

## Escolha de pista e versão

O laboratório prefere guitarra principal/lead e base/rhythm a pistas de fundo, extras ou efeitos. A indicação de popularidade da fonte serve como apoio, sem obrigar a abrir a guitarra de fundo. Antes de recomendar, verifica notas reais de corda/casa, cobertura dos compassos e posição da primeira entrada. A avaliação é limitada a três versões e até três pistas por versão, em sequência; não percorre o catálogo inteiro. Se a primeira opção for vazia ou muito esparsa, considera as próximas compatíveis. Não garante que a recomendação seja o melhor arranjo para toda gravação. Restrições e limites da fonte interrompem a consulta.

Se houver pausas no início, uma prévia mostra o primeiro compasso com notas e o botão **Ir à primeira entrada**. Os compassos de introdução e sua numeração são preservados: retirar pausas alteraria a referência de tempo. A escolha manual do instrumento continua sendo respeitada, inclusive para uma pista esparsa.

Casos de referência observados na fonte: em Thunderstruck, a guitarra principal começa no compasso 1, enquanto a de fundo começa no 54; em Bring Me to Life, a guitarra principal entra no compasso 9. Os testes simulados verificam preferência por lead, primeira versão vazia seguida de outra utilizável, prévia de entrada, notas de casa zero e cobertura de compassos. Conteúdo das músicas não integra os testes nem o repositório.

## Letra junto da tablatura

Com Spotify conectado e artista/título base correspondentes à tablatura, a letra é consultada no [LRCLIB](https://lrclib.net/docs) usando título da gravação, artista, álbum e duração. A frase atual e a próxima acompanham o relógio de reprodução, inclusive pausa e mudança de posição. A busca não usa a versão genérica da tablatura como identidade da gravação. A seleção automática de guitarra e versões continua independente.

Ao marcar **Este compasso começa agora**, os trechos são distribuídos abaixo dos compassos pela mesma estimativa de tempo da rolagem. Uma segunda marcação recalcula a distribuição; apagar marcas ou mudar a velocidade retira esse posicionamento até nova marcação. **Não há alinhamento exato entre sílabas e notas.** Introduções, repetições e diferenças de arranjo podem exigir ajustes. Antes da primeira marcação, a frase atual e a próxima servem como referência para localizar a entrada.

Somente letras com título de versão compatível e duração até dois segundos da gravação recebem acompanhamento por tempo. Se houver apenas texto ou uma versão/duração diferente, a letra fica recolhida em **Letra de referência · sem tempos compatíveis**, sem associação inventada aos compassos. Sem resultado, o leitor de tablatura continua funcionando. Disponibilidade e qualidade da letra dependem da fonte.

Uma consulta por gravação durante a sessão, cache em memória limitado a 20 resultados por 10 minutos, requisições sequenciais, identificação do cliente, pausa entre busca exata e alternativa, timeout e respeito a HTTP 429/Retry-After. Não envia token/cookies Spotify ao LRCLIB. Respostas de gravações anteriores são canceladas e descartadas; desconectar remove a letra da tela. Nenhuma letra é incluída no repositório ou persistida no armazenamento do aplicativo.

Testes: LRC com vários timestamps, lacunas instrumentais e offset; distribuição após uma/duas marcas; rejeição de artista incorreto e de tempos de outra versão/duração; cache, cancelamento e limite da fonte. Navegador: frase atual/próxima, pausa, letra abaixo dos compassos após marcar, remoção das posições ao trocar pista e isolamento de credenciais. O modo de fonte real também verifica acesso direto ao LRCLIB com CORS no navegador para Wake Me Up When September Ends, sem salvar sua letra no repositório.
