"""Production PDF workflow; generated files and screenshots remain in reports/."""
import argparse
import os
import functools
import http.server
import json
import threading
from pathlib import Path
from pypdf import PdfWriter, PdfReader
from pypdf.generic import NameObject, DictionaryObject, DecodedStreamObject
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
REPORTS=ROOT/'reports';REPORTS.mkdir(exist_ok=True)
writer=PdfWriter()
for i in range(2):
    page=writer.add_blank_page(width=595,height=842)
    font=DictionaryObject({NameObject('/Type'):NameObject('/Font'),NameObject('/Subtype'):NameObject('/Type1'),NameObject('/BaseFont'):NameObject('/Helvetica')})
    page[NameObject('/Resources')]=DictionaryObject({NameObject('/Font'):DictionaryObject({NameObject('/F1'):font})})
    stream=DecodedStreamObject();stream.set_data(f'BT /F1 20 Tf 70 740 Td (Original G4T0XX - page {i+1}) Tj ET'.encode())
    page[NameObject('/Contents')]=writer._add_object(stream)
fixture=REPORTS/'source.pdf'
with fixture.open('wb') as handle:writer.write(handle)
invalid=REPORTS/'invalid.pdf';invalid.write_bytes(b'not a pdf')
class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.mjs': 'text/javascript'}
    def log_message(self,*_):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/os.environ.get('G4_DOCS_BUILD_DIR','dist'))))
threading.Thread(target=server.serve_forever,daemon=True).start()
results={}
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={'width':1440,'height':1000},accept_downloads=True)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(f'http://127.0.0.1:{server.server_port}',wait_until='networkidle')
        page.locator('input[accept="application/pdf,.pdf"]').set_input_files(fixture)
        page.wait_for_function("document.querySelector('canvas')?.width > 100")
        expect(page.get_by_text('1/2',exact=True)).to_be_visible()
        page.get_by_title('Duplicar pagina').click()
        expect(page.get_by_text('2/3',exact=True)).to_be_visible()
        page.get_by_role('button',name='Desfazer',exact=True).click()
        expect(page.get_by_text('2/2',exact=True)).to_be_visible()
        page.get_by_role('button',name='Refazer',exact=True).click()
        expect(page.get_by_text('2/3',exact=True)).to_be_visible()
        page.get_by_title('Excluir pagina').click()
        expect(page.get_by_role('dialog')).to_be_visible()
        page.get_by_role('button',name='Cancelar',exact=True).click()
        expect(page.get_by_text('2/3',exact=True)).to_be_visible()
        page.get_by_title('Excluir pagina').click()
        page.get_by_role('button',name='Confirmar',exact=True).click()
        expect(page.get_by_text('2/2',exact=True)).to_be_visible()
        page.get_by_title('Adicionar retrato').click()
        expect(page.get_by_text('3/3',exact=True)).to_be_visible()
        for _ in range(5):page.get_by_title('Mais zoom').click()
        page.wait_for_timeout(500)
        page.screenshot(path=str(REPORTS/'desktop.png'))
        with page.expect_download() as saved:page.get_by_role('button',name='Salvar PDF',exact=True).click()
        output=REPORTS/'exported.pdf';saved.value.save_as(output)
        exported=PdfReader(output)
        assert len(exported.pages)==3
        assert 'Original G4T0XX' in exported.pages[0].extract_text()
        results['export_pages']=len(exported.pages)
        page.locator('input[accept="application/pdf,.pdf"]').set_input_files(invalid)
        expect(page.get_by_role('alert')).to_contain_text('Não foi possível abrir')
        expect(page.get_by_text('3/3',exact=True)).to_be_visible()
        page.get_by_role('button',name='Fechar aviso').click()
        page.get_by_title('Adicionar retrato').click()
        page.get_by_role('button',name='Fechar',exact=True).click()
        expect(page.get_by_role('dialog')).to_be_visible()
        page.keyboard.press('Escape')
        expect(page.get_by_text('4/4',exact=True)).to_be_visible()
        page.set_viewport_size({'width':390,'height':844})
        page.screenshot(path=str(REPORTS/'mobile.png'))
        results.update(history=True,invalid_preserved=True,unsaved_guard=True,rapid_zoom=True,runtime_errors=errors)
        assert not errors,errors
        page.close(run_before_unload=False)
        browser.close()
finally:server.shutdown();server.server_close()
(REPORTS/'browser.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps(results))
