# Validação da versão 6

Em 26/10/2026 foram realizados testes locais em Chromium headless. Os testes de reprodução usam respostas simuladas do Spotify e frases originais de teste; não incluem letras comerciais. A conta real do usuário e o iPhone não foram operados.

## Fluxos aprovados

- migration: original personal song and anchor preserved in IndexedDB; bulk removed from localStorage.
- automaticTrackAndLyrics: passed with synthetic Spotify and original test lyrics.
- chordBar: barra automática de diagramas visível durante o estudo, aprovada.
- diagramsAndModes: passed: four chords, variants, click from sheet and timed lyric line.
- txtImport: passed.
- gzipWorkerImport: passed.
- zipImport: passed, auxiliary JSON ignored.
- lrcImport: passed, overrides external cache.
- personalOverride: passed, catalogue reimport preserves user transposition.
- pinnedLibraryLyrics: passed, lyrics follow selected library song and return to active track.
- personalBackup: passed, user-edited catalogue charts included, bulk and tokens excluded.
- Barra de diagramas e recursos de fila de letras da versão 5 incorporados à versão 6.
- Quatro testes automatizados de LRC, correspondência de gravação, harmonia/baixo nos diagramas e importação ChordPro: aprovados. Execute `node --test tests/study.test.cjs`.

## Teste de volume e offline

- Importação efetiva de **430,324 registros**, em worker.
- Tela permaneceu responsiva durante a importação.
- Biblioteca paginada limita a apresentação a 100 resultados.
- Busca de “My Sacrifice” localizou o guia de acompanhamento.
- Reabertura offline, busca local e diagramas: aprovados.
- No ambiente de teste, a execução completa levou cerca de 67 segundos e o IndexedDB ocupou aproximadamente 525 MiB. Esses valores não são uma previsão de desempenho do iPhone.
- O localStorage continha apenas 148 caracteres de configurações/fila, sem a base grande.
- Nenhuma exceção de página nos fluxos aprovados.

## Escopo

O teste de volume validou o importador, os índices, a continuidade da interface e o funcionamento offline. Os ajustes finais de interface e preservação das edições foram conferidos nos testes funcionais posteriores. As transcrições de terceiros não foram revisadas musicalmente uma a uma. O guia de My Sacrifice é simplificado, sem o riff original e sem tempos artificiais de acordes. A disponibilidade das letras varia por faixa/serviço e deve ser conferida no uso real.
