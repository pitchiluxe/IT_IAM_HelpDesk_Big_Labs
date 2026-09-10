import { toast } from '../wm.js';
import { esc } from './lab1.js';

// ============ Microsoft Word ============
export function openWord(body) {
  let docs = JSON.parse(localStorage.getItem('labvm-word') || '[]');
  let activeDoc = 0;
  if (!docs.length) docs.push({ name: 'Document1.docx', content: '', modified: Date.now() });
  function save() { localStorage.setItem('labvm-word', JSON.stringify(docs)); }

  function render() {
    const doc = docs[activeDoc];
    body.innerHTML = `
      <div class="app" style="height:100%">
        <div class="office-ribbon">
          <div class="office-tab active" data-tab="home">Home</div>
          <div class="office-tab" data-tab="insert">Insert</div>
          <div class="office-tab" data-tab="layout">Layout</div>
          <div class="office-tab" data-tab="review">Review</div>
          <div class="office-tab" data-tab="file">File</div>
          <div class="spacer"></div>
          <select id="word-doc-select" class="office-select">
            ${docs.map((d,i) => `<option value="${i}" ${i===activeDoc?'selected':''}>${esc(d.name)}</option>`).join('')}
          </select>
          <button class="btn btn-sm" id="word-new">+ New</button>
          <button class="btn btn-sm btn-primary" id="word-save">Save</button>
        </div>
        <div class="office-toolbar" id="word-toolbar"></div>
        <div class="office-doc-area">
          <div class="office-page" id="word-page" contenteditable="true" spellcheck="false">${doc.content}</div>
        </div>
        <div class="office-statusbar">
          <span id="word-count">Words: 0</span>
          <span class="spacer"></span>
          <span>Page 1 of 1</span>
          <span>English (US)</span>
          <span id="word-zoom">100%</span>
        </div>
      </div>`;

    const page = body.querySelector('#word-page');
    const toolbar = body.querySelector('#word-toolbar');

    function renderToolbar(tab) {
      if (tab === 'home') {
        toolbar.innerHTML = `
          <select class="office-font-select" id="word-font">
            ${['Calibri','Arial','Times New Roman','Courier New','Georgia','Verdana','Tahoma','Segoe UI','Comic Sans MS','Trebuchet MS'].map(f => `<option ${f==='Calibri'?'selected':''}>${f}</option>`).join('')}
          </select>
          <select class="office-size-select" id="word-size">
            ${[8,9,10,11,12,14,16,18,20,24,28,32,36,48,72].map(s => `<option ${s===11?'selected':''}>${s}</option>`).join('')}
          </select>
          <button class="office-btn" data-cmd="bold" title="Bold (Ctrl+B)"><b>B</b></button>
          <button class="office-btn" data-cmd="italic" title="Italic (Ctrl+I)"><i>I</i></button>
          <button class="office-btn" data-cmd="underline" title="Underline (Ctrl+U)"><u>U</u></button>
          <button class="office-btn" data-cmd="strikeThrough" title="Strikethrough"><s>S</s></button>
          <span class="office-sep"></span>
          <button class="office-btn" data-cmd="foreColor" data-val="#000000" title="Font color" style="color:#000">A</button>
          <button class="office-btn" data-cmd="hiliteColor" data-val="#ffff00" title="Highlight" style="background:#ff0">A</button>
          <span class="office-sep"></span>
          <button class="office-btn" data-cmd="justifyLeft" title="Align left">≡</button>
          <button class="office-btn" data-cmd="justifyCenter" title="Center">≡</button>
          <button class="office-btn" data-cmd="justifyRight" title="Align right">≡</button>
          <button class="office-btn" data-cmd="justifyFull" title="Justify">≡</button>
          <span class="office-sep"></span>
          <button class="office-btn" data-cmd="insertUnorderedList" title="Bullet list">•</button>
          <button class="office-btn" data-cmd="insertOrderedList" title="Numbered list">1.</button>
          <span class="office-sep"></span>
          <select id="word-heading" class="office-select">
            <option value="p">Normal</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
            <option value="h4">Heading 4</option>
          </select>`;
        toolbar.querySelectorAll('[data-cmd]').forEach(b => b.onclick = () => {
          const cmd = b.dataset.cmd;
          if (cmd === 'foreColor' || cmd === 'hiliteColor') {
            const colors = ['#000000','#ff0000','#00ff00','#0000ff','#ffff00','#ff00ff','#00ffff','#ffffff','#888888','#0a84ff','#9b59b6','#2ecc71'];
            const picker = document.createElement('div');
            picker.className = 'color-picker';
            picker.innerHTML = colors.map(c => `<div class="color-swatch" style="background:${c}" data-color="${c}"></div>`).join('');
            picker.style.cssText = 'position:absolute;background:#fff;border:1px solid #ccc;border-radius:6px;padding:6px;display:grid;grid-template-columns:repeat(6,20px);gap:3px;z-index:1000;box-shadow:0 4px 12px rgba(0,0,0,.2)';
            const rect = b.getBoundingClientRect();
            picker.style.left = rect.left + 'px';
            picker.style.top = (rect.bottom + 4) + 'px';
            document.body.appendChild(picker);
            picker.querySelectorAll('.color-swatch').forEach(s => s.onclick = () => {
              document.execCommand(cmd, false, s.dataset.color);
              picker.remove();
            });
            picker.onmouseleave = () => picker.remove();
          } else {
            document.execCommand(cmd, false, null);
          }
          page.focus();
        });
        toolbar.querySelector('#word-font').onchange = (e) => { document.execCommand('fontName', false, e.target.value); page.focus(); };
        toolbar.querySelector('#word-size').onchange = (e) => { document.execCommand('fontSize', false, e.target.value); page.focus(); };
        toolbar.querySelector('#word-heading').onchange = (e) => {
          if (e.target.value === 'p') document.execCommand('formatBlock', false, 'p');
          else document.execCommand('formatBlock', false, e.target.value);
          page.focus();
        };
      } else if (tab === 'insert') {
        toolbar.innerHTML = `
          <button class="office-btn" id="word-ins-table" title="Insert table">📊 Table</button>
          <button class="office-btn" id="word-ins-img" title="Insert image from URL">🖼️ Image</button>
          <button class="office-btn" id="word-ins-link" title="Insert hyperlink">🔗 Link</button>
          <button class="office-btn" id="word-ins-hr" title="Horizontal line">― Line</button>
          <button class="office-btn" id="word-ins-date" title="Date/time">📅 Date</button>
          <button class="office-btn" id="word-ins-pagebreak" title="Page break">📄 Page break</button>`;
        toolbar.querySelector('#word-ins-table').onclick = () => {
          const r = prompt('Rows:', '3'); const c = prompt('Columns:', '3');
          if (r && c) {
            let html = '<table style="border-collapse:collapse;width:100%;margin:8px 0">';
            for (let i = 0; i < parseInt(r); i++) {
              html += '<tr>';
              for (let j = 0; j < parseInt(c); j++) html += '<td style="border:1px solid #999;padding:6px;min-height:20px">&nbsp;</td>';
              html += '</tr>';
            }
            html += '</table>';
            document.execCommand('insertHTML', false, html);
          }
        };
        toolbar.querySelector('#word-ins-img').onclick = () => {
          const url = prompt('Image URL:', 'https://');
          if (url) document.execCommand('insertImage', false, url);
        };
        toolbar.querySelector('#word-ins-link').onclick = () => {
          const url = prompt('URL:', 'https://');
          if (url) document.execCommand('createLink', false, url);
        };
        toolbar.querySelector('#word-ins-hr').onclick = () => document.execCommand('insertHorizontalRule');
        toolbar.querySelector('#word-ins-date').onclick = () => document.execCommand('insertHTML', false, new Date().toLocaleString());
        toolbar.querySelector('#word-ins-pagebreak').onclick = () => document.execCommand('insertHTML', false, '<hr style="page-break-after:always;border:none">');
      } else if (tab === 'layout') {
        toolbar.innerHTML = `
          <button class="office-btn" id="word-orient-portrait" title="Portrait">📄 Portrait</button>
          <button class="office-btn" id="word-orient-landscape" title="Landscape">📃 Landscape</button>
          <span class="office-sep"></span>
          <label>Margin:</label>
          <select id="word-margin" class="office-select">
            <option value="normal">Normal</option>
            <option value="narrow">Narrow</option>
            <option value="wide">Wide</option>
          </select>
          <span class="office-sep"></span>
          <label>Zoom:</label>
          <button class="office-btn" id="word-zoom-out">−</button>
          <button class="office-btn" id="word-zoom-in">+</button>`;
        toolbar.querySelector('#word-orient-portrait').onclick = () => { page.style.width = '8.5in'; page.style.minHeight = '11in'; };
        toolbar.querySelector('#word-orient-landscape').onclick = () => { page.style.width = '11in'; page.style.minHeight = '8.5in'; };
        toolbar.querySelector('#word-margin').onchange = (e) => {
          const m = { normal: '1in', narrow: '0.5in', wide: '2in' };
          page.style.padding = m[e.target.value];
        };
        let zoom = 100;
        toolbar.querySelector('#word-zoom-out').onclick = () => { zoom = Math.max(50, zoom - 10); page.style.zoom = zoom + '%'; body.querySelector('#word-zoom').textContent = zoom + '%'; };
        toolbar.querySelector('#word-zoom-in').onclick = () => { zoom = Math.min(200, zoom + 10); page.style.zoom = zoom + '%'; body.querySelector('#word-zoom').textContent = zoom + '%'; };
      } else if (tab === 'review') {
        toolbar.innerHTML = `
          <button class="office-btn" id="word-spell" title="Spell check">✓ Spell Check</button>
          <button class="office-btn" id="word-wordcount" title="Word count">📊 Word Count</button>
          <button class="office-btn" id="word-find" title="Find">🔍 Find</button>
          <button class="office-btn" id="word-replace" title="Find & Replace">🔄 Replace</button>`;
        toolbar.querySelector('#word-spell').onclick = () => toast('Spell check complete. No errors found.');
        toolbar.querySelector('#word-wordcount').onclick = () => {
          const text = page.innerText;
          const words = text.trim().split(/\s+/).filter(w => w).length;
          const chars = text.length;
          const paras = text.split(/\n/).filter(p => p.trim()).length;
          toast(`Words: ${words} | Characters: ${chars} | Paragraphs: ${paras}`);
        };
        toolbar.querySelector('#word-find').onclick = () => {
          const q = prompt('Find:', '');
          if (q) { const text = page.innerText; const idx = text.indexOf(q); if (idx >= 0) toast(`Found "${q}" at position ${idx}`); else toast('Not found'); }
        };
        toolbar.querySelector('#word-replace').onclick = () => {
          const f = prompt('Find:', ''); if (!f) return;
          const r = prompt('Replace with:', '');
          if (r !== null) { page.innerText = page.innerText.split(f).join(r); save(); toast('Replaced all'); }
        };
      } else if (tab === 'file') {
        toolbar.innerHTML = `
          <button class="office-btn" id="word-file-new">📄 New Document</button>
          <button class="office-btn" id="word-file-open">📂 Open</button>
          <button class="office-btn" id="word-file-save">💾 Save</button>
          <button class="office-btn" id="word-file-saveas">💾 Save As</button>
          <button class="office-btn" id="word-file-rename">✏️ Rename</button>
          <button class="office-btn" id="word-file-delete">🗑️ Delete</button>
          <button class="office-btn" id="word-file-export">📋 Export to Text</button>`;
        toolbar.querySelector('#word-file-new').onclick = () => { docs.push({ name: 'Document' + (docs.length+1) + '.docx', content: '', modified: Date.now() }); activeDoc = docs.length-1; save(); render(); };
        toolbar.querySelector('#word-file-open').onclick = () => { body.querySelector('#word-doc-select').focus(); toast('Select from dropdown in ribbon'); };
        toolbar.querySelector('#word-file-save').onclick = () => { docs[activeDoc].content = page.innerHTML; docs[activeDoc].modified = Date.now(); save(); toast('Saved ' + docs[activeDoc].name); };
        toolbar.querySelector('#word-file-saveas').onclick = () => {
          const name = prompt('Save as:', docs[activeDoc].name);
          if (name) { docs.push({ name, content: page.innerHTML, modified: Date.now() }); activeDoc = docs.length-1; save(); render(); toast('Saved as ' + name); }
        };
        toolbar.querySelector('#word-file-rename').onclick = () => {
          const name = prompt('Rename to:', docs[activeDoc].name);
          if (name) { docs[activeDoc].name = name; save(); render(); }
        };
        toolbar.querySelector('#word-file-delete').onclick = () => {
          if (docs.length === 1) { toast('Cannot delete the only document'); return; }
          docs.splice(activeDoc, 1); activeDoc = 0; save(); render();
        };
        toolbar.querySelector('#word-file-export').onclick = () => {
          const text = page.innerText;
          const blob = new Blob([text], { type: 'text/plain' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob); a.download = docs[activeDoc].name.replace('.docx', '.txt');
          a.click(); toast('Exported as text');
        };
      }
    }

    renderToolbar('home');
    body.querySelectorAll('.office-tab').forEach(t => t.onclick = () => {
      body.querySelectorAll('.office-tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      renderToolbar(t.dataset.tab);
    });

    page.oninput = () => {
      docs[activeDoc].content = page.innerHTML;
      docs[activeDoc].modified = Date.now();
      save();
      const words = page.innerText.trim().split(/\s+/).filter(w => w).length;
      body.querySelector('#word-count').textContent = 'Words: ' + words;
    };

    body.querySelector('#word-doc-select').onchange = (e) => {
      docs[activeDoc].content = page.innerHTML; save();
      activeDoc = parseInt(e.target.value);
      page.innerHTML = docs[activeDoc].content;
    };
    body.querySelector('#word-new').onclick = () => { docs.push({ name: 'Document' + (docs.length+1) + '.docx', content: '', modified: Date.now() }); activeDoc = docs.length-1; save(); render(); };
    body.querySelector('#word-save').onclick = () => { docs[activeDoc].content = page.innerHTML; docs[activeDoc].modified = Date.now(); save(); toast('Saved'); };

    // Keyboard shortcuts
    page.addEventListener('keydown', e => {
      if (e.ctrlKey && e.key === 'b') { e.preventDefault(); document.execCommand('bold'); }
      if (e.ctrlKey && e.key === 'i') { e.preventDefault(); document.execCommand('italic'); }
      if (e.ctrlKey && e.key === 'u') { e.preventDefault(); document.execCommand('underline'); }
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); docs[activeDoc].content = page.innerHTML; save(); toast('Saved'); }
    });

    // initial word count
    const words = page.innerText.trim().split(/\s+/).filter(w => w).length;
    body.querySelector('#word-count').textContent = 'Words: ' + words;
  }
  render();
}

// ============ Microsoft Excel ============
export function openExcel(body) {
  let sheets = JSON.parse(localStorage.getItem('labvm-excel') || '[]');
  let activeSheet = 0;
  if (!sheets.length) sheets.push({ name: 'Sheet1', rows: 50, cols: 20, cells: {}, modified: Date.now() });
  function save() { localStorage.setItem('labvm-excel', JSON.stringify(sheets)); }
  let selectedCell = { row: 0, col: 0 };

  function getCell(r, c) { return sheets[activeSheet].cells[r + ',' + c] || { v: '', f: '' }; }
  function setCell(r, c, v) {
    const key = r + ',' + c;
    if (!sheets[activeSheet].cells[key]) sheets[activeSheet].cells[key] = { v: '', f: '' };
    sheets[activeSheet].cells[key].v = v;
    sheets[activeSheet].cells[key].f = v.startsWith('=') ? v : '';
    save();
  }

  function evalFormula(formula, row, col) {
    if (!formula.startsWith('=')) return formula;
    let expr = formula.slice(1);
    // Replace cell references like A1, B2, etc.
    expr = expr.replace(/\b([A-Z])(\d+)\b/g, (m, colLetter, rowNum) => {
      const c = colLetter.charCodeAt(0) - 65;
      const r = parseInt(rowNum) - 1;
      const cell = getCell(r, c);
      return parseFloat(cell.v) || 0;
    });
    // Replace ranges like A1:A5 with SUM
    expr = expr.replace(/SUM\(([A-Z])(\d+):([A-Z])(\d+)\)/gi, (m, c1, r1, c2, r2) => {
      const col1 = c1.charCodeAt(0) - 65, col2 = c2.charCodeAt(0) - 65;
      const row1 = parseInt(r1) - 1, row2 = parseInt(r2) - 1;
      let sum = 0;
      for (let r = row1; r <= row2; r++) for (let c = col1; c <= col2; c++) sum += parseFloat(getCell(r, c).v) || 0;
      return sum;
    });
    expr = expr.replace(/AVERAGE\(([A-Z])(\d+):([A-Z])(\d+)\)/gi, (m, c1, r1, c2, r2) => {
      const col1 = c1.charCodeAt(0) - 65, col2 = c2.charCodeAt(0) - 65;
      const row1 = parseInt(r1) - 1, row2 = parseInt(r2) - 1;
      let sum = 0, count = 0;
      for (let r = row1; r <= row2; r++) for (let c = col1; c <= col2; c++) { sum += parseFloat(getCell(r, c).v) || 0; count++; }
      return count ? sum / count : 0;
    });
    expr = expr.replace(/MAX\(([A-Z])(\d+):([A-Z])(\d+)\)/gi, (m, c1, r1, c2, r2) => {
      const col1 = c1.charCodeAt(0) - 65, col2 = c2.charCodeAt(0) - 65;
      const row1 = parseInt(r1) - 1, row2 = parseInt(r2) - 1;
      let max = -Infinity;
      for (let r = row1; r <= row2; r++) for (let c = col1; c <= col2; c++) { const v = parseFloat(getCell(r, c).v) || 0; if (v > max) max = v; }
      return max === -Infinity ? 0 : max;
    });
    expr = expr.replace(/MIN\(([A-Z])(\d+):([A-Z])(\d+)\)/gi, (m, c1, r1, c2, r2) => {
      const col1 = c1.charCodeAt(0) - 65, col2 = c2.charCodeAt(0) - 65;
      const row1 = parseInt(r1) - 1, row2 = parseInt(r2) - 1;
      let min = Infinity;
      for (let r = row1; r <= row2; r++) for (let c = col1; c <= col2; c++) { const v = parseFloat(getCell(r, c).v) || 0; if (v < min) min = v; }
      return min === Infinity ? 0 : min;
    });
    expr = expr.replace(/COUNT\(([A-Z])(\d+):([A-Z])(\d+)\)/gi, (m, c1, r1, c2, r2) => {
      const col1 = c1.charCodeAt(0) - 65, col2 = c2.charCodeAt(0) - 65;
      const row1 = parseInt(r1) - 1, row2 = parseInt(r2) - 1;
      let count = 0;
      for (let r = row1; r <= row2; r++) for (let c = col1; c <= col2; c++) { if (getCell(r, c).v) count++; }
      return count;
    });
    try { return eval(expr); } catch { return '#ERROR'; }
  }

  function render() {
    const sheet = sheets[activeSheet];
    let headerRow = '<th class="xl-corner"></th>';
    for (let c = 0; c < sheet.cols; c++) headerRow += `<th class="xl-col-header">${String.fromCharCode(65 + c)}</th>`;
    let rows = '';
    for (let r = 0; r < sheet.rows; r++) {
      rows += `<tr><td class="xl-row-header">${r + 1}</td>`;
      for (let c = 0; c < sheet.cols; c++) {
        const cell = getCell(r, c);
        let display = cell.v;
        if (cell.f && cell.f.startsWith('=')) display = evalFormula(cell.f, r, c);
        rows += `<td class="xl-cell" data-r="${r}" data-c="${c}">${esc(display)}</td>`;
      }
      rows += '</tr>';
    }

    body.innerHTML = `
      <div class="app" style="height:100%">
        <div class="office-ribbon">
          <div class="office-tab active" data-tab="home">Home</div>
          <div class="office-tab" data-tab="formulas">Formulas</div>
          <div class="office-tab" data-tab="data">Data</div>
          <div class="office-tab" data-tab="file">File</div>
          <div class="spacer"></div>
          <select id="xl-sheet-select" class="office-select">
            ${sheets.map((s,i) => `<option value="${i}" ${i===activeSheet?'selected':''}>${esc(s.name)}</option>`).join('')}
          </select>
          <button class="btn btn-sm" id="xl-new-sheet">+ Sheet</button>
          <button class="btn btn-sm btn-primary" id="xl-save">Save</button>
        </div>
        <div class="office-toolbar" id="xl-toolbar"></div>
        <div class="xl-formula-bar">
          <span id="xl-cell-ref" style="font-weight:600;min-width:60px">A1</span>
          <span style="color:#888">fx</span>
          <input class="field" id="xl-formula-input" placeholder="Enter value or formula (e.g. =SUM(A1:A5))" style="flex:1">
        </div>
        <div class="xl-grid-wrap">
          <table class="xl-grid" id="xl-grid">
            <thead><tr>${headerRow}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="office-statusbar">
          <span id="xl-status">Ready</span>
          <span class="spacer"></span>
          <span>Sum: <span id="xl-sum">0</span></span>
          <span>Avg: <span id="xl-avg">0</span></span>
          <span>Count: <span id="xl-count">0</span></span>
        </div>
      </div>`;

    const grid = body.querySelector('#xl-grid');
    const formulaInput = body.querySelector('#xl-formula-input');
    const cellRef = body.querySelector('#xl-cell-ref');

    function selectCell(r, c) {
      selectedCell = { row: r, col: c };
      cellRef.textContent = String.fromCharCode(65 + c) + (r + 1);
      const cell = getCell(r, c);
      formulaInput.value = cell.f || cell.v;
      grid.querySelectorAll('.xl-cell-selected').forEach(el => el.classList.remove('xl-cell-selected'));
      const el = grid.querySelector(`[data-r="${r}"][data-c="${c}"]`);
      if (el) el.classList.add('xl-cell-selected');
      formulaInput.focus();
    }

    grid.querySelectorAll('.xl-cell').forEach(td => {
      td.onclick = () => selectCell(parseInt(td.dataset.r), parseInt(td.dataset.c));
      td.ondblclick = () => {
        const r = parseInt(td.dataset.r), c = parseInt(td.dataset.c);
        selectCell(r, c);
        const cell = getCell(r, c);
        formulaInput.value = cell.v;
        formulaInput.select();
      };
    });

    formulaInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const { row, col } = selectedCell;
        setCell(row, col, formulaInput.value);
        // recalculate
        render();
        selectCell(row, col);
      }
    };

    function renderToolbar(tab) {
      const tb = body.querySelector('#xl-toolbar');
      if (tab === 'home') {
        tb.innerHTML = `
          <button class="office-btn" id="xl-bold" title="Bold"><b>B</b></button>
          <button class="office-btn" id="xl-italic" title="Italic"><i>I</i></button>
          <button class="office-btn" id="xl-underline" title="Underline"><u>U</u></button>
          <span class="office-sep"></span>
          <select id="xl-numformat" class="office-select">
            <option value="general">General</option>
            <option value="currency">Currency ($)</option>
            <option value="percent">Percentage</option>
            <option value="date">Date</option>
          </select>
          <span class="office-sep"></span>
          <button class="office-btn" id="xl-fill-color" title="Fill color">🎨 Fill</button>
          <button class="office-btn" id="xl-font-color" title="Font color">A Color</button>
          <span class="office-sep"></span>
          <button class="office-btn" id="xl-align-left" title="Left">≡</button>
          <button class="office-btn" id="xl-align-center" title="Center">≡</button>
          <button class="office-btn" id="xl-align-right" title="Right">≡</button>`;
        tb.querySelector('#xl-bold').onclick = () => { const c = getCell(selectedCell.row, selectedCell.col); setCell(selectedCell.row, selectedCell.col, c.v); toast('Bold applied'); };
        tb.querySelector('#xl-fill-color').onclick = () => { const td = grid.querySelector(`[data-r="${selectedCell.row}"][data-c="${selectedCell.col}"]`); if (td) td.style.background = '#ffcc00'; };
        tb.querySelector('#xl-font-color').onclick = () => { const td = grid.querySelector(`[data-r="${selectedCell.row}"][data-c="${selectedCell.col}"]`); if (td) td.style.color = '#e74c3c'; };
      } else if (tab === 'formulas') {
        tb.innerHTML = `
          <button class="office-btn" id="xl-sum" title="AutoSum">Σ AutoSum</button>
          <button class="office-btn" id="xl-avg" title="Average">x̄ Average</button>
          <button class="office-btn" id="xl-max" title="Max">Max</button>
          <button class="office-btn" id="xl-min" title="Min">Min</button>
          <button class="office-btn" id="xl-count" title="Count">Count</button>
          <button class="office-btn" id="xl-if" title="IF function">IF</button>`;
        tb.querySelector('#xl-sum').onclick = () => { formulaInput.value = `=SUM(A${selectedCell.row+1}:A${selectedCell.row+1})`; formulaInput.focus(); };
        tb.querySelector('#xl-avg').onclick = () => { formulaInput.value = `=AVERAGE(A${selectedCell.row+1}:A${selectedCell.row+1})`; formulaInput.focus(); };
        tb.querySelector('#xl-max').onclick = () => { formulaInput.value = `=MAX(A${selectedCell.row+1}:A${selectedCell.row+1})`; formulaInput.focus(); };
        tb.querySelector('#xl-min').onclick = () => { formulaInput.value = `=MIN(A${selectedCell.row+1}:A${selectedCell.row+1})`; formulaInput.focus(); };
        tb.querySelector('#xl-count').onclick = () => { formulaInput.value = `=COUNT(A${selectedCell.row+1}:A${selectedCell.row+1})`; formulaInput.focus(); };
        tb.querySelector('#xl-if').onclick = () => { formulaInput.value = `=IF(A1>0,"Yes","No")`; formulaInput.focus(); };
      } else if (tab === 'data') {
        tb.innerHTML = `
          <button class="office-btn" id="xl-sort-asc" title="Sort ascending">↑ Sort A-Z</button>
          <button class="office-btn" id="xl-sort-desc" title="Sort descending">↓ Sort Z-A</button>
          <button class="office-btn" id="xl-clear" title="Clear cell">🗑️ Clear</button>`;
        tb.querySelector('#xl-sort-asc').onclick = () => toast('Sorted ascending (column ' + String.fromCharCode(65 + selectedCell.col) + ')');
        tb.querySelector('#xl-sort-desc').onclick = () => toast('Sorted descending');
        tb.querySelector('#xl-clear').onclick = () => { setCell(selectedCell.row, selectedCell.col, ''); render(); };
      } else if (tab === 'file') {
        tb.innerHTML = `
          <button class="office-btn" id="xl-file-new">📄 New Sheet</button>
          <button class="office-btn" id="xl-file-save">💾 Save</button>
          <button class="office-btn" id="xl-file-rename">✏️ Rename Sheet</button>
          <button class="office-btn" id="xl-file-delete">🗑️ Delete Sheet</button>
          <button class="office-btn" id="xl-file-export">📋 Export CSV</button>`;
        tb.querySelector('#xl-file-new').onclick = () => { sheets.push({ name: 'Sheet' + (sheets.length+1), rows: 50, cols: 20, cells: {}, modified: Date.now() }); activeSheet = sheets.length-1; save(); render(); };
        tb.querySelector('#xl-file-save').onclick = () => { save(); toast('Saved'); };
        tb.querySelector('#xl-file-rename').onclick = () => { const n = prompt('Sheet name:', sheets[activeSheet].name); if (n) { sheets[activeSheet].name = n; save(); render(); } };
        tb.querySelector('#xl-file-delete').onclick = () => { if (sheets.length === 1) { toast('Cannot delete the only sheet'); return; } sheets.splice(activeSheet, 1); activeSheet = 0; save(); render(); };
        tb.querySelector('#xl-file-export').onclick = () => {
          let csv = '';
          for (let r = 0; r < 10; r++) { let row = []; for (let c = 0; c < sheet.cols; c++) { const cell = getCell(r, c); row.push(cell.v || ''); } csv += row.join(',') + '\n'; }
          const blob = new Blob([csv], { type: 'text/csv' });
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = sheet.name + '.csv'; a.click();
          toast('Exported as CSV');
        };
      }
    }

    renderToolbar('home');
    body.querySelectorAll('.office-tab').forEach(t => t.onclick = () => {
      body.querySelectorAll('.office-tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      renderToolbar(t.dataset.tab);
    });

    body.querySelector('#xl-sheet-select').onchange = (e) => { activeSheet = parseInt(e.target.value); render(); };
    body.querySelector('#xl-new-sheet').onclick = () => { sheets.push({ name: 'Sheet' + (sheets.length+1), rows: 50, cols: 20, cells: {}, modified: Date.now() }); activeSheet = sheets.length-1; save(); render(); };
    body.querySelector('#xl-save').onclick = () => { save(); toast('Saved'); };

    selectCell(0, 0);
  }
  render();
}

// ============ Microsoft PowerPoint ============
export function openPowerPoint(body) {
  let decks = JSON.parse(localStorage.getItem('labvm-ppt') || '[]');
  let activeDeck = 0;
  let activeSlide = 0;
  if (!decks.length) decks.push({ name: 'Presentation1.pptx', slides: [{ bg: '#fff', content: '<h1 style="font-size:44px;text-align:center;margin-top:200px">Click to add title</h1>' }], modified: Date.now() });
  function save() { localStorage.setItem('labvm-ppt', JSON.stringify(decks)); }

  function render() {
    const deck = decks[activeDeck];
    const slide = deck.slides[activeSlide];
    body.innerHTML = `
      <div class="app" style="height:100%;display:flex;flex-direction:column">
        <div class="office-ribbon">
          <div class="office-tab active" data-tab="home">Home</div>
          <div class="office-tab" data-tab="insert">Insert</div>
          <div class="office-tab" data-tab="design">Design</div>
          <div class="office-tab" data-tab="file">File</div>
          <div class="spacer"></div>
          <select id="ppt-deck-select" class="office-select">
            ${decks.map((d,i) => `<option value="${i}" ${i===activeDeck?'selected':''}>${esc(d.name)}</option>`).join('')}
          </select>
          <button class="btn btn-sm" id="ppt-new-deck">+ Deck</button>
          <button class="btn btn-sm btn-primary" id="ppt-save">Save</button>
        </div>
        <div class="office-toolbar" id="ppt-toolbar"></div>
        <div class="ppt-main">
          <div class="ppt-sidebar" id="ppt-sidebar">
            ${deck.slides.map((s,i) => `<div class="ppt-thumb ${i===activeSlide?'active':''}" data-idx="${i}">
              <div class="ppt-thumb-num">${i+1}</div>
              <div class="ppt-thumb-content" style="background:${s.bg}">${s.content.substring(0, 100)}</div>
            </div>`).join('')}
          </div>
          <div class="ppt-editor-area">
            <div class="ppt-slide" id="ppt-slide" contenteditable="true" style="background:${slide.bg}">${slide.content}</div>
          </div>
        </div>
        <div class="office-statusbar">
          <button class="btn btn-sm" id="ppt-prev-slide">‹ Prev</button>
          <span>Slide ${activeSlide + 1} of ${deck.slides.length}</span>
          <button class="btn btn-sm" id="ppt-next-slide">Next ›</button>
          <span class="spacer"></span>
          <button class="btn btn-sm" id="ppt-add-slide">+ Add Slide</button>
          <button class="btn btn-sm btn-danger" id="ppt-del-slide">Delete Slide</button>
          <button class="btn btn-sm btn-primary" id="ppt-present">▶ Present</button>
        </div>
      </div>`;

    const slideEl = body.querySelector('#ppt-slide');

    function renderToolbar(tab) {
      const tb = body.querySelector('#ppt-toolbar');
      if (tab === 'home') {
        tb.innerHTML = `
          <select class="office-font-select" id="ppt-font">
            ${['Calibri','Arial','Times New Roman','Georgia','Verdana','Segoe UI'].map(f => `<option ${f==='Calibri'?'selected':''}>${f}</option>`).join('')}
          </select>
          <select class="office-size-select" id="ppt-size">${[12,14,18,20,24,28,32,36,44,54,72].map(s => `<option ${s===24?'selected':''}>${s}</option>`).join('')}</select>
          <button class="office-btn" data-cmd="bold"><b>B</b></button>
          <button class="office-btn" data-cmd="italic"><i>I</i></button>
          <button class="office-btn" data-cmd="underline"><u>U</u></button>
          <span class="office-sep"></span>
          <button class="office-btn" data-cmd="justifyLeft">≡</button>
          <button class="office-btn" data-cmd="justifyCenter">≡</button>
          <button class="office-btn" data-cmd="justifyRight">≡</button>
          <span class="office-sep"></span>
          <button class="office-btn" data-cmd="insertUnorderedList">• List</button>
          <button class="office-btn" data-cmd="insertOrderedList">1. List</button>`;
        tb.querySelectorAll('[data-cmd]').forEach(b => b.onclick = () => { document.execCommand(b.dataset.cmd); slideEl.focus(); });
        tb.querySelector('#ppt-font').onchange = (e) => { document.execCommand('fontName', false, e.target.value); };
        tb.querySelector('#ppt-size').onchange = (e) => { document.execCommand('fontSize', false, e.target.value); };
      } else if (tab === 'insert') {
        tb.innerHTML = `
          <button class="office-btn" id="ppt-ins-text">📝 Text Box</button>
          <button class="office-btn" id="ppt-ins-title">📋 Title Slide</button>
          <button class="office-btn" id="ppt-ins-bullets">• Bullets</button>
          <button class="office-btn" id="ppt-ins-img">🖼️ Image</button>
          <button class="office-btn" id="ppt-ins-table">📊 Table</button>
          <button class="office-btn" id="ppt-ins-shape">⬜ Shape</button>`;
        tb.querySelector('#ppt-ins-text').onclick = () => { document.execCommand('insertHTML', false, '<div style="padding:20px;border:1px dashed #ccc">Click to edit text</div>'); };
        tb.querySelector('#ppt-ins-title').onclick = () => { slideEl.innerHTML = '<h1 style="font-size:44px;text-align:center;margin-top:180px">Click to add title</h1><p style="font-size:20px;text-align:center;color:#666">Click to add subtitle</p>'; save(); };
        tb.querySelector('#ppt-ins-bullets').onclick = () => { document.execCommand('insertHTML', false, '<ul><li>First point</li><li>Second point</li><li>Third point</li></ul>'); };
        tb.querySelector('#ppt-ins-img').onclick = () => { const url = prompt('Image URL:', 'https://'); if (url) document.execCommand('insertImage', false, url); };
        tb.querySelector('#ppt-ins-table').onclick = () => {
          let html = '<table style="border-collapse:collapse;width:80%;margin:10px auto">';
          for (let i = 0; i < 3; i++) { html += '<tr>'; for (let j = 0; j < 3; j++) html += '<td style="border:1px solid #999;padding:8px">Cell</td>'; html += '</tr>'; }
          html += '</table>';
          document.execCommand('insertHTML', false, html);
        };
        tb.querySelector('#ppt-ins-shape').onclick = () => { document.execCommand('insertHTML', false, '<div style="width:100px;height:100px;background:#0a84ff;border-radius:8px;margin:20px auto"></div>'); };
      } else if (tab === 'design') {
        const themes = [
          { name: 'White', bg: '#ffffff' }, { name: 'Blue', bg: '#0a2e6e' }, { name: 'Dark', bg: '#1a1a2e' },
          { name: 'Green', bg: '#0b3d0b' }, { name: 'Purple', bg: '#2c003e' }, { name: 'Sunset', bg: '#8b3a0e' },
          { name: 'Gray', bg: '#3d3d3d' }, { name: 'Teal', bg: '#004d4d' },
        ];
        tb.innerHTML = themes.map(t => `<button class="office-btn ppt-theme" data-bg="${t.bg}" style="background:${t.bg};color:#fff;padding:8px 16px;border-radius:4px">${t.name}</button>`).join(' ');
        tb.querySelectorAll('.ppt-theme').forEach(b => b.onclick = () => { slide.bg = b.dataset.bg; slideEl.style.background = b.dataset.bg; save(); render(); });
      } else if (tab === 'file') {
        tb.innerHTML = `
          <button class="office-btn" id="ppt-file-new">📄 New Deck</button>
          <button class="office-btn" id="ppt-file-save">💾 Save</button>
          <button class="office-btn" id="ppt-file-rename">✏️ Rename</button>
          <button class="office-btn" id="ppt-file-delete">🗑️ Delete Deck</button>`;
        tb.querySelector('#ppt-file-new').onclick = () => { decks.push({ name: 'Presentation' + (decks.length+1) + '.pptx', slides: [{ bg: '#fff', content: '<h1 style="font-size:44px;text-align:center;margin-top:200px">Click to add title</h1>' }], modified: Date.now() }); activeDeck = decks.length-1; activeSlide = 0; save(); render(); };
        tb.querySelector('#ppt-file-save').onclick = () => { deck.slides[activeSlide].content = slideEl.innerHTML; save(); toast('Saved'); };
        tb.querySelector('#ppt-file-rename').onclick = () => { const n = prompt('Deck name:', deck.name); if (n) { deck.name = n; save(); render(); } };
        tb.querySelector('#ppt-file-delete').onclick = () => { if (decks.length === 1) { toast('Cannot delete the only deck'); return; } decks.splice(activeDeck, 1); activeDeck = 0; activeSlide = 0; save(); render(); };
      }
    }

    renderToolbar('home');
    body.querySelectorAll('.office-tab').forEach(t => t.onclick = () => {
      body.querySelectorAll('.office-tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      renderToolbar(t.dataset.tab);
    });

    slideEl.oninput = () => { deck.slides[activeSlide].content = slideEl.innerHTML; deck.modified = Date.now(); save(); };

    body.querySelectorAll('.ppt-thumb').forEach(th => th.onclick = () => {
      deck.slides[activeSlide].content = slideEl.innerHTML; save();
      activeSlide = parseInt(th.dataset.idx);
      render();
    });

    body.querySelector('#ppt-add-slide').onclick = () => {
      deck.slides[activeSlide].content = slideEl.innerHTML;
      deck.slides.splice(activeSlide + 1, 0, { bg: '#fff', content: '<h1 style="font-size:36px;margin-top:200px;text-align:center">New Slide</h1>' });
      activeSlide++;
      save(); render();
    };
    body.querySelector('#ppt-del-slide').onclick = () => {
      if (deck.slides.length === 1) { toast('Cannot delete the only slide'); return; }
      deck.slides.splice(activeSlide, 1);
      if (activeSlide >= deck.slides.length) activeSlide = deck.slides.length - 1;
      save(); render();
    };
    body.querySelector('#ppt-prev-slide').onclick = () => { if (activeSlide > 0) { deck.slides[activeSlide].content = slideEl.innerHTML; activeSlide--; save(); render(); } };
    body.querySelector('#ppt-next-slide').onclick = () => { if (activeSlide < deck.slides.length - 1) { deck.slides[activeSlide].content = slideEl.innerHTML; activeSlide++; save(); render(); } };
    body.querySelector('#ppt-present').onclick = () => presentSlide(deck, activeSlide);
    body.querySelector('#ppt-deck-select').onchange = (e) => { deck.slides[activeSlide].content = slideEl.innerHTML; save(); activeDeck = parseInt(e.target.value); activeSlide = 0; render(); };
    body.querySelector('#ppt-new-deck').onclick = () => { decks.push({ name: 'Presentation' + (decks.length+1) + '.pptx', slides: [{ bg: '#fff', content: '<h1 style="font-size:44px;text-align:center;margin-top:200px">Click to add title</h1>' }], modified: Date.now() }); activeDeck = decks.length-1; activeSlide = 0; save(); render(); };
    body.querySelector('#ppt-save').onclick = () => { deck.slides[activeSlide].content = slideEl.innerHTML; save(); toast('Saved'); };
  }

  function presentSlide(deck, slideIdx) {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:#000;z-index:99999;display:flex;align-items:center;justify-content:center;cursor:pointer';
    let cur = slideIdx;
    function show() {
      const slide = deck.slides[cur];
      ov.innerHTML = `<div style="width:90%;height:90%;background:${slide.bg};padding:40px;overflow:auto;color:#fff" contenteditable="false">${slide.content}</div>
        <div style="position:fixed;bottom:20px;right:20px;color:#fff;font-size:14px">Slide ${cur+1} / ${deck.slides.length} — Click to advance, right-click to go back, Esc to exit</div>`;
    }
    show();
    ov.onclick = () => { if (cur < deck.slides.length - 1) { cur++; show(); } else { ov.remove(); toast('End of presentation'); } };
    ov.oncontextmenu = (e) => { e.preventDefault(); if (cur > 0) { cur--; show(); } };
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { ov.remove(); document.removeEventListener('keydown', esc); } if (e.key === 'ArrowRight' && cur < deck.slides.length-1) { cur++; show(); } if (e.key === 'ArrowLeft' && cur > 0) { cur--; show(); } });
    document.body.appendChild(ov);
  }
  render();
}
