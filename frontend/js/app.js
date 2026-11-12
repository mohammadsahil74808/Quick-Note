/**
 * QuickNote Pop! — Frontend Controller
 * Funky Claymorphic Notes with Real-Time Request-Response Telemetry & Storage
 */

(function () {
  'use strict';

  // Category Emoji Map for Funky Cartoon Badges
  const CATEGORY_EMOJIS = {
    'General': '📝',
    'Work': '💼',
    'Ideas': '💡',
    'Tasks': '🎯',
    'Snippets': '💻',
    'Architecture': '📐',
  };

  // State Management
  const state = {
    notes: [],
    activeCategory: 'All',
    searchQuery: '',
    isLoading: false,
    backendConnected: false,
    isMockMode: false,
    theme: localStorage.getItem('quick_notes_theme') || 'light',
    customApiUrl: localStorage.getItem('quick_notes_api_url') || '',
  };

  // DOM Elements
  const DOM = {
    // Header
    backendStatusPill: document.getElementById('backendStatusPill'),
    backendStatusText: document.getElementById('backendStatusText'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    themeEmoji: document.getElementById('themeEmoji'),

    // Note Form
    noteForm: document.getElementById('noteForm'),
    noteTitle: document.getElementById('noteTitle'),
    noteCategory: document.getElementById('noteCategory'),
    noteContent: document.getElementById('noteContent'),
    charCount: document.getElementById('charCount'),
    saveNoteBtn: document.getElementById('saveNoteBtn'),

    // Telemetry Inspector
    telemetryBox: document.getElementById('telemetryBox'),
    telemetryBadge: document.getElementById('telemetryBadge'),
    telemetrySteps: document.getElementById('telemetrySteps'),
    telemetryDetails: document.getElementById('telemetryDetails'),

    // Ledger & Notes
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    categoryChips: document.getElementById('categoryChips'),
    notesGrid: document.getElementById('notesGrid'),
    emptyState: document.getElementById('emptyState'),
    notesCountBadge: document.getElementById('notesCountBadge'),
    refreshBtn: document.getElementById('refreshBtn'),

    // Toasts & Modal Dialog
    toastContainer: document.getElementById('toastContainer'),
    deleteModal: document.getElementById('deleteModal'),
    confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
    cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
  };

  /* ==========================================================================
     API Base URL Resolution & Network Layer
     ========================================================================== */

  function getApiBaseUrl() {
    if (state.customApiUrl && state.customApiUrl.trim()) {
      return state.customApiUrl.replace(/\/+$/, '');
    }
    // If running in development or from FastAPI directly
    if (window.location.protocol.startsWith('http')) {
      if (window.location.port === '8000') {
        return '';
      }
      // If served from local development server (e.g., port 5500 / 3000)
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:8000';
      }
    }
    // GitHub Pages / remote static hosting:
    return '';
  }

  function getApiEndpoint(path) {
    const base = getApiBaseUrl();
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return base ? `${base}${cleanPath}` : cleanPath;
  }

  /* ==========================================================================
     Telemetry Logger (Pedagogical Request-Response Flow)
     ========================================================================== */

  function updateTelemetryStep(stepNumber, status, message) {
    if (!DOM.telemetrySteps) return;
    const steps = DOM.telemetrySteps.querySelectorAll('.telemetry-step');
    steps.forEach((step, index) => {
      const currentNum = index + 1;
      step.classList.remove('step-active', 'step-success');

      if (currentNum < stepNumber) {
        step.classList.add('step-success');
      } else if (currentNum === stepNumber) {
        if (status === 'active') step.classList.add('step-active');
        if (status === 'success') step.classList.add('step-success');
      }
    });

    if (DOM.telemetryBadge) {
      DOM.telemetryBadge.textContent = status.toUpperCase();
      DOM.telemetryBadge.className = `telemetry-badge ${status === 'active' ? 'active' : ''}`;
    }

    if (DOM.telemetryDetails && message) {
      DOM.telemetryDetails.innerHTML = message;
    }
  }

  function resetTelemetry() {
    if (!DOM.telemetrySteps) return;
    const steps = DOM.telemetrySteps.querySelectorAll('.telemetry-step');
    steps.forEach((step) => step.classList.remove('step-active', 'step-success'));
    if (DOM.telemetryBadge) {
      DOM.telemetryBadge.textContent = 'READY';
      DOM.telemetryBadge.className = 'telemetry-badge';
    }
    if (DOM.telemetryDetails) {
      DOM.telemetryDetails.innerHTML = '<em>Hit "Save Note" to watch the live HTTP round-trip in action!</em>';
    }
  }

  /* ==========================================================================
     Health & Backend Connectivity
     ========================================================================== */

  async function checkBackendConnectivity() {
    const endpoint = getApiEndpoint('/api/health');

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (response.ok) {
        state.backendConnected = true;
        state.isMockMode = false;
        setBackendStatusUI('connected', 'Python Backend Connected');
        return true;
      }
    } catch (err) {
      // Backend not running (e.g. hosted statically on GitHub Pages)
    }

    // Seamless fallback to browser storage on GitHub Pages
    state.backendConnected = false;
    state.isMockMode = true;
    setBackendStatusUI('connected', 'Storage Active (Browser)');
    return false;
  }

  function setBackendStatusUI(type, label) {
    if (!DOM.backendStatusPill || !DOM.backendStatusText) return;
    DOM.backendStatusPill.className = `status-pill status-${type}`;
    DOM.backendStatusText.textContent = label;
  }

  /* ==========================================================================
     CRUD Operations (Request-Response Flow)
     ========================================================================== */

  /**
   * HTTP GET /api/notes
   * Fetches all notes and renders them to the ledger.
   */
  async function fetchNotes() {
    state.isLoading = true;
    renderSkeleton();

    if (state.isMockMode) {
      // Load from localStorage for static GitHub Pages hosting
      const localData = localStorage.getItem('quick_notes_demo_data');
      state.notes = localData ? JSON.parse(localData) : getInitialDemoNotes();
      state.isLoading = false;
      renderNotes();
      return;
    }

    const endpoint = getApiEndpoint('/api/notes');

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const notes = await response.json();
      state.notes = Array.isArray(notes) ? notes : [];
      state.backendConnected = true;
      setBackendStatusUI('connected', 'Python Backend Connected');
    } catch (err) {
      state.backendConnected = false;
      state.isMockMode = true;
      setBackendStatusUI('connected', 'Storage Active (Browser)');
      const localData = localStorage.getItem('quick_notes_demo_data');
      state.notes = localData ? JSON.parse(localData) : getInitialDemoNotes();
    } finally {
      state.isLoading = false;
      renderNotes();
    }
  }

  /**
   * HTTP POST /api/notes
   * Sends JSON payload to Python FastAPI, persists in SQLite, and updates UI on 201 Created.
   */
  async function handleNoteSubmit(e) {
    e.preventDefault();

    const title = DOM.noteTitle.value.trim();
    const content = DOM.noteContent.value.trim();
    const category = DOM.noteCategory.value;
    const selectedColorInput = document.querySelector('input[name="color"]:checked');
    const color = selectedColorInput ? selectedColorInput.value : 'amber';

    if (!title || !content) {
      showToast('⚠️ Please provide both a title and content!', 'error');
      if (!title) DOM.noteTitle.focus();
      else DOM.noteContent.focus();
      return;
    }

    const payload = { title, content, category, color };

    // Update UI to saving state
    setFormSaving(true);

    // Step 1: Client preparation
    updateTelemetryStep(1, 'active', `<strong>Payload Prepared:</strong> ${escapeHtml(JSON.stringify(payload))}`);

    if (state.isMockMode) {
      // Offline / GitHub Pages local storage mode
      await delay(180);
      updateTelemetryStep(2, 'active', `<strong>Dispatched:</strong> <code>POST /api/notes</code> (Storage Engine)`);
      await delay(180);
      updateTelemetryStep(3, 'active', `<strong>Storage Commit:</strong> Persisted to Web Storage`);
      await delay(150);

      const newNote = {
        id: Date.now(),
        ...payload,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      state.notes.unshift(newNote);
      localStorage.setItem('quick_notes_demo_data', JSON.stringify(state.notes));

      updateTelemetryStep(4, 'success', `<strong>Round-Trip Complete:</strong> <code>HTTP 201 Created</code> · Saved note #${newNote.id}`);
      showToast(`✨ Note "${newNote.title}" saved!`, 'success');
      resetForm();
      setFormSaving(false);
      renderNotes();
      return;
    }

    const endpoint = getApiEndpoint('/api/notes');
    const startTime = performance.now();

    try {
      // Step 2: Dispatch HTTP POST
      updateTelemetryStep(2, 'active', `<strong>Dispatching:</strong> <code>POST ${escapeHtml(endpoint)}</code> with <code>Content-Type: application/json</code>`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const elapsed = Math.round(performance.now() - startTime);

      // Step 3: Server processing telemetry
      updateTelemetryStep(3, 'active', `<strong>Server Execution:</strong> Python FastAPI validated payload & committed to SQLite (${elapsed}ms)`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server error ${response.status}`);
      }

      // Step 4: Parse 201 Created response
      const createdNote = await response.json();
      updateTelemetryStep(4, 'success', `<strong>Round-Trip Complete:</strong> Received <code>HTTP 201 Created</code> &amp; persisted note ID <strong>#${createdNote.id}</strong> in SQLite.`);

      // Prepend to client state (instant same-page update)
      state.notes.unshift(createdNote);
      renderNotes();
      resetForm();
      showToast(`✨ Note "${createdNote.title}" saved!`, 'success');
    } catch (err) {
      console.error('Note creation error:', err);
      updateTelemetryStep(4, 'active', `<span style="color:var(--clay-primary)"><strong>Error:</strong> ${escapeHtml(err.message)}</span>`);
      showToast(`❌ Failed to save note: ${err.message}`, 'error');
    } finally {
      setFormSaving(false);
    }
  }

  /**
   * Custom Pop-up Cartoon Confirmation Dialog
   */
  function askDeleteConfirmation() {
    return new Promise((resolve) => {
      if (!DOM.deleteModal) {
        return resolve(confirm('Delete this note? 🗑️'));
      }

      const onConfirm = () => {
        cleanup();
        resolve(true);
      };

      const onCancel = () => {
        cleanup();
        resolve(false);
      };

      function cleanup() {
        DOM.confirmDeleteBtn.removeEventListener('click', onConfirm);
        DOM.cancelDeleteBtn.removeEventListener('click', onCancel);
        DOM.deleteModal.removeEventListener('cancel', onCancel);
        DOM.deleteModal.close();
      }

      DOM.confirmDeleteBtn.addEventListener('click', onConfirm);
      DOM.cancelDeleteBtn.addEventListener('click', onCancel);
      DOM.deleteModal.addEventListener('cancel', onCancel);
      DOM.deleteModal.showModal();
    });
  }

  /**
   * HTTP DELETE /api/notes/{id}
   * Removes a note from SQLite and DOM.
   */
  async function handleDeleteNote(noteId, cardElement) {
    const confirmed = await askDeleteConfirmation();
    if (!confirmed) return;

    if (state.isMockMode) {
      state.notes = state.notes.filter((n) => n.id !== noteId);
      localStorage.setItem('quick_notes_demo_data', JSON.stringify(state.notes));
      cardElement.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
      cardElement.style.opacity = '0';
      cardElement.style.transform = 'scale(0.8) translateY(-15px)';
      setTimeout(() => renderNotes(), 280);
      showToast('🗑️ Note deleted successfully.', 'info');
      return;
    }

    const endpoint = getApiEndpoint(`/api/notes/${noteId}`);

    try {
      updateTelemetryStep(2, 'active', `<strong>Dispatching:</strong> <code>DELETE ${escapeHtml(endpoint)}</code>`);
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete note (HTTP ${response.status})`);
      }

      updateTelemetryStep(4, 'success', `<strong>Deleted:</strong> Note #${noteId} removed from SQLite.`);
      state.notes = state.notes.filter((n) => n.id !== noteId);

      // Animate card removal
      cardElement.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
      cardElement.style.opacity = '0';
      cardElement.style.transform = 'scale(0.8) translateY(-15px)';
      setTimeout(() => renderNotes(), 280);
      showToast('🗑️ Note deleted from database.', 'info');
    } catch (err) {
      showToast(`❌ ${err.message}`, 'error');
    }
  }

  /* ==========================================================================
     UI Rendering & Sanitization
     ========================================================================== */

  function renderNotes() {
    if (!DOM.notesGrid) return;

    // Filter notes by category and search query
    const filtered = state.notes.filter((note) => {
      const matchCategory =
        state.activeCategory === 'All' ||
        (note.category && note.category.toLowerCase() === state.activeCategory.toLowerCase());

      const matchSearch =
        !state.searchQuery ||
        note.title.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(state.searchQuery.toLowerCase());

      return matchCategory && matchSearch;
    });

    // Update count badge
    if (DOM.notesCountBadge) {
      const total = state.notes.length;
      const count = filtered.length;
      DOM.notesCountBadge.textContent =
        count === total ? `${total} ${total === 1 ? 'note' : 'notes'}` : `${count} of ${total} notes`;
    }

    // Toggle Empty State
    if (filtered.length === 0) {
      DOM.notesGrid.innerHTML = '';
      if (DOM.emptyState) DOM.emptyState.style.display = 'block';
      return;
    }

    if (DOM.emptyState) DOM.emptyState.style.display = 'none';

    // Build Cards HTML
    DOM.notesGrid.innerHTML = filtered
      .map((note) => {
        const safeTitle = escapeHtml(note.title);
        const safeContent = escapeHtml(note.content);
        const rawCategory = note.category || 'General';
        const safeCategory = escapeHtml(rawCategory);
        const catEmoji = CATEGORY_EMOJIS[rawCategory] || '🏷️';
        const colorClass = `color-${note.color || 'amber'}`;
        const formattedDate = formatDate(note.created_at);

        return `
          <article class="note-card clay-card ${colorClass}" data-note-id="${note.id}" role="article">
            <div class="card-top">
              <span class="card-category-badge">${catEmoji} ${safeCategory}</span>
              <div class="card-actions">
                <button class="card-action-btn btn-copy" title="Copy note text" aria-label="Copy note">📋</button>
                <button class="card-action-btn btn-delete" title="Delete note" aria-label="Delete note">🗑️</button>
              </div>
            </div>
            <h3 class="card-title">${safeTitle}</h3>
            <div class="card-body">${safeContent}</div>
            <footer class="card-footer">
              <span class="card-id">#${note.id}</span>
              <time class="card-time" datetime="${escapeHtml(note.created_at)}">${formattedDate}</time>
            </footer>
          </article>
        `;
      })
      .join('');

    // Attach Event Listeners to Note Cards
    DOM.notesGrid.querySelectorAll('.note-card').forEach((card) => {
      const noteId = parseInt(card.dataset.noteId, 10);
      const note = state.notes.find((n) => n.id === noteId);

      // Copy Action
      const copyBtn = card.querySelector('.btn-copy');
      if (copyBtn && note) {
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(`${note.title}\n\n${note.content}`).then(() => {
            showToast('📋 Copied to clipboard!', 'info');
          });
        });
      }

      // Delete Action
      const deleteBtn = card.querySelector('.btn-delete');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => handleDeleteNote(noteId, card));
      }
    });
  }

  function renderSkeleton() {
    if (!DOM.notesGrid) return;
    DOM.notesGrid.innerHTML = `
      <div class="note-skeleton clay-card"><div class="skeleton-line title"></div><div class="skeleton-line body"></div><div class="skeleton-line body short"></div></div>
      <div class="note-skeleton clay-card"><div class="skeleton-line title"></div><div class="skeleton-line body"></div><div class="skeleton-line body short"></div></div>
    `;
  }

  function resetForm() {
    DOM.noteForm.reset();
    DOM.charCount.textContent = '0 / 10,000';
    DOM.noteTitle.focus();
  }

  function setFormSaving(saving) {
    if (!DOM.saveNoteBtn) return;
    DOM.saveNoteBtn.disabled = saving;
    DOM.noteTitle.disabled = saving;
    DOM.noteContent.disabled = saving;
    DOM.noteCategory.disabled = saving;
    if (saving) {
      DOM.saveNoteBtn.classList.add('is-loading');
    } else {
      DOM.saveNoteBtn.classList.remove('is-loading');
    }
  }

  /* ==========================================================================
     Toasts & Modals
     ========================================================================== */

  function showToast(message, type = 'info') {
    if (!DOM.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    DOM.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
      toast.style.opacity = '0';
      toast.style.transform = 'scale(0.8) translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  /* ==========================================================================
     Theme Management
     ========================================================================== */

  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('quick_notes_theme', theme);
    if (DOM.themeEmoji) {
      DOM.themeEmoji.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
  }

  function toggleTheme() {
    const next = state.theme === 'light' ? 'dark' : 'light';
    applyTheme(next);
  }

  /* ==========================================================================
     Helper Utilities
     ========================================================================== */

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDate(isoString) {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getInitialDemoNotes() {
    return [
      {
        id: 1,
        title: 'Welcome to QuickNote Pop! 🎈',
        content:
          'This note demonstrates the funky claymorphic single-page experience!\n\nWrite your thoughts on the left, pick a cute color mood, and hit Save Note. Your notes stay permanently saved even when you refresh the page or close your browser.',
        category: 'General',
        color: 'amber',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 2,
        title: 'Request-Response Magic ⚡',
        content:
          '1. Client prepares JSON payload.\n2. Dispatches asynchronous POST /api/notes.\n3. Storage Engine commits your note.\n4. Server/Engine returns 201 Created.\n5. New note pops up instantly on the page without any full page reload!',
        category: 'Architecture',
        color: 'indigo',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
  }

  /* ==========================================================================
     Event Binding & Initialization
     ========================================================================== */

  function initEventListeners() {
    // Note form submit
    DOM.noteForm.addEventListener('submit', handleNoteSubmit);

    // Character counter
    DOM.noteContent.addEventListener('input', () => {
      const length = DOM.noteContent.value.length;
      DOM.charCount.textContent = `${length.toLocaleString()} / 10,000`;
    });

    // Keyboard shortcut (Ctrl+Enter or Cmd+Enter to save)
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (document.activeElement === DOM.noteTitle || document.activeElement === DOM.noteContent) {
          e.preventDefault();
          DOM.noteForm.requestSubmit();
        }
      }
    });

    // Category Filter Chips
    DOM.categoryChips.addEventListener('click', (e) => {
      const chip = e.target.closest('.clay-chip');
      if (!chip) return;
      DOM.categoryChips.querySelectorAll('.clay-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      state.activeCategory = chip.dataset.category;
      renderNotes();
    });

    // Search input
    DOM.searchInput.addEventListener('input', () => {
      state.searchQuery = DOM.searchInput.value.trim();
      DOM.clearSearchBtn.style.display = state.searchQuery ? 'block' : 'none';
      renderNotes();
    });

    DOM.clearSearchBtn.addEventListener('click', () => {
      DOM.searchInput.value = '';
      state.searchQuery = '';
      DOM.clearSearchBtn.style.display = 'none';
      renderNotes();
      DOM.searchInput.focus();
    });

    // Manual Refresh
    DOM.refreshBtn.addEventListener('click', () => {
      fetchNotes();
      showToast('🔄 Ledger refreshed!', 'info');
    });

    // Theme Toggle
    if (DOM.themeToggleBtn) {
      DOM.themeToggleBtn.addEventListener('click', toggleTheme);
    }
  }

  // Application Entrypoint
  async function init() {
    applyTheme(state.theme);
    initEventListeners();
    await checkBackendConnectivity();
    await fetchNotes();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
