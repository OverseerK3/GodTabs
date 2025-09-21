// GodTabs Popup JavaScript
// Handles popup UI interactions and tab management

document.addEventListener('DOMContentLoaded', async () => {
  console.log('GodTabs popup loaded');
  
  // Initialize popup
  await initializePopup();
  
  // Set up event listeners
  setupEventListeners();
  
  // Load tabs
  await loadTabs();
});

let allTabs = [];
let filteredTabs = [];
let currentFilter = 'all';
let searchQuery = '';

// Initialize popup with settings and UI state
async function initializePopup() {
  try {
    // Load user settings
    const result = await chrome.storage.sync.get('settings');
    const settings = result.settings || {};
    
    // Apply theme if available
    if (settings.theme) {
      document.body.setAttribute('data-theme', settings.theme);
    }
    
    // Set up UI based on settings
    if (!settings.showTabCount) {
      document.querySelector('.tab-count').style.display = 'none';
    }
    
    // Check for recovery data
    await checkRecoveryData();
    
    // Update auto-save status
    await updateAutoSaveStatus();
  } catch (error) {
    console.error('Error initializing popup:', error);
  }
}

// Set up all event listeners
function setupEventListeners() {
  // Header actions
  document.getElementById('refresh-btn').addEventListener('click', loadTabs);
  document.getElementById('options-btn').addEventListener('click', openOptions);
  
  // Search functionality
  const searchInput = document.getElementById('search-input');
  const clearSearch = document.getElementById('clear-search');
  
  searchInput.addEventListener('input', handleSearch);
  clearSearch.addEventListener('click', clearSearchInput);
  
  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', handleFilter);
  });
  
  // Quick actions
  document.getElementById('close-duplicates').addEventListener('click', closeDuplicateTabs);
  document.getElementById('save-session').addEventListener('click', saveCurrentSession);
  document.getElementById('create-workspace').addEventListener('click', showWorkspaceCreationForm);
  document.getElementById('restore-session').addEventListener('click', restoreLastSession);
  document.getElementById('recover-workspaces').addEventListener('click', showRecoveryModal);
  
  // Footer actions
  document.getElementById('new-tab').addEventListener('click', createNewTab);
  document.getElementById('close-all').addEventListener('click', closeAllTabs);
  document.getElementById('sessions-view').addEventListener('click', showSessionsModal);
  document.getElementById('workspaces-view').addEventListener('click', showWorkspacesModal);
  
  // Modal controls
  document.getElementById('close-modal').addEventListener('click', hideSessionsModal);
  document.getElementById('sessions-modal').addEventListener('click', (e) => {
    if (e.target.id === 'sessions-modal') {
      hideSessionsModal();
    }
  });
  
  // Workspace modal controls
  document.getElementById('close-workspaces-modal').addEventListener('click', hideWorkspacesModal);
  document.getElementById('workspaces-modal').addEventListener('click', (e) => {
    if (e.target.id === 'workspaces-modal') {
      hideWorkspacesModal();
    }
  });
  
  // Recovery modal controls
  document.getElementById('close-recovery-modal').addEventListener('click', hideRecoveryModal);
  document.getElementById('recovery-modal').addEventListener('click', (e) => {
    if (e.target.id === 'recovery-modal') {
      hideRecoveryModal();
    }
  });
  
  // Recovery actions
  document.getElementById('recover-selected').addEventListener('click', recoverSelectedWorkspaces);
  document.getElementById('recover-all').addEventListener('click', recoverAllWorkspaces);
  document.getElementById('dismiss-recovery').addEventListener('click', dismissRecovery);
  
  // Auto-save status click to toggle
  document.getElementById('auto-save-status').addEventListener('click', toggleAutoSave);
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'r') {
      e.preventDefault();
      showRecoveryModal();
    }
  });
  
  // Workspace creation form
  document.getElementById('cancel-workspace-creation').addEventListener('click', hideWorkspaceCreationForm);
  document.getElementById('confirm-workspace-creation').addEventListener('click', createWorkspace);
  document.getElementById('create-first-workspace').addEventListener('click', showWorkspaceCreationForm);
  document.getElementById('workspace-name-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      createWorkspace();
    } else if (e.key === 'Escape') {
      hideWorkspaceCreationForm();
    }
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboard);
}

// Load and display tabs
async function loadTabs() {
  try {
    showLoading(true);
    
    const response = await chrome.runtime.sendMessage({ action: 'getTabs' });
    allTabs = response.tabs || [];
    
    // Sort tabs by window and position
    allTabs.sort((a, b) => {
      if (a.windowId !== b.windowId) {
        return a.windowId - b.windowId;
      }
      return a.index - b.index;
    });
    
    applyFilters();
    showLoading(false);
  } catch (error) {
    console.error('Error loading tabs:', error);
    showLoading(false);
  }
}

// Apply current filters and search
function applyFilters() {
  let tabs = [...allTabs];
  
  // Apply search filter
  if (searchQuery) {
    tabs = tabs.filter(tab => 
      tab.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tab.url.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }
  
  // Apply category filter
  switch (currentFilter) {
    case 'pinned':
      tabs = tabs.filter(tab => tab.pinned);
      break;
    case 'audible':
      tabs = tabs.filter(tab => tab.audible);
      break;
    case 'all':
    default:
      // No additional filtering
      break;
  }
  
  filteredTabs = tabs;
  renderTabs();
  updateTabCount();
}

// Render tabs in the UI
function renderTabs() {
  const tabsList = document.getElementById('tabs-list');
  const noTabs = document.getElementById('no-tabs');
  
  if (filteredTabs.length === 0) {
    tabsList.innerHTML = '';
    noTabs.classList.remove('hidden');
    return;
  }
  
  noTabs.classList.add('hidden');
  
  const tabsHTML = filteredTabs.map(tab => `
    <div class="tab-item ${tab.active ? 'active' : ''} ${tab.pinned ? 'pinned' : ''} ${tab.discarded ? 'suspended' : ''}" 
         data-tab-id="${tab.id}" data-window-id="${tab.windowId}">
      <img src="${tab.favIconUrl || '../icons/godTabs_Logo.png'}" 
           alt="Favicon" class="tab-favicon ${tab.discarded ? 'suspended' : ''}" 
           onerror="this.src='../icons/godTabs_Logo.png'">
      <div class="tab-info">
        <div class="tab-title">
          ${tab.discarded ? '<i class="fas fa-moon suspend-icon" title="Suspended tab - click to restore"></i>' : ''}
          ${escapeHtml(tab.title)}
        </div>
        <div class="tab-url">${escapeHtml(tab.url)}</div>
      </div>
      <div class="tab-actions">
        <button class="tab-action pin" title="${tab.pinned ? 'Unpin' : 'Pin'} tab">
          ${tab.pinned ? '📌' : '📌'}
        </button>
        <button class="tab-action close" title="Close tab">×</button>
      </div>
    </div>
  `).join('');
  
  tabsList.innerHTML = tabsHTML;
  
  // Add event listeners to tab items
  tabsList.querySelectorAll('.tab-item').forEach(item => {
    const tabId = parseInt(item.dataset.tabId);
    const windowId = parseInt(item.dataset.windowId);
    
    // Click to switch to tab
    item.addEventListener('click', (e) => {
      if (!e.target.classList.contains('tab-action')) {
        switchToTab(tabId, windowId);
      }
    });
    
    // Tab actions
    const pinBtn = item.querySelector('.pin');
    const closeBtn = item.querySelector('.close');
    
    pinBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTabPin(tabId);
    });
    
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(tabId);
    });
  });
}

// Update tab count display
function updateTabCount() {
  const tabCounter = document.getElementById('tab-counter');
  const filteredCounter = document.getElementById('filtered-counter');
  
  tabCounter.textContent = `${allTabs.length} tab${allTabs.length !== 1 ? 's' : ''}`;
  
  if (filteredTabs.length !== allTabs.length) {
    filteredCounter.textContent = `${filteredTabs.length} filtered`;
    filteredCounter.classList.remove('hidden');
  } else {
    filteredCounter.classList.add('hidden');
  }
}

// Event handlers
function handleSearch(e) {
  searchQuery = e.target.value;
  applyFilters();
  
  const clearBtn = document.getElementById('clear-search');
  clearBtn.style.display = searchQuery ? 'flex' : 'none';
}

function clearSearchInput() {
  const searchInput = document.getElementById('search-input');
  searchInput.value = '';
  searchQuery = '';
  applyFilters();
  document.getElementById('clear-search').style.display = 'none';
}

function handleFilter(e) {
  // Update active filter button
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  e.target.classList.add('active');
  
  currentFilter = e.target.dataset.filter;
  applyFilters();
}

function handleKeyboard(e) {
  // Escape key to close modal
  if (e.key === 'Escape') {
    hideSessionsModal();
  }
  
  // Ctrl+F to focus search
  if (e.ctrlKey && e.key === 'f') {
    e.preventDefault();
    document.getElementById('search-input').focus();
  }
}

// Tab operations
async function switchToTab(tabId, windowId) {
  try {
    await chrome.runtime.sendMessage({
      action: 'switchToTab',
      tabId: tabId,
      windowId: windowId
    });
    window.close();
  } catch (error) {
    console.error('Error switching to tab:', error);
  }
}

async function closeTab(tabId) {
  try {
    await chrome.runtime.sendMessage({
      action: 'closeTab',
      tabId: tabId
    });
    
    // Remove tab from local arrays
    allTabs = allTabs.filter(tab => tab.id !== tabId);
    applyFilters();
  } catch (error) {
    console.error('Error closing tab:', error);
  }
}

async function toggleTabPin(tabId) {
  try {
    const tab = allTabs.find(t => t.id === tabId);
    if (tab) {
      await chrome.tabs.update(tabId, { pinned: !tab.pinned });
      await loadTabs(); // Reload to get updated state
    }
  } catch (error) {
    console.error('Error toggling tab pin:', error);
  }
}

// Quick actions
async function closeDuplicateTabs() {
  try {
    await chrome.runtime.sendMessage({ action: 'closeAllDuplicates' });
    await loadTabs();
    showNotification('Duplicate tabs closed successfully');
  } catch (error) {
    console.error('Error closing duplicate tabs:', error);
    showErrorNotification('Failed to close duplicate tabs');
  }
}

async function saveCurrentSession() {
  try {
    await chrome.runtime.sendMessage({ action: 'saveCurrentSession' });
    showNotification('Session saved successfully');
  } catch (error) {
    console.error('Error saving session:', error);
    showErrorNotification('Failed to save session');
  }
}

async function restoreLastSession() {
  try {
    await chrome.runtime.sendMessage({ action: 'restoreLastSession' });
    await loadTabs();
    showNotification('Session restored successfully');
  } catch (error) {
    console.error('Error restoring session:', error);
    showErrorNotification('Failed to restore session');
  }
}

async function createNewTab() {
  try {
    await chrome.tabs.create({ url: 'chrome://newtab/' });
    window.close();
  } catch (error) {
    console.error('Error creating new tab:', error);
  }
}

async function closeAllTabs() {
  if (confirm('Are you sure you want to close all tabs? This action cannot be undone.')) {
    try {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const tabIds = tabs.filter(tab => !tab.pinned).map(tab => tab.id);
      
      if (tabIds.length > 0) {
        await chrome.tabs.remove(tabIds);
        await loadTabs();
      }
    } catch (error) {
      console.error('Error closing all tabs:', error);
    }
  }
}

// Workspaces modal
async function showWorkspacesModal() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getWorkspaces' });
    const workspaces = response.workspaces || [];
    
    const workspacesList = document.getElementById('workspaces-list');
    const noWorkspaces = document.getElementById('no-workspaces');
    
    if (workspaces.length === 0) {
      workspacesList.innerHTML = '';
      noWorkspaces.classList.remove('hidden');
    } else {
      noWorkspaces.classList.add('hidden');
      renderWorkspaces(workspaces);
    }
    
    hideWorkspaceCreationForm();
    document.getElementById('workspaces-modal').classList.remove('hidden');
  } catch (error) {
    console.error('Error loading workspaces:', error);
  }
}

function hideWorkspacesModal() {
  document.getElementById('workspaces-modal').classList.add('hidden');
  hideWorkspaceCreationForm();
}

function showWorkspaceCreationForm() {
  const form = document.getElementById('workspace-creation-form');
  const input = document.getElementById('workspace-name-input');
  
  form.classList.remove('hidden');
  input.value = '';
  input.focus();
  
  // If modal is not open, open it first
  if (document.getElementById('workspaces-modal').classList.contains('hidden')) {
    showWorkspacesModal();
  }
}

function hideWorkspaceCreationForm() {
  document.getElementById('workspace-creation-form').classList.add('hidden');
  document.getElementById('workspace-name-input').value = '';
}

async function createWorkspace() {
  const nameInput = document.getElementById('workspace-name-input');
  const name = nameInput.value.trim();
  
  if (!name) {
    showNotification('Please enter a workspace name');
    nameInput.focus();
    return;
  }
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'createWorkspace',
      name: name
    });
    
    if (response.success) {
      showNotification(`Workspace "${name}" created successfully`);
      hideWorkspaceCreationForm();
      await showWorkspacesModal(); // Refresh the list
    } else {
      showNotification('Error creating workspace: ' + (response.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error creating workspace:', error);
    showNotification('Error creating workspace');
  }
}

function renderWorkspaces(workspaces) {
  const workspacesList = document.getElementById('workspaces-list');
  
  const workspacesHTML = workspaces.map(workspace => `
    <div class="workspace-item ${workspace.isActive ? 'active' : ''}" data-workspace-id="${workspace.id}">
      <div class="workspace-info">
        <div class="workspace-name">${escapeHtml(workspace.name)}</div>
        <div class="workspace-metadata">
          <span class="workspace-tab-count">${workspace.tabs.length} tabs</span>
          <span class="workspace-date">${formatDate(workspace.timestamp)}</span>
          ${workspace.isActive ? '<span class="workspace-active-badge">Active</span>' : ''}
        </div>
      </div>
      <div class="workspace-actions">
        <button class="workspace-action switch-btn" title="Switch to workspace">
          ${workspace.isActive ? 'Current' : 'Switch'}
        </button>
        <button class="workspace-action restore-btn" title="Restore workspace (keep current tabs)">
          Restore
        </button>
        <button class="workspace-action delete-btn" title="Delete workspace">
          Delete
        </button>
      </div>
    </div>
  `).join('');
  
  // Add "Add New Workspace" button at the end
  const addNewWorkspaceHTML = `
    <div class="workspace-item add-new-workspace">
      <div class="workspace-info">
        <div class="workspace-name">
          <i class="fas fa-plus"></i> Create New Workspace
        </div>
        <div class="workspace-metadata">
          <span>Save current tabs as a new workspace</span>
        </div>
      </div>
      <div class="workspace-actions">
        <button class="workspace-action create-btn btn-primary" title="Create new workspace">
          <i class="fas fa-plus"></i> Create
        </button>
      </div>
    </div>
  `;
  
  workspacesList.innerHTML = workspacesHTML + addNewWorkspaceHTML;
  
  // Add event listeners to workspace items
  workspacesList.querySelectorAll('.workspace-item').forEach(item => {
    const workspaceId = item.dataset.workspaceId;
    
    // Handle "Add New Workspace" button
    if (item.classList.contains('add-new-workspace')) {
      const createBtn = item.querySelector('.create-btn');
      createBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showWorkspaceCreationForm();
      });
      return; // Skip the rest for add-new-workspace item
    }
    
    const workspace = workspaces.find(w => w.id === workspaceId);
    
    // Switch button
    const switchBtn = item.querySelector('.switch-btn');
    if (!workspace.isActive) {
      switchBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        switchToWorkspace(workspaceId);
      });
    } else {
      switchBtn.disabled = true;
    }
    
    // Restore button
    const restoreBtn = item.querySelector('.restore-btn');
    restoreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      restoreWorkspace(workspaceId);
    });
    
    // Delete button
    const deleteBtn = item.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteWorkspace(workspaceId, workspace.name);
    });
  });
}

async function switchToWorkspace(workspaceId) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'switchWorkspace',
      workspaceId: workspaceId
    });
    
    if (response.success) {
      hideWorkspacesModal();
      await loadTabs(); // Refresh the tab list
      showNotification('Workspace switched successfully');
    } else {
      showNotification('Error switching workspace: ' + (response.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error switching workspace:', error);
    showNotification('Error switching workspace');
  }
}

async function restoreWorkspace(workspaceId) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'restoreWorkspace',
      workspaceId: workspaceId
    });
    
    if (response.success) {
      hideWorkspacesModal();
      await loadTabs(); // Refresh the tab list
      showNotification('Workspace restored successfully');
    } else {
      showNotification('Error restoring workspace: ' + (response.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error restoring workspace:', error);
    showNotification('Error restoring workspace');
  }
}

async function deleteWorkspace(workspaceId, workspaceName) {
  if (confirm(`Are you sure you want to delete the workspace "${workspaceName}"? This action cannot be undone.`)) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'deleteWorkspace',
        workspaceId: workspaceId
      });
      
      if (response.success) {
        showNotification('Workspace deleted successfully');
        await showWorkspacesModal(); // Refresh the list
      } else {
        showNotification('Error deleting workspace: ' + (response.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting workspace:', error);
      showNotification('Error deleting workspace');
    }
  }
}

// Sessions modal
async function showSessionsModal() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getSessions' });
    const sessions = response.sessions || [];
    
    const sessionsList = document.getElementById('sessions-list');
    const noSessions = document.getElementById('no-sessions');
    
    if (sessions.length === 0) {
      sessionsList.innerHTML = '';
      noSessions.classList.remove('hidden');
    } else {
      noSessions.classList.add('hidden');
      
      const sessionsHTML = sessions.map(session => `
        <div class="session-item" data-session-id="${session.id}">
          <div class="session-name">${escapeHtml(session.name)}</div>
          <div class="session-info">
            <span>${session.tabs.length} tabs</span>
            <span>${formatDate(session.timestamp)}</span>
          </div>
        </div>
      `).join('');
      
      sessionsList.innerHTML = sessionsHTML;
      
      // Add click handlers
      sessionsList.querySelectorAll('.session-item').forEach(item => {
        item.addEventListener('click', () => {
          const sessionId = item.dataset.sessionId;
          restoreSession(sessionId);
        });
      });
    }
    
    document.getElementById('sessions-modal').classList.remove('hidden');
  } catch (error) {
    console.error('Error loading sessions:', error);
  }
}

function hideSessionsModal() {
  document.getElementById('sessions-modal').classList.add('hidden');
}

async function restoreSession(sessionId) {
  try {
    await chrome.runtime.sendMessage({
      action: 'restoreSession',
      sessionId: sessionId
    });
    hideSessionsModal();
    await loadTabs();
  } catch (error) {
    console.error('Error restoring session:', error);
  }
}

// Utility functions
function openOptions() {
  chrome.runtime.openOptionsPage();
  window.close();
}

function showLoading(show) {
  const loading = document.getElementById('loading');
  const tabsList = document.getElementById('tabs-list');
  
  if (show) {
    loading.classList.remove('hidden');
    tabsList.style.display = 'none';
  } else {
    loading.classList.add('hidden');
    tabsList.style.display = 'block';
  }
}

function showNotification(message) {
  // Simple notification - could be enhanced with a toast system
  console.log('Notification:', message);
}

function showErrorNotification(message) {
  // Error notification with styling
  console.error('Error:', message);
  
  // Create toast notification element
  const notification = document.createElement('div');
  notification.className = 'error-notification';
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #f44336;
    color: white;
    padding: 12px;
    border-radius: 4px;
    z-index: 10000;
    max-width: 300px;
    font-size: 14px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  `;
  
  document.body.appendChild(notification);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 3000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

// Recovery functionality
async function checkRecoveryData() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getAutoSaveSnapshots' });
    const snapshots = response.snapshots || [];
    
    const recoveryBtn = document.getElementById('recover-workspaces');
    
    if (snapshots.length > 0) {
      recoveryBtn.classList.remove('hidden');
      
      // Check if we should show recovery notification
      const settings = await chrome.storage.sync.get('settings');
      if (settings.settings?.showRecoveryNotifications) {
        const latestSnapshot = snapshots[0];
        const ageMinutes = (Date.now() - latestSnapshot.timestamp) / (1000 * 60);
        
        if (ageMinutes < 60) { // Show if snapshot is less than 1 hour old
          showNotification('Recovery data available from recent session');
        }
      }
    } else {
      recoveryBtn.classList.add('hidden');
    }
  } catch (error) {
    console.error('Error checking recovery data:', error);
  }
}

async function showRecoveryModal() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getAutoSaveSnapshots' });
    const snapshots = response.snapshots || [];
    
    if (snapshots.length === 0) {
      showNotification('No recovery data available');
      return;
    }
    
    renderRecoveryOptions(snapshots);
    document.getElementById('recovery-modal').classList.remove('hidden');
  } catch (error) {
    console.error('Error showing recovery modal:', error);
  }
}

function hideRecoveryModal() {
  document.getElementById('recovery-modal').classList.add('hidden');
}

function renderRecoveryOptions(snapshots) {
  const summaryEl = document.getElementById('recovery-summary');
  const listEl = document.getElementById('recovery-list');
  
  // Render summary
  const totalWorkspaces = snapshots.reduce((sum, s) => sum + (s.metadata?.totalWorkspaces || 0), 0);
  const totalTabs = snapshots.reduce((sum, s) => sum + (s.metadata?.totalTabs || 0), 0);
  
  summaryEl.innerHTML = `
    <p><strong>${snapshots.length}</strong> snapshots available</p>
    <p><strong>${totalWorkspaces}</strong> workspaces can be recovered</p>
    <p><strong>${totalTabs}</strong> total tabs in snapshots</p>
  `;
  
  // Render snapshot list
  const snapshotsHTML = snapshots.map(snapshot => {
    const metadata = WorkspaceUtils.getSnapshotMetadata(snapshot);
    const ageMinutes = Math.round(metadata.age / (1000 * 60));
    const ageText = ageMinutes < 60 ? `${ageMinutes}m ago` : `${Math.round(ageMinutes / 60)}h ago`;
    
    return `
      <div class="recovery-item" data-snapshot-id="${snapshot.id}">
        <div class="recovery-checkbox">
          <input type="checkbox" id="snapshot-${snapshot.id}" value="${snapshot.id}">
        </div>
        <div class="recovery-info">
          <div class="recovery-title">
            <label for="snapshot-${snapshot.id}">
              Snapshot from ${metadata.creationTime}
            </label>
          </div>
          <div class="recovery-metadata">
            <span class="recovery-age">${ageText}</span>
            <span class="recovery-workspaces">${metadata.workspaceCount} workspaces</span>
            <span class="recovery-tabs">${metadata.tabCount} tabs</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  listEl.innerHTML = snapshotsHTML;
  
  // Add event listeners for checkboxes
  listEl.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', updateRecoveryButtons);
  });
  
  updateRecoveryButtons();
}

function updateRecoveryButtons() {
  const checkboxes = document.querySelectorAll('#recovery-list input[type="checkbox"]');
  const checkedBoxes = document.querySelectorAll('#recovery-list input[type="checkbox"]:checked');
  const recoverSelectedBtn = document.getElementById('recover-selected');
  
  recoverSelectedBtn.disabled = checkedBoxes.length === 0;
  recoverSelectedBtn.textContent = checkedBoxes.length > 0 
    ? `Recover Selected (${checkedBoxes.length})` 
    : 'Recover Selected';
}

async function recoverSelectedWorkspaces() {
  try {
    const checkedBoxes = document.querySelectorAll('#recovery-list input[type="checkbox"]:checked');
    const snapshotIds = Array.from(checkedBoxes).map(cb => cb.value);
    
    if (snapshotIds.length === 0) {
      showNotification('No snapshots selected');
      return;
    }
    
    const response = await chrome.runtime.sendMessage({
      action: 'recoverWorkspaces',
      snapshotIds: snapshotIds
    });
    
    if (response.success) {
      showNotification(`Recovered ${snapshotIds.length} workspace snapshots`);
      hideRecoveryModal();
      await showWorkspacesModal(); // Refresh workspaces view
    } else {
      showNotification('Error recovering workspaces: ' + (response.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error recovering selected workspaces:', error);
    showNotification('Error recovering workspaces');
  }
}

async function recoverAllWorkspaces() {
  try {
    const checkboxes = document.querySelectorAll('#recovery-list input[type="checkbox"]');
    const snapshotIds = Array.from(checkboxes).map(cb => cb.value);
    
    const response = await chrome.runtime.sendMessage({
      action: 'recoverWorkspaces',
      snapshotIds: snapshotIds
    });
    
    if (response.success) {
      showNotification(`Recovered all ${snapshotIds.length} workspace snapshots`);
      hideRecoveryModal();
      await showWorkspacesModal(); // Refresh workspaces view
    } else {
      showNotification('Error recovering workspaces: ' + (response.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error recovering all workspaces:', error);
    showNotification('Error recovering workspaces');
  }
}

async function dismissRecovery() {
  try {
    const confirmed = confirm('Are you sure you want to dismiss recovery data? This will clear all auto-save snapshots.');
    
    if (confirmed) {
      const response = await chrome.runtime.sendMessage({ action: 'clearAutoSaveData' });
      
      if (response.success) {
        showNotification('Recovery data cleared');
        hideRecoveryModal();
        await checkRecoveryData(); // Update recovery button visibility
      } else {
        showNotification('Error clearing recovery data');
      }
    }
  } catch (error) {
    console.error('Error dismissing recovery:', error);
    showNotification('Error dismissing recovery');
  }
}

async function updateAutoSaveStatus() {
  try {
    const settings = await chrome.storage.sync.get('settings');
    const autoSaveEnabled = settings.settings?.autoSaveEnabled !== false;
    
    const statusEl = document.getElementById('auto-save-status');
    const textEl = document.getElementById('auto-save-text');
    const timeEl = document.getElementById('last-save-time');
    
    if (autoSaveEnabled) {
      textEl.textContent = 'Auto-save enabled';
      statusEl.classList.remove('disabled');
      
      // Get last save time from snapshots
      const response = await chrome.runtime.sendMessage({ action: 'getAutoSaveSnapshots' });
      const snapshots = response.snapshots || [];
      
      if (snapshots.length > 0) {
        const lastSave = new Date(snapshots[0].timestamp);
        timeEl.textContent = `Last saved: ${formatDate(lastSave.getTime())}`;
        timeEl.classList.remove('hidden');
      } else {
        timeEl.textContent = 'Last saved: Never';
        timeEl.classList.remove('hidden');
      }
    } else {
      textEl.textContent = 'Auto-save disabled';
      statusEl.classList.add('disabled');
      timeEl.classList.add('hidden');
    }
  } catch (error) {
    console.error('Error updating auto-save status:', error);
  }
}

async function toggleAutoSave() {
  try {
    const settings = await chrome.storage.sync.get('settings');
    const currentSettings = settings.settings || {};
    const newAutoSaveState = !currentSettings.autoSaveEnabled;
    
    const updatedSettings = {
      ...currentSettings,
      autoSaveEnabled: newAutoSaveState
    };
    
    await chrome.storage.sync.set({ settings: updatedSettings });
    await updateAutoSaveStatus();
    
    showNotification(`Auto-save ${newAutoSaveState ? 'enabled' : 'disabled'}`);
  } catch (error) {
    console.error('Error toggling auto-save:', error);
    showNotification('Error updating auto-save settings');
  }
}

// Export functions for debugging
window.GodTabsPopup = {
  loadTabs,
  switchToTab,
  closeTab,
  closeDuplicateTabs,
  saveCurrentSession,
  restoreLastSession,
  showWorkspacesModal,
  createWorkspace,
  switchToWorkspace,
  deleteWorkspace,
  showRecoveryModal,
  checkRecoveryData,
  updateAutoSaveStatus,
  toggleAutoSave
};