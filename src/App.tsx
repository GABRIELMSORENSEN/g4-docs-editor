import {useDocumentHistory} from './useDocumentHistory';

import React, {useEffect, useMemo, useRef, useState} from 'react';

import * as pdfjs from 'pdfjs-dist';

import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

import appIcon from './assets/g4-docs-icon-512.png';

import {

  degrees,

  PDFDocument,

  PDFName,

  PDFString,

  rgb,

  StandardFonts,

} from 'pdf-lib';

import {

  AlignCenter,

  AlignLeft,

  AlignRight,

  Bold,

  ChevronLeft,

  ChevronRight,

  Circle,

  Copy,

  Download,

  Eraser,

  FilePlus2,

  Highlighter,

  Image as ImageIcon,

  Italic,

  Link as LinkIcon,

  Loader2,

  Minus,

  MousePointer2,

  MoveLeft,

  MoveRight,

  PenLine,

  Plus,

  RotateCw,

  Save,

  Scissors,

  Square,

  Stamp,

  Trash2,

  Type,

  Upload,

  ZoomIn,

  ZoomOut,

} from 'lucide-react';

import {motion} from 'motion/react';



pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;



type Rotation = 0 | 90 | 180 | 270;

type Tool =

  | 'select'

  | 'editText'

  | 'addText'

  | 'redact'

  | 'highlight'

  | 'draw'

  | 'signature'

  | 'image'

  | 'link'

  | 'shape';

type ShapeKind = 'rectangle' | 'ellipse' | 'line' | 'arrow';

type TextAlign = 'left' | 'center' | 'right';



interface Point {

  x: number;

  y: number;

}



interface Rect {

  x: number;

  y: number;

  width: number;

  height: number;

}



interface SourcePageRef {

  id: string;

  kind: 'pdf';

  sourceIndex: number;

  width: number;

  height: number;

  rotation: Rotation;

  label: string;

}



interface BlankPageRef {

  id: string;

  kind: 'blank';

  width: number;

  height: number;

  rotation: Rotation;

  label: string;

}



type PageRef = SourcePageRef | BlankPageRef;



interface PageData {

  pageId: string;

  viewport: any | null;

  canvasWidth: number;

  canvasHeight: number;

  pdfWidth: number;

  pdfHeight: number;

  scale: number;

  textItems: PDFTextItem[];

}



interface PDFTextItem {

  str: string;

  width: number;

  height?: number;

  transform: number[];

  fontName?: string;

}



interface MarkBase extends Rect {

  id: string;

  pageId: string;

}



interface TextMark extends MarkBase {

  type: 'text';

  text: string;

  originalText?: string;

  redactOriginal: boolean;

  fontSize: number;

  fontFamily: FontKey;

  color: string;

  bold: boolean;

  italic: boolean;

  align: TextAlign;

}



interface RedactMark extends MarkBase {

  type: 'redact';

  fill: string;

}



interface HighlightMark extends MarkBase {

  type: 'highlight';

  color: string;

  opacity: number;

}



interface ShapeMark extends MarkBase {

  type: 'shape';

  shape: ShapeKind;

  stroke: string;

  fill: string;

  thickness: number;

  opacity: number;

}



interface InkMark {

  id: string;

  pageId: string;

  type: 'ink' | 'signature';

  points: Point[];

  color: string;

  thickness: number;

  opacity: number;

}



interface ImageMark extends MarkBase {

  type: 'image';

  dataUrl: string;

  mime: 'image/png' | 'image/jpeg';

  name: string;

  opacity: number;

}



interface LinkMark extends MarkBase {

  type: 'link';

  url: string;

}



type Mark =

  | TextMark

  | RedactMark

  | HighlightMark

  | ShapeMark

  | InkMark

  | ImageMark

  | LinkMark;



interface ImageAsset {

  dataUrl: string;

  mime: 'image/png' | 'image/jpeg';

  name: string;

  width: number;

  height: number;

}



interface DraftRect {

  kind: 'rect';

  tool: 'redact' | 'highlight' | 'shape' | 'link';

  start: Point;

  end: Point;

}



interface DraftInk {

  kind: 'ink';

  tool: 'draw' | 'signature';

  points: Point[];

}



type Draft = DraftRect | DraftInk;



interface DragState {

  markId: string;

  start: Point;

  original: Mark;

}



const PAGE_PRESETS = {

  portrait: {width: 595.28, height: 841.89},

  landscape: {width: 841.89, height: 595.28},

};



const FONT_OPTIONS = [

  {

    id: 'Helvetica',

    label: 'Helvetica',

    regular: StandardFonts.Helvetica,

    bold: StandardFonts.HelveticaBold,

    italic: StandardFonts.HelveticaOblique,

    boldItalic: StandardFonts.HelveticaBoldOblique,

  },

  {

    id: 'Times',

    label: 'Times',

    regular: StandardFonts.TimesRoman,

    bold: StandardFonts.TimesRomanBold,

    italic: StandardFonts.TimesRomanItalic,

    boldItalic: StandardFonts.TimesRomanBoldItalic,

  },

  {

    id: 'Courier',

    label: 'Courier',

    regular: StandardFonts.Courier,

    bold: StandardFonts.CourierBold,

    italic: StandardFonts.CourierOblique,

    boldItalic: StandardFonts.CourierBoldOblique,

  },

] as const;



type FontKey = (typeof FONT_OPTIONS)[number]['id'];



const DEFAULT_TEXT = {

  fontSize: 14,

  fontFamily: 'Helvetica' as FontKey,

  color: '#111827',

  bold: false,

  italic: false,

  align: 'left' as TextAlign,

};



const createId = () =>

  typeof crypto !== 'undefined' && 'randomUUID' in crypto

    ? crypto.randomUUID()

    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;



const clamp = (value: number, min: number, max: number) =>

  Math.min(max, Math.max(min, value));



const normalizeRect = (start: Point, end: Point): Rect => ({

  x: Math.min(start.x, end.x),

  y: Math.min(start.y, end.y),

  width: Math.abs(start.x - end.x),

  height: Math.abs(start.y - end.y),

});



const hexToRgb = (hex: string) => {

  const normalized = hex.replace('#', '').padEnd(6, '0').slice(0, 6);

  const value = Number.parseInt(normalized, 16);

  return rgb(

    ((value >> 16) & 255) / 255,

    ((value >> 8) & 255) / 255,

    (value & 255) / 255,

  );

};



const getStandardFontName = (

  family: FontKey,

  bold: boolean,

  italic: boolean,

) => {

  const option = FONT_OPTIONS.find((font) => font.id === family) ?? FONT_OPTIONS[0];

  if (bold && italic) return option.boldItalic;

  if (bold) return option.bold;

  if (italic) return option.italic;

  return option.regular;

};



const getDisplayFont = (family: FontKey) => {

  if (family === 'Times') return 'Times New Roman, Times, serif';

  if (family === 'Courier') return 'Courier New, Courier, monospace';

  return 'Arial, Helvetica, sans-serif';

};



const inferFontFamily = (fontName?: string): FontKey => {

  const name = (fontName ?? '').toLowerCase();

  if (name.includes('times') || name.includes('serif')) return 'Times';

  if (name.includes('courier') || name.includes('mono')) return 'Courier';

  return 'Helvetica';

};



const getTextItemMetrics = (item: PDFTextItem) => {

  const [, b, c, d, x, y] = item.transform;

  const fontSize = Math.max(5, Math.hypot(c, d) || Math.abs(b) || item.height || 12);

  const width = Math.max(4, item.width || item.str.length * fontSize * 0.5);

  return {x, y, width, height: fontSize * 1.22, fontSize};

};



const estimateTextBox = (text: string, fontSize: number) => {

  const lines = text.split(/\r?\n/);

  const width = Math.max(

    40,

    ...lines.map((line) => Math.max(1, line.length) * fontSize * 0.62),

  );

  return {

    width,

    height: Math.max(fontSize * 1.25, lines.length * fontSize * 1.25),

  };

};



const cloneMarkForPage = (mark: Mark, pageId: string): Mark => ({

  ...structuredClone(mark),

  id: createId(),

  pageId,

});



const getMarkBounds = (mark: Mark): Rect => {

  if ('points' in mark) {

    const xs = mark.points.map((point) => point.x);

    const ys = mark.points.map((point) => point.y);

    const minX = Math.min(...xs);

    const minY = Math.min(...ys);

    return {

      x: minX,

      y: minY,

      width: Math.max(1, Math.max(...xs) - minX),

      height: Math.max(1, Math.max(...ys) - minY),

    };

  }

  return {x: mark.x, y: mark.y, width: mark.width, height: mark.height};

};



const moveMark = (mark: Mark, dx: number, dy: number): Mark => {

  if (mark.type === 'ink' || mark.type === 'signature') {

    return {

      ...mark,

      points: mark.points.map((point) => ({x: point.x + dx, y: point.y + dy})),

    };

  }

  if ('x' in mark) {

    return {...mark, x: mark.x + dx, y: mark.y + dy};

  }

  return mark;

};



export default function App() {

  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const [sourceBytes, setSourceBytes] = useState<ArrayBuffer | null>(null);

  const [pdfDoc, setPdfDoc] = useState<any>(null);

  const {pages, marks, setPages, setMarks, resetDocument, undo, redo, markSaved, canUndo, canRedo, dirty} = useDocumentHistory<PageRef, Mark>();

  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const [pageData, setPageData] = useState<PageData | null>(null);



  const [selectedMarkId, setSelectedMarkId] = useState<string | null>(null);

  const [tool, setTool] = useState<Tool>('select');

  const [shapeKind, setShapeKind] = useState<ShapeKind>('rectangle');

  const [zoom, setZoom] = useState(1);

  const [loading, setLoading] = useState(false);

  const [status, setStatus] = useState('Pronto');

  const [errorMessage, setErrorMessage] = useState('');

  const [pendingAction, setPendingAction] = useState<{title: string; run: () => void} | null>(null);

  const confirmRef = useRef<HTMLDialogElement>(null);

  const renderTaskRef = useRef<any>(null);



  useEffect(() => { if (pendingAction) confirmRef.current?.showModal(); }, [pendingAction]);

  useEffect(() => {

    if (!dirty) return;

    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };

    window.addEventListener('beforeunload', beforeUnload);

    return () => window.removeEventListener('beforeunload', beforeUnload);

  }, [dirty]);

  const [draft, setDraft] = useState<Draft | null>(null);

  const [drag, setDrag] = useState<DragState | null>(null);

  const [imageAsset, setImageAsset] = useState<ImageAsset | null>(null);

  const [linkUrl, setLinkUrl] = useState('https://');

  const [strokeColor, setStrokeColor] = useState('#e11d48');

  const [fillColor, setFillColor] = useState('#ffffff');

  const [highlightColor, setHighlightColor] = useState('#fde047');

  const [thickness, setThickness] = useState(2);



  const canvasRef = useRef<HTMLCanvasElement>(null);

  const stageRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);

  const renderSeq = useRef(0);



  const currentPage = pages[currentPageIndex] ?? null;

  const selectedMark = useMemo(

    () => marks.find((mark) => mark.id === selectedMarkId) ?? null,

    [marks, selectedMarkId],

  );

  const pageMarks = useMemo(

    () => (currentPage ? marks.filter((mark) => mark.pageId === currentPage.id) : []),

    [currentPage, marks],

  );



  useEffect(() => {

    if (currentPageIndex > pages.length - 1) {

      setCurrentPageIndex(Math.max(0, pages.length - 1));

    }

  }, [currentPageIndex, pages.length]);



  useEffect(() => {

    if (!currentPage) return;

    void renderPage(currentPage);

    return () => { renderSeq.current += 1; renderTaskRef.current?.cancel(); };

  }, [currentPage, pdfDoc, zoom]);



  const renderPage = async (pageRef: PageRef) => {

    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (!ctx) return;



    const seq = ++renderSeq.current;

    setStatus('Renderizando pagina');

    try {

      if (renderTaskRef.current) {

        renderTaskRef.current.cancel();

        await renderTaskRef.current.promise.catch(() => {});

      }

      if (seq !== renderSeq.current) return;

      const scale = zoom * 1.35;

      if (pageRef.kind === 'blank') {

        const width = pageRef.width * scale;

        const height = pageRef.height * scale;

        canvas.width = width;

        canvas.height = height;

        ctx.fillStyle = '#ffffff';

        ctx.fillRect(0, 0, width, height);

        if (seq !== renderSeq.current) return;

        setPageData({

          pageId: pageRef.id,

          viewport: null,

          canvasWidth: width,

          canvasHeight: height,

          pdfWidth: pageRef.width,

          pdfHeight: pageRef.height,

          scale,

          textItems: [],

        });

        setStatus('Pagina em branco');

        return;

      }



      if (!pdfDoc) return;

      const page = await pdfDoc.getPage(pageRef.sourceIndex + 1);

      if (seq !== renderSeq.current) return;

      const viewport = page.getViewport({

        scale,

        rotation: ((page.rotate + pageRef.rotation) % 360) as Rotation,

      });

      canvas.width = viewport.width;

      canvas.height = viewport.height;

      ctx.fillStyle = '#ffffff';

      ctx.fillRect(0, 0, viewport.width, viewport.height);

      const task = page.render({canvasContext: ctx, viewport});

      renderTaskRef.current = task;

      await task.promise;

      const textContent = await page.getTextContent();

      if (seq !== renderSeq.current) return;

      setPageData({

        pageId: pageRef.id,

        viewport,

        canvasWidth: viewport.width,

        canvasHeight: viewport.height,

        pdfWidth: pageRef.width,

        pdfHeight: pageRef.height,

        scale: viewport.scale,

        textItems: textContent.items as PDFTextItem[],

      });

      setStatus(`${textContent.items.length} blocos de texto mapeados`);

    } catch (error) {

      if (seq !== renderSeq.current || (error as Error).name === 'RenderingCancelledException') return;

      console.error(error);

      setStatus('Falha ao renderizar pagina');

      setErrorMessage('Não foi possível renderizar esta página. Tente outra página ou abra o documento novamente.');

    }

  };



  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {

    const file = event.target.files?.[0];

    if (!file) return;

    setLoading(true);

    setErrorMessage('');

    setStatus('Carregando PDF local');

    try {

      const bytes = await file.arrayBuffer();

      const loadingTask = pdfjs.getDocument({

        data: bytes.slice(0),

        disableFontFace: false,

        useSystemFonts: true,

      });

      const doc = await loadingTask.promise;

      const loadedPages: PageRef[] = [];

      for (let index = 0; index < doc.numPages; index += 1) {

        const page = await doc.getPage(index + 1);

        const [x1, y1, x2, y2] = page.view;

        loadedPages.push({

          id: createId(),

          kind: 'pdf',

          sourceIndex: index,

          width: Math.abs(x2 - x1),

          height: Math.abs(y2 - y1),

          rotation: 0,

          label: `Pagina ${index + 1}`,

        });

      }

      setPdfFile(file);

      setSourceBytes(bytes);

      void pdfDoc?.destroy();

      setPdfDoc(doc);

      resetDocument(loadedPages);

      setSelectedMarkId(null);

      setCurrentPageIndex(0);

      setTool('editText');

      setStatus(`${doc.numPages} paginas carregadas`);

    } catch (error) {

      console.error(error);

      setStatus('PDF invalido ou protegido');

      setErrorMessage('Não foi possível abrir este PDF. Escolha um arquivo PDF válido e sem senha. O documento anterior foi preservado.');

    } finally {

      setLoading(false);

      event.target.value = '';

    }

  };



  const clientToPdfPoint = (clientX: number, clientY: number): Point | null => {

    if (!pageData || !stageRef.current) return null;

    const rect = stageRef.current.getBoundingClientRect();

    const x = clientX - rect.left;

    const y = clientY - rect.top;

    if (pageData.viewport) {

      const [pdfX, pdfY] = pageData.viewport.convertToPdfPoint(x, y);

      return {x: pdfX, y: pdfY};

    }

    return {

      x: clamp(x / pageData.scale, 0, pageData.pdfWidth),

      y: clamp(pageData.pdfHeight - y / pageData.scale, 0, pageData.pdfHeight),

    };

  };



  const pointToViewport = (point: Point) => {

    if (!pageData) return {x: 0, y: 0};

    if (pageData.viewport) {

      const [x, y] = pageData.viewport.convertToViewportPoint(point.x, point.y);

      return {x, y};

    }

    return {

      x: point.x * pageData.scale,

      y: (pageData.pdfHeight - point.y) * pageData.scale,

    };

  };



  const rectToViewport = (rect: Rect) => {

    const topLeft = pointToViewport({x: rect.x, y: rect.y + rect.height});

    const bottomRight = pointToViewport({x: rect.x + rect.width, y: rect.y});

    return {

      left: Math.min(topLeft.x, bottomRight.x),

      top: Math.min(topLeft.y, bottomRight.y),

      width: Math.abs(bottomRight.x - topLeft.x),

      height: Math.abs(bottomRight.y - topLeft.y),

    };

  };



  const textToViewport = (mark: TextMark) => {

    const topLeft = pointToViewport({x: mark.x, y: mark.y + mark.height * 0.82});

    const bottomRight = pointToViewport({x: mark.x + mark.width, y: mark.y - mark.height * 0.24});

    return {

      left: Math.min(topLeft.x, bottomRight.x),

      top: Math.min(topLeft.y, bottomRight.y),

      width: Math.abs(bottomRight.x - topLeft.x),

      height: Math.abs(bottomRight.y - topLeft.y),

    };

  };



  const updateMark = (markId: string, patch: Partial<Mark>) => {

    setMarks((current) =>

      current.map((mark) =>

        mark.id === markId ? ({...mark, ...patch} as Mark) : mark,

      ),

    );

  };



  const deleteSelectedMark = () => {

    if (!selectedMarkId) return;

    setMarks((current) => current.filter((mark) => mark.id !== selectedMarkId));

    setSelectedMarkId(null);

  };



  const createTextMark = (pageId: string, point: Point, text = 'Novo texto') => {

    const mark: TextMark = {

      id: createId(),

      pageId,

      type: 'text',

      x: point.x,

      y: point.y,

      width: Math.max(120, text.length * DEFAULT_TEXT.fontSize * 0.55),

      height: DEFAULT_TEXT.fontSize * 1.25,

      text,

      redactOriginal: false,

      ...DEFAULT_TEXT,

    };

    setMarks((current) => [...current, mark]);

    setSelectedMarkId(mark.id);

    setTool('select');

  };



  const createExistingTextEdit = (

    event: React.PointerEvent<HTMLDivElement>,

    item: PDFTextItem,

  ) => {

    event.stopPropagation();

    if (!currentPage) return;

    const metrics = getTextItemMetrics(item);

    const existing = marks.find(

      (mark) =>

        mark.type === 'text' &&

        mark.pageId === currentPage.id &&

        Math.abs(mark.x - metrics.x) < 0.1 &&

        Math.abs(mark.y - metrics.y) < 0.1 &&

        mark.originalText === item.str,

    );

    if (existing) {

      setSelectedMarkId(existing.id);

      setTool('select');

      return;

    }

    const edit: TextMark = {

      id: createId(),

      pageId: currentPage.id,

      type: 'text',

      x: metrics.x,

      y: metrics.y,

      width: metrics.width,

      height: metrics.height,

      text: item.str,

      originalText: item.str,

      redactOriginal: true,

      fontSize: metrics.fontSize,

      fontFamily: inferFontFamily(item.fontName),

      color: '#111827',

      bold: (item.fontName ?? '').toLowerCase().includes('bold'),

      italic:

        (item.fontName ?? '').toLowerCase().includes('italic') ||

        (item.fontName ?? '').toLowerCase().includes('oblique'),

      align: 'left',

    };

    setMarks((current) => [...current, edit]);

    setSelectedMarkId(edit.id);

    setTool('select');

  };



  const startStageAction = (event: React.PointerEvent<HTMLDivElement>) => {

    if (!currentPage || !pageData || event.button !== 0) return;

    const point = clientToPdfPoint(event.clientX, event.clientY);

    if (!point) return;



    if (tool === 'addText') {

      createTextMark(currentPage.id, point);

      return;

    }



    if (tool === 'image') {

      if (!imageAsset) {

        imageInputRef.current?.click();

        return;

      }

      const ratio = imageAsset.width / Math.max(1, imageAsset.height);

      const width = Math.min(220, pageData.pdfWidth * 0.45);

      const height = width / ratio;

      const imageMark: ImageMark = {

        id: createId(),

        pageId: currentPage.id,

        type: 'image',

        x: point.x,

        y: point.y - height,

        width,

        height,

        dataUrl: imageAsset.dataUrl,

        mime: imageAsset.mime,

        name: imageAsset.name,

        opacity: 1,

      };

      setMarks((current) => [...current, imageMark]);

      setSelectedMarkId(imageMark.id);

      setTool('select');

      return;

    }



    if (tool === 'draw' || tool === 'signature') {

      setDraft({kind: 'ink', tool, points: [point]});

      return;

    }



    if (tool === 'redact' || tool === 'highlight' || tool === 'shape' || tool === 'link') {

      setDraft({kind: 'rect', tool, start: point, end: point});

      return;

    }



    setSelectedMarkId(null);

  };



  const continueStageAction = (event: React.PointerEvent<HTMLDivElement>) => {

    if (drag) {

      const point = clientToPdfPoint(event.clientX, event.clientY);

      if (!point) return;

      const dx = point.x - drag.start.x;

      const dy = point.y - drag.start.y;

      setMarks((current) =>

        current.map((mark) =>

          mark.id === drag.markId ? moveMark(drag.original, dx, dy) : mark,

        ),

      );

      return;

    }



    if (!draft) return;

    const point = clientToPdfPoint(event.clientX, event.clientY);

    if (!point) return;

    if (draft.kind === 'rect') {

      setDraft({...draft, end: point});

    } else {

      setDraft({...draft, points: [...draft.points, point]});

    }

  };



  const finishStageAction = () => {

    if (drag) {

      setDrag(null);

      return;

    }



    if (!draft || !currentPage) return;

    if (draft.kind === 'ink') {

      if (draft.points.length > 1) {

        const mark: InkMark = {

          id: createId(),

          pageId: currentPage.id,

          type: draft.tool === 'signature' ? 'signature' : 'ink',

          points: draft.points,

          color: draft.tool === 'signature' ? '#111827' : strokeColor,

          thickness: draft.tool === 'signature' ? Math.max(2, thickness) : thickness,

          opacity: 1,

        };

        setMarks((current) => [...current, mark]);

        setSelectedMarkId(mark.id);

      }

      setDraft(null);

      setTool('select');

      return;

    }



    const rect = normalizeRect(draft.start, draft.end);

    if (rect.width < 3 || rect.height < 3) {

      setDraft(null);

      return;

    }



    let mark: Mark;

    if (draft.tool === 'redact') {

      mark = {

        id: createId(),

        pageId: currentPage.id,

        type: 'redact',

        ...rect,

        fill: fillColor,

      };

    } else if (draft.tool === 'highlight') {

      mark = {

        id: createId(),

        pageId: currentPage.id,

        type: 'highlight',

        ...rect,

        color: highlightColor,

        opacity: 0.42,

      };

    } else if (draft.tool === 'link') {

      try {

        const url = new URL(linkUrl);

        if (!['https:', 'http:', 'mailto:'].includes(url.protocol)) throw new Error();

      } catch {

        setErrorMessage('Use um link HTTP, HTTPS ou mailto válido.');

        setDraft(null);

        return;

      }

      mark = {

        id: createId(),

        pageId: currentPage.id,

        type: 'link',

        ...rect,

        url: linkUrl.trim() || 'https://',

      };

    } else {

      mark = {

        id: createId(),

        pageId: currentPage.id,

        type: 'shape',

        ...rect,

        shape: shapeKind,

        stroke: strokeColor,

        fill: shapeKind === 'rectangle' || shapeKind === 'ellipse' ? 'transparent' : 'transparent',

        thickness,

        opacity: 1,

      };

    }

    setMarks((current) => [...current, mark]);

    setSelectedMarkId(mark.id);

    setDraft(null);

    setTool('select');

  };



  const startDraggingMark = (

    event: React.PointerEvent<HTMLDivElement | SVGElement>,

    mark: Mark,

  ) => {

    event.stopPropagation();

    const point = clientToPdfPoint(event.clientX, event.clientY);

    if (!point) return;

    setSelectedMarkId(mark.id);

    if (tool === 'select') {

      setDrag({markId: mark.id, start: point, original: structuredClone(mark)});

    }

  };



  const pickImageAsset = (event: React.ChangeEvent<HTMLInputElement>) => {

    const file = event.target.files?.[0];

    if (!file) return;

    const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';

    const reader = new FileReader();

    reader.onload = () => {

      const dataUrl = String(reader.result);

      const image = new Image();

      image.onload = () => {

        setImageAsset({

          dataUrl,

          mime,

          name: file.name,

          width: image.naturalWidth,

          height: image.naturalHeight,

        });

        setTool('image');

        setStatus('Imagem pronta para inserir');

      };

      image.src = dataUrl;

    };

    reader.readAsDataURL(file);

    event.target.value = '';

  };



  const addBlankPage = (orientation: 'portrait' | 'landscape') => {

    const preset = PAGE_PRESETS[orientation];

    const page: BlankPageRef = {

      id: createId(),

      kind: 'blank',

      width: preset.width,

      height: preset.height,

      rotation: 0,

      label: orientation === 'landscape' ? 'Paisagem' : 'Retrato',

    };

    const insertAt = currentPage ? currentPageIndex + 1 : pages.length;

    setPages((current) => [

      ...current.slice(0, insertAt),

      page,

      ...current.slice(insertAt),

    ]);

    setCurrentPageIndex(insertAt);

    setSelectedMarkId(null);

  };



  const rotateCurrentPage = () => {

    if (!currentPage) return;

    setPages((current) =>

      current.map((page) => {

        if (page.id !== currentPage.id) return page;

        if (page.kind === 'blank') {

          return {

            ...page,

            width: page.height,

            height: page.width,

            label: page.width > page.height ? 'Retrato' : 'Paisagem',

          };

        }

        return {...page, rotation: ((page.rotation + 90) % 360) as Rotation};

      }),

    );

  };



  const duplicateCurrentPage = () => {

    if (!currentPage) return;

    const newId = createId();

    const clone = {...currentPage, id: newId, label: `${currentPage.label} copia`} as PageRef;

    setPages((current) => [

      ...current.slice(0, currentPageIndex + 1),

      clone,

      ...current.slice(currentPageIndex + 1),

    ]);

    setMarks((current) => [

      ...current,

      ...current

        .filter((mark) => mark.pageId === currentPage.id)

        .map((mark) => cloneMarkForPage(mark, newId)),

    ]);

    setCurrentPageIndex(currentPageIndex + 1);

  };



  const deleteCurrentPage = () => {

    if (!currentPage || pages.length <= 1) return;

    setPages((current) => current.filter((page) => page.id !== currentPage.id));

    setMarks((current) => current.filter((mark) => mark.pageId !== currentPage.id));

    setSelectedMarkId(null);

  };



  const moveCurrentPage = (direction: -1 | 1) => {

    const target = currentPageIndex + direction;

    if (target < 0 || target >= pages.length) return;

    setPages((current) => {

      const next = [...current];

      const [page] = next.splice(currentPageIndex, 1);

      next.splice(target, 0, page);

      return next;

    });

    setCurrentPageIndex(target);

  };



  const exportPdf = async () => {

    if (loading || !sourceBytes || !pdfFile || pages.length === 0) return;

    setLoading(true);

    setErrorMessage('');

    setStatus('Gerando PDF final');

    const exportedSnapshot = JSON.stringify({pages, marks});

    try {

      const sourcePdf = await PDFDocument.load(sourceBytes.slice(0));

      const outputPdf = await PDFDocument.create();

      const fontCache = new Map<string, any>();



      const getFont = async (mark: TextMark) => {

        const fontName = getStandardFontName(mark.fontFamily, mark.bold, mark.italic);

        if (!fontCache.has(fontName)) {

          fontCache.set(fontName, await outputPdf.embedFont(fontName));

        }

        return fontCache.get(fontName);

      };



      for (const pageRef of pages) {

        let page;

        if (pageRef.kind === 'pdf') {

          const [copiedPage] = await outputPdf.copyPages(sourcePdf, [pageRef.sourceIndex]);

          page = copiedPage;

          if (pageRef.rotation) {

            const currentRotation = page.getRotation().angle;

            page.setRotation(degrees((currentRotation + pageRef.rotation) % 360));

          }

          outputPdf.addPage(page);

        } else {

          page = outputPdf.addPage([pageRef.width, pageRef.height]);

        }



        const currentMarks = marks.filter((mark) => mark.pageId === pageRef.id);

        for (const mark of currentMarks) {

          if (mark.type === 'text') {

            const font = await getFont(mark);

            if (mark.redactOriginal) {

              page.drawRectangle({

                x: mark.x - 1,

                y: mark.y - mark.height * 0.24,

                width: mark.width + 2,

                height: mark.height * 1.06,

                color: rgb(1, 1, 1),

              });

            }

            const lines = mark.text.split(/\r?\n/);

            lines.forEach((line, lineIndex) => {

              const y = mark.y - lineIndex * mark.fontSize * 1.18;

              let x = mark.x;

              const textWidth = font.widthOfTextAtSize(line, mark.fontSize);

              if (mark.align === 'center') x += Math.max(0, (mark.width - textWidth) / 2);

              if (mark.align === 'right') x += Math.max(0, mark.width - textWidth);

              page.drawText(line, {

                x,

                y,

                size: mark.fontSize,

                font,

                color: hexToRgb(mark.color),

                maxWidth: mark.width,

                lineHeight: mark.fontSize * 1.18,

              });

            });

          }



          if (mark.type === 'redact') {

            page.drawRectangle({

              x: mark.x,

              y: mark.y,

              width: mark.width,

              height: mark.height,

              color: hexToRgb(mark.fill),

            });

          }



          if (mark.type === 'highlight') {

            page.drawRectangle({

              x: mark.x,

              y: mark.y,

              width: mark.width,

              height: mark.height,

              color: hexToRgb(mark.color),

              opacity: mark.opacity,

            });

          }



          if (mark.type === 'shape') {

            if (mark.shape === 'rectangle') {

              page.drawRectangle({

                x: mark.x,

                y: mark.y,

                width: mark.width,

                height: mark.height,

                borderColor: hexToRgb(mark.stroke),

                borderWidth: mark.thickness,

                opacity: mark.opacity,

              });

            }

            if (mark.shape === 'ellipse') {

              page.drawEllipse({

                x: mark.x + mark.width / 2,

                y: mark.y + mark.height / 2,

                xScale: mark.width / 2,

                yScale: mark.height / 2,

                borderColor: hexToRgb(mark.stroke),

                borderWidth: mark.thickness,

                opacity: mark.opacity,

              });

            }

            if (mark.shape === 'line' || mark.shape === 'arrow') {

              page.drawLine({

                start: {x: mark.x, y: mark.y},

                end: {x: mark.x + mark.width, y: mark.y + mark.height},

                thickness: mark.thickness,

                color: hexToRgb(mark.stroke),

                opacity: mark.opacity,

              });

              if (mark.shape === 'arrow') {

                const end = {x: mark.x + mark.width, y: mark.y + mark.height};

                const angle = Math.atan2(mark.height, mark.width);

                const size = Math.max(8, mark.thickness * 4);

                const left = {

                  x: end.x - size * Math.cos(angle - Math.PI / 6),

                  y: end.y - size * Math.sin(angle - Math.PI / 6),

                };

                const right = {

                  x: end.x - size * Math.cos(angle + Math.PI / 6),

                  y: end.y - size * Math.sin(angle + Math.PI / 6),

                };

                page.drawLine({

                  start: end,

                  end: left,

                  thickness: mark.thickness,

                  color: hexToRgb(mark.stroke),

                  opacity: mark.opacity,

                });

                page.drawLine({

                  start: end,

                  end: right,

                  thickness: mark.thickness,

                  color: hexToRgb(mark.stroke),

                  opacity: mark.opacity,

                });

              }

            }

          }



          if (mark.type === 'ink' || mark.type === 'signature') {

            for (let index = 1; index < mark.points.length; index += 1) {

              page.drawLine({

                start: mark.points[index - 1],

                end: mark.points[index],

                thickness: mark.thickness,

                color: hexToRgb(mark.color),

                opacity: mark.opacity,

              });

            }

          }



          if (mark.type === 'image') {

            const imageBytes = await fetch(mark.dataUrl).then((response) =>

              response.arrayBuffer(),

            );

            const embedded =

              mark.mime === 'image/png'

                ? await outputPdf.embedPng(imageBytes)

                : await outputPdf.embedJpg(imageBytes);

            page.drawImage(embedded, {

              x: mark.x,

              y: mark.y,

              width: mark.width,

              height: mark.height,

              opacity: mark.opacity,

            } as any);

          }



          if (mark.type === 'link') {

            const annotation = outputPdf.context.obj({

              Type: PDFName.of('Annot'),

              Subtype: PDFName.of('Link'),

              Rect: [mark.x, mark.y, mark.x + mark.width, mark.y + mark.height],

              Border: [0, 0, 0],

              A: {

                Type: PDFName.of('Action'),

                S: PDFName.of('URI'),

                URI: PDFString.of(mark.url),

              },

            });

            page.node.addAnnot(outputPdf.context.register(annotation));

          }

        }

      }



      const pdfBytes = await outputPdf.save();

      const blob = new Blob([pdfBytes], {type: 'application/pdf'});

      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');

      const name = pdfFile.name.replace(/\.pdf$/i, '');

      link.href = url;

      link.download = `${name}-G4-DOCS-EDITADO.pdf`;

      link.click();

      window.setTimeout(() => URL.revokeObjectURL(url), 30000);

      markSaved(exportedSnapshot);

      setStatus('PDF exportado');

    } catch (error) {

      console.error(error);

      setStatus('Falha ao exportar');

      setErrorMessage('Não foi possível exportar. Suas alterações foram preservadas. Verifique caracteres não suportados na edição de texto e tente novamente.');

    } finally {

      setLoading(false);

    }

  };



  const clearDocument = () => {

    setPdfFile(null);

    setSourceBytes(null);

    void pdfDoc?.destroy();

    setPdfDoc(null);

    resetDocument();

    setSelectedMarkId(null);

    setCurrentPageIndex(0);

    setPageData(null);

    setTool('select');

    setStatus('Pronto');

  };



  const renderDraft = () => {

    if (!draft || !pageData) return null;

    if (draft.kind === 'rect') {

      const rect = rectToViewport(normalizeRect(draft.start, draft.end));

      return (

        <div

          className="absolute z-30 border-2 border-dashed border-blue-600 bg-blue-500/10 pointer-events-none"

          style={rect}

        />

      );

    }



    const path = draft.points.map(pointToViewport);

    const points = path.map((point) => `${point.x},${point.y}`).join(' ');

    return (

      <svg className="absolute inset-0 z-30 pointer-events-none overflow-visible">

        <polyline

          points={points}

          fill="none"

          stroke={draft.tool === 'signature' ? '#111827' : strokeColor}

          strokeWidth={thickness}

          strokeLinecap="round"

          strokeLinejoin="round"

        />

      </svg>

    );

  };



  const renderTextHitboxes = () => {

    if (!pageData || tool !== 'editText') return null;

    return pageData.textItems

      .filter((item) => item.str.trim().length > 0)

      .map((item, index) => {

        const metrics = getTextItemMetrics(item);

        const topLeft = pointToViewport({

          x: metrics.x,

          y: metrics.y + metrics.height * 0.75,

        });

        const bottomRight = pointToViewport({

          x: metrics.x + metrics.width,

          y: metrics.y - metrics.height * 0.25,

        });

        const rect = {

          left: Math.min(topLeft.x, bottomRight.x),

          top: Math.min(topLeft.y, bottomRight.y),

          width: Math.abs(bottomRight.x - topLeft.x),

          height: Math.abs(bottomRight.y - topLeft.y),

        };

        return (

          <div

            key={`${item.str}-${index}-${metrics.x}-${metrics.y}`}

            onPointerDown={(event) => createExistingTextEdit(event, item)}

            className="absolute z-20 cursor-text border border-blue-500/0 bg-blue-500/0 transition hover:border-blue-500 hover:bg-blue-500/15"

            style={rect}

            title={item.str}

          />

        );

      });

  };



  const renderMark = (mark: Mark) => {

    const selected = selectedMarkId === mark.id;

    if (mark.type === 'text') {

      const rect = textToViewport(mark);

      return (

        <div

          key={mark.id}

          onPointerDown={(event) => startDraggingMark(event, mark)}

          className={`absolute z-20 cursor-move whitespace-pre px-0.5 ${

            selected ? 'ring-2 ring-blue-600 ring-offset-1' : ''

          }`}

          style={{

            left: rect.left,

            top: rect.top,

            width: Math.max(6, rect.width),

            minHeight: Math.max(8, rect.height),

            background: mark.redactOriginal ? '#ffffff' : 'transparent',

            color: mark.color,

            fontFamily: getDisplayFont(mark.fontFamily),

            fontWeight: mark.bold ? 700 : 400,

            fontStyle: mark.italic ? 'italic' : 'normal',

            fontSize: `${Math.max(5, mark.fontSize * (pageData?.scale ?? 1))}px`,

            lineHeight: 1.18,

            textAlign: mark.align,

            overflow: 'visible',

          }}

        >

          {mark.text}

        </div>

      );

    }



    if (mark.type === 'ink' || mark.type === 'signature') {

      const points = mark.points.map(pointToViewport);

      const polyline = points.map((point) => `${point.x},${point.y}`).join(' ');

      const bounds = rectToViewport(getMarkBounds(mark));

      return (

        <svg

          key={mark.id}

          onPointerDown={(event) => startDraggingMark(event, mark)}

          className={`absolute inset-0 z-20 cursor-move overflow-visible ${

            selected ? 'drop-shadow-[0_0_3px_#2563eb]' : ''

          }`}

        >

          <polyline

            points={polyline}

            fill="none"

            stroke={mark.color}

            strokeOpacity={mark.opacity}

            strokeWidth={mark.thickness}

            strokeLinecap="round"

            strokeLinejoin="round"

          />

          {selected && (

            <rect

              x={bounds.left}

              y={bounds.top}

              width={bounds.width}

              height={bounds.height}

              fill="none"

              stroke="#2563eb"

              strokeDasharray="4 3"

            />

          )}

        </svg>

      );

    }



    const rect = rectToViewport(getMarkBounds(mark));

    if (mark.type === 'redact') {

      return (

        <div

          key={mark.id}

          onPointerDown={(event) => startDraggingMark(event, mark)}

          className={`absolute z-20 cursor-move ${selected ? 'ring-2 ring-blue-600' : ''}`}

          style={{...rect, background: mark.fill}}

        />

      );

    }



    if (mark.type === 'highlight') {

      return (

        <div

          key={mark.id}

          onPointerDown={(event) => startDraggingMark(event, mark)}

          className={`absolute z-20 cursor-move mix-blend-multiply ${

            selected ? 'ring-2 ring-blue-600' : ''

          }`}

          style={{...rect, background: mark.color, opacity: mark.opacity}}

        />

      );

    }



    if (mark.type === 'image') {

      return (

        <img

          key={mark.id}

          src={mark.dataUrl}

          alt={mark.name}

          onPointerDown={(event) => startDraggingMark(event, mark)}

          className={`absolute z-20 cursor-move object-fill ${

            selected ? 'ring-2 ring-blue-600 ring-offset-1' : ''

          }`}

          style={{...rect, opacity: mark.opacity}}

        />

      );

    }



    if (mark.type === 'link') {

      return (

        <div

          key={mark.id}

          onPointerDown={(event) => startDraggingMark(event, mark)}

          className={`absolute z-20 cursor-move border-2 border-blue-500/70 bg-blue-500/10 ${

            selected ? 'ring-2 ring-blue-700 ring-offset-1' : ''

          }`}

          style={rect}

        />

      );

    }



    if (mark.type === 'shape') {

      if (mark.shape === 'line' || mark.shape === 'arrow') {

        const start = pointToViewport({x: mark.x, y: mark.y});

        const end = pointToViewport({x: mark.x + mark.width, y: mark.y + mark.height});

        const arrowId = `arrow-${mark.id}`;

        return (

          <svg

            key={mark.id}

            onPointerDown={(event) => startDraggingMark(event, mark)}

            className="absolute inset-0 z-20 cursor-move overflow-visible"

          >

            <defs>

              <marker

                id={arrowId}

                markerWidth="10"

                markerHeight="10"

                refX="9"

                refY="3"

                orient="auto"

                markerUnits="strokeWidth"

              >

                <path d="M0,0 L0,6 L9,3 z" fill={mark.stroke} />

              </marker>

            </defs>

            <line

              x1={start.x}

              y1={start.y}

              x2={end.x}

              y2={end.y}

              stroke={mark.stroke}

              strokeOpacity={mark.opacity}

              strokeWidth={mark.thickness}

              strokeLinecap="round"

              markerEnd={mark.shape === 'arrow' ? `url(#${arrowId})` : undefined}

            />

            {selected && (

              <line

                x1={start.x}

                y1={start.y}

                x2={end.x}

                y2={end.y}

                stroke="#2563eb"

                strokeDasharray="4 3"

              />

            )}

          </svg>

        );

      }

      return (

        <div

          key={mark.id}

          onPointerDown={(event) => startDraggingMark(event, mark)}

          className={`absolute z-20 cursor-move ${

            mark.shape === 'ellipse' ? 'rounded-full' : ''

          } ${selected ? 'ring-2 ring-blue-600 ring-offset-1' : ''}`}

          style={{

            ...rect,

            border: `${mark.thickness}px solid ${mark.stroke}`,

            opacity: mark.opacity,

          }}

        />

      );

    }



    return null;

  };



  const renderInspector = () => {

    if (!selectedMark) {

      return (

        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-xs font-medium text-slate-500">

          Nenhum objeto selecionado

        </div>

      );

    }



    const bounds = getMarkBounds(selectedMark);

    return (

      <div className="space-y-4">

        <div className="flex items-center justify-between">

          <div>

            <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">

              Selecionado

            </div>

            <div className="text-sm font-bold text-slate-800">{selectedMark.type}</div>

          </div>

          <button

            onClick={deleteSelectedMark}

            className="grid h-9 w-9 place-items-center rounded-md border border-red-200 text-red-600 hover:bg-red-50"

            title="Excluir"

          >

            <Trash2 className="h-4 w-4" />

          </button>

        </div>



        {'x' in selectedMark && (

          <div className="grid grid-cols-2 gap-2">

            {(['x', 'y', 'width', 'height'] as const).map((field) => (

              <label key={field} className="space-y-1 text-[11px] font-bold text-slate-500">

                {field.toUpperCase()}

                <input

                  type="number"

                  value={Math.round((selectedMark as MarkBase)[field])}

                  onChange={(event) =>

                    updateMark(selectedMark.id, {

                      [field]: Number(event.target.value),

                    } as Partial<Mark>)

                  }

                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"

                />

              </label>

            ))}

          </div>

        )}



        {(selectedMark.type === 'ink' || selectedMark.type === 'signature') && (

          <div className="grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-500">

            <div className="rounded-md bg-slate-50 px-3 py-2">X {Math.round(bounds.x)}</div>

            <div className="rounded-md bg-slate-50 px-3 py-2">Y {Math.round(bounds.y)}</div>

            <div className="rounded-md bg-slate-50 px-3 py-2">W {Math.round(bounds.width)}</div>

            <div className="rounded-md bg-slate-50 px-3 py-2">H {Math.round(bounds.height)}</div>

          </div>

        )}



        {selectedMark.type === 'text' && (

          <div className="space-y-3">

            <textarea
            data-ui-owner="pdf-text"
            style={{resize: 'none'}}

              value={selectedMark.text}

              onChange={(event) => {

                const nextText = event.target.value;

                const estimated = estimateTextBox(nextText, selectedMark.fontSize);

                updateMark(selectedMark.id, {

                  text: nextText,

                  width: Math.max(selectedMark.width, estimated.width),

                  height: Math.max(selectedMark.height, estimated.height),

                });

              }}

              className="min-h-28 w-full resize-none rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium outline-none focus:border-blue-500"

            />

            <div className="grid grid-cols-[1fr_72px] gap-2">

              <select

                value={selectedMark.fontFamily}

                onChange={(event) =>

                  updateMark(selectedMark.id, {fontFamily: event.target.value as FontKey})

                }

                className="rounded-md border border-slate-200 bg-white px-2 py-2 text-xs font-semibold outline-none focus:border-blue-500"

              >

                {FONT_OPTIONS.map((font) => (

                  <option key={font.id} value={font.id}>

                    {font.label}

                  </option>

                ))}

              </select>

              <input

                type="number"

                value={Math.round(selectedMark.fontSize)}

                onChange={(event) =>

                  updateMark(selectedMark.id, {fontSize: Number(event.target.value)})

                }

                className="rounded-md border border-slate-200 bg-white px-2 py-2 text-xs font-semibold outline-none focus:border-blue-500"

              />

            </div>

            <div className="flex items-center gap-2">

              <button

                onClick={() => updateMark(selectedMark.id, {bold: !selectedMark.bold})}

                className={`grid h-9 w-9 place-items-center rounded-md border ${

                  selectedMark.bold

                    ? 'border-blue-500 bg-blue-50 text-blue-700'

                    : 'border-slate-200 text-slate-600'

                }`}

                title="Negrito"

              >

                <Bold className="h-4 w-4" />

              </button>

              <button

                onClick={() => updateMark(selectedMark.id, {italic: !selectedMark.italic})}

                className={`grid h-9 w-9 place-items-center rounded-md border ${

                  selectedMark.italic

                    ? 'border-blue-500 bg-blue-50 text-blue-700'

                    : 'border-slate-200 text-slate-600'

                }`}

                title="Italico"

              >

                <Italic className="h-4 w-4" />

              </button>

              {[

                ['left', AlignLeft],

                ['center', AlignCenter],

                ['right', AlignRight],

              ].map(([align, Icon]) => (

                <button

                  key={align as string}

                  onClick={() =>

                    updateMark(selectedMark.id, {align: align as TextAlign})

                  }

                  className={`grid h-9 w-9 place-items-center rounded-md border ${

                    selectedMark.align === align

                      ? 'border-blue-500 bg-blue-50 text-blue-700'

                      : 'border-slate-200 text-slate-600'

                  }`}

                  title={`Alinhar ${align}`}

                >

                  {React.createElement(Icon as typeof AlignLeft, {className: 'h-4 w-4'})}

                </button>

              ))}

              <input

                type="color"

                value={selectedMark.color}

                onChange={(event) => updateMark(selectedMark.id, {color: event.target.value})}

                className="h-9 w-11 rounded-md border border-slate-200 bg-white p-1"

                title="Cor"

              />

            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">

              <input

                type="checkbox"

                checked={selectedMark.redactOriginal}

                onChange={(event) =>

                  updateMark(selectedMark.id, {redactOriginal: event.target.checked})

                }

              />

              Cobrir texto original

            </label>

          </div>

        )}



        {selectedMark.type === 'redact' && (

          <label className="flex items-center justify-between text-xs font-bold text-slate-600">

            Cor da cobertura

            <input

              type="color"

              value={selectedMark.fill}

              onChange={(event) => updateMark(selectedMark.id, {fill: event.target.value})}

              className="h-9 w-12 rounded-md border border-slate-200 bg-white p-1"

            />

          </label>

        )}



        {selectedMark.type === 'highlight' && (

          <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-600">

            <label>

              Cor

              <input

                type="color"

                value={selectedMark.color}

                onChange={(event) => updateMark(selectedMark.id, {color: event.target.value})}

                className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white p-1"

              />

            </label>

            <label>

              Opacidade

              <input

                type="number"

                min="0.1"

                max="1"

                step="0.05"

                value={selectedMark.opacity}

                onChange={(event) =>

                  updateMark(selectedMark.id, {opacity: Number(event.target.value)})

                }

                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2"

              />

            </label>

          </div>

        )}



        {selectedMark.type === 'shape' && (

          <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-600">

            <label>

              Linha

              <input

                type="color"

                value={selectedMark.stroke}

                onChange={(event) => updateMark(selectedMark.id, {stroke: event.target.value})}

                className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white p-1"

              />

            </label>

            <label>

              Espessura

              <input

                type="number"

                min="1"

                max="24"

                value={selectedMark.thickness}

                onChange={(event) =>

                  updateMark(selectedMark.id, {thickness: Number(event.target.value)})

                }

                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2"

              />

            </label>

          </div>

        )}



        {(selectedMark.type === 'ink' || selectedMark.type === 'signature') && (

          <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-600">

            <label>

              Cor

              <input

                type="color"

                value={selectedMark.color}

                onChange={(event) => updateMark(selectedMark.id, {color: event.target.value})}

                className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white p-1"

              />

            </label>

            <label>

              Espessura

              <input

                type="number"

                min="1"

                max="24"

                value={selectedMark.thickness}

                onChange={(event) =>

                  updateMark(selectedMark.id, {thickness: Number(event.target.value)})

                }

                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2"

              />

            </label>

          </div>

        )}



        {selectedMark.type === 'image' && (

          <label className="text-xs font-bold text-slate-600">

            Opacidade

            <input

              type="number"

              min="0.1"

              max="1"

              step="0.05"

              value={selectedMark.opacity}

              onChange={(event) =>

                updateMark(selectedMark.id, {opacity: Number(event.target.value)})

              }

              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2"

            />

          </label>

        )}



        {selectedMark.type === 'link' && (

          <label className="text-xs font-bold text-slate-600">

            URL

            <input

              type="url"

              value={selectedMark.url}

              onChange={(event) => updateMark(selectedMark.id, {url: event.target.value})}

              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2 outline-none focus:border-blue-500"

            />

          </label>

        )}

      </div>

    );

  };



  const toolbar = [

    {id: 'select', label: 'Selecionar', icon: MousePointer2},

    {id: 'editText', label: 'Editar texto', icon: Type},

    {id: 'addText', label: 'Texto novo', icon: Plus},

    {id: 'redact', label: 'Cobrir', icon: Eraser},

    {id: 'highlight', label: 'Marca-texto', icon: Highlighter},

    {id: 'draw', label: 'Caneta', icon: PenLine},

    {id: 'signature', label: 'Assinar', icon: Stamp},

    {id: 'image', label: 'Imagem', icon: ImageIcon},

    {id: 'link', label: 'Link', icon: LinkIcon},

    {id: 'shape', label: 'Forma', icon: Square},

  ] as const;



  return (

    <div className="editor-shell flex h-dvh flex-col overflow-hidden bg-slate-100 text-slate-900">

      <input

        ref={fileInputRef}

        type="file"

        accept="application/pdf,.pdf"

        className="hidden"

        onChange={onFileChange}

      />

      <input

        ref={imageInputRef}

        type="file"

        accept="image/png,image/jpeg"

        className="hidden"

        onChange={pickImageAsset}

      />



      <dialog ref={confirmRef} aria-labelledby="confirm-title" onCancel={() => setPendingAction(null)} onClose={() => setPendingAction(null)} className="confirm-dialog">

        <h2 id="confirm-title">{pendingAction?.title}</h2>

        <div className="dialog-actions"><button autoFocus onClick={() => { confirmRef.current?.close(); setPendingAction(null); }}>Cancelar</button><button onClick={() => { const action = pendingAction?.run; confirmRef.current?.close(); setPendingAction(null); action?.(); }}>Confirmar</button></div>

      </dialog>

      {errorMessage && <div className="error-banner" role="alert">{errorMessage}<button aria-label="Fechar aviso" onClick={() => setErrorMessage('')}>×</button></div>}

      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">

        <div className="flex min-w-0 items-center gap-3">

          <img src={appIcon} alt="G4 DOCS" className="h-10 w-10 rounded-lg object-cover" />

          <div className="min-w-0">

            <div className="text-sm font-black tracking-wide">G4 DOCS EDITOR</div>

            <div className="truncate text-[11px] font-semibold text-slate-500">

              {pdfFile ? pdfFile.name : 'Editor PDF local'}

            </div>

          </div>

        </div>



        <div className="flex items-center gap-2">

          {pdfFile && (

            <>

              <button

                disabled={loading}

                onClick={() => dirty ? setPendingAction({title: 'Fechar sem salvar? As alterações serão descartadas.', run: clearDocument}) : clearDocument()}

                className="rounded-md px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"

              >

                Fechar

              </button>

              <button

                onClick={exportPdf}

                disabled={loading}

                className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"

              >

                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}

                Salvar PDF

              </button>

            </>

          )}

        </div>

      </header>



      {pdfFile && (

        <div className="flex h-16 shrink-0 items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3">

          <button type="button" onClick={undo} disabled={!canUndo || loading} className="history-button">Desfazer</button>

          <button type="button" onClick={redo} disabled={!canRedo || loading} className="history-button">Refazer</button>

          {toolbar.map(({id, label, icon: Icon}) => (

            <button

              key={id}

              onClick={() => {

                setTool(id);

                if (id === 'image' && !imageAsset) imageInputRef.current?.click();

              }}

              className={`flex h-11 min-w-20 flex-col items-center justify-center rounded-md px-2 text-[10px] font-black transition ${

                tool === id

                  ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'

                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'

              }`}

              title={label}

            >

              <Icon className="mb-0.5 h-4 w-4" />

              {label}

            </button>

          ))}



          <div className="mx-2 h-8 w-px bg-slate-200" />



          <button

            onClick={() => addBlankPage('portrait')}

            className="grid h-10 w-10 place-items-center rounded-md text-slate-600 hover:bg-slate-100"

            title="Adicionar retrato"

          >

            <FilePlus2 className="h-4 w-4" />

          </button>

          <button

            onClick={() => addBlankPage('landscape')}

            className="grid h-10 w-10 place-items-center rounded-md text-slate-600 hover:bg-slate-100"

            title="Adicionar paisagem"

          >

            <Scissors className="h-4 w-4 rotate-90" />

          </button>

          <button

            onClick={rotateCurrentPage}

            className="grid h-10 w-10 place-items-center rounded-md text-slate-600 hover:bg-slate-100"

            title="Girar pagina"

          >

            <RotateCw className="h-4 w-4" />

          </button>

          <button

            onClick={duplicateCurrentPage}

            className="grid h-10 w-10 place-items-center rounded-md text-slate-600 hover:bg-slate-100"

            title="Duplicar pagina"

          >

            <Copy className="h-4 w-4" />

          </button>

          <button

            onClick={() => setPendingAction({title: `Excluir a página ${currentPageIndex + 1}? Você pode desfazer esta ação.`, run: deleteCurrentPage})}

            disabled={pages.length <= 1}

            className="grid h-10 w-10 place-items-center rounded-md text-red-600 hover:bg-red-50 disabled:opacity-30"

            title="Excluir pagina"

          >

            <Trash2 className="h-4 w-4" />

          </button>

        </div>

      )}



      <main className="flex min-h-0 flex-1">

        {pdfFile && (

          <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white">

            <div className="border-b border-slate-200 p-4">

              <div className="mb-3 flex items-center justify-between">

                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">

                  Paginas

                </div>

                <div className="text-xs font-black text-slate-700">

                  {currentPageIndex + 1}/{pages.length}

                </div>

              </div>

              <div className="flex items-center gap-2">

                <button

                  onClick={() => moveCurrentPage(-1)}

                  disabled={currentPageIndex === 0}

                  className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 text-slate-600 disabled:opacity-30"

                  title="Mover para esquerda"

                >

                  <MoveLeft className="h-4 w-4" />

                </button>

                <button

                  onClick={() => setCurrentPageIndex(Math.max(0, currentPageIndex - 1))}

                  disabled={currentPageIndex === 0}

                  className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 text-slate-600 disabled:opacity-30"

                  title="Pagina anterior"

                >

                  <ChevronLeft className="h-4 w-4" />

                </button>

                <button

                  onClick={() =>

                    setCurrentPageIndex(Math.min(pages.length - 1, currentPageIndex + 1))

                  }

                  disabled={currentPageIndex === pages.length - 1}

                  className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 text-slate-600 disabled:opacity-30"

                  title="Proxima pagina"

                >

                  <ChevronRight className="h-4 w-4" />

                </button>

                <button

                  onClick={() => moveCurrentPage(1)}

                  disabled={currentPageIndex === pages.length - 1}

                  className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 text-slate-600 disabled:opacity-30"

                  title="Mover para direita"

                >

                  <MoveRight className="h-4 w-4" />

                </button>

              </div>

            </div>



            <div className="space-y-4 border-b border-slate-200 p-4">

              <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">

                Configuracao

              </div>

              {tool === 'shape' && (

                <div className="grid grid-cols-4 gap-2">

                  {[

                    ['rectangle', Square],

                    ['ellipse', Circle],

                    ['line', Minus],

                    ['arrow', MoveRight],

                  ].map(([id, Icon]) => (

                    <button

                      key={id as string}

                      onClick={() => setShapeKind(id as ShapeKind)}

                      className={`grid h-9 place-items-center rounded-md border ${

                        shapeKind === id

                          ? 'border-blue-500 bg-blue-50 text-blue-700'

                          : 'border-slate-200 text-slate-600'

                      }`}

                    >

                      {React.createElement(Icon as typeof Square, {className: 'h-4 w-4'})}

                    </button>

                  ))}

                </div>

              )}

              {(tool === 'draw' || tool === 'signature' || tool === 'shape') && (

                <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-600">

                  <label>

                    Cor

                    <input

                      type="color"

                      value={strokeColor}

                      onChange={(event) => setStrokeColor(event.target.value)}

                      className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white p-1"

                    />

                  </label>

                  <label>

                    Linha

                    <input

                      type="number"

                      min="1"

                      max="24"

                      value={thickness}

                      onChange={(event) => setThickness(Number(event.target.value))}

                      className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2"

                    />

                  </label>

                </div>

              )}

              {tool === 'redact' && <p className="text-xs text-slate-600">Cobertura visual: o conteúdo original continua no PDF. Não use para ocultar dados sigilosos.</p>}

              {tool === 'redact' && (

                <label className="flex items-center justify-between text-xs font-bold text-slate-600">

                  Cobertura

                  <input

                    type="color"

                    value={fillColor}

                    onChange={(event) => setFillColor(event.target.value)}

                    className="h-9 w-12 rounded-md border border-slate-200 bg-white p-1"

                  />

                </label>

              )}

              {tool === 'highlight' && (

                <label className="flex items-center justify-between text-xs font-bold text-slate-600">

                  Marcador

                  <input

                    type="color"

                    value={highlightColor}

                    onChange={(event) => setHighlightColor(event.target.value)}

                    className="h-9 w-12 rounded-md border border-slate-200 bg-white p-1"

                  />

                </label>

              )}

              {tool === 'link' && (

                <label className="text-xs font-bold text-slate-600">

                  URL

                  <input

                    type="url"

                    value={linkUrl}

                    onChange={(event) => setLinkUrl(event.target.value)}

                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2 outline-none focus:border-blue-500"

                  />

                </label>

              )}

              {tool === 'image' && (

                <button

                  onClick={() => imageInputRef.current?.click()}

                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"

                >

                  {imageAsset ? imageAsset.name : 'Escolher imagem'}

                </button>

              )}

            </div>



            <div className="min-h-0 flex-1 overflow-y-auto p-4">{renderInspector()}</div>

          </aside>

        )}



        <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[#4b5563]">

          {!pdfFile ? (

            <div className="flex flex-1 items-center justify-center bg-slate-100 p-6">

              <motion.button

                initial={{opacity: 0, y: 12}}

                animate={{opacity: 1, y: 0}}

                onClick={() => fileInputRef.current?.click()}

                className="group flex w-full max-w-xl flex-col items-center rounded-2xl border-2 border-dashed border-slate-300 bg-white p-14 text-center shadow-xl shadow-slate-200/70 transition hover:border-blue-500"

              >

                <img

                  src={appIcon}

                  alt="G4 DOCS"

                  className="mb-7 h-28 w-28 rounded-[28px] object-cover shadow-2xl shadow-slate-300 transition group-hover:scale-105"

                />

                <span className="text-3xl font-black tracking-tight text-slate-900">

                  G4 DOCS EDITOR

                </span>

                <span className="mt-3 max-w-sm text-sm font-semibold leading-6 text-slate-500">

                  PDF local com texto editavel, paginas, imagens, assinatura, links e exportacao.

                </span>

                <span className="mt-9 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-200">

                  <Upload className="h-4 w-4" />

                  Abrir PDF

                </span>

              </motion.button>

            </div>

          ) : (

            <>

              <div className="min-h-0 flex-1 overflow-auto p-8">

                <div

                  ref={stageRef}

                  onPointerDown={startStageAction}

                  onPointerMove={continueStageAction}

                  onPointerUp={finishStageAction}

                  onPointerLeave={finishStageAction}

                  className="relative mx-auto bg-white shadow-2xl"

                  style={{

                    width: pageData?.canvasWidth ?? 1,

                    height: pageData?.canvasHeight ?? 1,

                    cursor:

                      tool === 'select'

                        ? 'default'

                        : tool === 'editText'

                          ? 'text'

                          : 'crosshair',

                  }}

                >

                  {loading && (

                    <div className="absolute inset-0 z-50 grid place-items-center bg-white/60 backdrop-blur-sm">

                      <Loader2 className="h-11 w-11 animate-spin text-blue-600" />

                    </div>

                  )}

                  <canvas ref={canvasRef} />

                  <div className="absolute inset-0">

                    {pageMarks.map(renderMark)}

                    {renderTextHitboxes()}

                    {renderDraft()}

                  </div>

                </div>

              </div>



              <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-white/15 bg-slate-950/80 px-4 py-2 text-white shadow-2xl backdrop-blur">

                <button

                  onClick={() => setZoom((value) => Math.max(0.35, value - 0.1))}

                  className="grid h-8 w-8 place-items-center rounded-md hover:bg-white/10"

                  title="Menos zoom"

                >

                  <ZoomOut className="h-4 w-4" />

                </button>

                <div className="w-14 text-center text-xs font-black">{Math.round(zoom * 100)}%</div>

                <button

                  onClick={() => setZoom((value) => Math.min(2.5, value + 0.1))}

                  className="grid h-8 w-8 place-items-center rounded-md hover:bg-white/10"

                  title="Mais zoom"

                >

                  <ZoomIn className="h-4 w-4" />

                </button>

              </div>

            </>

          )}

        </section>

      </main>



      {pdfFile && (

        <footer className="flex h-9 shrink-0 items-center justify-between border-t border-slate-200 bg-white px-4 text-[11px] font-bold text-slate-500">

          <span role="status" aria-live="polite">{status}{dirty ? " · Alterações não salvas" : ""}</span>

          <span>

            {marks.length} objeto(s) · Processamento neste computador

          </span>

        </footer>

      )}

    </div>

  );

}
