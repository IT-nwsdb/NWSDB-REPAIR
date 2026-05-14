/* =========================
   DEV.OPTN (Custom Locations)
   ========================= */
function renderCustomLocationsList() {
  const tbody = document.getElementById('customLocationsBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!customLocations.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No custom locations added yet.</td></tr>`;
    return;
  }

  customLocations.forEach(loc => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${e(loc.region || '')}</td>
      <td>${e(loc.section || '')}</td>
      <td>${e(loc.costCenter || '')}</td>
      <td>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteCustomLocation('${e(loc.id)}')">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function addCustomLocation() {
  const region = (document.getElementById('devRegionInput')?.value || '').trim();
  const section = (document.getElementById('devSectionInput')?.value || '').trim();
  const costCenter = (document.getElementById('devCostCenterInput')?.value || '').trim();

  if (!region || !section || !costCenter) {
    alert('Please fill region, office/section, and cost center.');
    return;
  }

  // Prevent duplicate region+section combo in customLocations
  const dup = customLocations.find(c => c.region.toLowerCase() === region.toLowerCase() && c.section.toLowerCase() === section.toLowerCase());
  if (dup) {
    if (!confirm('This region + section already exists in custom locations. Update cost center?')) return;
    db.collection('customLocations').doc(dup.id).update({
      costCenter,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
      alert('Custom location updated.');
      (document.getElementById('customLocationForm'))?.reset();
      populateRegionDatalist();
    }).catch(err => {
      console.error('Error updating custom location:', err);
      alert('Error updating. Please try again.');
    });
    return;
  }

  db.collection('customLocations').add({
    region,
    section,
    costCenter,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    alert('Custom location added.');
    (document.getElementById('customLocationForm'))?.reset();
    populateRegionDatalist();
  }).catch(err => {
    console.error('Error adding custom location:', err);
    alert('Error adding. Please try again.');
  });
}

function deleteCustomLocation(id) {
  if (!id) return;
  if (!confirm('Delete this custom location?')) return;
  db.collection('customLocations').doc(id).delete().catch(err => {
    console.error('Error deleting custom location:', err);
    alert('Error deleting. Please try again.');
  });
}

/* =========================
   Received Items: add
   ========================= */
function addReceivedItem() {
  try {
    const nameSel = document.getElementById('receivedItemName');
    const otherName = (document.getElementById('otherItemName')?.value || '').trim();
    let itemName = nameSel?.value || '';
    if (!itemName) return alert('Please select an item name');
    if (itemName === 'other') {
      if (!otherName) return alert('Please enter the other item name');
      itemName = otherName;
    }

    const primarySerial = (document.getElementById('receivedItemSerial')?.value || '').trim();
    const invoiceNumber = (document.getElementById('receivedItemInvoice')?.value || '').trim();
    const fileNumber = (document.getElementById('receivedItemFileNumber')?.value || '').trim();
    const poNumber = (document.getElementById('receivedItemPONumber')?.value || '').trim();
    const warrantyPeriod = parseInt(document.getElementById('receivedItemWarranty')?.value || '0', 10) || 0;
    const supplier = (document.getElementById('receivedItemSupplier')?.value || '').trim();
    const unitPrice = parseFloat(document.getElementById('receivedItemPrice')?.value || '0') || 0;
    const quantity = parseInt(document.getElementById('receivedItemQuantity')?.value || '1', 10) || 1;

    const capacityField = document.getElementById('receivedItemCapacity');
    const rawItemNameLower = itemName.toLowerCase();
    const capacityApplies = ['ram', 'hard disk', 'ssd'].includes(rawItemNameLower);
    const capacity = capacityApplies ? (parseInt(capacityField?.value || '0', 10) || null) : null;

    if (!primarySerial) return alert('Please enter the primary serial number');
    if (!invoiceNumber) return alert('Please enter the invoice number');
    if (!supplier) return alert('Please enter the supplier');
    if (unitPrice <= 0) return alert('Please enter a valid unit price');
    if (quantity < 1) return alert('Quantity must be at least 1');
    if (capacityApplies && !capacity) return alert('Please enter storage capacity (GB)');

    const serials = [primarySerial];
    const extraInputs = document.querySelectorAll('#additionalSerialNumbers .serial-number-input input');
    extraInputs.forEach(inp => {
      const v = (inp.value || '').trim();
      if (v) serials.push(v);
    });

    if (quantity > 1) {
      const uniqueSerials = Array.from(new Set(serials));
      if (uniqueSerials.length !== quantity) {
        return alert(`Please enter exactly ${quantity} unique serial numbers (you entered ${uniqueSerials.length}).`);
      }
    }

    const payload = {
      itemName: rawItemNameLower,
      capacity: capacityApplies ? capacity : null,
      invoiceNumber,
      fileNumber,
      poNumber,
      warrantyPeriod,
      supplier,
      unitPrice,
      quantity,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (quantity > 1) {
      payload.serialNumbers = serials;
    } else {
      payload.newSerial = primarySerial;
    }

    db.collection('receivedItems').add(payload)
      .then(() => {
        alert('Received item added successfully!');
        const form = document.getElementById('receivedItemForm');
        form?.reset();
        const addWrap = document.getElementById('additionalSerialNumbers');
        if (addWrap) addWrap.innerHTML = '';
        const serialWrap = document.getElementById('serialNumbersContainer');
        if (serialWrap) serialWrap.style.display = 'none';
        const capFieldWrap = document.getElementById('storageCapacityField');
        if (capFieldWrap) capFieldWrap.style.display = 'none';
      })
      .catch(err => {
        console.error('Error adding received item:', err);
        alert('Error adding item. Please try again.');
      });
  } catch (e) {
    console.error('addReceivedItem() failed:', e);
    alert('Something went wrong. Please try again.');
  }
}

// Misc helpers
function initializeItemReceivedCheckboxes() {
  const mainCheckbox = document.querySelector('.item-received-check');
  if (mainCheckbox) {
    mainCheckbox.addEventListener('change', function () {
      const isChecked = this.checked;
      const container = this.closest('.row').parentElement;

      container.querySelector('.repair-new-serial').disabled = !isChecked;
      container.querySelector('.repair-unit-price').disabled = !isChecked;
      container.querySelector('.repair-quantity').disabled = !isChecked;

      container.querySelector('.repair-total-price').removeAttribute('disabled');

      if (!isChecked) {
        container.querySelector('.repair-new-serial').value = '';
        container.querySelector('.repair-unit-price').value = '';
        container.querySelector('.repair-quantity').value = '1';
        container.querySelector('.repair-total-price').value = '';
      }
    });
  }

  const unitPriceInputs = document.querySelectorAll('.repair-unit-price');
  const quantityInputs = document.querySelectorAll('.repair-quantity');

  unitPriceInputs.forEach(input => input.addEventListener('input', () => calculateRepairTotal(input)));
  quantityInputs.forEach(input => input.addEventListener('input', () => calculateRepairTotal(input)));
}

function calculateRepairTotal(input) {
  const container = input.closest('.row').parentElement;
  const unitPrice = parseFloat(container.querySelector('.repair-unit-price').value) || 0;
  const quantity = parseInt(container.querySelector('.repair-quantity').value) || 1;
  container.querySelector('.repair-total-price').value = (unitPrice * quantity).toFixed(2);
}

function bindRepairItemSelectToggles(root) {
  const scope = root || document;
  const selects = scope.querySelectorAll('.repair-item-select');
  selects.forEach(sel => {
    if (sel.dataset.bound === '1') return;
    sel.addEventListener('change', function () {
      let otherWrap = this.closest('.col-md-6')?.querySelector('.repair-other-item-input');
      if (!otherWrap) {
        otherWrap = this.parentElement.querySelector('.repair-other-item-input');
      }
      if (otherWrap) {
        otherWrap.style.display = this.value === 'other' ? 'block' : 'none';
      }
    });
    sel.dataset.bound = '1';
  });
}

// ====== Login overlay + sequence ======
function showAuthOverlay() {
  const ov = document.getElementById('authOverlay');
  if (!ov) return;
  resetAuthOverlay();
  ov.classList.add('show');
}

function hideAuthOverlay() {
  const ov = document.getElementById('authOverlay');
  if (!ov) return;
  ov.classList.remove('show');
}

function resetAuthOverlay() {
  const steps = document.querySelectorAll('#authSteps .auth-step');
  steps.forEach(li => {
    li.classList.remove('active', 'done', 'fail');
    const iconSpin = li.querySelector('.icon-pending');
    const iconDone = li.querySelector('.icon-done');
    const iconFail = li.querySelector('.icon-fail');
    if (iconSpin) iconSpin.classList.add('d-none');
    if (iconDone) iconDone.classList.add('d-none');
    if (iconFail) iconFail.classList.add('d-none');
  });
  setAuthStep(1, 'active');
  setProgress(0);
}

function setProgress(pct) {
  const bar = document.getElementById('authProgress');
  if (bar) bar.style.width = Math.max(0, Math.min(100, pct)) + '%';
}

function setAuthStep(stepNumber, state) {
  const li = document.querySelector(`#authSteps .auth-step[data-step="${stepNumber}"]`);
  if (!li) return;
  const iconSpin = li.querySelector('.icon-pending');
  const iconDone = li.querySelector('.icon-done');
  const iconFail = li.querySelector('.icon-fail');

  li.classList.remove('active', 'done', 'fail');
  if (iconSpin) iconSpin.classList.add('d-none');
  if (iconDone) iconDone.classList.add('d-none');
  if (iconFail) iconFail.classList.add('d-none');

  if (state === 'active') {
    li.classList.add('active');
    if (iconSpin) iconSpin.classList.remove('d-none');
  } else if (state === 'done') {
    li.classList.add('done');
    if (iconDone) iconDone.classList.remove('d-none');
  } else if (state === 'fail') {
    li.classList.add('fail');
    if (iconFail) iconFail.classList.remove('d-none');
  }
}

function wait(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function pingFirestore(timeoutMs = 1500) {
  const p = db.collection('_ping').limit(1).get();
  const t = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs));
  return Promise.race([p, t]).catch(err => { throw err; });
}

async function waitForDataReady(timeoutMs = 2500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (dataReady.repairs && dataReady.received && dataReady.approvals) return true;
    await wait(100);
  }
  return false;
}

async function runLoginAnimationSequence() {
  showAuthOverlay();

  // Step 1: Authenticating
  setAuthStep(1, 'active');
  setProgress(12);
  await wait(450);
  setAuthStep(1, 'done');

  // Step 2: Secure session
  setAuthStep(2, 'active');
  setProgress(28);
  await wait(400);
  setAuthStep(2, 'done');

  // Step 3: Connect DB
  setAuthStep(3, 'active');
  setProgress(45);
  let dbOk = true;
  try {
    await pingFirestore(1500);
  } catch (e) {
    dbOk = false;
  }
  setAuthStep(3, dbOk ? 'done' : 'fail');
  setProgress(60);

  // Step 4: Sync data (wait for first snapshots or timeout)
  setAuthStep(4, 'active');
  const ready = await waitForDataReady(2500);
  setAuthStep(4, ready ? 'done' : 'done'); // mark done either way (we have fallback UI)
  setProgress(85);

  // Step 5: Prepare UI
  setAuthStep(5, 'active');
  await wait(350);
  setAuthStep(5, 'done');
  setProgress(100);

  await wait(350);
  hideAuthOverlay();
}

function handleLogin() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  if (admins[username] && admins[username].password === password) {
    currentUser = username;
    runLoginAnimationSequence()
      .then(() => loginSuccess())
      .catch(() => loginSuccess()); // even if animation hiccups, continue
  } else {
    alert('Invalid credentials. Please try again.');
  }
}

function loginSuccess() {
  document.getElementById('login').classList.remove('active');
  document.body.classList.remove('login-page');

  document.getElementById('repairDashboard').classList.add('active');

  // Existing admin labels
  document.getElementById('currentAdmin').textContent = admins[currentUser].name;
  const rAdmin = document.getElementById('receivedItemsAdmin');
  const cAdmin = document.getElementById('committeeAdmin');
  if (rAdmin) rAdmin.textContent = admins[currentUser].name;
  if (cAdmin) cAdmin.textContent = admins[currentUser].name;

  // Sidebar admin name
  const sAdmin = document.getElementById('sidebarCurrentAdmin');
  if (sAdmin) sAdmin.textContent = admins[currentUser].name;

  // Highlight Dashboard
  setActiveSidebar('repairDashboard');

  // Initial loads
  populateRegionSelects();
  populateUpcomingReturns();
  populateAllRepairs();
  populateReceivedItems();
  populatePreviousApprovals();
}

function logout() {
  currentUser = null;
  const active = document.querySelector('.page.active');
  if (active) active.classList.remove('active');
  document.getElementById('login').classList.add('active');
  document.body.classList.add('login-page');
  document.getElementById('loginForm').reset();
}

// Sidebar: set active highlight
function setActiveSidebar(targetId) {
  const buttons = document.querySelectorAll('#appSidebar .nav-btn');
  buttons.forEach(btn => btn.classList.remove('active'));
  const btn = Array.from(buttons).find(b => b.dataset.target === targetId);
  if (btn) btn.classList.add('active');
}

// Sidebar: init left menu navigation
function initSidebarNav() {
  const sidebar = document.getElementById('appSidebar');
  if (!sidebar) return;

  sidebar.addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-btn');
    if (!btn) return;
    const target = btn.dataset.target;
    if (target) showPage(target);
  });

  const logoutBtn = document.getElementById('sidebarLogout');
  if (logoutBtn) logoutBtn.addEventListener('click', () => logout());
}

function showPage(pageId) {
  const active = document.querySelector('.page.active');
  if (active) active.classList.remove('active');
  document.getElementById(pageId).classList.add('active');

  // Update sidebar highlight
  setActiveSidebar(pageId);

  // Existing per-page init
  if (pageId === 'repairDashboard') {
    populateRegionSelects();
    populateUpcomingReturns();
    populateAllRepairs();
  } else if (pageId === 'receivedItemsPage') {
    populateReceivedItems();
  } else if (pageId === 'committeeApprovalPage') {
    populateRegionSelects();
    populatePreviousApprovals();
    populateApprovalJobCardOptions();
  } else if (pageId === 'jobCardListPage') {
    populateJobCardList();
  } else if (pageId === 'jobCardHistoryPage') {
    const y = new Date().getFullYear();
    const input = document.getElementById('jobCardSearchInput');
    if (input && !input.value) input.value = `RSC/${y}/`;
  } else if (pageId === 'devOptionsPage') {
    populateRegionDatalist();
    renderCustomLocationsList();
  }
}

function setDefaultDates() {
  const today = new Date().toISOString().split('T')[0];
  const serviceDateEl = document.getElementById('repairServiceDate');
  const approvalDateEl = document.getElementById('approvalDate');
  if (serviceDateEl) serviceDateEl.value = today;
  if (approvalDateEl) approvalDateEl.value = today;

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const returnDateEl = document.getElementById('repairReturnDate');
  if (returnDateEl) returnDateEl.value = nextWeek.toISOString().split('T')[0];
}

// File Tracking Search
function searchFileTracking() {
  const q = (document.getElementById('fileTrackingSearchInput')?.value || '').trim();
  if (!q) return;
  const qLower = q.toLowerCase();
  const resultDiv = document.getElementById('fileTrackingSearchResult');
  if (resultDiv) resultDiv.textContent = 'Searching...';

  let candidate = null;

  if (receivedItems.length) {
    const matches = receivedItems.filter(it => String(it.fileNumber || '').toLowerCase() === qLower);
    if (matches.length) {
      matches.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
      candidate = matches[0];
    }
  }

  if (!candidate) {
    outer: for (const r of repairs) {
      for (const it of (r.items || [])) {
        if (it.fileNumber && String(it.fileNumber).toLowerCase() === qLower) {
          candidate = it;
          break outer;
        }
      }
    }
  }

  if (!candidate) {
    if (resultDiv) resultDiv.innerHTML = '<div class="text-danger">No data found for this file number.</div>';
    return;
  }

  const po = candidate.poNumber || '-';
  const invNo = candidate.invoiceNumber || '-';
  const url = candidate.invoiceUrl || candidate.invoice_url || null;

  let invoiceHtml = e(invNo);
  if (url) {
    const isImg = /\.(png|jpe?g|gif|webp)$/i.test(url);
    invoiceHtml += ` - ${isImg
      ? `<div><img src="${e(url)}" alt="Invoice" style="max-width:320px; border:1px solid #eee; margin-top:6px"></div>`
      : `<a href="${e(url)}" target="_blank" rel="noopener">Open invoice</a>`}`;
  }

  if (resultDiv) {
    resultDiv.innerHTML = `
      <div><strong>PO Number:</strong> ${e(po)}</div>
      <div><strong>Invoice:</strong> ${invoiceHtml}</div>
    `;
  }
}

/* =========================
   EDIT REPAIR: open + save
   ========================= */

// Build one editable item row (re-uses same classes as main/additional items)
function addEditItem(prefill = null) {
  const container = document.getElementById('editRepairItemsContainer');
  if (!container) return;

  const count = container.querySelectorAll('.edit-item').length + 1;
  const rowId = `edit-item-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const wrapper = document.createElement('div');
  wrapper.className = 'edit-item mb-3';
  wrapper.id = rowId;

  wrapper.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-2">
      <h6 class="mb-0">Item #${count}</h6>
      <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeEditItem('${rowId}')">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="edit-item-content">
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label">Item Replaced</label>
          <select class="form-select repair-item-select">
            <option value="" selected disabled>Select Item</option>
            <option value="ram">RAM</option>
            <option value="hard disk">Hard Disk</option>
            <option value="ssd">SSD</option>
            <option value="motherboard">Motherboard</option>
            <option value="battery">Battery</option>
            <option value="power supply">Power Supply</option>
            <option value="graphic card">Graphic Card</option>
            <option value="other">Other</option>
          </select>
          <div class="repair-other-item-input mt-2" style="display: none;">
            <input type="text" class="form-control" placeholder="Enter item name">
          </div>
          <button type="button" class="btn btn-sm btn-link mt-1" onclick="showReceivedItemsModal(this)">
            <i class="fas fa-search me-1"></i> Select from received items
          </button>
        </div>
        <div class="col-md-6">
          <div class="form-check mb-3">
            <input class="form-check-input item-received-check" type="checkbox">
            <label class="form-check-label">Item has been received</label>
          </div>
        </div>
        <div class="col-md-6">
          <label class="form-label">New Serial Number</label>
          <select class="form-select repair-new-serial" disabled>
            <option value="" selected disabled>Select Serial Number</option>
          </select>
        </div>
        <div class="col-md-6">
          <label class="form-label">Old Serial Number</label>
          <input type="text" class="form-control repair-old-serial">
        </div>
        <div class="col-md-6">
          <label class="form-label">Unit Price (Rs)</label>
          <input type="number" class="form-control repair-unit-price" min="0" step="0.01" disabled>
        </div>
        <div class="col-md-6">
          <label class="form-label">Quantity</label>
          <input type="number" class="form-control repair-quantity" min="1" value="1" disabled>
        </div>
        <div class="col-md-6">
          <label class="form-label">Total Price (Rs)</label>
          <input type="text" class="form-control repair-total-price" readonly>
        </div>
      </div>
    </div>
  `;

  container.appendChild(wrapper);

  // Bind select toggles
  bindRepairItemSelectToggles(wrapper);

  // Bind checkbox to enable/disable fields
  const chk = wrapper.querySelector('.item-received-check');
  const unitInput = wrapper.querySelector('.repair-unit-price');
  const qtyInput = wrapper.querySelector('.repair-quantity');

  chk.addEventListener('change', function () {
    const isChecked = this.checked;
    const content = wrapper.querySelector('.edit-item-content');
    content.querySelector('.repair-new-serial').disabled = !isChecked;
    content.querySelector('.repair-unit-price').disabled = !isChecked;
    content.querySelector('.repair-quantity').disabled = !isChecked;
    content.querySelector('.repair-total-price').removeAttribute('disabled');

    if (!isChecked) {
      content.querySelector('.repair-new-serial').value = '';
      content.querySelector('.repair-unit-price').value = '';
      content.querySelector('.repair-quantity').value = '1';
      content.querySelector('.repair-total-price').value = '';
    } else {
      // Ensure total reflects values
      calculateRepairTotal(unitInput || qtyInput);
    }
  });

  // Bind total calc
  unitInput.addEventListener('input', () => calculateRepairTotal(unitInput));
  qtyInput.addEventListener('input', () => calculateRepairTotal(qtyInput));

  // Prefill (if editing an existing item)
  if (prefill) {
    const itemNameRaw = (prefill.itemReplaced || prefill.itemName || '').toLowerCase().trim();
    const itemSelect = wrapper.querySelector('.repair-item-select');
    const options = Array.from(itemSelect.options).map(o => o.value);
    if (options.includes(itemNameRaw) && itemNameRaw !== '') {
      itemSelect.value = itemNameRaw;
    } else if (itemNameRaw) {
      itemSelect.value = 'other';
      const otherWrap = wrapper.querySelector('.repair-other-item-input');
      const otherInput = otherWrap.querySelector('input');
      otherWrap.style.display = 'block';
      otherInput.value = prefill.itemReplaced || prefill.itemName || '';
    }

    // Received + enable fields accordingly
    chk.checked = !!prefill.itemReceived;
    chk.dispatchEvent(new Event('change'));

    // Serial
    const serialSel = wrapper.querySelector('.repair-new-serial');
    serialSel.innerHTML = '<option value="" disabled>Select Serial Number</option>';
    if (prefill.newSerial) {
      const opt = document.createElement('option');
      opt.value = prefill.newSerial;
      opt.textContent = prefill.newSerial;
      serialSel.appendChild(opt);
      serialSel.value = prefill.newSerial;
    }

    // Old serial
    wrapper.querySelector('.repair-old-serial').value = prefill.oldSerial || '';

    // Prices
    if (prefill.unitPrice != null && prefill.unitPrice !== '') {
      wrapper.querySelector('.repair-unit-price').value = prefill.unitPrice;
    }
    wrapper.querySelector('.repair-quantity').value = prefill.quantity || 1;
    const total = prefill.totalPrice != null
      ? prefill.totalPrice
      : (parseNumber(prefill.unitPrice) * parseNumber(prefill.quantity || 1));
    wrapper.querySelector('.repair-total-price').value = Number(total || 0).toFixed(2);
  }
}

function removeEditItem(rowId) {
  const el = document.getElementById(rowId);
  if (!el) return;
  const container = el.parentElement;
  el.remove();
  // Renumber headers
  const rows = container.querySelectorAll('.edit-item');
  rows.forEach((r, idx) => {
    const h = r.querySelector('h6');
    if (h) h.textContent = `Item #${idx + 1}`;
  });
}

function renderEditItems(items) {
  const container = document.getElementById('editRepairItemsContainer');
  if (!container) return;
  container.innerHTML = '';

  if (!Array.isArray(items) || items.length === 0) {
    addEditItem(); // add one empty row
    return;
  }

  items.forEach(it => addEditItem(it));
}

// Gather items from Edit modal
function collectItemsFromEditModal() {
  const container = document.getElementById('editRepairItemsContainer');
  const rows = Array.from(container.querySelectorAll('.edit-item'));
  const items = [];
  let totalPrice = 0;

  rows.forEach(row => {
    const sel = row.querySelector('.repair-item-select');
    const otherInput = row.querySelector('.repair-other-item-input input');
    const itemName = sel?.value === 'other' ? (otherInput?.value || '') : (sel?.value || '');
    const received = !!row.querySelector('.item-received-check')?.checked;
    const newSerial = row.querySelector('.repair-new-serial')?.value || '';
    const oldSerial = row.querySelector('.repair-old-serial')?.value || '';
    const unitPrice = parseFloat(row.querySelector('.repair-unit-price')?.value || '0') || 0;
    const quantity = parseInt(row.querySelector('.repair-quantity')?.value || '1') || 1;
    const total = parseFloat(row.querySelector('.repair-total-price')?.value || '0') || (unitPrice * quantity);

    const hasData = !!(itemName || newSerial || oldSerial || unitPrice > 0 || quantity > 1);
    if (!hasData) return;

    const item = {
      itemReplaced: itemName || '',
      itemReceived: received,
      newSerial,
      oldSerial,
      unitPrice,
      quantity,
      totalPrice: total
    };

    // Enrich from inventory if received + newSerial present
    if (received && newSerial) {
      const inv = findReceivedItemBySerial(newSerial);
      if (inv) {
        item.invoiceNumber = inv.invoiceNumber || '';
        item.warrantyPeriod = inv.warrantyPeriod || '';
        item.supplier = inv.supplier || '';
        item.itemName = inv.itemName || item.itemReplaced || '';
        item.capacity = inv.capacity || null;
        item.fileNumber = inv.fileNumber || '';
        item.poNumber = inv.poNumber || '';
        item.invoiceUrl = inv.invoiceUrl || '';
      }
    }

    items.push(item);
    totalPrice += total;
  });

  return { items, totalPrice };
}

// Open Edit modal and populate fields
function openEditRepair(repairId) {
  const repair = repairs.find(r => r.id === repairId);
  if (!repair) {
    alert('Repair not found.');
    return;
  }
  editingRepairDocId = repairId;

  // Prefill fields
  document.getElementById('editRepairJobNumber').value = repair.jobNumber || '-';
  document.getElementById('editRepairEmployeeName').value = repair.employeeName || '';
  document.getElementById('editRepairPcSerial').value = repair.pcSerial || '';
  document.getElementById('editRepairGatePassNo').value = repair.gatePassNo || '';
  document.getElementById('editRepairErrorDetails').value = repair.errorDetails || '';
  document.getElementById('editRepairServiceDate').value = repair.serviceDate || '';
  document.getElementById('editRepairReturnDate').value = repair.returnDate || '';

  // Regions/Offices
  const editRegionEl = document.getElementById('editRepairRegion');
  const editDistrictEl = document.getElementById('editRepairDistrict');

  // Ensure region options are present
  populateRegionSelects();

  if (editRegionEl) {
    editRegionEl.value = repair.region || '';
  }
  // Populate districts based on region and preselect
  updateEditDistricts(repair.district || '');
  if (editDistrictEl && repair.district) editDistrictEl.value = repair.district;

  // Completed checkbox
  const chk = document.getElementById('editRepairCompleted');
  if (chk) chk.checked = !!repair.completed;

  // Render items into edit modal
  renderEditItems(repair.items || []);

  // If All Repairs modal open, hide it first to avoid stacking modals
  const listModalEl = document.getElementById('repairsModal');
  const listModal = bootstrap.Modal.getInstance(listModalEl);
  if (listModal) listModal.hide();

  // Show edit modal
  const modalEl = document.getElementById('editRepairModal');
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
}

// Save updated repair (Customer Info, Error Details, Replaced Items, Service Dates, Status)
async function saveEditedRepair() {
  if (!editingRepairDocId) return;

  // Read values
  const employeeName = document.getElementById('editRepairEmployeeName').value.trim();
  const region = document.getElementById('editRepairRegion').value;
  const district = document.getElementById('editRepairDistrict').value;
  const pcSerial = document.getElementById('editRepairPcSerial').value.trim();
  const gatePassNo = document.getElementById('editRepairGatePassNo').value.trim();
  const errorDetails = document.getElementById('editRepairErrorDetails').value.trim();
  const serviceDate = document.getElementById('editRepairServiceDate').value;
  const returnDate = document.getElementById('editRepairReturnDate').value;
  const completed = document.getElementById('editRepairCompleted').checked;

  if (!employeeName || !region || !district || !pcSerial || !serviceDate || !returnDate) {
    alert('Please fill all required fields.');
    return;
  }

  const { items, totalPrice } = collectItemsFromEditModal();

  const saveBtn = document.getElementById('editRepairSaveBtn');
  const oldHtml = saveBtn.innerHTML;
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

  try {
    await db.collection('repairs').doc(editingRepairDocId).update({
      employeeName,
      region,
      district,
      pcSerial,
      gatePassNo,
      errorDetails,
      serviceDate,
      returnDate,
      items,
      totalPrice,
      completed,
      status: completed ? 'Completed' : 'In Progress'
    });

    // Close modal
    const modalEl = document.getElementById('editRepairModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    editingRepairDocId = null;
    alert('Repair updated successfully.');
  } catch (err) {
    console.error('Error updating repair:', err);
    alert('Error updating repair. Please try again.');
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = oldHtml;
  }
}