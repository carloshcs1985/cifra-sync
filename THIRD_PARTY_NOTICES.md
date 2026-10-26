# Fontes e terceiros

## Chordonomicon — sequências harmônicas

Kantarelis, Spyridon; Thomas, Konstantinos; Lyberatos, Vassilis; Dervakos, Edmund; Stamou, Giorgos. CHORDONOMICON: A Dataset of 666,000 Songs and their Chord Progressions (2024).

- https://doi.org/10.48550/arXiv.2410.22046
- https://huggingface.co/datasets/ailsntua/Chordonomicon
- Licença declarada dos dados: **CC BY-NC 4.0**, https://creativecommons.org/licenses/by-nc/4.0/

A fonte obtida em 26/10/2026 contém 679.807 registros. Foram selecionados IDs válidos do Spotify, removidas duplicatas de ID, preservadas sequências de acordes, convertidas grafias conhecidas e traduzidos rótulos de seção. Não foram acrescentadas letras nem tempos artificiais. O banco distribuído conserva a atribuição e a restrição não comercial dos dados. A licença Apache do repositório de código do Chordonomicon não substitui a licença dos dados.

## Metadados factuais de faixas

- Maharshi Pandya: https://huggingface.co/datasets/maharshipandya/spotify-tracks-dataset (catálogo declara BSD).
- Espelho de khushimalviya: https://huggingface.co/datasets/khushimalviya/spotify-tracks-dataset (não declara licença própria no catálogo consultado).
- Spotify oEmbed, para nomes adicionais de faixas: https://open.spotify.com/oembed

Foram associados por ID exato apenas metadados factuais como títulos, artistas e duração. Eles podem refletir erros dos catálogos ou homônimos. O app atualiza nomes de registros sem nome com os dados da faixa efetivamente recebida do Spotify.

## Dicionário de posições de acordes

David Rubert (Tombatossals), chords-db.
https://github.com/tombatossals/chords-db

Licença **MIT** preservada integralmente em `assets/CHORDS-LICENSE.txt`. Os dados são distribuídos em `assets/chord-shapes.json`. A interface reorganiza posições pela casa inicial e desenha as formas em SVG; não modifica as digitações da fonte.

## Descompactação ZIP

fflate 0.8.2, Arjun Barrett.
https://github.com/101arrowz/fflate

Licença **MIT** preservada integralmente em `vendor/fflate.LICENSE`. A biblioteca é empacotada localmente, sem CDN em tempo de execução.

## Letras

Consulta individual ao LRCLIB: https://lrclib.net/docs
Código do serviço: https://github.com/tranxuanthang/lrclib

Nenhuma letra de repertório comercial integra este repositório ou o catálogo de acordes. A disponibilidade de letras depende do serviço e dos arquivos que o usuário importar. O app não baixa um dump de letras nem contorna autenticação de sites.

## Acompanhamento adicional

“My Sacrifice”, Creed: guia simplificado de acompanhamento, sem letra, solo ou riff; não representa uma transcrição integral com compassos/tempos. Referências de acordes: https://www.cifraclub.com.br/creed/my-sacrifice/ e https://www.cifras.com.br/cifra/creed/my-sacrifice . Os diagramas usam afinação padrão e não reproduzem posições alternativas da gravação.

Estes avisos descrevem os componentes de terceiros; não alteram a licença do código original do aplicativo do usuário.
