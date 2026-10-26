# Cifra Sync · Estudo 7

Ambiente pessoal de estudo de guitarra/violão que identifica a faixa em reprodução no Spotify, abre os acordes da biblioteca local e acompanha o tempo da música.

## Leitura conjunta na versão 7

A aba **Juntos** exibe a letra inteira, o acorde atual, o próximo e o diagrama. O acorde só é destacado quando existe um tempo salvo para aquela ocorrência: não é calculado dividindo a duração da música pelo número de acordes.

Cifras pessoais com acordes sobre as palavras mantêm suas colunas. Quando o texto corresponde à letra com LRC, a frase acompanha o Spotify. Tempos de frase não informam o instante de cada troca dentro dela.

**Sincronizar trocas** registra os acordes com um toque no instante em que você os ouve. Você pode selecionar a ocorrência, desfazer e retomar. As marcações ficam no aparelho e no backup pessoal; transpor preserva os tempos. Outro ID de gravação, duração incompatível ou mudança na sequência de acordes impede o uso automático das marcações antigas.

Os **430.324 registros não são 430.324 cifras completas**. O banco contém acordes/estrutura, sem letras e sem tempos de troca. Para acompanhar cada acorde automaticamente sem marcação pessoal, ainda é necessária uma fonte com tempos por acorde para a gravação exata. Essa fonte não integra esta versão. A diferença entre letra com tempos e acordes sem tempos aparece na interface.

A seleção inicial foi ampliada com as 293 entradas aproveitáveis de Red Hot Chili Peppers, Nirvana e No Doubt identificadas na fonte. **Scar Tissue** e **Smells Like Teen Spirit** foram acrescentadas como **guias simplificados da harmonia principal**, sem letra embutida, tempos ou arranjo integral. Elas não devem ser confundidas com cifras completas.

A seleção inicial se atualiza ao abrir a versão 7 e preserva as edições pessoais. O arquivo grande de importação continua sendo o mesmo.

## Recursos da biblioteca

- Biblioteca em **IndexedDB**, com migração automática das cifras que estavam no `localStorage`.
- **430.324 registros** de acordes no arquivo de importação completa. Cerca de 40 MiB de download; o espaço ocupado no navegador é maior.
- Seleção inicial de **1.224 registros**, carregada automaticamente na primeira abertura.
- Busca por ID do Spotify e por artista/título. O botão **Importar banco completo** carrega o acervo no aparelho uma única vez.
- **828 tipos de acordes e 3.283 posições** em diagramas de guitarra: dedos, casas, cordas soltas e pestanas, com posições alternativas.
- Aba **Letra**, consulta individual ao LRCLIB e cache local. Quando a resposta traz LRC, a linha acompanha os tempos do Spotify; o trecho atual também pode aparecer sobre a cifra.
- Importação de **TXT, ChordPro, JSON nativo, JSONL, JSONL.gz, ZIP de cifras e LRC**, com o processamento de bases grandes em um worker.
- A preparação de uma playlist procura as cifras no banco local e pode listar também faixas sem letra importada.

## Instalar a atualização no GitHub Pages

Mantenha o mesmo endereço, Client ID e Redirect URI já configurados. Atualize os arquivos do aplicativo e inclua as novas pastas `assets`, `catalog` e `vendor`. A pasta `catalog` publica apenas o manifesto e a seleção inicial. O banco completo é um arquivo separado, importado no aparelho.

Não apague os dados do site no iPhone: a atualização migra as cifras existentes. O login do Spotify continua apenas no aparelho; não há token nem segredo no repositório.

Abra a versão atualizada e confira **Menu → Cifra Sync · versão 7**. Se ainda aparecer a versão anterior, feche as abas e o app instalado e abra novamente. As versões dos arquivos e do service worker foram atualizadas.

## Preparar o estudo

1. A seleção inicial é atualizada automaticamente. Dê play no Spotify e abra **Juntos** para ler a letra inteira. Cifras pessoais alinhadas e trocas com tempos salvos aparecem na mesma leitura.
2. Baixe o arquivo **Cifra_Sync_Biblioteca_430mil.jsonl.gz** entregue junto da atualização. Escolha **Menu → Importar banco completo** e selecione esse arquivo. Não precisa extrair. É uma importação única; depois, a busca usa os dados do aparelho.
3. Mantenha o aplicativo aberto durante a importação. A tela continua funcionando e é possível interromper; os lotes já gravados permanecem. Reserve espaço livre: no teste, a base ocupou aproximadamente 550 MB, além da interface e dos seus arquivos. O uso real varia por navegador.
4. Na aba **Acordes**, toque em um diagrama para mudar de posição. Também é possível tocar num acorde da cifra.
5. Na aba **Letra**, uma letra com LRC acompanha o tempo recebido do Spotify. Toque em uma linha com tempos para voltar a esse trecho.
6. Para fazer uma seleção de playlist, use a função de playlist existente no menu. A disponibilidade da playlist depende do acesso liberado pelo Spotify para o seu app.

## Letras e acordes são fontes diferentes

O catálogo distribuído contém **acordes e divisões de estrutura**, sem letras, áudio, tablaturas de solos ou tempos por acorde. As letras **não estão embutidas no repositório**. A consulta ao LRCLIB é feita apenas para a faixa selecionada/reproduzida; não há download em massa de letras.

A consulta envia título, artista, álbum e duração ao LRCLIB; nunca envia o token do Spotify. Pode ser desativada no menu. O serviço é externo e a cobertura varia. Uma resposta que não corresponde a título, artista, tipo de versão e duração é descartada. Falha de rede ou falta de letra não impede a leitura dos acordes.

Arquivos TXT/ChordPro **com letra e acordes já alinhados** mantêm esse alinhamento na aba Cifra. Uma letra obtida separadamente não informa onde cada acorde deve cair sobre as palavras: o aplicativo mostra as duas informações sem inventar esse alinhamento. A aba Letra e o trecho sobre a cifra podem usar os tempos do LRC; a rolagem dos acordes sem marcações continua aproximada. Para os acordes acompanharem um arranjo exatamente, use **Marcar** e salve as entradas de cada trecho.

## Importar seus arquivos

- TXT: nomeie como `Artista - Música.txt`.
- ChordPro: `.cho`, `.chopro`, `.chordpro`, `.crd` ou `.pro`; pode conter várias músicas com `{new_song}`.
- ZIP: reúne TXT/ChordPro e backups JSON. Arquivos auxiliares são ignorados; SQLite não é carregado. Para bases grandes, prefira JSONL.gz.
- LRC: use `Artista - Música.lrc` ou os metadados `[ar:Artista]` e `[ti:Música]`. O arquivo fica vinculado à chave artista/título e, quando corresponder à faixa atual, ao ID dela. LRC importado tem prioridade sobre a consulta externa.
- JSONL.gz: um objeto de música por linha, com `id`, `title`, `artist`, `sheet`, `trackIds` e, quando possível, `key`. O formato é lido em fluxo, sem descompactar o arquivo inteiro na memória.

Importações gravam lotes no banco; se uma operação for interrompida ou encontrar erro, os lotes já concluídos permanecem salvos. Uma nova importação reutiliza IDs e não cria cópias ilimitadas. O espaço disponível depende do navegador/aparelho. Não limpe os dados do site sem exportar suas cifras pessoais.

## Cobertura e precisão

- 430.324 registros; 61.333 já têm título e artista. Os demais são consultáveis pelo ID do Spotify e ganham nomes quando reconhecidos na reprodução ou em uma playlist.
- Os gêneros da fonte incluem outros estilos além de pop/rock. A identificação e a qualidade musical das transcrições de terceiros não foram revisadas uma a uma.
- Um ID pode corresponder a uma gravação específica. Outra edição, apresentação ao vivo, acústica, remix ou versão regional pode não ter o mesmo arranjo. O app dá preferência ao ID exato e evita associar tipos de versão diferentes no fallback por nome.
- Algumas grafias incomuns da fonte são sinalizadas para revisão; não há diagrama inventado para um acorde ausente do dicionário.
- Os diagramas são **formas em afinação padrão E A D G B e**, para acompanhamento. Não representam automaticamente capotraste, afinações alternativas ou a digitação de um riff original.
- “My Sacrifice”, do Creed, foi incluída como **acompanhamento simplificado**. Ela não é uma transcrição do riff nem possui tempos de acordes inventados.

## Dados pessoais, backup e funcionamento offline

As cifras, marcações e letras consultadas/importadas ficam no IndexedDB do aparelho. Configurações, fila e autorização do Spotify continuam no armazenamento local. A migração guarda uma cópia do estado anterior no próprio banco antes de reduzir o `localStorage`.

**Exportar minhas cifras e marcações** exporta as cifras pessoais, incluindo entradas do catálogo que você editou, transpôs ou marcou. Não reexporta os 430 mil registros públicos nem os tokens. O arquivo do catálogo pode ser importado novamente sem multiplicar os mesmos IDs. O cache separado de letras não faz parte desse backup: preserve seus arquivos LRC e TXT/ChordPro; as letras do serviço podem ser consultadas novamente.

A interface, os diagramas e as cifras importadas funcionam offline após a instalação do service worker. O reconhecimento e os controles do Spotify precisam de internet; a consulta de uma letra ainda não salva também precisa. Safari e o app da tela inicial podem manter áreas de armazenamento diferentes: faça a importação no ambiente em que você vai estudar.

## Desenvolvimento

Sem etapa de compilação. Sirva a pasta por HTTPS ou, para testar, `python -m http.server 8000 --bind 127.0.0.1`. Cadastre o Redirect URI local no Spotify se precisar testar autenticação. Não coloque um client secret neste app público.

Arquivos novos: `storage.js`, `study-core.js`, `playalong-core.js`, `together.js`, `study.js`, `catalog.js`, `import-worker.js`, `assets/`, `catalog/` e `vendor/`. Veja `THIRD_PARTY_NOTICES.md` para as fontes e licenças e `VALIDACAO.md` para o escopo dos testes.
