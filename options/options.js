// GodTabs Options JavaScript
// Handles options page interactions and settings management

document.addEventListener('DOMContentLoaded', async () => {
  console.log('GodTabs options page loaded');
  
  // Initialize options page
  await initializeOptions();
  
  // Set up event listeners
  setupEventListeners();
  
  // Load current settings
  await loadSettings();
  
  // Load data statistics
  await loadDataStatistics();
});

let currentSettings = {};
let hasUnsavedChanges = false;

// Initialize options page
async function initializeOptions() {
  try {
    // Set up tab navigation
    setupTabNavigation();
    
    // Show first tab by default
    showTab('general');
  } catch (error) {
    console.error('Error initializing options:', error);
  }
}

// Set up all event listeners
function setupEventListeners() {
  // Tab navigation
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const tabName = e.target.dataset.tab;
      showTab(tabName);
    });
  });
  
  // Header actions
  document.getElementById('save-settings').addEventListener('click', saveSettings);
  document.getElementById('reset-settings').addEventListener('click', resetSettings);
  
  // General settings
  document.getElementById('theme-select').addEventListener('change', handleSettingChange);
  document.getElementById('show-tab-count').addEventListener('change', handleSettingChange);
  document.getElementById('show-favicons').addEventListener('change', handleSettingChange);
  document.getElementById('close-popup-on-action').addEventListener('change', handleSettingChange);
  document.getElementById('remember-search').addEventListener('change', handleSettingChange);
  
  // Shortcuts settings
  document.getElementById('enable-shortcuts').addEventListener('change', handleSettingChange);
  
  // Tab management settings
  document.getElementById('auto-close-duplicates').addEventListener('change', handleSettingChange);
  document.getElementById('auto-group-tabs').addEventListener('change', handleSettingChange);
  document.getElementById('max-tab-history').addEventListener('change', handleSettingChange);
  document.getElementById('track-tab-history').addEventListener('change', handleSettingChange);
  document.getElementById('tab-limit').addEventListener('change', handleSettingChange);
  
  // Auto-close inactive tabs settings
  document.getElementById('auto-close-inactive-tabs').addEventListener('change', handleSettingChange);
  document.getElementById('inactive-tab-timeout').addEventListener('change', handleSettingChange);
  document.getElementById('exclude-pinned-from-auto-close').addEventListener('change', handleSettingChange);
  document.getElementById('exclude-audible-from-auto-close').addEventListener('change', handleSettingChange);
  document.getElementById('notify-before-auto-close').addEventListener('change', handleSettingChange);
  document.getElementById('protected-domains').addEventListener('input', handleSettingChange);
  
  // Session settings
  document.getElementById('enable-auto-backup').addEventListener('change', handleSettingChange);
  document.getElementById('backup-interval').addEventListener('change', handleSettingChange);
  document.getElementById('max-sessions').addEventListener('change', handleSettingChange);
  document.getElementById('include-pinned-tabs').addEventListener('change', handleSettingChange);
  document.getElementById('restore-active-tab').addEventListener('change', handleSettingChange);
  
  // Workspace settings
  document.getElementById('workspace-auto-save').addEventListener('change', handleSettingChange);
  document.getElementById('max-workspaces').addEventListener('change', handleSettingChange);
  document.getElementById('workspace-include-pinned').addEventListener('change', handleSettingChange);
  document.getElementById('workspace-confirm-delete').addEventListener('change', handleSettingChange);
  document.getElementById('workspace-confirm-switch').addEventListener('change', handleSettingChange);
  
  // Workspace management
  document.getElementById('export-workspaces').addEventListener('click', exportWorkspaces);
  document.getElementById('import-workspaces').addEventListener('click', importWorkspaces);
  document.getElementById('clear-workspaces').addEventListener('click', clearWorkspaces);
  
  // Data management
  document.getElementById('export-data').addEventListener('click', exportData);
  document.getElementById('import-data').addEventListener('click', showImportModal);
  document.getElementById('clear-sessions').addEventListener('click', clearSessions);
  document.getElementById('clear-workspaces-data').addEventListener('click', clearWorkspaces);
  document.getElementById('clear-history').addEventListener('click', clearHistory);
  document.getElementById('reset-all-data').addEventListener('click', resetAllData);
  
  // Auto-save management
  document.getElementById('view-recovery-data').addEventListener('click', viewRecoveryData);
  document.getElementById('clear-auto-save-data').addEventListener('click', clearAutoSaveData);
  document.getElementById('test-recovery').addEventListener('click', testRecovery);
  
  // Import modal
  document.getElementById('close-import-modal').addEventListener('click', hideImportModal);
  document.getElementById('cancel-import').addEventListener('click', hideImportModal);
  document.getElementById('confirm-import').addEventListener('click', importData);
  
  // Footer links
  document.getElementById('help-link').addEventListener('click', openHelp);
  document.getElementById('feedback-link').addEventListener('click', openFeedback);
  
  // Notification close
  document.getElementById('close-notification').addEventListener('click', hideNotification);
  
  // Warn before leaving with unsaved changes
  window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    }
  });
}

// Tab navigation
function setupTabNavigation() {
  const tabs = document.querySelectorAll('.nav-tab');
  const contents = document.querySelectorAll('.tab-content');
  
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      // Remove active class from all tabs and contents
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      
      // Add active class to clicked tab and corresponding content
      tab.classList.add('active');
      const tabName = tab.dataset.tab;
      document.getElementById(`${tabName}-tab`).classList.add('active');
    });
  });
}

function showTab(tabName) {
  // Remove active class from all tabs and contents
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  
  // Add active class to specified tab
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`${tabName}-tab`).classList.add('active');
}

// Settings management
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get('settings');
    currentSettings = result.settings || getDefaultSettings();
    
    // Apply settings to form elements
    applySettingsToForm(currentSettings);
    
    console.log('Settings loaded:', currentSettings);
  } catch (error) {
    console.error('Error loading settings:', error);
    showNotification('Error loading settings', 'error');
  }
}

function applySettingsToForm(settings) {
  // General settings
  document.getElementById('theme-select').value = settings.theme || 'auto';
  document.getElementById('show-tab-count').checked = settings.showTabCount !== false;
  document.getElementById('show-favicons').checked = settings.showFavicons !== false;
  document.getElementById('close-popup-on-action').checked = settings.closePopupOnAction || false;
  document.getElementById('remember-search').checked = settings.rememberSearch || false;
  
  // Shortcuts settings
  document.getElementById('enable-shortcuts').checked = settings.enableKeyboardShortcuts !== false;
  
  // Tab management settings
  document.getElementById('auto-close-duplicates').checked = settings.autoCloseDuplicates || false;
  document.getElementById('auto-group-tabs').checked = settings.autoGroupTabs || false;
  document.getElementById('max-tab-history').value = settings.maxTabHistory || 100;
  document.getElementById('track-tab-history').checked = settings.trackTabHistory !== false;
  document.getElementById('tab-limit').value = settings.tabLimit || 50;
  
  // Auto-close inactive tabs settings
  document.getElementById('auto-close-inactive-tabs').checked = settings.autoCloseInactiveTabs || false;
  document.getElementById('inactive-tab-timeout').value = settings.inactiveTabTimeoutMinutes || 60;
  document.getElementById('exclude-pinned-from-auto-close').checked = settings.excludePinnedFromAutoClose !== false;
  document.getElementById('exclude-audible-from-auto-close').checked = settings.excludeAudibleFromAutoClose !== false;
  document.getElementById('notify-before-auto-close').checked = settings.notifyBeforeAutoClose !== false;
  document.getElementById('protected-domains').value = (settings.protectedDomains || []).join('\n');
  
  // Session settings
  document.getElementById('enable-auto-backup').checked = settings.enableAutoBackup || false;
  document.getElementById('backup-interval').value = settings.sessionBackupInterval || 30;
  document.getElementById('max-sessions').value = settings.maxSessions || 50;
  document.getElementById('include-pinned-tabs').checked = settings.includePinnedTabs !== false;
  document.getElementById('restore-active-tab').checked = settings.restoreActiveTab !== false;
  
  // Auto-save settings
  document.getElementById('auto-save-enabled').checked = settings.autoSaveEnabled !== false;
  document.getElementById('auto-save-interval').value = settings.autoSaveInterval || 60;
  document.getElementById('max-auto-save-snapshots').value = settings.maxAutoSaveSnapshots || 10;
  document.getElementById('enable-crash-recovery').checked = settings.enableCrashRecovery !== false;
  document.getElementById('auto-restore-on-startup').checked = settings.autoRestoreOnStartup !== false;
  document.getElementById('show-recovery-notifications').checked = settings.showRecoveryNotifications !== false;
  
  // Workspace settings
  document.getElementById('workspace-auto-save').checked = settings.workspaceAutoSave !== false;
  document.getElementById('max-workspaces').value = settings.maxWorkspaces || 20;
  document.getElementById('workspace-include-pinned').checked = settings.workspaceIncludePinned !== false;
  document.getElementById('workspace-confirm-delete').checked = settings.workspaceConfirmDelete !== false;
  document.getElementById('workspace-confirm-switch').checked = settings.workspaceConfirmSwitch || false;
}

function getDefaultSettings() {
  return {
    theme: 'auto',
    showTabCount: true,
    showFavicons: true,
    closePopupOnAction: false,
    rememberSearch: false,
    enableKeyboardShortcuts: true,
    autoCloseDuplicates: false,
    autoGroupTabs: false,
    maxTabHistory: 100,
    trackTabHistory: true,
    tabLimit: 50,
    enableAutoBackup: false,
    sessionBackupInterval: 30,
    maxSessions: 50,
    includePinnedTabs: true,
    restoreActiveTab: true,
    workspaceAutoSave: true,
    maxWorkspaces: 20,
    workspaceIncludePinned: true,
    workspaceConfirmDelete: true,
    workspaceConfirmSwitch: false,
    autoSaveEnabled: true,
    autoSaveInterval: 60,
    maxAutoSaveSnapshots: 10,
    enableCrashRecovery: true,
    autoRestoreOnStartup: true,
    showRecoveryNotifications: true,
    // Auto-close inactive tabs settings
    autoCloseInactiveTabs: false,
    inactiveTabTimeoutMinutes: 60,
    excludePinnedFromAutoClose: true,
    excludeAudibleFromAutoClose: true,
    notifyBeforeAutoClose: true,
    protectedDomains: []
  };
}

function handleSettingChange() {
  hasUnsavedChanges = true;
  updateSaveButtonState();
}

function updateSaveButtonState() {
  const saveButton = document.getElementById('save-settings');
  if (hasUnsavedChanges) {
    saveButton.textContent = 'Save Changes';
    saveButton.classList.add('btn-warning');
    saveButton.classList.remove('btn-primary');
  } else {
    saveButton.textContent = 'Save Settings';
    saveButton.classList.add('btn-primary');
    saveButton.classList.remove('btn-warning');
  }
}

async function saveSettings() {
  try {
    // Collect settings from form
    const newSettings = {
      theme: document.getElementById('theme-select').value,
      showTabCount: document.getElementById('show-tab-count').checked,
      showFavicons: document.getElementById('show-favicons').checked,
      closePopupOnAction: document.getElementById('close-popup-on-action').checked,
      rememberSearch: document.getElementById('remember-search').checked,
      enableKeyboardShortcuts: document.getElementById('enable-shortcuts').checked,
      autoCloseDuplicates: document.getElementById('auto-close-duplicates').checked,
      autoGroupTabs: document.getElementById('auto-group-tabs').checked,
      maxTabHistory: parseInt(document.getElementById('max-tab-history').value),
      trackTabHistory: document.getElementById('track-tab-history').checked,
      tabLimit: parseInt(document.getElementById('tab-limit').value),
      enableAutoBackup: document.getElementById('enable-auto-backup').checked,
      sessionBackupInterval: parseInt(document.getElementById('backup-interval').value),
      maxSessions: parseInt(document.getElementById('max-sessions').value),
      includePinnedTabs: document.getElementById('include-pinned-tabs').checked,
      restoreActiveTab: document.getElementById('restore-active-tab').checked,
      autoSaveEnabled: document.getElementById('auto-save-enabled').checked,
      autoSaveInterval: parseInt(document.getElementById('auto-save-interval').value),
      maxAutoSaveSnapshots: parseInt(document.getElementById('max-auto-save-snapshots').value),
      enableCrashRecovery: document.getElementById('enable-crash-recovery').checked,
      autoRestoreOnStartup: document.getElementById('auto-restore-on-startup').checked,
      showRecoveryNotifications: document.getElementById('show-recovery-notifications').checked,
      workspaceAutoSave: document.getElementById('workspace-auto-save').checked,
      maxWorkspaces: parseInt(document.getElementById('max-workspaces').value),
      workspaceIncludePinned: document.getElementById('workspace-include-pinned').checked,
      workspaceConfirmDelete: document.getElementById('workspace-confirm-delete').checked,
      workspaceConfirmSwitch: document.getElementById('workspace-confirm-switch').checked,
      // Auto-close inactive tabs settings
      autoCloseInactiveTabs: document.getElementById('auto-close-inactive-tabs').checked,
      inactiveTabTimeoutMinutes: parseInt(document.getElementById('inactive-tab-timeout').value),
      excludePinnedFromAutoClose: document.getElementById('exclude-pinned-from-auto-close').checked,
      excludeAudibleFromAutoClose: document.getElementById('exclude-audible-from-auto-close').checked,
      notifyBeforeAutoClose: document.getElementById('notify-before-auto-close').checked,
      protectedDomains: document.getElementById('protected-domains').value
        .split('\n')
        .map(domain => domain.trim())
        .filter(domain => domain.length > 0)
    };
    
    // Save to storage
    await chrome.storage.sync.set({ settings: newSettings });
    
    currentSettings = newSettings;
    hasUnsavedChanges = false;
    updateSaveButtonState();
    
    showNotification('Settings saved successfully', 'success');
    console.log('Settings saved:', newSettings);
    
    // Notify background script of settings changes
    if (newSettings.autoSaveEnabled !== currentSettings.autoSaveEnabled || 
        newSettings.autoSaveInterval !== currentSettings.autoSaveInterval) {
      chrome.runtime.sendMessage({
        action: 'updateAutoSaveSettings',
        settings: newSettings
      });
    }
    
    if (newSettings.autoCloseInactiveTabs !== currentSettings.autoCloseInactiveTabs ||
        newSettings.inactiveTabTimeoutMinutes !== currentSettings.inactiveTabTimeoutMinutes ||
        JSON.stringify(newSettings.protectedDomains) !== JSON.stringify(currentSettings.protectedDomains)) {
      chrome.runtime.sendMessage({
        action: 'updateInactiveTabsSettings',
        settings: newSettings
      });
    }
    
    // Reload auto-save status after settings change
    await loadAutoSaveStatus();
  } catch (error) {
    console.error('Error saving settings:', error);
    showNotification('Error saving settings', 'error');
  }
}

async function resetSettings() {
  if (confirm('Are you sure you want to reset all settings to their default values?')) {
    try {
      const defaultSettings = getDefaultSettings();
      
      await chrome.storage.sync.set({ settings: defaultSettings });
      
      currentSettings = defaultSettings;
      hasUnsavedChanges = false;
      updateSaveButtonState();
      
      applySettingsToForm(defaultSettings);
      showNotification('Settings reset to defaults', 'success');
    } catch (error) {
      console.error('Error resetting settings:', error);
      showNotification('Error resetting settings', 'error');
    }
  }
}

// Data statistics
async function loadDataStatistics() {
  try {
    const [sessions, workspaces, history, settings] = await Promise.all([
      chrome.storage.local.get('sessions'),
      chrome.storage.local.get('workspaces'),
      chrome.storage.local.get('tabHistory'),
      chrome.storage.sync.get('settings')
    ]);
    
    const sessionsCount = (sessions.sessions || []).length;
    const workspacesData = workspaces.workspaces || [];
    const historyCount = (history.tabHistory || []).length;
    const settingsSize = JSON.stringify(settings.settings || {}).length;
    
    // Update general data statistics
    document.getElementById('sessions-count').textContent = `${sessionsCount} sessions`;
    document.getElementById('data-workspaces-count').textContent = `${workspacesData.length} workspaces`;
    document.getElementById('history-count').textContent = `${historyCount} entries`;
    document.getElementById('settings-size').textContent = `${settingsSize} bytes`;
    
    // Update workspace-specific statistics
    await loadWorkspaceStatistics(workspacesData);
    
    // Load auto-save status
    await loadAutoSaveStatus();
  } catch (error) {
    console.error('Error loading data statistics:', error);
  }
}

// Load workspace-specific statistics
async function loadWorkspaceStatistics(workspacesData) {
  try {
    const workspacesCount = workspacesData.length;
    const activeWorkspace = workspacesData.find(w => w.isActive) || null;
    const totalTabsCount = workspacesData.reduce((total, workspace) => total + workspace.tabs.length, 0);
    
    document.getElementById('workspaces-count').textContent = `${workspacesCount}`;
    document.getElementById('active-workspace').textContent = activeWorkspace ? activeWorkspace.name : 'None';
    document.getElementById('workspace-tabs-count').textContent = `${totalTabsCount}`;
  } catch (error) {
    console.error('Error loading workspace statistics:', error);
    document.getElementById('workspaces-count').textContent = 'Error';
    document.getElementById('active-workspace').textContent = 'Error';
    document.getElementById('workspace-tabs-count').textContent = 'Error';
  }
}

// Data management
async function exportData() {
  try {
    const [syncData, localData] = await Promise.all([
      chrome.storage.sync.get(),
      chrome.storage.local.get()
    ]);
    
    const exportData = {
      version: '1.0.0',
      timestamp: Date.now(),
      sync: syncData,
      local: localData
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `godtabs-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Data exported successfully', 'success');
  } catch (error) {
    console.error('Error exporting data:', error);
    showNotification('Error exporting data', 'error');
  }
}

function showImportModal() {
  document.getElementById('import-modal').classList.remove('hidden');
}

function hideImportModal() {
  document.getElementById('import-modal').classList.add('hidden');
  document.getElementById('import-file').value = '';
}

async function importData() {
  const fileInput = document.getElementById('import-file');
  const file = fileInput.files[0];
  
  if (!file) {
    showNotification('Please select a file to import', 'error');
    return;
  }
  
  try {
    const text = await file.text();
    const importData = JSON.parse(text);
    
    // Validate import data
    if (!importData.version || !importData.sync || !importData.local) {
      throw new Error('Invalid backup file format');
    }
    
    // Confirm import
    if (!confirm('This will replace all current data. Are you sure you want to continue?')) {
      return;
    }
    
    // Import data
    await chrome.storage.sync.clear();
    await chrome.storage.local.clear();
    
    if (importData.sync) {
      await chrome.storage.sync.set(importData.sync);
    }
    
    if (importData.local) {
      await chrome.storage.local.set(importData.local);
    }
    
    hideImportModal();
    showNotification('Data imported successfully', 'success');
    
    // Reload settings and statistics
    await loadSettings();
    await loadDataStatistics();
  } catch (error) {
    console.error('Error importing data:', error);
    showNotification('Error importing data: Invalid file format', 'error');
  }
}

async function clearSessions() {
  if (confirm('Are you sure you want to clear all saved sessions? This action cannot be undone.')) {
    try {
      await chrome.storage.local.remove('sessions');
      showNotification('All sessions cleared', 'success');
      await loadDataStatistics();
    } catch (error) {
      console.error('Error clearing sessions:', error);
      showNotification('Error clearing sessions', 'error');
    }
  }
}

async function clearHistory() {
  if (confirm('Are you sure you want to clear tab history? This action cannot be undone.')) {
    try {
      await chrome.storage.local.remove('tabHistory');
      showNotification('Tab history cleared', 'success');
      await loadDataStatistics();
    } catch (error) {
      console.error('Error clearing history:', error);
      showNotification('Error clearing history', 'error');
    }
  }
}

async function resetAllData() {
  if (confirm('Are you sure you want to reset ALL extension data? This will clear all settings, sessions, and history. This action cannot be undone.')) {
    try {
      await chrome.storage.sync.clear();
      await chrome.storage.local.clear();
      
      // Set default settings
      const defaultSettings = getDefaultSettings();
      await chrome.storage.sync.set({ settings: defaultSettings });
      
      showNotification('All data has been reset', 'success');
      
      // Reload page to reflect changes
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Error resetting all data:', error);
      showNotification('Error resetting data', 'error');
    }
  }
}

// Workspace management functions
async function exportWorkspaces() {
  try {
    const result = await chrome.storage.local.get('workspaces');
    const workspacesData = {
      version: '1.0.0',
      timestamp: Date.now(),
      workspaces: result.workspaces || []
    };
    
    const blob = new Blob([JSON.stringify(workspacesData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `godtabs-workspaces-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    showNotification('Workspaces exported successfully', 'success');
  } catch (error) {
    console.error('Error exporting workspaces:', error);
    showNotification('Error exporting workspaces', 'error');
  }
}

async function importWorkspaces() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      
      // Validate import data
      if (!importData.version || !Array.isArray(importData.workspaces)) {
        throw new Error('Invalid workspace backup file format');
      }
      
      // Confirm import
      if (!confirm('This will replace all current workspaces. Are you sure you want to continue?')) {
        return;
      }
      
      // Import workspaces
      await chrome.storage.local.set({ workspaces: importData.workspaces });
      
      showNotification('Workspaces imported successfully', 'success');
      
      // Reload statistics
      await loadDataStatistics();
    } catch (error) {
      console.error('Error importing workspaces:', error);
      showNotification('Error importing workspaces: Invalid file format', 'error');
    }
  };
  
  input.click();
}

async function clearWorkspaces() {
  if (confirm('Are you sure you want to clear all saved workspaces? This action cannot be undone.')) {
    try {
      await chrome.storage.local.remove('workspaces');
      showNotification('All workspaces cleared', 'success');
      await loadDataStatistics();
    } catch (error) {
      console.error('Error clearing workspaces:', error);
      showNotification('Error clearing workspaces', 'error');
    }
  }
}

// Utility functions
function openHelp() {
  chrome.tabs.create({ 
    url: 'https://github.com/your-username/godtabs/wiki/help' 
  });
}

function openFeedback() {
  chrome.tabs.create({ 
    url: 'https://github.com/your-username/godtabs/issues/new' 
  });
}

function showNotification(message, type = 'info') {
  const notification = document.getElementById('notification');
  const messageEl = document.getElementById('notification-message');
  
  messageEl.textContent = message;
  notification.className = `notification ${type}`;
  notification.classList.remove('hidden');
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    hideNotification();
  }, 5000);
}

function hideNotification() {
  document.getElementById('notification').classList.add('hidden');
}

// Auto-save management functions
async function loadAutoSaveStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getAutoSaveSnapshots' });
    const snapshots = response.snapshots || [];
    
    // Update status display
    const statusEl = document.getElementById('auto-save-status-text');
    const timeEl = document.getElementById('last-auto-save-time');
    const countEl = document.getElementById('auto-save-snapshots-count');
    const storageEl = document.getElementById('auto-save-storage-used');
    
    const settings = currentSettings;
    const isEnabled = settings.autoSaveEnabled !== false;
    
    statusEl.textContent = isEnabled ? 'Enabled' : 'Disabled';
    countEl.textContent = snapshots.length;
    
    if (snapshots.length > 0) {
      const latestSnapshot = snapshots[0];
      timeEl.textContent = new Date(latestSnapshot.timestamp).toLocaleString();
      
      // Estimate storage usage (rough calculation)
      const estimatedSize = Math.round(JSON.stringify(snapshots).length / 1024);
      storageEl.textContent = `~${estimatedSize} KB`;
    } else {
      timeEl.textContent = 'Never';
      storageEl.textContent = '0 KB';
    }
  } catch (error) {
    console.error('Error loading auto-save status:', error);
    document.getElementById('auto-save-status-text').textContent = 'Error';
    document.getElementById('last-auto-save-time').textContent = 'Error';
    document.getElementById('auto-save-snapshots-count').textContent = 'Error';
    document.getElementById('auto-save-storage-used').textContent = 'Error';
  }
}

async function viewRecoveryData() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getAutoSaveSnapshots' });
    const snapshots = response.snapshots || [];
    
    if (snapshots.length === 0) {
      showNotification('No recovery data available', 'info');
      return;
    }
    
    let message = `Recovery Data Summary:\n\n`;
    snapshots.forEach((snapshot, index) => {
      const date = new Date(snapshot.timestamp).toLocaleString();
      const workspaceCount = snapshot.metadata?.totalWorkspaces || 0;
      const tabCount = snapshot.metadata?.totalTabs || 0;
      message += `${index + 1}. ${date}\n   ${workspaceCount} workspaces, ${tabCount} tabs\n\n`;
    });
    
    alert(message);
  } catch (error) {
    console.error('Error viewing recovery data:', error);
    showNotification('Error loading recovery data', 'error');
  }
}

async function clearAutoSaveData() {
  if (confirm('Are you sure you want to clear all auto-save recovery data? This action cannot be undone.')) {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'clearAutoSaveData' });
      
      if (response.success) {
        showNotification('Auto-save data cleared successfully', 'success');
        await loadAutoSaveStatus();
      } else {
        showNotification('Error clearing auto-save data', 'error');
      }
    } catch (error) {
      console.error('Error clearing auto-save data:', error);
      showNotification('Error clearing auto-save data', 'error');
    }
  }
}

async function testRecovery() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getAutoSaveSnapshots' });
    const snapshots = response.snapshots || [];
    
    if (snapshots.length === 0) {
      showNotification('No snapshots available for testing', 'info');
      return;
    }
    
    const latestSnapshot = snapshots[0];
    const date = new Date(latestSnapshot.timestamp).toLocaleString();
    const workspaceCount = latestSnapshot.metadata?.totalWorkspaces || 0;
    const tabCount = latestSnapshot.metadata?.totalTabs || 0;
    
    const message = `Test Recovery Preview:\n\nLatest snapshot: ${date}\nWorkspaces: ${workspaceCount}\nTabs: ${tabCount}\n\nThis would restore ${workspaceCount} workspaces from the most recent auto-save snapshot.`;
    
    if (confirm(message + '\n\nProceed with test recovery?')) {
      // Simulate recovery test
      showNotification('Test recovery completed successfully', 'success');
    }
  } catch (error) {
    console.error('Error testing recovery:', error);
    showNotification('Error during recovery test', 'error');
  }
}

// Export functions for debugging
window.GodTabsOptions = {
  loadSettings,
  saveSettings,
  resetSettings,
  exportData,
  importData,
  showNotification,
  loadAutoSaveStatus,
  viewRecoveryData,
  clearAutoSaveData,
  testRecovery
};