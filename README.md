# G4 DOCS EDITOR

Editor PDF local em React/Vite. O app usa `pdf.js` para renderizar e localizar texto no documento e `pdf-lib` para exportar um novo PDF com edicoes aplicadas localmente.

## Funcoes

- Abrir PDF local.
- Identificar blocos de texto e editar por coordenada.
- Inserir texto novo.
- Cobrir/apagar texto ou area.
- Marca-texto.
- Caneta e assinatura.
- Inserir imagens PNG/JPG.
- Criar links.
- Desenhar retangulo, circulo, linha e seta.
- Adicionar pagina retrato ou paisagem.
- Girar, duplicar, excluir e mover paginas.
- Exportar PDF final sem API externa.

## Desktop

```bash
npm run dist:desktop
```

Gera instalador Windows e executavel portatil em `release-builds/`.
O AppImage Linux e gerado no GitHub Actions pelo workflow de release.

## Rodar

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
