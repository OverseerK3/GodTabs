// GodTabs Background Service Worker
// Handles extension lifecycle, tab management, and storage operations

// Initialize extension on installation
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('GodTabs extension installed/updated');
  
  // Initialize default settings
  const defaultSettings = {
    autoCloseDuplicates: false,
    sessionBackupInterval: 30, // minutes
    maxTabHistory: 100,
    theme: 'auto',
    enableKeyboardShortcuts: true,
    showTabCount: true,
    autoSaveEnabled: true,
    autoSaveInterval: 60, // seconds
    maxAutoSaveSnapshots: 10,
    enableCrashRecovery: true,
    autoRestoreOnStartup: true,
    showRecoveryNotifications: true,
    // Auto-close inactive tabs settings
    autoCloseInactiveTabs: false,
    inactiveTabTimeoutMinutes: 60, // 1 hour default
    excludePinnedFromAutoClose: true,
    excludeAudibleFromAutoClose: true,
    notifyBeforeAutoClose: true,
    protectedDomains: [] // Domains to never auto-close
  };
  
  // Set default settings if not already present
  const existingSettings = await chrome.storage.sync.get('settings');
  if (!existingSettings.settings) {
    await chrome.storage.sync.set({ settings: defaultSettings });
  }
  
  // Initialize session storage
  const sessions = await chrome.storage.local.get('sessions');
  if (!sessions.sessions) {
    await chrome.storage.local.set({ sessions: [] });
  }
  
  // Initialize workspace storage
  const workspaces = await chrome.storage.local.get('workspaces');
  if (!workspaces.workspaces) {
    await chrome.storage.local.set({ workspaces: [] });
  }
  
  // Initialize auto-save storage
  const autoSaveSnapshots = await chrome.storage.local.get('autoSaveSnapshots');
  if (!autoSaveSnapshots.autoSaveSnapshots) {
    await chrome.storage.local.set({ autoSaveSnapshots: [] });
  }
  
  const recoveryData = await chrome.storage.local.get('recoveryData');
  if (!recoveryData.recoveryData) {
    await chrome.storage.local.set({ recoveryData: {} });
  }
  
  // Initialize tab activity tracking storage
  const tabActivity = await chrome.storage.local.get('tabActivity');
  if (!tabActivity.tabActivity) {
    await chrome.storage.local.set({ tabActivity: {} });
  }
});

// Handle extension startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('GodTabs extension started');
  
  // Crash detection and recovery
  await detectAndRecoverFromCrash();
  
  // Set extension running flag
  await chrome.storage.local.set({ extensionRunning: true });
  
  // Restore any auto-backup sessions if enabled
  const settings = await chrome.storage.sync.get('settings');
  if (settings.settings?.sessionBackupInterval > 0) {
    scheduleSessionBackup(settings.settings.sessionBackupInterval);
  }
  
  // Initialize auto-save if enabled
  if (settings.settings?.autoSaveEnabled) {
    initializeAutoSave();
  }
  
  // Initialize inactive tab cleanup if enabled
  if (settings.settings?.autoCloseInactiveTabs) {
    initializeInactiveTabCleanup();
  }
});

// Handle tab updates for various features
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Check for duplicate tabs if auto-close is enabled
    const settings = await chrome.storage.sync.get('settings');
    if (settings.settings?.autoCloseDuplicates) {
      await closeDuplicateTabs(tab);
    }
    
    // Update tab history
    await updateTabHistory(tab);
    
    // Update tab activity tracking
    await updateTabActivity(tabId);
  }
});

// Handle tab activation for activity tracking
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await updateTabActivity(activeInfo.tabId);
});

// Handle tab creation for activity tracking
chrome.tabs.onCreated.addListener(async (tab) => {
  await updateTabActivity(tab.id);
});

// Handle tab removal to clean up activity data
chrome.tabs.onRemoved.addListener(async (tabId) => {
  await cleanupTabActivity(tabId);
});

// Handle keyboard commands
chrome.commands.onCommand.addListener(async (command) => {
  console.log('Command received:', command);
  
  switch (command) {
    case 'save_session':
      await saveCurrentSession();
      break;
    case 'create_workspace':
      await createCurrentWorkspace();
      break;
    case 'switch_workspace':
      await cycleThroughWorkspaces();
      break;
    default:
      console.log('Unknown command:', command);
  }
});

// Tab management functions
async function closeDuplicateTabs(currentTab) {
  try {
    const tabs = await chrome.tabs.query({});
    const duplicates = tabs.filter(tab => 
      tab.url === currentTab.url && 
      tab.id !== currentTab.id && 
      !tab.pinned
    );
    
    if (duplicates.length > 0) {
      const tabIds = duplicates.map(tab => tab.id);
      await chrome.tabs.remove(tabIds);
      console.log(`Closed ${duplicates.length} duplicate tabs`);
    }
  } catch (error) {
    console.error('Error closing duplicate tabs:', error);
  }
}

async function closeAllDuplicates() {
  try {
    const tabs = await chrome.tabs.query({});
    const urlMap = new Map();
    const duplicates = [];
    
    tabs.forEach(tab => {
      if (tab.url && !tab.pinned) {
        if (urlMap.has(tab.url)) {
          duplicates.push(tab.id);
        } else {
          urlMap.set(tab.url, tab.id);
        }
      }
    });
    
    if (duplicates.length > 0) {
      await chrome.tabs.remove(duplicates);
      showNotification(`Closed ${duplicates.length} duplicate tabs`);
    }
  } catch (error) {
    console.error('Error closing all duplicates:', error);
  }
}

// Session management functions
async function saveCurrentSession() {
  try {
    const tabs = await chrome.tabs.query({});
    const session = {
      id: Date.now().toString(),
      name: `Session ${new Date().toLocaleString()}`,
      timestamp: Date.now(),
      tabs: tabs.map(tab => ({
        url: tab.url,
        title: tab.title,
        pinned: tab.pinned,
        active: tab.active
      }))
    };
    
    const { sessions = [] } = await chrome.storage.local.get('sessions');
    sessions.unshift(session);
    
    // Keep only the latest 50 sessions
    if (sessions.length > 50) {
      sessions.splice(50);
    }
    
    await chrome.storage.local.set({ sessions });
    showNotification('Session saved successfully');
  } catch (error) {
    console.error('Error saving session:', error);
  }
}

async function restoreLastSession() {
  try {
    const { sessions = [] } = await chrome.storage.local.get('sessions');
    if (sessions.length === 0) {
      showNotification('No saved sessions found');
      return;
    }
    
    const lastSession = sessions[0];
    for (const tabData of lastSession.tabs) {
      await chrome.tabs.create({
        url: tabData.url,
        pinned: tabData.pinned,
        active: false
      });
    }
    
    showNotification(`Restored session: ${lastSession.name}`);
  } catch (error) {
    console.error('Error restoring session:', error);
  }
}

// Tab history management
async function updateTabHistory(tab) {
  try {
    const { tabHistory = [] } = await chrome.storage.local.get('tabHistory');
    
    // Remove existing entry for this URL
    const filteredHistory = tabHistory.filter(entry => entry.url !== tab.url);
    
    // Add new entry at the beginning
    filteredHistory.unshift({
      url: tab.url,
      title: tab.title,
      timestamp: Date.now(),
      favicon: tab.favIconUrl
    });
    
    // Keep only the latest entries based on settings
    const settings = await chrome.storage.sync.get('settings');
    const maxHistory = settings.settings?.maxTabHistory || 100;
    if (filteredHistory.length > maxHistory) {
      filteredHistory.splice(maxHistory);
    }
    
    await chrome.storage.local.set({ tabHistory: filteredHistory });
  } catch (error) {
    console.error('Error updating tab history:', error);
  }
}

// Tab activity tracking for auto-suspend inactive tabs
async function updateTabActivity(tabId) {
  try {
    const now = Date.now();
    const { tabActivity = {} } = await chrome.storage.local.get('tabActivity');
    
    // Update the last accessed time for this tab
    tabActivity[tabId] = {
      lastAccessed: now,
      createdAt: tabActivity[tabId]?.createdAt || now,
      suspended: false, // Mark as active when accessed
      suspendedAt: null
    };
    
    await chrome.storage.local.set({ tabActivity });
  } catch (error) {
    console.error('Error updating tab activity:', error);
  }
}

async function cleanupTabActivity(tabId) {
  try {
    const { tabActivity = {} } = await chrome.storage.local.get('tabActivity');
    
    if (tabActivity[tabId]) {
      delete tabActivity[tabId];
      await chrome.storage.local.set({ tabActivity });
    }
  } catch (error) {
    console.error('Error cleaning up tab activity:', error);
  }
}

// Session backup scheduling
function scheduleSessionBackup(intervalMinutes) {
  setInterval(async () => {
    await saveCurrentSession();
  }, intervalMinutes * 60 * 1000);
}

// Auto-save functionality
let autoSaveTimer = null;
let autoSaveInitMutex = false;
const AUTO_SAVE_DEBOUNCE_MS = 5000; // Minimum time between auto-save attempts

/**
 * Initializes the auto-save system with efficient, non-blocking operation
 * Sets up interval timer and handles configuration changes gracefully
 * Uses mutex pattern to prevent race conditions
 */
async function initializeAutoSave() {
  // Prevent concurrent initialization
  if (autoSaveInitMutex) {
    console.log('Auto-save initialization already in progress, skipping');
    return;
  }
  
  autoSaveInitMutex = true;
  
  try {
    // Get current settings with fallback defaults
    const settings = await chrome.storage.sync.get('settings');
    const interval = Math.max(settings.settings?.autoSaveInterval || 60, 10); // Minimum 10 seconds
    
    // Clear existing timer to prevent multiple timers
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer);
      autoSaveTimer = null;
    }
    
    // Only initialize if auto-save is enabled
    if (!settings.settings?.autoSaveEnabled) {
      console.log('Auto-save is disabled, skipping initialization');
      return;
    }
    
    // Start non-blocking auto-save timer
    autoSaveTimer = setInterval(() => {
      // Use setTimeout to make the snapshot creation non-blocking
      setTimeout(() => {
        createWorkspaceSnapshot().catch(error => {
          console.error('Auto-save snapshot creation failed:', error);
        });
      }, 0);
    }, interval * 1000);
    
    console.log(`Auto-save initialized with ${interval}s interval`);
  } catch (error) {
    console.error('Error initializing auto-save:', error);
    // Ensure timer is cleared on error
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer);
      autoSaveTimer = null;
    }
  } finally {
    autoSaveInitMutex = false;
  }
}

/**
 * Creates a workspace snapshot with efficient, atomic operation
 * Prevents data corruption by using temporary storage and atomic swaps
 * Implements debouncing to avoid excessive snapshot creation
 */
async function createWorkspaceSnapshot() {
  // Check if auto-save is temporarily disabled due to failures
  const now = Date.now();
  if (autoSaveDisabledUntil > now) {
    console.log(`Auto-save disabled until ${new Date(autoSaveDisabledUntil).toISOString()}, skipping snapshot`);
    return;
  }
  
  // Debounce: Skip if another save is in progress or too recent
  if (isAutoSaveInProgress || (now - lastAutoSaveAttempt) < AUTO_SAVE_DEBOUNCE_MS) {
    console.log('Auto-save skipped: operation in progress or too recent');
    return;
  }
  
  // Set flags to prevent concurrent operations
  isAutoSaveInProgress = true;
  lastAutoSaveAttempt = now;
  
  let tempSnapshot = null;
  
  try {
    // Step 1: Check if auto-save is still enabled (settings might have changed)
    const settings = await chrome.storage.sync.get('settings');
    if (!settings.settings?.autoSaveEnabled) {
      console.log('Auto-save disabled during snapshot creation, aborting');
      return;
    }
    
    // Step 2: Gather data efficiently using Promise.all for parallel operations
    const [tabs, workspaces] = await Promise.all([
      chrome.tabs.query({}),
      chrome.storage.local.get('workspaces')
    ]);
    
    // Step 3: Filter and process tabs efficiently
    const validTabs = tabs.filter(tab => 
      tab.url && 
      !tab.url.startsWith('chrome://') && 
      !tab.url.startsWith('chrome-extension://') &&
      !tab.url.startsWith('moz-extension://')
    );
    
    // Step 4: Create snapshot object with comprehensive metadata
    const snapshotId = `snapshot_${now}_${Math.random().toString(36).substr(2, 9)}`;
    tempSnapshot = {
      id: snapshotId,
      timestamp: now,
      sessionId: `session_${now}`,
      version: '1.1', // Updated version for new format
      workspaces: workspaces.workspaces || [],
      tabs: validTabs.map(tab => ({
        id: tab.id,
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl,
        pinned: tab.pinned,
        windowId: tab.windowId,
        index: tab.index,
        active: tab.active
      })),
      metadata: {
        totalTabs: validTabs.length,
        totalWorkspaces: (workspaces.workspaces || []).length,
        userAgent: navigator.userAgent,
        extensionVersion: chrome.runtime.getManifest().version,
        createdAt: new Date(now).toISOString(),
        platform: 'chrome-extension'
      }
    };
    
    // Step 5: Validate snapshot integrity before saving
    if (!validateWorkspaceSnapshot(tempSnapshot)) {
      throw new Error('Snapshot validation failed');
    }
    
    // Step 6: Save using atomic operation to prevent corruption
    await saveWorkspaceSnapshotAtomic(tempSnapshot);
    
    console.log(`Auto-save completed successfully: ${snapshotId} (${validTabs.length} tabs, ${(workspaces.workspaces || []).length} workspaces)`);
    
  } catch (error) {
    console.error('Error creating workspace snapshot:', error);
    
    // Step 7: Attempt cleanup of any partial data if temp snapshot was created
    if (tempSnapshot) {
      try {
        await cleanupFailedSnapshot(tempSnapshot.id);
      } catch (cleanupError) {
        console.error('Failed to cleanup after snapshot error:', cleanupError);
      }
    }
    
    // Optional: Disable auto-save temporarily if there are repeated failures
    await handleAutoSaveFailure(error);
    
  } finally {
    // Always reset the progress flag
    isAutoSaveInProgress = false;
  }
}

/**
 * Enhanced snapshot validation with comprehensive checks
 * Ensures data integrity before storage operations
 */
function validateWorkspaceSnapshot(snapshot) {
  try {
    // Basic structure validation
    if (!snapshot || typeof snapshot !== 'object') {
      console.error('Snapshot validation failed: invalid snapshot object');
      return false;
    }
    
    // Required field validation
    const requiredFields = ['id', 'timestamp', 'sessionId', 'version', 'workspaces', 'tabs', 'metadata'];
    for (const field of requiredFields) {
      if (!(field in snapshot)) {
        console.error(`Snapshot validation failed: missing required field '${field}'`);
        return false;
      }
    }
    
    // Type validation
    if (!Array.isArray(snapshot.workspaces)) {
      console.error('Snapshot validation failed: workspaces must be an array');
      return false;
    }
    
    if (!Array.isArray(snapshot.tabs)) {
      console.error('Snapshot validation failed: tabs must be an array');
      return false;
    }
    
    if (typeof snapshot.timestamp !== 'number' || snapshot.timestamp <= 0) {
      console.error('Snapshot validation failed: invalid timestamp');
      return false;
    }
    
    // Data size validation (prevent excessive memory usage)
    const maxTabs = 1000;
    const maxWorkspaces = 100;
    
    if (snapshot.tabs.length > maxTabs) {
      console.warn(`Snapshot has ${snapshot.tabs.length} tabs, exceeding maximum of ${maxTabs}`);
      return false;
    }
    
    if (snapshot.workspaces.length > maxWorkspaces) {
      console.warn(`Snapshot has ${snapshot.workspaces.length} workspaces, exceeding maximum of ${maxWorkspaces}`);
      return false;
    }
    
    // Tab validation
    for (const tab of snapshot.tabs) {
      if (!tab.url || typeof tab.url !== 'string') {
        console.error('Snapshot validation failed: tab missing valid URL');
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error during snapshot validation:', error);
    return false;
  }
}

/**
 * Atomic snapshot saving operation to prevent data corruption
 * Uses temporary storage and atomic swaps to ensure data integrity
 */
async function saveWorkspaceSnapshotAtomic(snapshot) {
  const tempKey = `temp_snapshot_${snapshot.id}`;
  
  try {
    // Step 1: Get current snapshots and settings
    const [currentData, settings] = await Promise.all([
      chrome.storage.local.get('autoSaveSnapshots'),
      chrome.storage.sync.get('settings')
    ]);
    
    const autoSaveSnapshots = currentData.autoSaveSnapshots || [];
    const maxSnapshots = Math.max(settings.settings?.maxAutoSaveSnapshots || 10, 1);
    
    // Step 2: Save snapshot to temporary location first
    await chrome.storage.local.set({ [tempKey]: snapshot });
    
    // Step 3: Verify temporary save was successful
    const tempVerification = await chrome.storage.local.get(tempKey);
    if (!tempVerification[tempKey] || tempVerification[tempKey].id !== snapshot.id) {
      throw new Error('Temporary snapshot save verification failed');
    }
    
    // Step 4: Prepare new snapshots array
    const newSnapshots = [snapshot, ...autoSaveSnapshots];
    
    // Step 5: Trim to maximum allowed snapshots
    if (newSnapshots.length > maxSnapshots) {
      newSnapshots.splice(maxSnapshots);
    }
    
    // Step 6: Atomically update the main snapshots array
    await chrome.storage.local.set({ autoSaveSnapshots: newSnapshots });
    
    // Step 7: Verify main save was successful
    const verification = await chrome.storage.local.get('autoSaveSnapshots');
    const savedSnapshot = verification.autoSaveSnapshots?.[0];
    
    if (!savedSnapshot || savedSnapshot.id !== snapshot.id) {
      throw new Error('Main snapshot save verification failed');
    }
    
    // Step 8: Clean up temporary storage
    await chrome.storage.local.remove(tempKey);
    
    // Step 9: Reset failure tracking on successful save
    resetAutoSaveFailureTracking();
    
    console.log(`Snapshot saved atomically: ${snapshot.id} (${newSnapshots.length}/${maxSnapshots} snapshots)`);
    
  } catch (error) {
    // Cleanup temporary storage on error
    try {
      await chrome.storage.local.remove(tempKey);
    } catch (cleanupError) {
      console.error('Failed to cleanup temporary snapshot:', cleanupError);
    }
    
    throw new Error(`Atomic snapshot save failed: ${error.message}`);
  }
}

/**
 * Legacy snapshot saving function - kept for backward compatibility
 * @deprecated Use saveWorkspaceSnapshotAtomic instead
 */
async function saveWorkspaceSnapshot(snapshot) {
  console.warn('Using deprecated saveWorkspaceSnapshot - consider upgrading to saveWorkspaceSnapshotAtomic');
  return saveWorkspaceSnapshotAtomic(snapshot);
}

/**
 * Cleans up failed snapshot data to prevent storage pollution
 * Removes any temporary or corrupted snapshot entries
 */
async function cleanupFailedSnapshot(snapshotId) {
  try {
    const tempKey = `temp_snapshot_${snapshotId}`;
    
    // Remove any temporary storage
    await chrome.storage.local.remove(tempKey);
    
    // Check if the failed snapshot made it into the main array
    const { autoSaveSnapshots = [] } = await chrome.storage.local.get('autoSaveSnapshots');
    const filteredSnapshots = autoSaveSnapshots.filter(snapshot => 
      snapshot && snapshot.id !== snapshotId
    );
    
    // Update storage if we found and removed the corrupted snapshot
    if (filteredSnapshots.length !== autoSaveSnapshots.length) {
      await chrome.storage.local.set({ autoSaveSnapshots: filteredSnapshots });
      console.log(`Cleaned up corrupted snapshot: ${snapshotId}`);
    }
    
  } catch (error) {
    console.error(`Failed to cleanup snapshot ${snapshotId}:`, error);
  }
}

/**
 * Handles auto-save failures with intelligent retry and fallback mechanisms
 * Implements exponential backoff and temporary disabling for repeated failures
 */
let autoSaveFailureCount = 0;
let autoSaveDisabledUntil = 0;
const MAX_CONSECUTIVE_FAILURES = 3;
const FAILURE_TIMEOUT_MS = 300000; // 5 minutes

async function handleAutoSaveFailure(error) {
  try {
    autoSaveFailureCount++;
    const now = Date.now();
    
    console.error(`Auto-save failure #${autoSaveFailureCount}:`, error.message);
    
    // If we've had too many consecutive failures, temporarily disable auto-save
    if (autoSaveFailureCount >= MAX_CONSECUTIVE_FAILURES) {
      autoSaveDisabledUntil = now + FAILURE_TIMEOUT_MS;
      
      // Clear the auto-save timer to stop further attempts
      if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
        autoSaveTimer = null;
      }
      
      console.warn(`Auto-save temporarily disabled due to ${autoSaveFailureCount} consecutive failures. Will re-enable at ${new Date(autoSaveDisabledUntil).toISOString()}`);
      
      // Schedule re-initialization
      setTimeout(() => {
        initializeAutoSave().catch(err => {
          console.error('Failed to re-initialize auto-save after failure timeout:', err);
        });
      }, FAILURE_TIMEOUT_MS);
      
    } else {
      // For sporadic failures, just log and continue
      console.log(`Auto-save will continue, failure count: ${autoSaveFailureCount}/${MAX_CONSECUTIVE_FAILURES}`);
    }
    
  } catch (handlingError) {
    console.error('Error while handling auto-save failure:', handlingError);
  }
}

/**
 * Resets auto-save failure tracking when a successful save occurs
 * Called internally by saveWorkspaceSnapshotAtomic on success
 */
function resetAutoSaveFailureTracking() {
  if (autoSaveFailureCount > 0) {
    console.log(`Auto-save recovered after ${autoSaveFailureCount} failures`);
    autoSaveFailureCount = 0;
    autoSaveDisabledUntil = 0;
  }
}

/**
 * Manually triggers an auto-save snapshot creation
 * Can be called from popup or options page for immediate backup
 */
async function triggerManualAutoSave() {
  try {
    console.log('Manual auto-save triggered');
    
    // Temporarily reset failure tracking for manual saves
    const originalFailureCount = autoSaveFailureCount;
    autoSaveFailureCount = 0;
    autoSaveDisabledUntil = 0;
    
    await createWorkspaceSnapshot();
    
    console.log('Manual auto-save completed successfully');
    return { success: true, message: 'Auto-save completed successfully' };
    
  } catch (error) {
    // Restore original failure count if manual save fails
    autoSaveFailureCount = originalFailureCount;
    
    console.error('Manual auto-save failed:', error);
    return { success: false, message: `Auto-save failed: ${error.message}` };
  }
}

/**
 * Handles auto-save settings changes and reinitializes if needed
 * Called when user changes auto-save settings in options page
 */
async function handleAutoSaveSettingsChange(newSettings) {
  try {
    console.log('Auto-save settings changed, reinitializing...');
    
    // Clear existing timer
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer);
      autoSaveTimer = null;
    }
    
    // Reset failure tracking on settings change
    resetAutoSaveFailureTracking();
    
    // Reinitialize with new settings if enabled
    if (newSettings.autoSaveEnabled) {
      await initializeAutoSave();
    } else {
      console.log('Auto-save disabled by user settings');
    }
    
  } catch (error) {
    console.error('Error handling auto-save settings change:', error);
  }
}

// Inactive tabs cleanup functionality
let inactiveTabsTimer = null;
let inactiveTabsInitMutex = false;

/**
 * Initializes the inactive tabs cleanup system
 * Sets up periodic checks to suspend tabs that exceed the inactivity timeout
 * Uses mutex pattern to prevent race conditions
 */
async function initializeInactiveTabCleanup() {
  // Prevent concurrent initialization
  if (inactiveTabsInitMutex) {
    console.log('Inactive tabs cleanup initialization already in progress, skipping');
    return;
  }
  
  inactiveTabsInitMutex = true;
  
  try {
    const settings = await chrome.storage.sync.get('settings');
    
    // Clear existing timer if any
    if (inactiveTabsTimer) {
      clearInterval(inactiveTabsTimer);
      inactiveTabsTimer = null;
    }
    
    // Only initialize if auto-suspend is enabled
    if (!settings.settings?.autoCloseInactiveTabs) {
      console.log('Auto-suspend inactive tabs is disabled, skipping initialization');
      return;
    }
    
    // Check for inactive tabs every 5 minutes
    const checkInterval = 5 * 60 * 1000; // 5 minutes
    
    inactiveTabsTimer = setInterval(async () => {
      await checkAndCloseInactiveTabs();
    }, checkInterval);
    
    console.log('Inactive tabs cleanup initialized with 5-minute check interval');
  } catch (error) {
    console.error('Error initializing inactive tabs cleanup:', error);
    if (inactiveTabsTimer) {
      clearInterval(inactiveTabsTimer);
      inactiveTabsTimer = null;
    }
  } finally {
    inactiveTabsInitMutex = false;
  }
}

/**
 * Checks for inactive tabs and suspends them based on user settings
 * Implements smart exclusions for pinned tabs, audio tabs, and protected domains
 */
async function checkAndCloseInactiveTabs() {
  try {
    const settings = await chrome.storage.sync.get('settings');
    
    // Double-check if feature is still enabled
    if (!settings.settings?.autoCloseInactiveTabs) {
      return;
    }
    
    const timeoutMinutes = settings.settings?.inactiveTabTimeoutMinutes || 60;
    const timeoutMs = timeoutMinutes * 60 * 1000;
    const now = Date.now();
    
    // Get all tabs and activity data
    const [tabs, { tabActivity = {} }] = await Promise.all([
      chrome.tabs.query({}),
      chrome.storage.local.get('tabActivity')
    ]);
    
    const tabsToSuspend = [];
    const protectedDomains = settings.settings?.protectedDomains || [];
    
    for (const tab of tabs) {
      // Skip if tab should be excluded or is already discarded
      if (shouldExcludeFromAutoClose(tab, settings.settings, protectedDomains) || tab.discarded) {
        continue;
      }
      
      // Check if tab is inactive
      const activity = tabActivity[tab.id];
      if (!activity) {
        // If no activity record, assume it's old and create one
        await updateTabActivity(tab.id);
        continue;
      }
      
      const inactiveTime = now - activity.lastAccessed;
      if (inactiveTime > timeoutMs) {
        tabsToSuspend.push(tab);
      }
    }
    
    if (tabsToSuspend.length > 0) {
      await processInactiveTabsForSuspension(tabsToSuspend, settings.settings);
    }
    
  } catch (error) {
    console.error('Error checking inactive tabs:', error);
  }
}

/**
 * Determines if a tab should be excluded from auto-suspend
 */
function shouldExcludeFromAutoClose(tab, settings, protectedDomains) {
  // Always exclude special Chrome pages
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    return true;
  }
  
  // Always exclude the active tab
  if (tab.active) {
    return true;
  }
  
  // Exclude pinned tabs if setting is enabled
  if (settings.excludePinnedFromAutoClose && tab.pinned) {
    return true;
  }
  
  // Exclude audible tabs (playing audio) if setting is enabled
  if (settings.excludeAudibleFromAutoClose && tab.audible) {
    return true;
  }
  
  // Exclude tabs with important states
  if (tab.status === 'loading') {
    return true;
  }
  
  // Exclude protected domains
  if (protectedDomains.length > 0) {
    try {
      const url = new URL(tab.url);
      const domain = url.hostname;
      
      if (protectedDomains.some(protected => {
        // Support wildcard matching
        if (protected.startsWith('*.')) {
          const baseDomain = protected.substring(2);
          return domain.endsWith(baseDomain);
        }
        return domain === protected;
      })) {
        return true;
      }
    } catch (error) {
      // Invalid URL, skip protection check
    }
  }
  
  return false;
}

/**
 * Processes inactive tabs for suspension with optional notifications
 */
async function processInactiveTabsForSuspension(tabsToSuspend, settings) {
  try {
    if (settings.notifyBeforeAutoClose) {
      // Show notification before suspending tabs
      await showInactiveTabsNotification(tabsToSuspend.length, 'suspend');
      
      // Delay suspension to give user time to see notification
      setTimeout(async () => {
        await suspendInactiveTabs(tabsToSuspend);
      }, 3000); // 3 second delay
    } else {
      // Suspend immediately without notification
      await suspendInactiveTabs(tabsToSuspend);
    }
  } catch (error) {
    console.error('Error processing inactive tabs for suspension:', error);
  }
}

/**
 * Suspends (discards) inactive tabs to free memory while preserving tab state
 */
async function suspendInactiveTabs(tabsToSuspend) {
  try {
    const tabIds = tabsToSuspend.map(tab => tab.id);
    
    if (tabIds.length > 0) {
      // Suspend the tabs using chrome.tabs.discard API
      for (const tabId of tabIds) {
        try {
          await chrome.tabs.discard(tabId);
        } catch (error) {
          console.error(`Failed to suspend tab ${tabId}:`, error);
        }
      }
      
      // Update activity data to mark as suspended (don't clean up completely)
      const { tabActivity = {} } = await chrome.storage.local.get('tabActivity');
      for (const tabId of tabIds) {
        if (tabActivity[tabId]) {
          tabActivity[tabId].suspended = true;
          tabActivity[tabId].suspendedAt = Date.now();
        }
      }
      await chrome.storage.local.set({ tabActivity });
      
      console.log(`Auto-suspended ${tabIds.length} inactive tabs`);
    }
  } catch (error) {
    console.error('Error suspending inactive tabs:', error);
  }
}

/**
 * Shows notification about inactive tabs being suspended or closed
 */
async function showInactiveTabsNotification(count, action = 'suspend') {
  try {
    const actionText = action === 'suspend' ? 'Suspending' : 'Closing';
    const description = action === 'suspend' ? 
      'due to inactivity. Click to restore when needed.' : 
      'due to inactivity.';
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'GodTabs Auto-Suspend',
      message: `${actionText} ${count} inactive tab${count > 1 ? 's' : ''} ${description}`
    });
  } catch (error) {
    console.error('Error showing inactive tabs notification:', error);
  }
}

/**
 * Handles inactive tabs settings changes and reinitializes if needed
 */
async function handleInactiveTabsSettingsChange(newSettings) {
  try {
    console.log('Inactive tabs settings changed, reinitializing...');
    
    // Clear existing timer
    if (inactiveTabsTimer) {
      clearInterval(inactiveTabsTimer);
      inactiveTabsTimer = null;
    }
    
    // Reinitialize with new settings if enabled
    if (newSettings.autoCloseInactiveTabs) {
      await initializeInactiveTabCleanup();
    } else {
      console.log('Auto-close inactive tabs disabled by user settings');
    }
    
  } catch (error) {
    console.error('Error handling inactive tabs settings change:', error);
  }
}

async function detectAndRecoverFromCrash() {
  try {
    const { extensionRunning } = await chrome.storage.local.get('extensionRunning');
    const settings = await chrome.storage.sync.get('settings');
    
    if (extensionRunning && settings.settings?.enableCrashRecovery) {
      console.log('Crash detected - extension was running during shutdown');
      
      // Check if auto-restore is enabled
      if (settings.settings?.autoRestoreOnStartup) {
        await restoreWorkspacesFromSnapshots();
      } else if (settings.settings?.showRecoveryNotifications) {
        // Show notification about available recovery data
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'GodTabs Recovery Available',
          message: 'Workspace recovery data is available. Open GodTabs to restore your workspaces.'
        });
      }
    }
  } catch (error) {
    console.error('Error during crash detection:', error);
  }
}

async function restoreWorkspacesFromSnapshots() {
  try {
    const { autoSaveSnapshots = [] } = await chrome.storage.local.get('autoSaveSnapshots');
    
    if (autoSaveSnapshots.length === 0) {
      return;
    }
    
    // Get the most recent snapshot
    const latestSnapshot = autoSaveSnapshots[0];
    
    // Restore workspaces from snapshot
    if (latestSnapshot.workspaces && latestSnapshot.workspaces.length > 0) {
      await chrome.storage.local.set({ workspaces: latestSnapshot.workspaces });
      console.log('Workspaces restored from snapshot:', latestSnapshot.id);
      
      // Optionally restore tabs as well
      const settings = await chrome.storage.sync.get('settings');
      if (settings.settings?.autoRestoreOnStartup && latestSnapshot.tabs) {
        // Create a recovery workspace with the snapshot tabs
        const recoveryWorkspace = {
          id: `recovery_${Date.now()}`,
          name: 'Recovered Session',
          tabs: latestSnapshot.tabs,
          timestamp: Date.now(),
          isActive: false
        };
        
        const { workspaces = [] } = await chrome.storage.local.get('workspaces');
        workspaces.unshift(recoveryWorkspace);
        await chrome.storage.local.set({ workspaces });
      }
    }
  } catch (error) {
    console.error('Error restoring workspaces from snapshots:', error);
  }
}

async function cleanupAutoSaveData() {
  try {
    const settings = await chrome.storage.sync.get('settings');
    const maxAgeHours = 24; // Keep snapshots for 24 hours
    const maxSnapshots = settings.settings?.maxAutoSaveSnapshots || 10;
    
    const { autoSaveSnapshots = [] } = await chrome.storage.local.get('autoSaveSnapshots');
    const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
    
    // Filter out old snapshots
    const filteredSnapshots = autoSaveSnapshots.filter((snapshot, index) => {
      return index < maxSnapshots && snapshot.timestamp > cutoffTime;
    });
    
    if (filteredSnapshots.length !== autoSaveSnapshots.length) {
      await chrome.storage.local.set({ autoSaveSnapshots: filteredSnapshots });
      console.log(`Cleaned up ${autoSaveSnapshots.length - filteredSnapshots.length} old snapshots`);
    }
  } catch (error) {
    console.error('Error cleaning up auto-save data:', error);
  }
}

async function recoverSelectedWorkspaces(snapshotIds) {
  try {
    const { autoSaveSnapshots = [] } = await chrome.storage.local.get('autoSaveSnapshots');
    const { workspaces = [] } = await chrome.storage.local.get('workspaces');
    
    for (const snapshotId of snapshotIds) {
      const snapshot = autoSaveSnapshots.find(s => s.id === snapshotId);
      if (snapshot && snapshot.workspaces) {
        // Add recovered workspaces to current workspaces
        for (const workspace of snapshot.workspaces) {
          // Create a recovery version to avoid conflicts
          const recoveredWorkspace = {
            ...workspace,
            id: `recovered_${workspace.id}_${Date.now()}`,
            name: `${workspace.name} (Recovered)`,
            isActive: false,
            timestamp: Date.now()
          };
          workspaces.push(recoveredWorkspace);
        }
      }
    }
    
    await chrome.storage.local.set({ workspaces });
    console.log(`Recovered ${snapshotIds.length} workspace snapshots`);
  } catch (error) {
    console.error('Error recovering workspaces:', error);
    throw error;
  }
}

// Workspace management functions
async function saveCurrentWorkspace(name = null, options = {}) {
  try {
    const tabs = await chrome.tabs.query({});
    
    // Filter out empty tabs and validate
    const validTabs = tabs.filter(tab => tab.url && !tab.url.startsWith('chrome://'));
    
    if (validTabs.length === 0 && !options.allowEmpty) {
      throw new Error('Cannot create workspace: No valid tabs found');
    }
    
    // Get existing workspaces for duplicate name checking
    const { workspaces = [] } = await chrome.storage.local.get('workspaces');
    
    // Generate unique name if not provided or if duplicate exists
    let workspaceName = name;
    if (!workspaceName || workspaces.some(w => w.name === workspaceName)) {
      workspaceName = await generateUniqueWorkspaceName(workspaces, name);
    }
    
    // Get settings for workspace configuration
    const settings = await chrome.storage.sync.get('settings');
    const maxWorkspaces = settings.settings?.maxWorkspaces || 20;
    const includePinned = settings.settings?.workspaceIncludePinned !== false;
    
    const workspace = {
      id: Date.now().toString(),
      name: workspaceName,
      timestamp: Date.now(),
      isActive: false,
      tabCount: validTabs.length,
      hasUnsavedChanges: false,
      tabs: validTabs
        .filter(tab => includePinned || !tab.pinned)
        .map(tab => ({
          url: tab.url,
          title: tab.title || 'Untitled',
          pinned: tab.pinned,
          active: tab.active,
          favIconUrl: tab.favIconUrl
        }))
    };
    
    // Deactivate other workspaces
    const updatedWorkspaces = workspaces.map(w => ({ ...w, isActive: false }));
    updatedWorkspaces.unshift(workspace);
    
    // Apply workspace limit
    if (updatedWorkspaces.length > maxWorkspaces) {
      updatedWorkspaces.splice(maxWorkspaces);
    }
    
    await chrome.storage.local.set({ workspaces: updatedWorkspaces });
    showNotification(`Workspace "${workspaceName}" saved successfully`);
    return workspace;
  } catch (error) {
    console.error('Error saving workspace:', error);
    showNotification(`Failed to save workspace: ${error.message}`, 'error');
    throw error;
  }
}

async function generateUniqueWorkspaceName(existingWorkspaces, baseName = null) {
  const defaultBase = baseName || `Workspace ${new Date().toLocaleString()}`;
  const existingNames = new Set(existingWorkspaces.map(w => w.name));
  
  if (!existingNames.has(defaultBase)) {
    return defaultBase;
  }
  
  // Generate numbered variant
  let counter = 1;
  let uniqueName;
  do {
    uniqueName = `${defaultBase} (${counter})`;
    counter++;
  } while (existingNames.has(uniqueName) && counter < 100);
  
  return uniqueName;
}

async function createCurrentWorkspace() {
  try {
    const quickName = `Quick Workspace ${new Date().getHours()}:${String(new Date().getMinutes()).padStart(2, '0')}`;
    const workspace = await saveCurrentWorkspace(quickName);
    showNotification(`Workspace "${workspace.name}" created`, 'success');
  } catch (error) {
    console.error('Error creating workspace via shortcut:', error);
    showNotification('Failed to create workspace', 'error');
  }
}

async function switchToWorkspace(workspaceId, options = {}) {
  try {
    const { workspaces = [] } = await chrome.storage.local.get('workspaces');
    const workspace = workspaces.find(w => w.id === workspaceId);
    
    if (!workspace) {
      throw new Error('Workspace not found');
    }
    
    // Check if workspace has valid tabs
    if (!workspace.tabs || workspace.tabs.length === 0) {
      const shouldProceed = options.force || await confirmEmptyWorkspace(workspace.name);
      if (!shouldProceed) {
        return null;
      }
    }
    
    // Check for unsaved changes if enabled
    const settings = await chrome.storage.sync.get('settings');
    if (settings.settings?.workspaceConfirmSwitch && !options.skipConfirmation) {
      const currentWorkspace = workspaces.find(w => w.isActive);
      if (currentWorkspace && await hasUnsavedChanges(currentWorkspace)) {
        const shouldSave = await confirmUnsavedChanges();
        if (shouldSave) {
          await saveCurrentWorkspace(currentWorkspace.name + ' (Auto-saved)', { allowEmpty: true });
        }
      }
    }
    
    // Get current tabs to manage
    const currentTabs = await chrome.tabs.query({ currentWindow: true });
    const settings_includePinned = settings.settings?.workspaceIncludePinned !== false;
    
    // Close non-pinned tabs (or all tabs if includePinned is true)
    const tabsToClose = currentTabs
      .filter(tab => settings_includePinned || !tab.pinned)
      .map(tab => tab.id);
    
    if (tabsToClose.length > 0) {
      await chrome.tabs.remove(tabsToClose);
    }
    
    // Create workspace tabs with error handling
    const createdTabs = [];
    const failedTabs = [];
    
    for (const [index, tabData] of workspace.tabs.entries()) {
      try {
        // Validate URL before creating tab
        if (!isValidUrl(tabData.url)) {
          failedTabs.push({ ...tabData, reason: 'Invalid URL' });
          continue;
        }
        
        const tab = await chrome.tabs.create({
          url: tabData.url,
          pinned: tabData.pinned,
          active: false
        });
        
        createdTabs.push(tab);
      } catch (error) {
        console.error(`Failed to create tab ${index}:`, error);
        failedTabs.push({ ...tabData, reason: error.message });
      }
    }
    
    // Update workspace states
    const updatedWorkspaces = workspaces.map(w => ({
      ...w,
      isActive: w.id === workspaceId,
      lastAccessed: w.id === workspaceId ? Date.now() : w.lastAccessed
    }));
    
    await chrome.storage.local.set({ workspaces: updatedWorkspaces });
    
    // Activate the originally active tab
    await setActiveTab(workspace.tabs, createdTabs);
    
    // Show results notification
    const message = failedTabs.length > 0 
      ? `Switched to "${workspace.name}" (${failedTabs.length} tabs failed to load)`
      : `Switched to workspace: ${workspace.name}`;
    
    showNotification(message, failedTabs.length > 0 ? 'warning' : 'success');
    
    return { 
      workspace, 
      createdTabs, 
      failedTabs,
      success: true 
    };
  } catch (error) {
    console.error('Error switching to workspace:', error);
    showNotification(`Failed to switch workspace: ${error.message}`, 'error');
    throw error;
  }
}

async function setActiveTab(originalTabs, createdTabs) {
  try {
    const activeTabData = originalTabs.find(t => t.active);
    if (activeTabData && createdTabs.length > 0) {
      const activeTabIndex = originalTabs.indexOf(activeTabData);
      if (createdTabs[activeTabIndex]) {
        await chrome.tabs.update(createdTabs[activeTabIndex].id, { active: true });
      } else if (createdTabs[0]) {
        // Fallback to first tab if original active tab failed to create
        await chrome.tabs.update(createdTabs[0].id, { active: true });
      }
    }
  } catch (error) {
    console.error('Error setting active tab:', error);
  }
}

async function deleteWorkspace(workspaceId) {
  try {
    const { workspaces = [] } = await chrome.storage.local.get('workspaces');
    const workspace = workspaces.find(w => w.id === workspaceId);
    
    if (!workspace) {
      throw new Error('Workspace not found');
    }
    
    const updatedWorkspaces = workspaces.filter(w => w.id !== workspaceId);
    await chrome.storage.local.set({ workspaces: updatedWorkspaces });
    
    showNotification(`Workspace "${workspace.name}" deleted`, 'success');
    return { success: true, deletedWorkspace: workspace };
  } catch (error) {
    console.error('Error deleting workspace:', error);
    showNotification(`Failed to delete workspace: ${error.message}`, 'error');
    throw error;
  }
}

async function restoreWorkspace(workspaceId) {
  try {
    const { workspaces = [] } = await chrome.storage.local.get('workspaces');
    const workspace = workspaces.find(w => w.id === workspaceId);
    
    if (!workspace) {
      throw new Error('Workspace not found');
    }
    
    if (!workspace.tabs || workspace.tabs.length === 0) {
      showNotification(`Workspace "${workspace.name}" is empty`, 'warning');
      return { success: true, createdTabs: [] };
    }
    
    // Create workspace tabs without closing existing ones
    const createdTabs = [];
    const failedTabs = [];
    
    for (const tabData of workspace.tabs) {
      try {
        if (!isValidUrl(tabData.url)) {
          failedTabs.push({ ...tabData, reason: 'Invalid URL' });
          continue;
        }
        
        const tab = await chrome.tabs.create({
          url: tabData.url,
          pinned: tabData.pinned,
          active: false
        });
        createdTabs.push(tab);
      } catch (error) {
        console.error('Failed to restore tab:', error);
        failedTabs.push({ ...tabData, reason: error.message });
      }
    }
    
    const message = failedTabs.length > 0 
      ? `Restored "${workspace.name}" (${failedTabs.length} tabs failed)`
      : `Restored workspace: ${workspace.name}`;
    
    showNotification(message, failedTabs.length > 0 ? 'warning' : 'success');
    
    return { 
      success: true, 
      workspace, 
      createdTabs, 
      failedTabs 
    };
  } catch (error) {
    console.error('Error restoring workspace:', error);
    showNotification(`Failed to restore workspace: ${error.message}`, 'error');
    throw error;
  }
}

async function cycleThroughWorkspaces() {
  try {
    const { workspaces = [] } = await chrome.storage.local.get('workspaces');
    
    if (workspaces.length === 0) {
      showNotification('No workspaces available', 'warning');
      return null;
    }
    
    if (workspaces.length === 1) {
      showNotification('Only one workspace available', 'info');
      return await switchToWorkspace(workspaces[0].id);
    }
    
    const activeWorkspace = workspaces.find(w => w.isActive);
    let nextWorkspace;
    
    if (!activeWorkspace) {
      // No active workspace, switch to first one
      nextWorkspace = workspaces[0];
    } else {
      // Find next workspace
      const currentIndex = workspaces.indexOf(activeWorkspace);
      const nextIndex = (currentIndex + 1) % workspaces.length;
      nextWorkspace = workspaces[nextIndex];
    }
    
    return await switchToWorkspace(nextWorkspace.id, { skipConfirmation: true });
  } catch (error) {
    console.error('Error cycling through workspaces:', error);
    showNotification('Failed to switch workspace', 'error');
    throw error;
  }
}

// Utility functions
function showNotification(message, type = 'basic') {
  chrome.notifications?.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: 'GodTabs',
    message: message
  });
}

// Workspace validation and utility functions
function isValidUrl(url) {
  try {
    const urlObj = new URL(url);
    return ['http:', 'https:', 'ftp:', 'file:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
}

async function hasUnsavedChanges(workspace) {
  try {
    const currentTabs = await chrome.tabs.query({ currentWindow: true });
    const currentUrls = new Set(currentTabs.map(tab => tab.url));
    const workspaceUrls = new Set(workspace.tabs.map(tab => tab.url));
    
    // Simple comparison - could be enhanced with more sophisticated logic
    return currentUrls.size !== workspaceUrls.size || 
           ![...currentUrls].every(url => workspaceUrls.has(url));
  } catch (error) {
    console.error('Error checking for unsaved changes:', error);
    return false;
  }
}

async function confirmEmptyWorkspace(workspaceName) {
  // In a real implementation, this would show a confirmation dialog
  // For now, we'll just return true to proceed
  console.warn(`Workspace "${workspaceName}" is empty`);
  return true;
}

async function confirmUnsavedChanges() {
  // In a real implementation, this would show a confirmation dialog
  // For now, we'll return false to not auto-save
  console.log('Detected unsaved changes in current workspace');
  return false;
}

function validateWorkspaceName(name, existingWorkspaces = []) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Workspace name is required' };
  }
  
  if (name.trim().length === 0) {
    return { valid: false, error: 'Workspace name cannot be empty' };
  }
  
  if (name.length > 100) {
    return { valid: false, error: 'Workspace name is too long (max 100 characters)' };
  }
  
  if (existingWorkspaces.some(w => w.name === name.trim())) {
    return { valid: false, error: 'A workspace with this name already exists' };
  }
  
  return { valid: true };
}

// Message handling for popup and options communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getTabs':
      chrome.tabs.query({}, (tabs) => {
        sendResponse({ tabs });
      });
      return true;
    
    case 'closeTab':
      chrome.tabs.remove(request.tabId);
      sendResponse({ success: true });
      break;
    
    case 'switchToTab':
      chrome.tabs.update(request.tabId, { active: true });
      chrome.windows.update(request.windowId, { focused: true });
      sendResponse({ success: true });
      break;
    
    case 'getSessions':
      chrome.storage.local.get('sessions', (result) => {
        sendResponse({ sessions: result.sessions || [] });
      });
      return true;
    
    case 'getTabHistory':
      chrome.storage.local.get('tabHistory', (result) => {
        sendResponse({ history: result.tabHistory || [] });
      });
      return true;
    
    case 'createWorkspace':
      saveCurrentWorkspace(request.name).then((workspace) => {
        sendResponse({ success: true, workspace });
      }).catch((error) => {
        sendResponse({ error: error.message });
      });
      return true;
    
    case 'getWorkspaces':
      chrome.storage.local.get('workspaces', (result) => {
        sendResponse({ workspaces: result.workspaces || [] });
      });
      return true;
    
    case 'switchWorkspace':
      switchToWorkspace(request.workspaceId).then(() => {
        sendResponse({ success: true });
      }).catch((error) => {
        sendResponse({ error: error.message });
      });
      return true;
    
    case 'deleteWorkspace':
      deleteWorkspace(request.workspaceId).then(() => {
        sendResponse({ success: true });
      }).catch((error) => {
        sendResponse({ error: error.message });
      });
      return true;
    
    case 'restoreWorkspace':
      restoreWorkspace(request.workspaceId).then(() => {
        sendResponse({ success: true });
      }).catch((error) => {
        sendResponse({ error: error.message });
      });
      return true;
    
    case 'closeAllDuplicates':
      closeAllDuplicates().then(() => {
        sendResponse({ success: true });
      }).catch((error) => {
        sendResponse({ error: error.message });
      });
      return true;
    
    case 'saveCurrentSession':
      saveCurrentSession().then(() => {
        sendResponse({ success: true });
      }).catch((error) => {
        sendResponse({ error: error.message });
      });
      return true;
    
    case 'restoreLastSession':
      restoreLastSession().then(() => {
        sendResponse({ success: true });
      }).catch((error) => {
        sendResponse({ error: error.message });
      });
      return true;
    
    case 'getAutoSaveSnapshots':
      chrome.storage.local.get('autoSaveSnapshots', (result) => {
        sendResponse({ snapshots: result.autoSaveSnapshots || [] });
      });
      return true;
    
    case 'recoverWorkspaces':
      if (request.snapshotIds && Array.isArray(request.snapshotIds)) {
        recoverSelectedWorkspaces(request.snapshotIds).then(() => {
          sendResponse({ success: true });
        }).catch((error) => {
          sendResponse({ error: error.message });
        });
      } else {
        sendResponse({ error: 'Invalid snapshot IDs' });
      }
      return true;
    
    case 'clearAutoSaveData':
      clearAutoSaveData().then(() => {
        sendResponse({ success: true });
      }).catch((error) => {
        sendResponse({ error: error.message });
      });
      return true;
    
    case 'triggerManualAutoSave':
      triggerManualAutoSave().then((result) => {
        sendResponse(result);
      }).catch((error) => {
        sendResponse({ success: false, message: error.message });
      });
      return true;
    
    case 'updateAutoSaveSettings':
      handleAutoSaveSettingsChange(request.settings).then(() => {
        sendResponse({ success: true });
      }).catch((error) => {
        sendResponse({ error: error.message });
      });
      return true;
    
    case 'updateInactiveTabsSettings':
      handleInactiveTabsSettingsChange(request.settings).then(() => {
        sendResponse({ success: true });
      }).catch((error) => {
        sendResponse({ error: error.message });
      });
      return true;
    
    case 'getAutoSaveStatus':
      sendResponse({
        isEnabled: !!autoSaveTimer,
        isInProgress: isAutoSaveInProgress,
        failureCount: autoSaveFailureCount,
        disabledUntil: autoSaveDisabledUntil,
        lastAttempt: lastAutoSaveAttempt
      });
      break;
      chrome.storage.local.set({ autoSaveSnapshots: [] }).then(() => {
        sendResponse({ success: true });
      }).catch((error) => {
        sendResponse({ error: error.message });
      });
      return true;
    
    default:
      sendResponse({ error: 'Unknown action' });
  }
});

// Handle extension shutdown
chrome.runtime.onSuspend.addListener(async () => {
  console.log('GodTabs extension shutting down');
  
  // Clear extension running flag
  await chrome.storage.local.remove('extensionRunning');
  
  // Clear auto-save timer and reset failure tracking
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = null;
  }
  
  // Clear inactive tabs timer
  if (inactiveTabsTimer) {
    clearInterval(inactiveTabsTimer);
    inactiveTabsTimer = null;
  }
  
  // Reset auto-save failure tracking on clean shutdown
  resetAutoSaveFailureTracking();
  
  // Cleanup old auto-save data
  await cleanupAutoSaveData();
});

console.log('GodTabs background script loaded');