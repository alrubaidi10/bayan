/* Inventory Management — Specialized Telecom & Mobile Phone Inventory System (On-Hand & IMEI Tracking) */
const InventoryPage = {
  title: () => 'إدارة المخزون الفعلي وسيريالات الجوالات',

  // Default Dimensions Preferences (matches Microsoft Dynamics 365 layout)
  getDefaultDims() {
    try {
      const saved = localStorage.getItem('inv_dims_pref_v2');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      showSku: true,
      showSpecs: true,
      showColor: true,
      showSn: true,
      showBatch: false,
      showBranch: true,
      showShelf: true,
      showPhysical: true,
      showReserved: true,
      showAvailable: true,
      showPrice: true,
      showCost: false,
      showCondition: true,
      hideZero: true,
      savePref: true,
    };
  },

  saveDims(dims) {
    try {
      localStorage.setItem('inv_dims_pref_v2', JSON.stringify(dims));
    } catch (e) {}
  },

  async render(view) {
    const self = this;
    const bc = App.me.company.base_currency;
    let activeTab = 'on_hand'; // 'on_hand' | 'products'
    let currentDims = self.getDefaultDims();
    let showFilters = true;

    // Filter state
    let filterState = {
      q: '',
      product_id: '',
      branch_id: '',
      serial_number: '',
      batch_number: '',
      condition: '',
      color: '',
      storage: '',
      hide_zero: currentDims.hideZero ? '1' : '0'
    };

    // Render container shell
    view.innerHTML = `
      <!-- Header Bar & Tabs -->
      <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="display:inline-flex;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:3px;box-shadow:var(--shadow-sm)">
            <button class="btn sm" id="tab-onhand" style="border-radius:7px;font-weight:600;background:var(--primary);color:#fff">
              ${icon('layers')} المخزون الفعلي (الأجهزة والسيريالات IMEI)
            </button>
            <button class="btn sm ghost" id="tab-products" style="border-radius:7px;font-weight:600">
              ${icon('box')} بطاقات الموديلات والأصناف
            </button>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <button class="btn ghost" id="btn-toggle-filters" style="white-space:nowrap;border:1px solid var(--border)">
            ${icon('filter')} <span id="lbl-toggle-filters">عوامل التصفية</span>
          </button>
          <button class="btn ghost" id="btn-dims" style="white-space:nowrap;border:1px solid var(--border)">
            ${icon('sliders')} عرض الأبعاد
          </button>
          <button class="btn ghost" id="btn-warranty-lookup" style="white-space:nowrap;border:1px solid var(--border);color:var(--primary)">
            ${icon('search')} فحص سيريال / ضمان
          </button>
          <button class="btn secondary" id="btn-bulk-scan" style="white-space:nowrap">
            ${icon('plus')} استلام أجهزة بالسكانر (Bulk IMEI)
          </button>
          <button class="btn primary" id="btn-new-item" style="white-space:nowrap">
            ${icon('plus')} إضافة صنف جديد
          </button>
          <a class="btn ghost" href="#/inventory-print" style="white-space:nowrap;border:1px solid var(--border)" title="طباعة كشف الجرد">
            ${icon('printer')}
          </a>
        </div>
      </div>

      <!-- Main Layout: Sidebar Filters + Content Grid -->
      <div id="inv-main-layout" style="display:grid;grid-template-columns:${showFilters ? '280px 1fr' : '1fr'};gap:16px;align-items:start">
        <!-- Sidebar Filters (عوامل التصفية - from Microsoft Dynamics 365) -->
        <div id="side-filters-panel" class="card" style="padding:16px;border-radius:12px;display:${showFilters ? 'block' : 'none'};background:var(--card);border:1px solid var(--border)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;border-bottom:1px solid var(--border);padding-bottom:10px">
            <h4 style="margin:0;font-size:1rem;display:flex;align-items:center;gap:6px">
              ${icon('filter')} عوامل التصفية
            </h4>
            <span class="badge gray" id="lbl-result-count" style="font-size:.75rem">0 جهاز</span>
          </div>

          <div style="display:flex;flex-direction:column;gap:12px">
            <div class="field">
              <label style="font-size:.8rem;font-weight:600;color:var(--muted);margin-bottom:4px;display:block">بحث سريع (اسم / موديل / SKU)</label>
              <input id="f-q" placeholder="مثال: Nova 15, iPhone..." value="${esc(filterState.q)}" style="width:100%">
            </div>

            <div class="field">
              <label style="font-size:.8rem;font-weight:600;color:var(--muted);margin-bottom:4px;display:block">رقم الصنف (الموديل)</label>
              <select id="f-product" style="width:100%">
                <option value="">— جميع الأصناف والموديلات —</option>
              </select>
            </div>

            <div class="field">
              <label style="font-size:.8rem;font-weight:600;color:var(--muted);margin-bottom:4px;display:block">الموقع / المستودع (الفرع)</label>
              <select id="f-branch" style="width:100%">
                <option value="">— جميع المستودعات والفروع —</option>
              </select>
            </div>

            <div class="field">
              <label style="font-size:.8rem;font-weight:600;color:var(--muted);margin-bottom:4px;display:block">الرقم المسلسل / الـ IMEI</label>
              <input id="f-sn" placeholder="امسح بالسكانر أو اكتب الـ IMEI..." value="${esc(filterState.serial_number)}" style="width:100%;font-family:monospace">
            </div>

            <div class="field">
              <label style="font-size:.8rem;font-weight:600;color:var(--muted);margin-bottom:4px;display:block">حالة الجهاز</label>
              <select id="f-condition" style="width:100%">
                <option value="">— جميع الحالات —</option>
                <option value="new">جديد (New)</option>
                <option value="demo">ديمو للعرض (DEMO)</option>
                <option value="used">مستعمل / معتمد (Used)</option>
                <option value="refurbished">مجدد (Refurbished)</option>
                <option value="maintenance">صيانة (Maintenance)</option>
              </select>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <div class="field">
                <label style="font-size:.8rem;font-weight:600;color:var(--muted);margin-bottom:4px;display:block">اللون</label>
                <select id="f-color" style="width:100%"><option value="">الكل</option></select>
              </div>
              <div class="field">
                <label style="font-size:.8rem;font-weight:600;color:var(--muted);margin-bottom:4px;display:block">السعة</label>
                <select id="f-storage" style="width:100%"><option value="">الكل</option></select>
              </div>
            </div>

            <div class="field">
              <label style="font-size:.8rem;font-weight:600;color:var(--muted);margin-bottom:4px;display:block">رقم الدفعة (Batch)</label>
              <input id="f-batch" placeholder="رقم الشحنة / الدفعة" value="${esc(filterState.batch_number)}" style="width:100%">
            </div>

            <label style="display:flex;align-items:center;gap:8px;font-size:.85rem;cursor:pointer;margin-top:4px">
              <input type="checkbox" id="f-hide-zero" ${currentDims.hideZero ? 'checked' : ''}>
              <span>الكمية &lt;&gt; 0 (الأجهزة المتاحة فقط)</span>
            </label>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">
              <button class="btn primary" id="btn-apply-filters" style="width:100%;justify-content:center">
                ${icon('check')} تطبيق
              </button>
              <button class="btn ghost" id="btn-reset-filters" style="width:100%;justify-content:center;border:1px solid var(--border)">
                ${icon('x')} إعادة تعيين
              </button>
            </div>
          </div>
        </div>

        <!-- Main View Container -->
        <div id="inv-content-area" style="min-width:0">
          <!-- KPI Summary Strip -->
          <div id="kpi-strip" class="kpi-row" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px">
            <!-- Dynamically populated -->
          </div>

          <!-- Active Table Card -->
          <div class="card" style="padding:0;border-radius:12px;overflow:hidden;border:1px solid var(--border)">
            <div id="table-container" class="table-wrap">
              <div style="padding:40px;text-align:center;color:var(--muted)">
                جاري تحميل بيانات المخزون الفعلي...
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Elements
    const mainLayout = view.querySelector('#inv-main-layout');
    const sideFilters = view.querySelector('#side-filters-panel');
    const btnToggleFilters = view.querySelector('#btn-toggle-filters');
    const tableContainer = view.querySelector('#table-container');
    const kpiStrip = view.querySelector('#kpi-strip');
    const lblResultCount = view.querySelector('#lbl-result-count');

    // Toggle Filters Drawer
    btnToggleFilters.onclick = () => {
      showFilters = !showFilters;
      sideFilters.style.display = showFilters ? 'block' : 'none';
      mainLayout.style.gridTemplateColumns = showFilters ? '280px 1fr' : '1fr';
    };

    /* =========================================================================
       1. Load & Render On-Hand Inventory (الأجهزة والسيريالات IMEI)
       ========================================================================= */
    const loadOnHand = async () => {
      tableContainer.innerHTML = `<div style="padding:40px;text-align:center;color:var(--muted)">جاري جلب أجهزة وسيريالات المخزون...</div>`;

      // Build query string
      const params = new URLSearchParams();
      if (filterState.q) params.set('q', filterState.q);
      if (filterState.product_id) params.set('product_id', filterState.product_id);
      if (filterState.branch_id) params.set('branch_id', filterState.branch_id);
      if (filterState.serial_number) params.set('serial_number', filterState.serial_number);
      if (filterState.batch_number) params.set('batch_number', filterState.batch_number);
      if (filterState.condition) params.set('condition', filterState.condition);
      if (filterState.color) params.set('color', filterState.color);
      if (filterState.storage) params.set('storage', filterState.storage);
      if (filterState.hide_zero === '1') params.set('hide_zero', '1');

      try {
        const data = await api('/inventory/on-hand?' + params.toString());
        const items = data.items || [];
        const totals = data.totals || {};

        // Populate filter dropdowns if empty
        const selProd = view.querySelector('#f-product');
        if (selProd && selProd.options.length <= 1) {
          selProd.innerHTML = '<option value="">— جميع الأصناف والموديلات —</option>' +
            (data.products || []).map(p => `<option value="${p.id}" ${filterState.product_id == p.id ? 'selected' : ''}>${esc(p.name)} (${esc(p.sku || '')})</option>`).join('');
        }

        const selBranch = view.querySelector('#f-branch');
        if (selBranch && selBranch.options.length <= 1) {
          selBranch.innerHTML = '<option value="">— جميع المستودعات والفروع —</option>' +
            (data.branches || []).map(b => `<option value="${b.id}" ${filterState.branch_id == b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('');
        }

        const selColor = view.querySelector('#f-color');
        if (selColor && selColor.options.length <= 1) {
          selColor.innerHTML = '<option value="">الكل</option>' +
            (data.filter_options?.colors || []).map(c => `<option value="${esc(c)}" ${filterState.color == c ? 'selected' : ''}>${esc(c)}</option>`).join('');
        }

        const selStorage = view.querySelector('#f-storage');
        if (selStorage && selStorage.options.length <= 1) {
          selStorage.innerHTML = '<option value="">الكل</option>' +
            (data.filter_options?.storages || []).map(s => `<option value="${esc(s)}" ${filterState.storage == s ? 'selected' : ''}>${esc(s)}</option>`).join('');
        }

        if (lblResultCount) lblResultCount.textContent = `${items.length} جهاز`;

        // Render KPI Strip
        kpiStrip.innerHTML = `
          <div class="kpi-card" style="background:var(--card);border-radius:10px;padding:12px 16px;box-shadow:var(--shadow-sm);border:1px solid var(--border)">
            <div style="font-size:.75rem;color:var(--muted);margin-bottom:4px">المخزون الفعلي (الأجهزة)</div>
            <div style="font-size:1.4rem;font-weight:700;color:var(--text)">${fmtNum(totals.totalPhysical || items.length, 0)}</div>
          </div>
          <div class="kpi-card" style="background:var(--card);border-radius:10px;padding:12px 16px;box-shadow:var(--shadow-sm);border:1px solid var(--border)">
            <div style="font-size:.75rem;color:var(--muted);margin-bottom:4px">الفعلي المتاح للبيع</div>
            <div style="font-size:1.4rem;font-weight:700;color:var(--success)">${fmtNum(totals.totalAvailable || 0, 0)}</div>
          </div>
          <div class="kpi-card" style="background:var(--card);border-radius:10px;padding:12px 16px;box-shadow:var(--shadow-sm);border:1px solid var(--border)">
            <div style="font-size:.75rem;color:var(--muted);margin-bottom:4px">أجهزة العرض (DEMO)</div>
            <div style="font-size:1.4rem;font-weight:700;color:var(--warning,#e67e22)">${fmtNum(totals.demoCount || 0, 0)}</div>
          </div>
          <div class="kpi-card" style="background:var(--card);border-radius:10px;padding:12px 16px;box-shadow:var(--shadow-sm);border:1px solid var(--border)">
            <div style="font-size:.75rem;color:var(--muted);margin-bottom:4px">إجمالي قيمة التكلفة</div>
            <div style="font-size:1.4rem;font-weight:700;color:var(--primary)">${fmtMoney(totals.totalCostValue || 0, bc)}</div>
          </div>
        `;

        if (!items.length) {
          tableContainer.innerHTML = `
            <div style="padding:50px 20px;text-align:center">
              <div style="font-size:2.5rem;margin-bottom:12px">📱</div>
              <h4 style="margin:0 0 6px 0">لا توجد أجهزة مطابقة لعوامل التصفية المحددة</h4>
              <p style="color:var(--muted);margin:0 0 16px 0;font-size:.9rem">يمكنك إضافة أجهزة وسيريالات جديدة أو استلام دفعة بالسكانر.</p>
              <button class="btn primary sm" id="btn-empty-scan">${icon('plus')} استلام أجهزة بالسكانر</button>
            </div>
          `;
          const btnEmpty = tableContainer.querySelector('#btn-empty-scan');
          if (btnEmpty) btnEmpty.onclick = () => openBulkScanModal(data.products, data.branches);
          return;
        }

        // Build Table matching Microsoft Dynamics 365
        let thHtml = '';
        if (currentDims.showSku) thHtml += `<th style="white-space:nowrap;font-size:.82rem">رقم الصنف (SKU)</th>`;
        thHtml += `<th style="white-space:nowrap;font-size:.82rem">اسم الصنف والموديل</th>`;
        if (currentDims.showSpecs) thHtml += `<th style="white-space:nowrap;font-size:.82rem">المواصفات (RAM/ROM)</th>`;
        if (currentDims.showColor) thHtml += `<th style="white-space:nowrap;font-size:.82rem">اللون</th>`;
        if (currentDims.showSn) thHtml += `<th style="white-space:nowrap;font-size:.82rem;font-family:monospace">الرقم المسلسل (IMEI)</th>`;
        if (currentDims.showBatch) thHtml += `<th style="white-space:nowrap;font-size:.82rem">الدفعة</th>`;
        if (currentDims.showBranch) thHtml += `<th style="white-space:nowrap;font-size:.82rem">المستودع / الفرع</th>`;
        if (currentDims.showShelf) thHtml += `<th style="white-space:nowrap;font-size:.82rem">المكان / الرف</th>`;
        if (currentDims.showPhysical) thHtml += `<th class="num" style="white-space:nowrap;font-size:.82rem">المخزون الفعلي</th>`;
        if (currentDims.showReserved) thHtml += `<th class="num" style="white-space:nowrap;font-size:.82rem">المحتجز</th>`;
        if (currentDims.showAvailable) thHtml += `<th class="num" style="white-space:nowrap;font-size:.82rem">الفعلي المتاح</th>`;
        if (currentDims.showCost) thHtml += `<th class="num" style="white-space:nowrap;font-size:.82rem">التكلفة</th>`;
        if (currentDims.showPrice) thHtml += `<th class="num" style="white-space:nowrap;font-size:.82rem">سعر البيع</th>`;
        if (currentDims.showCondition) thHtml += `<th style="white-space:nowrap;font-size:.82rem">الحالة</th>`;
        thHtml += `<th style="text-align:end;white-space:nowrap;font-size:.82rem">الإجراءات</th>`;

        let rowsHtml = items.map(it => {
          let badgeCondition = '<span class="badge green">جديد New</span>';
          if (it.condition === 'demo') badgeCondition = '<span class="badge amber" style="background:#fff3cd;color:#856404;border:1px solid #ffeeba">ديمو DEMO</span>';
          else if (it.condition === 'used') badgeCondition = '<span class="badge blue">مستعمل Used</span>';
          else if (it.condition === 'maintenance') badgeCondition = '<span class="badge red">صيانة RMA</span>';

          if (it.status === 'sold') badgeCondition = '<span class="badge gray">مباع Sold</span>';

          let tdHtml = '';
          if (currentDims.showSku) tdHtml += `<td class="mono muted" style="font-size:.82rem">${esc(it.product_sku || '—')}</td>`;
          tdHtml += `<td>
            <div style="font-weight:600;font-size:.9rem">${esc(it.product_name)}</div>
            ${it.product_name_ar ? `<div class="muted small" style="font-size:.78rem">${esc(it.product_name_ar)}</div>` : ''}
          </td>`;
          if (currentDims.showSpecs) tdHtml += `<td class="small" style="font-size:.82rem">${esc(it.specs || '—')}</td>`;
          if (currentDims.showColor) tdHtml += `<td>${it.color ? `<span class="badge gray">${esc(it.color)}</span>` : '—'}</td>`;
          if (currentDims.showSn) {
            tdHtml += `<td class="mono" style="font-size:.85rem;white-space:nowrap">
              <span style="background:var(--bg);padding:3px 7px;border-radius:5px;border:1px solid var(--border);display:inline-flex;align-items:center;gap:6px">
                <span style="color:var(--primary);font-weight:600">${esc(it.serial_number)}</span>
                <button class="btn sm ghost" data-act="copy-sn" data-sn="${esc(it.serial_number)}" style="padding:1px 4px;font-size:.7rem" title="نسخ السيريال">${icon('copy')}</button>
              </span>
            </td>`;
          }
          if (currentDims.showBatch) tdHtml += `<td class="muted small">${esc(it.batch_number || '—')}</td>`;
          if (currentDims.showBranch) tdHtml += `<td class="small">${esc(it.branch_name || 'الرئيسي')}</td>`;
          if (currentDims.showShelf) tdHtml += `<td><span class="badge gray" style="font-family:monospace">${esc(it.shelf_location || '—')}</span></td>`;
          if (currentDims.showPhysical) tdHtml += `<td class="num" style="font-weight:600">${fmtNum(it.physical_qty, 2)}</td>`;
          if (currentDims.showReserved) tdHtml += `<td class="num muted">${fmtNum(it.reserved_qty, 2)}</td>`;
          if (currentDims.showAvailable) {
            tdHtml += `<td class="num"><b style="color:${it.available_qty > 0 ? 'var(--success)' : 'var(--danger)'}">${fmtNum(it.available_qty, 2)}</b></td>`;
          }
          if (currentDims.showCost) tdHtml += `<td class="money">${fmtMoney(it.cost || it.product_default_cost, bc)}</td>`;
          if (currentDims.showPrice) tdHtml += `<td class="money"><b>${fmtMoney(it.price || it.product_default_price, bc)}</b></td>`;
          if (currentDims.showCondition) tdHtml += `<td>${badgeCondition}</td>`;

          tdHtml += `
            <td style="text-align:end;white-space:nowrap">
              <button class="btn sm ghost" data-act="lookup-sn" data-sn="${esc(it.serial_number)}" title="فحص وتتبع الضمان">${icon('search')}</button>
              <button class="btn sm ghost" data-act="edit-sn" data-id="${it.id}" title="تعديل الرف والحالة">${icon('edit')}</button>
              ${it.status === 'available' ? `<button class="btn sm ghost" data-act="del-sn" data-id="${it.id}" style="color:var(--danger)" title="حذف الجهاز">${icon('trash')}</button>` : ''}
            </td>
          `;

          return `<tr data-id="${it.id}">${tdHtml}</tr>`;
        }).join('');

        tableContainer.innerHTML = `
          <table class="tbl" style="width:100%;margin:0">
            <thead style="background:var(--bg)"><tr>${thHtml}</tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <div style="padding:10px 16px;background:var(--bg);border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;font-size:.85rem;color:var(--muted)">
            <div>عدد الأجهزة المعروضة: <b>${items.length}</b></div>
            <div>الكمية الفعلية المتاحة: <b style="color:var(--success)">${fmtNum(totals.totalAvailable || 0, 0)} جهاز</b></div>
          </div>
        `;

        // Wire Table Actions
        tableContainer.querySelectorAll('[data-act=copy-sn]').forEach(b => {
          b.onclick = (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(b.dataset.sn);
            toast('تم نسخ الرقم المسلسل (IMEI)');
          };
        });

        tableContainer.querySelectorAll('[data-act=lookup-sn]').forEach(b => {
          b.onclick = () => openWarrantyLookupModal(b.dataset.sn);
        });

        tableContainer.querySelectorAll('[data-act=edit-sn]').forEach(b => {
          b.onclick = () => {
            const item = items.find(x => x.id === Number(b.dataset.id));
            if (item) openEditSerialModal(item);
          };
        });

        tableContainer.querySelectorAll('[data-act=del-sn]').forEach(b => {
          b.onclick = () => {
            const item = items.find(x => x.id === Number(b.dataset.id));
            if (!item) return;
            if (confirm(`هل أنت متأكد من حذف الجهاز رقم ${item.serial_number} من المخزون؟`)) {
              api('/inventory/serials/' + item.id, { method: 'DELETE' })
                .then(() => {
                  toast('تم حذف الجهاز وتحديث رصيد المخزون');
                  loadOnHand();
                })
                .catch(err => toast(err.message, 'err'));
            }
          };
        });

      } catch (err) {
        tableContainer.innerHTML = `<div style="padding:40px;text-align:center;color:var(--danger)">فشل تحميل المخزون: ${esc(err.message)}</div>`;
      }
    };

    /* =========================================================================
       2. Filter Events
       ========================================================================= */
    const applyFiltersFromUi = () => {
      filterState.q = view.querySelector('#f-q').value.trim();
      filterState.product_id = view.querySelector('#f-product').value;
      filterState.branch_id = view.querySelector('#f-branch').value;
      filterState.serial_number = view.querySelector('#f-sn').value.trim();
      filterState.condition = view.querySelector('#f-condition').value;
      filterState.color = view.querySelector('#f-color').value;
      filterState.storage = view.querySelector('#f-storage').value;
      filterState.batch_number = view.querySelector('#f-batch').value.trim();
      filterState.hide_zero = view.querySelector('#f-hide-zero').checked ? '1' : '0';
      loadOnHand();
    };

    view.querySelector('#btn-apply-filters').onclick = applyFiltersFromUi;
    view.querySelector('#f-q').onkeydown = (e) => { if (e.key === 'Enter') applyFiltersFromUi(); };
    view.querySelector('#f-sn').onkeydown = (e) => { if (e.key === 'Enter') applyFiltersFromUi(); };

    view.querySelector('#btn-reset-filters').onclick = () => {
      view.querySelector('#f-q').value = '';
      view.querySelector('#f-product').value = '';
      view.querySelector('#f-branch').value = '';
      view.querySelector('#f-sn').value = '';
      view.querySelector('#f-condition').value = '';
      view.querySelector('#f-color').value = '';
      view.querySelector('#f-storage').value = '';
      view.querySelector('#f-batch').value = '';
      view.querySelector('#f-hide-zero').checked = true;
      applyFiltersFromUi();
    };

    /* =========================================================================
       3. Display Dimensions Modal (عرض الأبعاد — Microsoft Dynamics 365)
       ========================================================================= */
    view.querySelector('#btn-dims').onclick = () => {
      modal({
        title: 'عرض الأبعاد (تخصيص أعمدة المخزون الفعلي)',
        wide: false,
        onOpen(body, close) {
          body.innerHTML = `
            <div style="font-size:.85rem;color:var(--muted);margin-bottom:14px">
              اختر الأبعاد التفصيلية التي تريد إظهارها في شاشة المخزون الفعلي للأجهزة:
            </div>

            <!-- Group 1: أبعاد المنتجات -->
            <div style="margin-bottom:16px;background:var(--bg);padding:12px 14px;border-radius:8px">
              <div style="font-weight:700;font-size:.88rem;margin-bottom:8px;color:var(--text)">أبعاد المنتجات (Product Dimensions)</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                <label style="display:flex;align-items:center;gap:8px;font-size:.85rem;cursor:pointer">
                  <input type="checkbox" id="d-sku" ${currentDims.showSku ? 'checked' : ''}>
                  <span>رقم الصنف (SKU)</span>
                </label>
                <label style="display:flex;align-items:center;gap:8px;font-size:.85rem;cursor:pointer">
                  <input type="checkbox" id="d-specs" ${currentDims.showSpecs ? 'checked' : ''}>
                  <span>التكوين (RAM & ROM)</span>
                </label>
                <label style="display:flex;align-items:center;gap:8px;font-size:.85rem;cursor:pointer">
                  <input type="checkbox" id="d-color" ${currentDims.showColor ? 'checked' : ''}>
                  <span>اللون (Color)</span>
                </label>
              </div>
            </div>

            <!-- Group 2: أبعاد التتبع -->
            <div style="margin-bottom:16px;background:var(--bg);padding:12px 14px;border-radius:8px">
              <div style="font-weight:700;font-size:.88rem;margin-bottom:8px;color:var(--text)">أبعاد التتبع (Tracking Dimensions)</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                <label style="display:flex;align-items:center;gap:8px;font-size:.85rem;cursor:pointer">
                  <input type="checkbox" id="d-sn" ${currentDims.showSn ? 'checked' : ''}>
                  <span style="font-weight:600;color:var(--primary)">الرقم المسلسل (IMEI)</span>
                </label>
                <label style="display:flex;align-items:center;gap:8px;font-size:.85rem;cursor:pointer">
                  <input type="checkbox" id="d-batch" ${currentDims.showBatch ? 'checked' : ''}>
                  <span>رقم الدفعة (Batch)</span>
                </label>
                <label style="display:flex;align-items:center;gap:8px;font-size:.85rem;cursor:pointer">
                  <input type="checkbox" id="d-condition" ${currentDims.showCondition ? 'checked' : ''}>
                  <span>حالة المخزون (جديد / ديمو)</span>
                </label>
              </div>
            </div>

            <!-- Group 3: أبعاد التخزين -->
            <div style="margin-bottom:16px;background:var(--bg);padding:12px 14px;border-radius:8px">
              <div style="font-weight:700;font-size:.88rem;margin-bottom:8px;color:var(--text)">أبعاد التخزين (Storage Dimensions)</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                <label style="display:flex;align-items:center;gap:8px;font-size:.85rem;cursor:pointer">
                  <input type="checkbox" id="d-branch" ${currentDims.showBranch ? 'checked' : ''}>
                  <span>الموقع / المستودع</span>
                </label>
                <label style="display:flex;align-items:center;gap:8px;font-size:.85rem;cursor:pointer">
                  <input type="checkbox" id="d-shelf" ${currentDims.showShelf ? 'checked' : ''}>
                  <span>المكان / الرف (Shelf Location)</span>
                </label>
              </div>
            </div>

            <!-- Group 4: الكميات والأسعار -->
            <div style="margin-bottom:16px;background:var(--bg);padding:12px 14px;border-radius:8px">
              <div style="font-weight:700;font-size:.88rem;margin-bottom:8px;color:var(--text)">الكميات والأسعار</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                <label style="display:flex;align-items:center;gap:8px;font-size:.85rem;cursor:pointer">
                  <input type="checkbox" id="d-price" ${currentDims.showPrice ? 'checked' : ''}>
                  <span>سعر البيع</span>
                </label>
                <label style="display:flex;align-items:center;gap:8px;font-size:.85rem;cursor:pointer">
                  <input type="checkbox" id="d-cost" ${currentDims.showCost ? 'checked' : ''}>
                  <span>سعر التكلفة</span>
                </label>
                <label style="display:flex;align-items:center;gap:8px;font-size:.85rem;cursor:pointer;grid-column:1/-1">
                  <input type="checkbox" id="d-hide-zero" ${currentDims.hideZero ? 'checked' : ''}>
                  <span>إخفاء الكميات الصفرية (الكمية &lt;&gt; 0)</span>
                </label>
              </div>
            </div>

            <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:12px;display:flex;align-items:center;justify-content:space-between">
              <label style="display:flex;align-items:center;gap:8px;font-size:.85rem;cursor:pointer">
                <input type="checkbox" id="d-save-pref" checked>
                <span>حفظ هذه الأبعاد كإعداد افتراضي</span>
              </label>
              <div style="display:flex;gap:8px">
                <button class="btn ghost sm" id="d-cancel">إلغاء الأمر</button>
                <button class="btn primary sm" id="d-save">موافق</button>
              </div>
            </div>
          `;

          body.querySelector('#d-cancel').onclick = close;
          body.querySelector('#d-save').onclick = () => {
            currentDims.showSku = body.querySelector('#d-sku').checked;
            currentDims.showSpecs = body.querySelector('#d-specs').checked;
            currentDims.showColor = body.querySelector('#d-color').checked;
            currentDims.showSn = body.querySelector('#d-sn').checked;
            currentDims.showBatch = body.querySelector('#d-batch').checked;
            currentDims.showCondition = body.querySelector('#d-condition').checked;
            currentDims.showBranch = body.querySelector('#d-branch').checked;
            currentDims.showShelf = body.querySelector('#d-shelf').checked;
            currentDims.showPrice = body.querySelector('#d-price').checked;
            currentDims.showCost = body.querySelector('#d-cost').checked;
            currentDims.hideZero = body.querySelector('#d-hide-zero').checked;

            if (body.querySelector('#d-save-pref').checked) {
              self.saveDims(currentDims);
            }

            filterState.hide_zero = currentDims.hideZero ? '1' : '0';
            const chkZero = view.querySelector('#f-hide-zero');
            if (chkZero) chkZero.checked = currentDims.hideZero;

            close();
            loadOnHand();
            toast('تم تطبيق تفضيلات الأبعاد');
          };
        }
      });
    };

    /* =========================================================================
       4. Bulk IMEI Scanner Modal (استلام دفعة أجهزة بالسكانر اليدوي)
       ========================================================================= */
    const openBulkScanModal = async (cachedProds, cachedBranches) => {
      let prods = cachedProds;
      let branches = cachedBranches;
      if (!prods) {
        const d = await api('/inventory/on-hand');
        prods = d.products || [];
        branches = d.branches || [];
      }

      modal({
        title: 'استلام أجهزة بالسكانر (مسح وإدخال دفعة IMEIs)',
        wide: true,
        onOpen(body, close) {
          let scannedList = [];

          body.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
              <div class="field" style="grid-column:1/-1">
                <label style="font-weight:600">اختر الصنف / الموديل *</label>
                <select id="b-product" style="width:100%;font-size:.95rem">
                  <option value="">— اختر الصنف —</option>
                  ${prods.map(p => `<option value="${p.id}" data-cost="${p.cost}" data-price="${p.price}" data-color="${esc(p.color || '')}" data-storage="${esc(p.storage || '')}" data-ram="${esc(p.ram || '')}">${esc(p.name)} (${esc(p.sku || '')})</option>`).join('')}
                </select>
              </div>

              <div class="field">
                <label>المستودع / الفرع المستلم *</label>
                <select id="b-branch" style="width:100%">
                  ${branches.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}
                </select>
              </div>

              <div class="field">
                <label>رقم الرف / المكان (Shelf Location)</label>
                <input id="b-shelf" placeholder="مثال: A-01 أو رف 4">
              </div>

              <div class="field">
                <label>اللون</label>
                <input id="b-color" placeholder="مثال: Golden Black, Blue, Titanium">
              </div>

              <div class="field">
                <label>السعة والرام</label>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
                  <input id="b-storage" placeholder="256GB">
                  <input id="b-ram" placeholder="8GB">
                </div>
              </div>

              <div class="field">
                <label>حالة الأجهزة</label>
                <select id="b-condition" style="width:100%">
                  <option value="new" selected>جديد (New)</option>
                  <option value="demo">ديمو للعرض (DEMO)</option>
                  <option value="used">مستعمل (Used)</option>
                </select>
              </div>

              <div class="field">
                <label>مدة الضمان (بالأشهر)</label>
                <input type="number" id="b-warranty" value="24">
              </div>

              <div class="field">
                <label>سعر التكلفة للجهاز (${esc(bc)})</label>
                <input type="number" step="0.01" id="b-cost" placeholder="0">
              </div>

              <div class="field">
                <label>سعر البيع المقترح (${esc(bc)})</label>
                <input type="number" step="0.01" id="b-price" placeholder="0">
              </div>
            </div>

            <!-- Scanner Box -->
            <div style="background:var(--bg);border:2px dashed var(--primary);border-radius:10px;padding:16px;margin-bottom:14px">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                <label style="font-weight:700;color:var(--primary);display:flex;align-items:center;gap:6px">
                  📱 حقل المسح الفوري بالسكانر (امسح الباركود على كرتون الجوال)
                </label>
                <span class="badge primary" id="b-scan-counter" style="font-size:.85rem">تم مسح 0 جهاز</span>
              </div>
              <div style="display:flex;gap:8px">
                <input id="b-scan-input" placeholder="امسح الباركود / الـ IMEI هنا (Enter تلقائي)..." style="font-family:monospace;font-size:1.1rem;font-weight:600;width:100%" autofocus>
                <button class="btn primary" id="b-btn-add-sn">${icon('plus')} إضافة</button>
              </div>
              <div style="margin-top:6px;font-size:.78rem;color:var(--muted)">
                * يدعم ماسح الباركود اليدوي USB / اللاسلكي مباشرة، كما يمكنك لصق أرقام متعددة تفصلها أسطر.
              </div>
            </div>

            <!-- Scanned Preview List -->
            <div style="margin-bottom:14px">
              <div style="font-size:.82rem;font-weight:600;margin-bottom:6px">قائمة السيريالات الممسوحة:</div>
              <div id="b-scanned-container" style="max-height:160px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:8px;background:var(--card);display:flex;flex-wrap:wrap;gap:6px">
                <span class="muted small" style="padding:10px">لم يتم مسح أي جهاز بعد...</span>
              </div>
            </div>

            <div style="display:flex;justify-content:flex-end;gap:10px;border-top:1px solid var(--border);padding-top:12px">
              <button class="btn ghost" id="b-cancel">إلغاء</button>
              <button class="btn primary" id="b-submit-all" style="font-weight:700">
                ${icon('check')} حفظ واستلام في المخزون
              </button>
            </div>
          `;

          const selProd = body.querySelector('#b-product');
          const scanInput = body.querySelector('#b-scan-input');
          const scanCounter = body.querySelector('#b-scan-counter');
          const scannedBox = body.querySelector('#b-scanned-container');

          // Auto-fill cost & specs when product selected
          selProd.onchange = () => {
            const opt = selProd.selectedOptions[0];
            if (!opt) return;
            if (opt.dataset.cost) body.querySelector('#b-cost').value = opt.dataset.cost;
            if (opt.dataset.price) body.querySelector('#b-price').value = opt.dataset.price;
            if (opt.dataset.color) body.querySelector('#b-color').value = opt.dataset.color;
            if (opt.dataset.storage) body.querySelector('#b-storage').value = opt.dataset.storage;
            if (opt.dataset.ram) body.querySelector('#b-ram').value = opt.dataset.ram;
            scanInput.focus();
          };

          const renderScannedTags = () => {
            scanCounter.textContent = `تم مسح ${scannedList.length} جهاز`;
            if (scannedList.length === 0) {
              scannedBox.innerHTML = '<span class="muted small" style="padding:10px">لم يتم مسح أي جهاز بعد...</span>';
              return;
            }
            scannedBox.innerHTML = scannedList.map((sn, idx) => `
              <span class="badge" style="background:var(--bg);border:1px solid var(--border);display:inline-flex;align-items:center;gap:6px;font-family:monospace;padding:4px 8px">
                <b>#${idx + 1}</b> ${esc(sn)}
                <span data-del="${idx}" style="cursor:pointer;color:var(--danger);font-weight:bold">&times;</span>
              </span>
            `).join('');

            scannedBox.querySelectorAll('[data-del]').forEach(el => {
              el.onclick = () => {
                const idx = Number(el.dataset.del);
                scannedList.splice(idx, 1);
                renderScannedTags();
              };
            });
          };

          const addSnFromInput = () => {
            const raw = scanInput.value.trim();
            if (!raw) return;
            const items = raw.split(/[\r\n,;\t]+/).map(s => s.trim()).filter(Boolean);
            let added = 0;
            for (const item of items) {
              if (!scannedList.includes(item)) {
                scannedList.push(item);
                added++;
              }
            }
            scanInput.value = '';
            renderScannedTags();
            scanInput.focus();
          };

          body.querySelector('#b-btn-add-sn').onclick = addSnFromInput;
          scanInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addSnFromInput();
            }
          };

          body.querySelector('#b-cancel').onclick = close;

          body.querySelector('#b-submit-all').onclick = async () => {
            const productId = selProd.value;
            if (!productId) return toast('يرجى اختيار الصنف أولاً', 'err');
            if (scannedList.length === 0) return toast('يرجى مسح رقم تسلسلي (IMEI) واحد على الأقل', 'err');

            const payload = {
              product_id: productId,
              branch_id: body.querySelector('#b-branch').value,
              serials: scannedList,
              shelf_location: body.querySelector('#b-shelf').value.trim(),
              color: body.querySelector('#b-color').value.trim(),
              storage: body.querySelector('#b-storage').value.trim(),
              ram: body.querySelector('#b-ram').value.trim(),
              condition: body.querySelector('#b-condition').value,
              warranty_months: body.querySelector('#b-warranty').value,
              cost: body.querySelector('#b-cost').value,
              price: body.querySelector('#b-price').value,
            };

            try {
              const res = await api('/inventory/serials/bulk', { method: 'POST', body: payload });
              toast(`تم استلام وإدخال ${res.added_count} جهاز بنجاح في المخزون!`);
              close();
              loadOnHand();
            } catch (err) {
              toast(err.message || 'حدث خطأ أثناء حفظ الأجهزة', 'err');
            }
          };
        }
      });
    };

    view.querySelector('#btn-bulk-scan').onclick = () => openBulkScanModal();

    /* =========================================================================
       5. IMEI & Warranty Lookup Modal (فحص السيريال واستعلام الضمان)
       ========================================================================= */
    const openWarrantyLookupModal = (initialSn = '') => {
      modal({
        title: 'فحص سيريال الجهاز وتتبع الضمان (IMEI Lookup)',
        wide: false,
        onOpen(body, close) {
          body.innerHTML = `
            <div style="margin-bottom:14px">
              <label style="font-weight:600;display:block;margin-bottom:6px">امسح أو اكتب الرقم المسلسل (IMEI):</label>
              <div style="display:flex;gap:8px">
                <input id="w-sn-input" placeholder="مثال: 8636110871082364" value="${esc(initialSn)}" style="font-family:monospace;font-size:1.1rem;font-weight:600;width:100%" autofocus>
                <button class="btn primary" id="w-btn-search">${icon('search')} فحص</button>
              </div>
            </div>
            <div id="w-result-area" style="min-height:120px">
              <div style="padding:20px;text-align:center;color:var(--muted)">
                أدخل رقم السيريال واضغط فحص لعرض بيانات الجهاز وسجل المبيعات والضمان.
              </div>
            </div>
          `;

          const input = body.querySelector('#w-sn-input');
          const resArea = body.querySelector('#w-result-area');

          const doSearch = async () => {
            const sn = input.value.trim();
            if (!sn) return;
            resArea.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted)">جاري البحث...</div>';
            try {
              const data = await api('/inventory/serials/lookup/' + encodeURIComponent(sn));
              const s = data.serial;
              const w = data.warranty;

              let statusBadge = '<span class="badge green">متاح في المخزون</span>';
              if (s.status === 'sold') statusBadge = '<span class="badge gray">تم بيعه</span>';
              else if (s.condition === 'demo') statusBadge = '<span class="badge amber">جهاز عرض (DEMO)</span>';

              let warrantyBadge = w.status === 'active'
                ? `<span class="badge green" style="font-size:.9rem;padding:4px 10px">ساري المفعول (متبقي ${w.remaining_days} يوم)</span>`
                : `<span class="badge red" style="font-size:.9rem;padding:4px 10px">منتهي الضمان</span>`;

              resArea.innerHTML = `
                <div style="background:var(--bg);border-radius:10px;padding:14px;border:1px solid var(--border)">
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
                    <span style="font-weight:700;font-size:1.1rem">${esc(s.product_name)}</span>
                    ${statusBadge}
                  </div>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:.85rem;margin-bottom:12px">
                    <div><b>الرقم المسلسل:</b> <span class="mono">${esc(s.serial_number)}</span></div>
                    <div><b>كود الصنف:</b> <span class="mono">${esc(s.product_sku || '—')}</span></div>
                    <div><b>اللون والسعة:</b> ${esc(s.color || '')} ${esc(s.storage || '')}</div>
                    <div><b>الفرع والرف:</b> ${esc(s.branch_name || 'الرئيسي')} (${esc(s.shelf_location || 'بدون رف')})</div>
                    <div><b>سعر البيع:</b> ${fmtMoney(s.price, bc)}</div>
                    <div><b>سعر التكلفة:</b> ${fmtMoney(s.cost, bc)}</div>
                  </div>

                  <div style="border-top:1px solid var(--border);padding-top:10px;margin-top:10px">
                    <div style="font-weight:700;font-size:.85rem;margin-bottom:6px">حالة الضمان (Warranty):</div>
                    <div style="display:flex;align-items:center;justify-content:space-between">
                      ${warrantyBadge}
                      <span class="muted small">${w.expiry_date ? `ينتهي بتاريخ: ${w.expiry_date}` : ''}</span>
                    </div>
                  </div>

                  ${s.invoice_number ? `
                    <div style="border-top:1px solid var(--border);padding-top:10px;margin-top:10px;font-size:.85rem">
                      <div style="font-weight:700;margin-bottom:4px">بيانات البيع:</div>
                      <div>فاتورة رقم: <b>${esc(s.invoice_number)}</b> (${esc(s.invoice_date || '')})</div>
                      ${s.customer_name ? `<div>العميل: <b>${esc(s.customer_name)}</b> (${esc(s.customer_phone || '')})</div>` : ''}
                    </div>
                  ` : ''}
                </div>
              `;
            } catch (err) {
              resArea.innerHTML = `<div style="padding:20px;text-align:center;color:var(--danger)">لم يتم العثور على جهاز بهذا الرقم المسلسل (${esc(sn)})</div>`;
            }
          };

          body.querySelector('#w-btn-search').onclick = doSearch;
          input.onkeydown = (e) => { if (e.key === 'Enter') doSearch(); };
          if (initialSn) doSearch();
        }
      });
    };

    view.querySelector('#btn-warranty-lookup').onclick = () => openWarrantyLookupModal();

    /* =========================================================================
       6. Edit Single Serial Modal (تعديل الرف والحالة)
       ========================================================================= */
    const openEditSerialModal = (item) => {
      modal({
        title: `تعديل بيانات الجهاز — ${esc(item.serial_number)}`,
        onOpen(body, close) {
          body.innerHTML = `
            <div class="form-grid">
              <div class="field"><label>الصنف</label><input value="${esc(item.product_name)}" disabled></div>
              <div class="field"><label>السيريال (IMEI)</label><input value="${esc(item.serial_number)}" disabled class="mono"></div>
              <div class="field">
                <label>المكان / الرف (Shelf Location)</label>
                <input id="es-shelf" value="${esc(item.shelf_location || '')}">
              </div>
              <div class="field">
                <label>حالة الجهاز</label>
                <select id="es-condition">
                  <option value="new" ${item.condition === 'new' ? 'selected' : ''}>جديد (New)</option>
                  <option value="demo" ${item.condition === 'demo' ? 'selected' : ''}>ديمو للعرض (DEMO)</option>
                  <option value="used" ${item.condition === 'used' ? 'selected' : ''}>مستعمل (Used)</option>
                  <option value="maintenance" ${item.condition === 'maintenance' ? 'selected' : ''}>صيانة (RMA)</option>
                </select>
              </div>
              <div class="field"><label>سعر البيع (${esc(bc)})</label><input type="number" step="0.01" id="es-price" value="${item.price || ''}"></div>
              <div class="field"><label>سعر التكلفة (${esc(bc)})</label><input type="number" step="0.01" id="es-cost" value="${item.cost || ''}"></div>
              <div class="field" style="grid-column:1/-1"><label>ملاحظات</label><input id="es-notes" value="${esc(item.notes || '')}"></div>
            </div>
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px">
              <button class="btn ghost" id="es-cancel">إلغاء</button>
              <button class="btn primary" id="es-save">${icon('check')} حفظ التعديلات</button>
            </div>
          `;

          body.querySelector('#es-cancel').onclick = close;
          body.querySelector('#es-save').onclick = async () => {
            const payload = {
              shelf_location: body.querySelector('#es-shelf').value.trim(),
              condition: body.querySelector('#es-condition').value,
              price: body.querySelector('#es-price').value,
              cost: body.querySelector('#es-cost').value,
              notes: body.querySelector('#es-notes').value.trim(),
            };
            try {
              await api('/inventory/serials/' + item.id, { method: 'PUT', body: payload });
              toast('تم تحديث بيانات الجهاز');
              close();
              loadOnHand();
            } catch (err) {
              toast(err.message, 'err');
            }
          };
        }
      });
    };

    /* =========================================================================
       7. Add New Product / Phone Model Modal
       ========================================================================= */
    const openNewProductModal = () => {
      modal({
        title: 'إضافة صنف / موديل جوال جديد',
        wide: true,
        onOpen(body, close) {
          body.innerHTML = `
            <div class="form-grid">
              <div class="field"><label>اسم الصنف والموديل (إنجليزي) *</label><input id="np-name" placeholder="Huawei Nova 15 Pro 12+512"></div>
              <div class="field"><label>اسم الصنف (عربي)</label><input id="np-name-ar" placeholder="هواوي نوفا 15 برو"></div>
              <div class="field"><label>كود الصنف (SKU) *</label><input id="np-sku" placeholder="HU-N15P-12-512"></div>
              <div class="field"><label>الماركة (Brand)</label><input id="np-brand" placeholder="Huawei, Apple, Samsung"></div>
              <div class="field"><label>الفئة</label><input id="np-cat" value="جوالات"></div>
              <div class="field"><label>اللون الافتراضي</label><input id="np-color" placeholder="Black, Titanium, Blue"></div>
              <div class="field"><label>سعة التخزين</label><input id="np-storage" placeholder="256GB, 512GB"></div>
              <div class="field"><label>الرام</label><input id="np-ram" placeholder="8GB, 12GB"></div>
              <div class="field"><label>سعر التكلفة (${esc(bc)})</label><input type="number" step="0.01" id="np-cost" placeholder="0"></div>
              <div class="field"><label>سعر البيع (${esc(bc)})</label><input type="number" step="0.01" id="np-price" placeholder="0"></div>
              <div class="field"><label>حد إعادة الطلب</label><input type="number" id="np-reorder" value="5"></div>
            </div>
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px">
              <button class="btn ghost" id="np-cancel">إلغاء</button>
              <button class="btn primary" id="np-save">${icon('check')} حفظ الصنف</button>
            </div>
          `;

          body.querySelector('#np-cancel').onclick = close;
          body.querySelector('#np-save').onclick = async () => {
            const name = body.querySelector('#np-name').value.trim();
            const sku = body.querySelector('#np-sku').value.trim();
            if (!name) return toast('يرجى كتابة اسم الصنف', 'err');

            const payload = {
              name,
              name_ar: body.querySelector('#np-name-ar').value.trim(),
              sku,
              brand: body.querySelector('#np-brand').value.trim(),
              category: body.querySelector('#np-cat').value.trim(),
              color: body.querySelector('#np-color').value.trim(),
              storage: body.querySelector('#np-storage').value.trim(),
              ram: body.querySelector('#np-ram').value.trim(),
              cost: Number(body.querySelector('#np-cost').value) || 0,
              price: Number(body.querySelector('#np-price').value) || 0,
              reorder_level: Number(body.querySelector('#np-reorder').value) || 5,
              unit: 'pcs',
              stock: 0,
            };

            try {
              await api('/products', { method: 'POST', body: payload });
              toast('تم إضافة الموديل بنجاح');
              close();
              loadOnHand();
            } catch (err) {
              toast(err.message, 'err');
            }
          };
        }
      });
    };

    view.querySelector('#btn-new-item').onclick = openNewProductModal;

    /* =========================================================================
       8. Tab Switcher
       ========================================================================= */
    const tabOnHand = view.querySelector('#tab-onhand');
    const tabProducts = view.querySelector('#tab-products');

    tabOnHand.onclick = () => {
      activeTab = 'on_hand';
      tabOnHand.style.background = 'var(--primary)';
      tabOnHand.style.color = '#fff';
      tabProducts.style.background = 'transparent';
      tabProducts.style.color = 'var(--text)';
      sideFilters.style.display = showFilters ? 'block' : 'none';
      mainLayout.style.gridTemplateColumns = showFilters ? '280px 1fr' : '1fr';
      loadOnHand();
    };

    tabProducts.onclick = async () => {
      activeTab = 'products';
      tabProducts.style.background = 'var(--primary)';
      tabProducts.style.color = '#fff';
      tabOnHand.style.background = 'transparent';
      tabOnHand.style.color = 'var(--text)';
      sideFilters.style.display = 'none';
      mainLayout.style.gridTemplateColumns = '1fr';

      // Load products summary
      tableContainer.innerHTML = `<div style="padding:40px;text-align:center;color:var(--muted)">جاري تحميل قائمة الأصناف...</div>`;
      try {
        const { products } = await api('/inventory/summary');
        tableContainer.innerHTML = `
          <table class="tbl" style="width:100%">
            <thead><tr>
              <th>الموديل والصنف</th>
              <th>كود الصنف (SKU)</th>
              <th>الفئة</th>
              <th class="num">التكلفة</th>
              <th class="num">سعر البيع</th>
              <th class="num">إجمالي الرصيد</th>
              <th class="num">حد الطلب</th>
              <th>الحالة</th>
            </tr></thead>
            <tbody>
              ${products.map(p => `
                <tr>
                  <td><b>${esc(p.name)}</b>${p.name_ar ? `<br><span class="muted small">${esc(p.name_ar)}</span>` : ''}</td>
                  <td class="mono muted">${esc(p.sku || '—')}</td>
                  <td><span class="badge primary">${esc(p.category || '—')}</span></td>
                  <td class="money">${fmtMoney(p.cost, bc)}</td>
                  <td class="money"><b>${fmtMoney(p.price, bc)}</b></td>
                  <td class="num"><span class="badge ${p.stock <= 0 ? 'red' : p.low ? 'amber' : 'green'}">${fmtNum(p.stock, 0)} ${esc(p.unit)}</span></td>
                  <td class="num muted">${fmtNum(p.reorder_level, 0)}</td>
                  <td>${p.is_active ? '<span class="badge green">نشط</span>' : '<span class="badge gray">معطل</span>'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      } catch (e) {
        tableContainer.innerHTML = `<div style="padding:40px;text-align:center;color:var(--danger)">خطأ: ${esc(e.message)}</div>`;
      }
    };

    // Initial load
    loadOnHand();
  }
};
