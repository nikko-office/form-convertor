// MasterPiece Mini Web UI ロジック

// ===== ページ切替 =====
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('page-' + btn.dataset.page).classList.add('active');

    // ページ表示時にデータ再読込
    if (btn.dataset.page === 'issuers') loadIssuers();
    if (btn.dataset.page === 'recipients') loadRecipients();
    if (btn.dataset.page === 'generate') {
      loadIssuerOptions();
      loadRecipientOptions();
    }
  });
});

// ===== 初期化 =====
document.addEventListener('DOMContentLoaded', () => {
  // 今日の日付をセット
  document.getElementById('inp-date').value = new Date().toISOString().split('T')[0];
  loadIssuerOptions();
  loadRecipientOptions();
});

// ===== API ヘルパー =====
async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch('/api' + path, opts);
  return res;
}

async function apiJson(method, path, body) {
  const res = await api(method, path, body);
  return res.json();
}

// ===== 自社情報セレクター読込 =====
async function loadIssuerOptions() {
  const issuers = await apiJson('GET', '/issuers');
  const sel = document.getElementById('sel-issuer');
  sel.innerHTML = '<option value="">\uff08\u672a\u9078\u629e\uff09</option>';
  for (const i of issuers) {
    const opt = document.createElement('option');
    opt.value = i.id;
    opt.textContent = i.companyName + (i.isDefault ? ' [デフォルト]' : '');
    if (i.isDefault) opt.selected = true;
    sel.appendChild(opt);
  }
}

// ===== 得意先セレクター読込 =====
async function loadRecipientOptions() {
  const recipients = await apiJson('GET', '/recipients');
  const sel = document.getElementById('sel-recipient');
  sel.innerHTML = '<option value="">\uff08\u672a\u9078\u629e\uff09</option>';
  for (const r of recipients) {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = r.companyName + (r.department ? ' ' + r.department : '') + (r.personName ? ' ' + r.personName + (r.honorific || '') : '');
    sel.appendChild(opt);
  }
}

// ===== フォームデータ収集 =====
function collectFormData() {
  // TSVパース
  const tsvText = document.getElementById('inp-tsv').value.trim();
  let items = [];
  if (tsvText) {
    const lines = tsvText.replace(/\r\n/g, '\n').split('\n').filter(l => l.length > 0);
    // 1行目がヘッダーかどうか判定（数値でなければヘッダー）
    const firstRow = lines[0].split('\t');
    const startIdx = isNaN(Number(firstRow[1])) ? 1 : 0;
    for (let i = startIdx; i < lines.length; i++) {
      const cols = lines[i].split('\t');
      items.push({
        description: cols[0] || '',
        quantity: Number(cols[1]) || 0,
        unit: cols[2] || '',
        unitPrice: Number(cols[3]) || 0,
      });
    }
  }

  // 自社情報
  const issuerSel = document.getElementById('sel-issuer');
  let issuer = { companyName: '', address: '', tel: '' };

  // 得意先
  const recipientSel = document.getElementById('sel-recipient');
  let recipient = { companyName: '' };

  return {
    documentDate: document.getElementById('inp-date').value,
    documentNumber: document.getElementById('inp-number').value,
    subject: document.getElementById('inp-subject').value,
    items,
    taxRate: 0.10,
    remarks: document.getElementById('inp-remarks').value,
    validUntil: document.getElementById('inp-valid').value || undefined,
    paymentTerms: document.getElementById('inp-payment').value || undefined,
    issuer,
    recipient,
    showStamp: document.getElementById('chk-stamp').checked,
    showLogo: document.getElementById('chk-logo').checked,
    // フィールド表示設定
    visibility: {
      issuerFax: document.getElementById('vis-issuer-fax').checked,
      subject: document.getElementById('vis-subject').checked,
      totalSummary: document.getElementById('vis-total-summary').checked,
      remarks: document.getElementById('vis-remarks').checked,
      validUntil: document.getElementById('vis-valid-until').checked,
      paymentTerms: document.getElementById('vis-payment-terms').checked,
      deliveryDate: document.getElementById('vis-delivery-date').checked,
    },
    // DB IDを渡して、サーバー側で解決してもらう
    _issuerId: issuerSel.value,
    _recipientId: recipientSel.value,
  };
}

// フォームデータにDB情報をマージする
async function resolveDbData(data) {
  // 自社情報をDBから取得
  if (data._issuerId) {
    const issuers = await apiJson('GET', '/issuers');
    const found = issuers.find(i => i.id === data._issuerId);
    if (found) {
      data.issuer = {
        companyName: found.companyName,
        address: found.address,
        tel: found.tel,
        fax: found.fax,
      };
    }
  }

  // 得意先をDBから取得
  if (data._recipientId) {
    const recipients = await apiJson('GET', '/recipients');
    const found = recipients.find(r => r.id === data._recipientId);
    if (found) {
      data.recipient = {
        companyName: found.companyName,
        department: found.department,
        personName: found.personName,
        honorific: found.honorific,
      };
    }
  }

  delete data._issuerId;
  delete data._recipientId;
  return data;
}

// ===== プレビュー =====
document.getElementById('btn-preview').addEventListener('click', async () => {
  const btn = document.getElementById('btn-preview');
  btn.disabled = true;
  btn.textContent = '読込中...';

  try {
    let data = collectFormData();
    data = await resolveDbData(data);

    const template = document.getElementById('sel-template').value;
    const paperSize = document.getElementById('sel-paper').value;
    const orientation = document.getElementById('sel-orientation').value;

    const result = await apiJson('POST', '/preview', { template, data, paperSize, orientation });

    const frame = document.getElementById('preview-frame');
    const placeholder = document.getElementById('preview-placeholder');
    placeholder.style.display = 'none';
    frame.style.display = 'block';

    // iframe に HTML を書き込む
    const doc = frame.contentDocument || frame.contentWindow.document;
    doc.open();
    doc.write(result.html);
    doc.close();
  } catch (err) {
    alert('プレビューに失敗しました: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'プレビュー';
  }
});

// ===== PDF生成 =====
document.getElementById('btn-pdf').addEventListener('click', async () => {
  const btn = document.getElementById('btn-pdf');
  btn.disabled = true;
  btn.textContent = '生成中...';

  try {
    let data = collectFormData();
    data = await resolveDbData(data);

    const template = document.getElementById('sel-template').value;
    const paperSize = document.getElementById('sel-paper').value;
    const orientation = document.getElementById('sel-orientation').value;

    const res = await api('POST', '/generate-pdf', { template, data, paperSize, orientation });
    const blob = await res.blob();

    // ダウンロード
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = template + '_' + new Date().toISOString().replace(/[:.]/g, '').slice(0, 15) + '.pdf';
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('PDF生成に失敗しました: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'PDF生成';
  }
});


// =====================================================
// 自社情報 管理
// =====================================================

async function loadIssuers() {
  const issuers = await apiJson('GET', '/issuers');
  const list = document.getElementById('issuer-list');
  if (issuers.length === 0) {
    list.innerHTML = '<p style="color:#888;font-size:13px;">まだ登録されていません</p>';
    return;
  }
  list.innerHTML = issuers.map(i => `
    <div class="card">
      <div class="card-body">
        <div class="company-name">${esc(i.companyName)} ${i.isDefault ? '<span class="card-badge">デフォルト</span>' : ''}</div>
        <div class="detail">${esc(i.address)}</div>
        <div class="detail">TEL: ${esc(i.tel)}${i.fax ? '  FAX: ' + esc(i.fax) : ''}</div>
      </div>
      <div class="card-actions">
        <button onclick="editIssuer('${i.id}')">編集</button>
        <button class="btn-delete" onclick="deleteIssuerConfirm('${i.id}')">削除</button>
      </div>
    </div>
  `).join('');
}

document.getElementById('btn-issuer-new').addEventListener('click', () => {
  document.getElementById('issuer-form-title').textContent = '自社情報を追加';
  document.getElementById('issuer-id').value = '';
  document.getElementById('issuer-name').value = '';
  document.getElementById('issuer-address').value = '';
  document.getElementById('issuer-tel').value = '';
  document.getElementById('issuer-fax').value = '';
  document.getElementById('issuer-default').checked = false;
  document.getElementById('issuer-form-panel').style.display = 'block';
});

document.getElementById('btn-issuer-cancel').addEventListener('click', () => {
  document.getElementById('issuer-form-panel').style.display = 'none';
});

window.editIssuer = async function(id) {
  const issuers = await apiJson('GET', '/issuers');
  const i = issuers.find(x => x.id === id);
  if (!i) return;
  document.getElementById('issuer-form-title').textContent = '自社情報を編集';
  document.getElementById('issuer-id').value = i.id;
  document.getElementById('issuer-name').value = i.companyName;
  document.getElementById('issuer-address').value = i.address;
  document.getElementById('issuer-tel').value = i.tel;
  document.getElementById('issuer-fax').value = i.fax || '';
  document.getElementById('issuer-default').checked = i.isDefault;
  document.getElementById('issuer-form-panel').style.display = 'block';
};

window.deleteIssuerConfirm = async function(id) {
  if (!confirm('この自社情報を削除しますか？')) return;
  await api('DELETE', '/issuers/' + id);
  loadIssuers();
};

document.getElementById('btn-issuer-save').addEventListener('click', async () => {
  const id = document.getElementById('issuer-id').value;
  const body = {
    companyName: document.getElementById('issuer-name').value,
    address: document.getElementById('issuer-address').value,
    tel: document.getElementById('issuer-tel').value,
    fax: document.getElementById('issuer-fax').value || undefined,
    isDefault: document.getElementById('issuer-default').checked,
  };

  if (!body.companyName || !body.address || !body.tel) {
    alert('会社名・住所・TELは必須です');
    return;
  }

  if (id) {
    await api('PUT', '/issuers/' + id, body);
  } else {
    await api('POST', '/issuers', body);
  }

  document.getElementById('issuer-form-panel').style.display = 'none';
  loadIssuers();
});


// =====================================================
// 得意先 管理
// =====================================================

async function loadRecipients() {
  const recipients = await apiJson('GET', '/recipients');
  const list = document.getElementById('recipient-list');
  if (recipients.length === 0) {
    list.innerHTML = '<p style="color:#888;font-size:13px;">まだ登録されていません</p>';
    return;
  }
  list.innerHTML = recipients.map(r => `
    <div class="card">
      <div class="card-body">
        <div class="company-name">${esc(r.companyName)}</div>
        ${r.department ? '<div class="detail">' + esc(r.department) + '</div>' : ''}
        ${r.personName ? '<div class="detail">' + esc(r.personName) + (r.honorific || '') + '</div>' : ''}
        ${r.address ? '<div class="detail">' + esc(r.address) + '</div>' : ''}
        ${r.tel ? '<div class="detail">TEL: ' + esc(r.tel) + '</div>' : ''}
      </div>
      <div class="card-actions">
        <button onclick="editRecipient('${r.id}')">編集</button>
        <button class="btn-delete" onclick="deleteRecipientConfirm('${r.id}')">削除</button>
      </div>
    </div>
  `).join('');
}

document.getElementById('btn-recipient-new').addEventListener('click', () => {
  document.getElementById('recipient-form-title').textContent = '得意先を追加';
  document.getElementById('recipient-id').value = '';
  document.getElementById('recipient-name').value = '';
  document.getElementById('recipient-department').value = '';
  document.getElementById('recipient-person').value = '';
  document.getElementById('recipient-honorific').value = '御中';
  document.getElementById('recipient-address').value = '';
  document.getElementById('recipient-tel').value = '';
  document.getElementById('recipient-form-panel').style.display = 'block';
});

document.getElementById('btn-recipient-cancel').addEventListener('click', () => {
  document.getElementById('recipient-form-panel').style.display = 'none';
});

window.editRecipient = async function(id) {
  const recipients = await apiJson('GET', '/recipients');
  const r = recipients.find(x => x.id === id);
  if (!r) return;
  document.getElementById('recipient-form-title').textContent = '得意先を編集';
  document.getElementById('recipient-id').value = r.id;
  document.getElementById('recipient-name').value = r.companyName;
  document.getElementById('recipient-department').value = r.department || '';
  document.getElementById('recipient-person').value = r.personName || '';
  document.getElementById('recipient-honorific').value = r.honorific || '御中';
  document.getElementById('recipient-address').value = r.address || '';
  document.getElementById('recipient-tel').value = r.tel || '';
  document.getElementById('recipient-form-panel').style.display = 'block';
};

window.deleteRecipientConfirm = async function(id) {
  if (!confirm('この得意先を削除しますか？')) return;
  await api('DELETE', '/recipients/' + id);
  loadRecipients();
};

document.getElementById('btn-recipient-save').addEventListener('click', async () => {
  const id = document.getElementById('recipient-id').value;
  const body = {
    companyName: document.getElementById('recipient-name').value,
    department: document.getElementById('recipient-department').value || undefined,
    personName: document.getElementById('recipient-person').value || undefined,
    honorific: document.getElementById('recipient-honorific').value,
    address: document.getElementById('recipient-address').value || undefined,
    tel: document.getElementById('recipient-tel').value || undefined,
  };

  if (!body.companyName) {
    alert('会社名は必須です');
    return;
  }

  if (id) {
    await api('PUT', '/recipients/' + id, body);
  } else {
    await api('POST', '/recipients', body);
  }

  document.getElementById('recipient-form-panel').style.display = 'none';
  loadRecipients();
});


// ===== ユーティリティ =====
function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
