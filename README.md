# G4 Docs Editor 1.1

Editor PDF local para Windows, Linux e navegador. Identidade G4T0XX em preto e vermelho.

## Usar

Baixe o instalador ou a versão portátil em [Releases](https://github.com/GABRIELMSORENSEN/g4-docs-editor/releases). No navegador, use [G4 Docs Editor](https://gabrielmsorensen.github.io/g4-docs-editor/).

Abra um PDF, selecione a ferramenta e exporte uma cópia em **Salvar PDF**. Os documentos não são enviados a servidores.

## Recursos

- Inserir e editar texto por sobreposição, imagens, links, assinatura e desenhos.
- Reordenar, duplicar, girar, adicionar e remover páginas.
- Histórico de desfazer/refazer para páginas e objetos.
- Aviso antes de descartar alterações e mensagens de erro com recuperação.
- Cancelamento de renderizações antigas durante mudanças rápidas de zoom/página.

**Cobrir é uma alteração visual.** O texto original permanece no arquivo e pode ser extraído. Para remoção de dados sigilosos, use uma ferramenta de redação segura. A edição de texto sobreposto usa fontes PDF padrão e não reconstrói a diagramação original.

## Desenvolver e empacotar

Node.js 22 ou superior.

```powershell
npm ci
npm run lint
npm run build
npm run dist:win
```

Linux: `npm run dist:appimage` em Linux. Os workflows existentes geram Windows/Linux em tags `v*`.

Teste real do navegador: `python -m pip install playwright pypdf`, `python -m playwright install chromium` e `python tests/verify_browser.py`. O teste abre e exporta PDFs, confere o arquivo exportado e cobre histórico, erros, descarte e zoom. Evidências em `reports/`.
