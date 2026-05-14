function searchReceivedItems() {
  const searchTerm = (document.getElementById('receivedItemsSearch').value || '').toLowerCase();
  const rows = document.querySelectorAll('#receivedItemsTable tr');

  rows.forEach(row => {
    const itemName = row.cells[0].textContent.toLowerCase();
    row.style.display = itemName.includes(searchTerm) ? '' : 'none';
  });
}

function populateUpcomingReturns() {
  const tableBody = document.getElementById('upcomingReturnsTable');
  if (!tableBody) return;
  tableBody.innerHTML = '';

  const upcomingReturns = repairs.filter(r => {
    const returnDate = new Date(r.returnDate);
    const today = new Date();
    const diffDays = Math.ceil((returnDate - today) / (1000 * 60 * 60 * 24));
    return !r.completed && diffDays >= 0 && diffDays <= 28;
  }).slice(0, 5);

  upcomingReturns.forEach(repair => {
    const returnDate = new Date(repair.returnDate);
    const today = new Date();
    const diffDays = Math.ceil((returnDate - today) / (1000 * 60 * 60 * 24));

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${e(repair.employeeName || '-')}</td>
      <td>${(repair.items || []).map(item => e(item.itemReplaced || '')).join(', ')}</td>
      <td>${isFinite(diffDays) ? diffDays : '-'}</td>
    `;
    tableBody.appendChild(row);
  });
}

function populateAllRepairs() {
  const tableBody = document.getElementById('allRepairsTable');
  if (!tableBody) return;
  tableBody.innerHTML = '';

  repairs.forEach(repair => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${e(repair.serviceDate || '')}</td>
      <td>${e(repair.employeeName || '')}</td>
      <td>${e(repair.jobNumber || '-')}</td>
      <td>${e(repair.pcSerial || '')}</td>
      <td>${repair.items?.map(item => e(item.itemReplaced || '')).join(', ') || ''}</td>
      <td><span class="badge ${repair.completed ? 'bg-success' : 'bg-warning text-dark'}">${repair.completed ? 'Completed' : 'In Progress'}</span></td>
      <td>${e(repair.returnDate || '')}</td>
      <td>Rs ${Number(repair.totalPrice || 0).toFixed(2)}</td>
      <td class="text-nowrap">
        <button class="btn btn-sm btn-outline-primary me-1" title="Print" onclick="printRepair('${repair.id}')">
          <i class="fas fa-print"></i>
        </button>
        <button class="btn btn-sm btn-outline-warning me-1" title="Edit" onclick="openEditRepair('${repair.id}')">
          <i class="fas fa-edit"></i>
        </button>
        ${repair.completed
          ? '<button class="btn btn-sm btn-outline-secondary" disabled title="Completed"><i class="fas fa-check"></i></button>'
          : `<button class="btn btn-sm btn-outline-success" title="Mark Completed" onclick="completeRepair('${repair.id}')">
               <i class="fas fa-check"></i>
             </button>`
        }
      </td>
    `;
    tableBody.appendChild(row);
  });
}

function sortApprovalsLatestFirst(list) {
  return list.slice().sort((a, b) => {
    const aTime = a.timestamp?.toMillis?.() || (a.date ? new Date(a.date).getTime() : 0);
    const bTime = b.timestamp?.toMillis?.() || (b.date ? new Date(b.date).getTime() : 0);
    return bTime - aTime;
  });
}

function populatePreviousApprovals() {
  const tableBody = document.getElementById('previousApprovalsTable');
  if (!tableBody) return;
  tableBody.innerHTML = '';

  const toggleBtn = document.getElementById('toggleApprovalsViewBtn');

  let list = sortApprovalsLatestFirst(committeeApprovals);

  if (approvalDateSearchTerm) {
    list = list.filter(approval => (approval.date || '').toLowerCase().includes(approvalDateSearchTerm));
  }

  const sectionFilter = (approvalLocationFilter || '').toLowerCase();
  if (sectionFilter) {
    list = list.filter(approval =>
      (approval.items || []).some(it => (it.section || '').toLowerCase() === sectionFilter)
    );
  }

  const toRender = showAllApprovals ? list : list.slice(0, 5);

  toRender.forEach(approval => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${e(approval.date || '')}</td>
      <td>Rs ${Number(approval.totalAmount || 0).toFixed(2)}</td>
      <td>${e(approval.chairman || '')}</td>
      <td class="text-nowrap">
        <button class="btn btn-sm btn-outline-primary me-1" title="Print" onclick="printCommitteeApproval('${approval.id}')">
          <i class="fas fa-print"></i>
        </button>
        <button class="btn btn-sm btn-outline-warning me-1" title="Edit" onclick="startEditApproval('${approval.id}')">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger" title="Delete" onclick="deleteCommitteeApproval('${approval.id}')">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;
    tableBody.appendChild(row);
  });

  if (toggleBtn) {
    toggleBtn.textContent = showAllApprovals ? 'Show Latest 5' : 'View All';
  }
}

function completeRepair(repairId) {
  db.collection("repairs").doc(repairId).update({
    completed: true,
    status: 'Completed'
  }).catch((error) => {
    console.error("Error updating repair: ", error);
    alert('Error completing repair. Please try again.');
  });
}

function findReceivedItemBySerial(serial) {
  if (!serial) return null;
  const s = String(serial).toLowerCase();
  for (const item of receivedItems) {
    if (item.serialNumbers && item.serialNumbers.some(sn => String(sn).toLowerCase() === s)) {
      return item;
    }
    if (item.newSerial && String(item.newSerial).toLowerCase() === s) {
      return item;
    }
  }
  return null;
}
// Add this helper function
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Make main "Item Replaced" optional: only push items that have some data
async function addNewRepair() {
  const employeeName = document.getElementById('repairEmployeeName').value;
  const region = document.getElementById('repairRegion').value;
  const district = document.getElementById('repairDistrict').value;
  const pcSerial = document.getElementById('repairPcSerialNumber').value;
  const jobNumber = (document.getElementById('repairJobNumber')?.value || '').trim() || generateJobNumber();
  const gatePassNo = (document.getElementById('repairGatePassNo')?.value || '').trim();
  const errorDetails = document.getElementById('repairErrorDetails').value;
  const serviceDate = document.getElementById('repairServiceDate').value;
  const returnDate = document.getElementById('repairReturnDate').value;
  

  // NEW: Get email input
  const customerEmailsInput = document.getElementById('repairCustomerEmails')?.value || '';
  const customerEmails = customerEmailsInput
    .split(',')
    .map(email => email.trim())
    .filter(email => isValidEmail(email));

  const items = [];
  let totalPrice = 0;


  // Main item (optional)
  const mainItemSelect = document.querySelector('.repair-item-select');
  const mainItemOtherInput = document.querySelector('.repair-other-item-input input');
  const mainItemReceived = !!document.querySelector('.item-received-check')?.checked;
  const mainItemNewSerial = document.querySelector('.repair-new-serial').value;
  const mainItemOldSerial = document.querySelector('.repair-old-serial').value;
  const mainItemUnitPrice = parseFloat(document.querySelector('.repair-unit-price').value) || 0;
  const mainItemQuantity = parseInt(document.querySelector('.repair-quantity').value) || 1;
  const mainItemTotalPrice = parseFloat(document.querySelector('.repair-total-price').value) || 0;

  const mainItemName = mainItemSelect?.value === 'other' ? (mainItemOtherInput?.value || '') : (mainItemSelect?.value || '');

  const hasMainData = !!(mainItemName || mainItemNewSerial || mainItemOldSerial || mainItemUnitPrice > 0 || mainItemQuantity > 1);

  if (hasMainData) {
    items.push({
      itemReplaced: mainItemName || '',
      itemReceived: mainItemReceived,
      newSerial: mainItemNewSerial || '',
      oldSerial: mainItemOldSerial || '',
      unitPrice: mainItemUnitPrice,
      quantity: mainItemQuantity,
      totalPrice: mainItemTotalPrice
    });
    totalPrice += mainItemTotalPrice;
  }

  // Additional items
  const additionalItems = document.querySelectorAll('.additional-item');
  additionalItems.forEach(item => {
    const itemSelect = item.querySelector('.repair-item-select');
    const itemOtherInput = item.querySelector('.repair-other-item-input input');
    const itemReceived = item.querySelector('.item-received-check').checked;
    const itemNewSerial = item.querySelector('.repair-new-serial').value;
    const itemOldSerial = item.querySelector('.repair-old-serial').value;
    const itemUnitPrice = parseFloat(item.querySelector('.repair-unit-price').value) || 0;
    const itemQuantity = parseInt(item.querySelector('.repair-quantity').value) || 1;
    const itemTotalPrice = parseFloat(item.querySelector('.repair-total-price').value) || 0;

    const itemName = itemSelect.value === 'other' ? (itemOtherInput.value || '') : (itemSelect.value || '');
    const hasData = !!(itemName || itemNewSerial || itemOldSerial || itemUnitPrice > 0 || itemQuantity > 1);

    if (hasData) {
      items.push({
        itemReplaced: itemName || '',
        itemReceived: itemReceived,
        newSerial: itemNewSerial || '',
        oldSerial: itemOldSerial || '',
        unitPrice: itemUnitPrice,
        quantity: itemQuantity,
        totalPrice: itemTotalPrice
      });
      totalPrice += itemTotalPrice;
    }
  });

  // Enrich items with inventory details
  items.forEach(it => {
    if (it.itemReceived && it.newSerial) {
      const found = findReceivedItemBySerial(it.newSerial);
      if (found) {
        it.invoiceNumber = found.invoiceNumber || '';
        it.warrantyPeriod = found.warrantyPeriod || '';
        it.supplier = found.supplier || '';
        it.itemName = found.itemName || it.itemReplaced || '';
        it.capacity = found.capacity || null;
        it.fileNumber = found.fileNumber || '';
        it.poNumber = found.poNumber || '';
        it.invoiceUrl = found.invoiceUrl || '';
      }
    }
  });

  const newRepair = {
    employeeName,
    region,
    district,
    pcSerial,
    jobNumber,
    gatePassNo,
    errorDetails,
    serviceDate,
    returnDate,
    items,
    totalPrice,
    completed: false,
    status: 'In Progress',
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  // NEW: Email fields
    customerEmails: customerEmails,
    emailSent: false
  };
 try {
    const docRef = await db.collection("repairs").add(newRepair);
// NEW: Send email if emails were provided
    if (customerEmails.length > 0) {
      setTimeout(() => {
        sendJobCardEmail(docRef.id, customerEmailsInput)
          .then(success => {
            if (success) {
              console.log('Email sent automatically for new repair');
            }
          })
          .catch(err => console.error('Auto-email failed:', err));
      }, 1000);
      
      alert('Repair submitted successfully! Job card email will be sent shortly.');
    } else {
      alert('Repair submitted successfully!');
    }
    // Remove selected serial(s) from inventory after saving repair
    const updates = [];
    items.forEach(it => {
      if (it.itemReceived && it.newSerial) {
        const found = findReceivedItemBySerial(it.newSerial);
        if (found) updates.push(updateReceivedItemQuantity(found.id, 1, it.newSerial));
      }
    });
    if (updates.length) await Promise.allSettled(updates);

    document.getElementById('repairForm').reset();
    document.getElementById('additionalItemsContainer').innerHTML = '';
    setDefaultDates();
    generateJobNumber();

    // Re-bind toggles after reset (for main item)
    bindRepairItemSelectToggles();
  } catch (error) {
    console.error("Error adding repair: ", error);
    alert('Error submitting repair. Please try again.');
  }
}

// ===== Committee Approval: helpers for edit/update + Job Card linking =====
function toggleApprovalTableHeader() {
  const thead = document.querySelector('#approvalItemsTable thead');
  const hasRows = document.querySelectorAll('#approvalItemsBody tr').length > 0;
  if (thead) thead.style.display = hasRows ? 'table-header-group' : 'none';
}

function createApprovalItemRow({ description, region, section, costCenter, qty, unitRate, amount }) {
  const tableBody = document.getElementById('approvalItemsBody');
  const rowCount = tableBody.querySelectorAll('tr').length;
  const tr = document.createElement('tr');
  const qtyVal = parseNumber(qty) || 0;
  const unitVal = parseNumber(unitRate) || 0;
  const amtVal = parseNumber(amount) || (qtyVal * unitVal);

  tr.innerHTML = `
    <td>${rowCount + 1}</td>
    <td>${e(description || '')}</td>
    <td>${e(region || '')}</td>
    <td>${e(section || '')}</td>
    <td>${e(costCenter || '')}</td>
    <td>${qtyVal}</td>
    <td>${unitVal.toFixed(2)}</td>
    <td>${amtVal.toFixed(2)}</td>
    <td>
      <button class="btn btn-sm btn-outline-danger" onclick="this.closest('tr').remove(); updateApprovalItemNumbers(); toggleApprovalTableHeader();">
        <i class="fas fa-times"></i>
      </button>
    </td>
  `;
  tableBody.appendChild(tr);
  updateApprovalItemNumbers();
  toggleApprovalTableHeader();
}

// Build job card label for the multi-select
function jobCardOptionLabel(rep) {
  const job = rep.jobNumber || '-';
  const pc = rep.pcSerial || '-';
  const gp = rep.gatePassNo || '-';
  return `${job} — PC: ${pc} — Gate Pass: ${gp}`;
}

// Populate the job card multi-select
function populateApprovalJobCardOptions(preselect = null) {
  const sel = document.getElementById('approvalLinkedJobCards');
  if (!sel) return;

  const prev = preselect ?? Array.from(sel.selectedOptions || []).map(o => o.value);
  const selected = new Set(prev);

  sel.innerHTML = '';

  const withJobs = repairs.filter(r => r.jobNumber && String(r.jobNumber).trim() !== '');
  withJobs.sort((a, b) => {
    const at = a.timestamp?.toMillis?.() || 0;
    const bt = b.timestamp?.toMillis?.() || 0;
    return bt - at;
  });

  withJobs.forEach(rep => {
    const opt = document.createElement('option');
    opt.value = rep.jobNumber;
    opt.textContent = jobCardOptionLabel(rep);
    if (selected.has(rep.jobNumber)) opt.selected = true;
    sel.appendChild(opt);
  });
}

// Read selected job cards from UI
function getSelectedLinkedJobCardsFromUI() {
  const sel = document.getElementById('approvalLinkedJobCards');
  if (!sel) return [];
  return Array.from(sel.selectedOptions || []).map(o => o.value);
}

function startEditApproval(approvalId) {
  showPage('committeeApprovalPage');

  const approval = committeeApprovals.find(a => a.id === approvalId);
  if (!approval) {
    alert('Approval not found.');
    return;
  }

  editingApprovalId = approvalId;
  editingApproval = approval;

  // Fill basic fields
  const dateEl = document.getElementById('approvalDate');
  const vatEl = document.getElementById('vatPercentage');
  const mrEl = document.getElementById('approvalMrNumber');
  const prEl = document.getElementById('approvalPrNumber');
  const chairmanSel = document.getElementById('chairmanName');
  const otherChairmanWrap = document.getElementById('otherChairmanNameWrap');
  const otherChairmanInput = document.getElementById('otherChairmanName');
  const memberEl = document.getElementById('memberName');
  const otherMemberEl = document.getElementById('otherMemberName');

  if (dateEl) dateEl.value = approval.date || '';
  if (vatEl) vatEl.value = approval.vatPercentage ?? 0;
  if (mrEl) mrEl.value = approval.mrNumber || '';
  if (prEl) prEl.value = approval.prNumber || '';
  if (memberEl) memberEl.value = approval.member || '';
  if (otherMemberEl) otherMemberEl.value = approval.otherMember || '';

  // Chairman
  if (chairmanSel) {
    if (approval.chairman === 'DGM (C)') {
      chairmanSel.value = 'DGM (C)';
      toggleOtherChairmanField();
      if (otherChairmanInput) otherChairmanInput.value = '';
    } else {
      chairmanSel.value = 'Other';
      toggleOtherChairmanField();
      if (otherChairmanInput) otherChairmanInput.value = approval.chairman || '';
      if (otherChairmanWrap) otherChairmanWrap.style.display = 'block';
    }
  }

  // Items table
  const tbody = document.getElementById('approvalItemsBody');
  if (tbody) tbody.innerHTML = '';
  (approval.items || []).forEach(it => {
    createApprovalItemRow({
      description: it.description,
      region: it.region,
      section: it.section,
      costCenter: it.costCenter,
      qty: it.qty,
      unitRate: it.unitRate,
      amount: it.amount
    });
  });
  toggleApprovalTableHeader();

  // Preselect linked job cards in the multi-select
  const pre = Array.isArray(approval.linkedJobCards) ? approval.linkedJobCards : [];
  populateApprovalJobCardOptions(pre);

  // Update submit button label
  const submitBtn = document.querySelector('#committeeForm button[type="submit"]');
  if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save me-1"></i> Update Approval';

  const form = document.getElementById('committeeForm');
  if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}