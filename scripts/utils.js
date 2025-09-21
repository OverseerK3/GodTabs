// GodTabs Utility Functions
// Shared helper functions for tab management, storage operations, and common UI functionality

/**
 * Storage utility functions
 */
const StorageUtils = {
  /**
   * Get data from Chrome storage with error handling
   * @param {string} area - 'sync' or 'local'
   * @param {string|string[]|object} keys - Keys to retrieve
   * @returns {Promise<object>} Retrieved data
   */
  async get(area = 'sync', keys = null) {
    try {
      const storage = area === 'sync' ? chrome.storage.sync : chrome.storage.local;
      return await storage.get(keys);
    } catch (error) {
      console.error(`Error getting storage data from ${area}:`, error);
      return {};
    }
  },

  /**
   * Set data in Chrome storage with error handling
   * @param {string} area - 'sync' or 'local'
   * @param {object} data - Data to store
   * @returns {Promise<boolean>} Success status
   */
  async set(area = 'sync', data) {
    try {
      const storage = area === 'sync' ? chrome.storage.sync : chrome.storage.local;
      await storage.set(data);
      return true;
    } catch (error) {
      console.error(`Error setting storage data in ${area}:`, error);
      return false;
    }
  },

  /**
   * Remove data from Chrome storage
   * @param {string} area - 'sync' or 'local'
   * @param {string|string[]} keys - Keys to remove
   * @returns {Promise<boolean>} Success status
   */
  async remove(area = 'sync', keys) {
    try {
      const storage = area === 'sync' ? chrome.storage.sync : chrome.storage.local;
      await storage.remove(keys);
      return true;
    } catch (error) {
      console.error(`Error removing storage data from ${area}:`, error);
      return false;
    }
  },

  /**
   * Clear all data from storage area
   * @param {string} area - 'sync' or 'local'
   * @returns {Promise<boolean>} Success status
   */
  async clear(area = 'sync') {
    try {
      const storage = area === 'sync' ? chrome.storage.sync : chrome.storage.local;
      await storage.clear();
      return true;
    } catch (error) {
      console.error(`Error clearing storage area ${area}:`, error);
      return false;
    }
  }
};

/**
 * Tab utility functions
 */
const TabUtils = {
  /**
   * Get all tabs with error handling
   * @param {object} queryInfo - Chrome tabs query parameters
   * @returns {Promise<chrome.tabs.Tab[]>} Array of tabs
   */
  async query(queryInfo = {}) {
    try {
      return await chrome.tabs.query(queryInfo);
    } catch (error) {
      console.error('Error querying tabs:', error);
      return [];
    }
  },

  /**
   * Filter tabs by various criteria
   * @param {chrome.tabs.Tab[]} tabs - Array of tabs to filter
   * @param {object} filters - Filter criteria
   * @returns {chrome.tabs.Tab[]} Filtered tabs
   */
  filter(tabs, filters = {}) {
    return tabs.filter(tab => {
      if (filters.url && !tab.url.toLowerCase().includes(filters.url.toLowerCase())) {
        return false;
      }
      if (filters.title && !tab.title.toLowerCase().includes(filters.title.toLowerCase())) {
        return false;
      }
      if (filters.pinned !== undefined && tab.pinned !== filters.pinned) {
        return false;
      }
      if (filters.audible !== undefined && tab.audible !== filters.audible) {
        return false;
      }
      if (filters.active !== undefined && tab.active !== filters.active) {
        return false;
      }
      if (filters.windowId !== undefined && tab.windowId !== filters.windowId) {
        return false;
      }
      return true;
    });
  },

  /**
   * Sort tabs by various criteria
   * @param {chrome.tabs.Tab[]} tabs - Array of tabs to sort
   * @param {string} sortBy - Sort criteria: 'title', 'url', 'index', 'lastAccessed'
   * @param {string} order - Sort order: 'asc' or 'desc'
   * @returns {chrome.tabs.Tab[]} Sorted tabs
   */
  sort(tabs, sortBy = 'index', order = 'asc') {
    const sortedTabs = [...tabs].sort((a, b) => {
      let aVal, bVal;
      
      switch (sortBy) {
        case 'title':
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          break;
        case 'url':
          aVal = a.url.toLowerCase();
          bVal = b.url.toLowerCase();
          break;
        case 'lastAccessed':
          aVal = a.lastAccessed || 0;
          bVal = b.lastAccessed || 0;
          break;
        case 'index':
        default:
          aVal = a.index;
          bVal = b.index;
          break;
      }
      
      if (aVal < bVal) return order === 'asc' ? -1 : 1;
      if (aVal > bVal) return order === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sortedTabs;
  },

  /**
   * Group tabs by domain
   * @param {chrome.tabs.Tab[]} tabs - Array of tabs to group
   * @returns {object} Object with domains as keys and tab arrays as values
   */
  groupByDomain(tabs) {
    const groups = {};
    
    tabs.forEach(tab => {
      try {
        const url = new URL(tab.url);
        const domain = url.hostname;
        
        if (!groups[domain]) {
          groups[domain] = [];
        }
        groups[domain].push(tab);
      } catch (error) {
        // Handle invalid URLs
        if (!groups['other']) {
          groups['other'] = [];
        }
        groups['other'].push(tab);
      }
    });
    
    return groups;
  },

  /**
   * Find duplicate tabs
   * @param {chrome.tabs.Tab[]} tabs - Array of tabs to check
   * @returns {chrome.tabs.Tab[][]} Array of duplicate tab groups
   */
  findDuplicates(tabs) {
    const urlMap = new Map();
    const duplicates = [];
    
    tabs.forEach(tab => {
      if (tab.url) {
        if (urlMap.has(tab.url)) {
          urlMap.get(tab.url).push(tab);
        } else {
          urlMap.set(tab.url, [tab]);
        }
      }
    });
    
    urlMap.forEach(tabGroup => {
      if (tabGroup.length > 1) {
        duplicates.push(tabGroup);
      }
    });
    
    return duplicates;
  },

  /**
   * Get tab favicon URL with fallback
   * @param {chrome.tabs.Tab} tab - Tab object
   * @returns {string} Favicon URL
   */
  getFaviconUrl(tab) {
    if (tab.favIconUrl && tab.favIconUrl !== '') {
      return tab.favIconUrl;
    }
    
    try {
      const url = new URL(tab.url);
      return `${url.origin}/favicon.ico`;
    } catch (error) {
      return 'chrome://favicon/';
    }
  }
};

/**
 * Session utility functions
 */
const SessionUtils = {
  /**
   * Create a session object from current tabs
   * @param {chrome.tabs.Tab[]} tabs - Array of tabs
   * @param {string} name - Session name
   * @returns {object} Session object
   */
  createSession(tabs, name = null) {
    return {
      id: Date.now().toString(),
      name: name || `Session ${new Date().toLocaleString()}`,
      timestamp: Date.now(),
      tabs: tabs.map(tab => ({
        url: tab.url,
        title: tab.title,
        pinned: tab.pinned,
        active: tab.active,
        favicon: TabUtils.getFaviconUrl(tab)
      }))
    };
  },

  /**
   * Validate session object
   * @param {object} session - Session to validate
   * @returns {boolean} Whether session is valid
   */
  isValidSession(session) {
    return session &&
           typeof session.id === 'string' &&
           typeof session.name === 'string' &&
           typeof session.timestamp === 'number' &&
           Array.isArray(session.tabs);
  },

  /**
   * Restore tabs from session
   * @param {object} session - Session to restore
   * @param {boolean} newWindow - Whether to open in new window
   * @returns {Promise<chrome.tabs.Tab[]>} Created tabs
   */
  async restoreSession(session, newWindow = false) {
    if (!SessionUtils.isValidSession(session)) {
      throw new Error('Invalid session object');
    }
    
    const createdTabs = [];
    
    try {
      for (const tabData of session.tabs) {
        const tab = await chrome.tabs.create({
          url: tabData.url,
          pinned: tabData.pinned,
          active: false
        });
        createdTabs.push(tab);
      }
      
      // Activate the originally active tab
      const activeTabData = session.tabs.find(t => t.active);
      if (activeTabData && createdTabs.length > 0) {
        const activeTabIndex = session.tabs.indexOf(activeTabData);
        if (createdTabs[activeTabIndex]) {
          await chrome.tabs.update(createdTabs[activeTabIndex].id, { active: true });
        }
      }
      
      return createdTabs;
    } catch (error) {
      console.error('Error restoring session:', error);
      return createdTabs;
    }
  }
};

/**
 * Workspace utility functions
 */
const WorkspaceUtils = {
  /**
   * Create a workspace object from current tabs
   * @param {chrome.tabs.Tab[]} tabs - Array of tabs
   * @param {string} name - Workspace name
   * @param {boolean} isActive - Whether workspace is currently active
   * @returns {object} Workspace object
   */
  createWorkspace(tabs, name = null, isActive = false) {
    return {
      id: Date.now().toString(),
      name: name || `Workspace ${new Date().toLocaleString()}`,
      timestamp: Date.now(),
      isActive: isActive,
      creationMethod: 'manual',
      tabs: tabs.map(tab => ({
        url: tab.url,
        title: tab.title,
        pinned: tab.pinned,
        active: tab.active,
        favicon: TabUtils.getFaviconUrl(tab)
      }))
    };
  },

  /**
   * Validate workspace object
   * @param {object} workspace - Workspace to validate
   * @returns {boolean} Whether workspace is valid
   */
  isValidWorkspace(workspace) {
    return workspace &&
           typeof workspace.id === 'string' &&
           typeof workspace.name === 'string' &&
           typeof workspace.timestamp === 'number' &&
           typeof workspace.isActive === 'boolean' &&
           Array.isArray(workspace.tabs);
  },

  /**
   * Get the currently active workspace
   * @param {object[]} workspaces - Array of workspaces
   * @returns {object|null} Active workspace or null
   */
  getActiveWorkspace(workspaces) {
    return workspaces.find(workspace => workspace.isActive) || null;
  },

  /**
   * Set a workspace as active and mark others as inactive
   * @param {object[]} workspaces - Array of workspaces
   * @param {string} workspaceId - ID of workspace to activate
   * @returns {object[]} Updated workspaces array
   */
  setWorkspaceActive(workspaces, workspaceId) {
    return workspaces.map(workspace => ({
      ...workspace,
      isActive: workspace.id === workspaceId
    }));
  },

  /**
   * Filter workspaces by date range
   * @param {object[]} workspaces - Array of workspaces
   * @param {string} dateRange - Date range filter ('today', 'week', 'month', 'all')
   * @returns {object[]} Filtered workspaces
   */
  filterWorkspacesByDate(workspaces, dateRange = 'all') {
    if (dateRange === 'all') {
      return workspaces;
    }

    const now = Date.now();
    let cutoffTime;

    switch (dateRange) {
      case 'today':
        cutoffTime = now - (24 * 60 * 60 * 1000); // 24 hours
        break;
      case 'week':
        cutoffTime = now - (7 * 24 * 60 * 60 * 1000); // 7 days
        break;
      case 'month':
        cutoffTime = now - (30 * 24 * 60 * 60 * 1000); // 30 days
        break;
      default:
        return workspaces;
    }

    return workspaces.filter(workspace => workspace.timestamp >= cutoffTime);
  },

  /**
   * Sort workspaces by various criteria
   * @param {object[]} workspaces - Array of workspaces to sort
   * @param {string} sortBy - Sort criteria: 'name', 'timestamp', 'tabCount'
   * @param {string} order - Sort order: 'asc' or 'desc'
   * @returns {object[]} Sorted workspaces
   */
  sortWorkspaces(workspaces, sortBy = 'timestamp', order = 'desc') {
    return [...workspaces].sort((a, b) => {
      let aVal, bVal;
      
      switch (sortBy) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'tabCount':
          aVal = a.tabs.length;
          bVal = b.tabs.length;
          break;
        case 'timestamp':
        default:
          aVal = a.timestamp;
          bVal = b.timestamp;
          break;
      }
      
      if (aVal < bVal) return order === 'asc' ? -1 : 1;
      if (aVal > bVal) return order === 'asc' ? 1 : -1;
      return 0;
    });
  },

  /**
   * Get workspace statistics
   * @param {object[]} workspaces - Array of workspaces
   * @returns {object} Statistics object
   */
  getWorkspaceStats(workspaces) {
    const totalWorkspaces = workspaces.length;
    const totalTabs = workspaces.reduce((sum, workspace) => sum + workspace.tabs.length, 0);
    const averageTabsPerWorkspace = totalWorkspaces > 0 ? Math.round(totalTabs / totalWorkspaces) : 0;
    const activeWorkspace = WorkspaceUtils.getActiveWorkspace(workspaces);
    
    return {
      totalWorkspaces,
      totalTabs,
      averageTabsPerWorkspace,
      hasActiveWorkspace: !!activeWorkspace,
      activeWorkspaceName: activeWorkspace?.name || null
    };
  },

  /**
   * Create a comprehensive workspace snapshot
   * @param {object[]} workspaces - Current workspaces
   * @param {object} metadata - Additional metadata
   * @returns {object} Snapshot object
   */
  createWorkspaceSnapshot(workspaces, metadata = {}) {
    return {
      id: `snapshot_${Date.now()}`,
      timestamp: Date.now(),
      sessionId: `session_${Date.now()}`,
      version: '1.0',
      workspaces: workspaces || [],
      metadata: {
        totalWorkspaces: workspaces ? workspaces.length : 0,
        totalTabs: workspaces ? workspaces.reduce((sum, ws) => sum + ws.tabs.length, 0) : 0,
        userAgent: navigator.userAgent,
        extensionVersion: chrome.runtime.getManifest().version,
        ...metadata
      }
    };
  },

  /**
   * Validate snapshot integrity
   * @param {object} snapshot - Snapshot to validate
   * @returns {boolean} Whether snapshot is valid
   */
  validateSnapshot(snapshot) {
    return snapshot &&
           snapshot.timestamp &&
           snapshot.sessionId &&
           snapshot.version &&
           Array.isArray(snapshot.workspaces) &&
           typeof snapshot.metadata === 'object';
  },

  /**
   * Merge workspace snapshots with current workspaces
   * @param {object[]} currentWorkspaces - Current workspaces
   * @param {object[]} snapshotWorkspaces - Workspaces from snapshot
   * @returns {object[]} Merged workspaces
   */
  mergeWorkspaceSnapshots(currentWorkspaces, snapshotWorkspaces) {
    const merged = [...currentWorkspaces];
    const existingIds = new Set(currentWorkspaces.map(ws => ws.id));
    
    for (const snapshotWorkspace of snapshotWorkspaces) {
      if (!existingIds.has(snapshotWorkspace.id)) {
        const recoveredWorkspace = {
          ...snapshotWorkspace,
          id: `recovered_${snapshotWorkspace.id}_${Date.now()}`,
          name: `${snapshotWorkspace.name} (Recovered)`,
          isActive: false,
          timestamp: Date.now()
        };
        merged.push(recoveredWorkspace);
      }
    }
    
    return merged;
  },

  /**
   * Get snapshot metadata for display
   * @param {object} snapshot - Snapshot object
   * @returns {object} Formatted metadata
   */
  getSnapshotMetadata(snapshot) {
    if (!snapshot || !snapshot.metadata) {
      return {};
    }
    
    return {
      creationTime: new Date(snapshot.timestamp).toLocaleString(),
      workspaceCount: snapshot.metadata.totalWorkspaces || 0,
      tabCount: snapshot.metadata.totalTabs || 0,
      age: Date.now() - snapshot.timestamp,
      sessionId: snapshot.sessionId
    };
  },

  /**
   * Check if snapshot is recent enough for recovery
   * @param {object} snapshot - Snapshot to check
   * @param {number} maxAgeMinutes - Maximum age in minutes
   * @returns {boolean} Whether snapshot is recent
   */
  isSnapshotRecent(snapshot, maxAgeMinutes = 60) {
    if (!snapshot || !snapshot.timestamp) {
      return false;
    }
    
    const ageMinutes = (Date.now() - snapshot.timestamp) / (1000 * 60);
    return ageMinutes <= maxAgeMinutes;
  },

  /**
   * Generate recovery report from snapshots
   * @param {object[]} snapshots - Available snapshots
   * @returns {object} Recovery report
   */
  generateRecoveryReport(snapshots) {
    const recent = snapshots.filter(s => this.isSnapshotRecent(s, 60));
    const totalWorkspaces = snapshots.reduce((sum, s) => sum + (s.metadata?.totalWorkspaces || 0), 0);
    const totalTabs = snapshots.reduce((sum, s) => sum + (s.metadata?.totalTabs || 0), 0);
    
    return {
      totalSnapshots: snapshots.length,
      recentSnapshots: recent.length,
      totalRecoverableWorkspaces: totalWorkspaces,
      totalRecoverableTabs: totalTabs,
      latestSnapshot: snapshots[0] || null,
      recommendRecovery: recent.length > 0 && totalWorkspaces > 0
    };
  },

  /**
   * Clean up old snapshots
   * @param {object[]} snapshots - Current snapshots
   * @param {number} maxCount - Maximum snapshots to keep
   * @param {number} maxAgeHours - Maximum age in hours
   * @returns {object[]} Filtered snapshots
   */
  cleanupOldSnapshots(snapshots, maxCount = 10, maxAgeHours = 24) {
    const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
    
    return snapshots
      .filter(snapshot => snapshot.timestamp > cutoffTime)
      .slice(0, maxCount);
  },

  /**
   * Compare current workspace state with snapshot
   * @param {object[]} current - Current workspaces
   * @param {object} snapshot - Snapshot to compare
   * @returns {object} Comparison results
   */
  compareWorkspaceStates(current, snapshot) {
    const currentIds = new Set(current.map(ws => ws.id));
    const snapshotIds = new Set(snapshot.workspaces.map(ws => ws.id));
    
    const added = current.filter(ws => !snapshotIds.has(ws.id));
    const removed = snapshot.workspaces.filter(ws => !currentIds.has(ws.id));
    const common = current.filter(ws => snapshotIds.has(ws.id));
    
    return {
      hasChanges: added.length > 0 || removed.length > 0,
      addedWorkspaces: added,
      removedWorkspaces: removed,
      commonWorkspaces: common,
      significantChanges: added.length > 0 || removed.length > 2
    };
  },

  /**
   * Extract recoverable workspaces from snapshot
   * @param {object} snapshot - Snapshot to process
   * @returns {object[]} Valid recoverable workspaces
   */
  extractRecoverableWorkspaces(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.workspaces)) {
      return [];
    }
    
    return snapshot.workspaces.filter(workspace => {
      return this.isValidWorkspace(workspace) && 
             workspace.tabs && 
             workspace.tabs.length > 0;
    });
  }
};

/**
 * Search and filtering utility functions
 */
const SearchUtils = {
  /**
   * Fuzzy search for tabs
   * @param {chrome.tabs.Tab[]} tabs - Array of tabs to search
   * @param {string} query - Search query
   * @returns {chrome.tabs.Tab[]} Matching tabs with scores
   */
  fuzzySearch(tabs, query) {
    if (!query || query.trim() === '') {
      return tabs;
    }
    
    const queryLower = query.toLowerCase();
    const results = [];
    
    tabs.forEach(tab => {
      const titleLower = tab.title.toLowerCase();
      const urlLower = tab.url.toLowerCase();
      
      let score = 0;
      
      // Exact matches get highest score
      if (titleLower.includes(queryLower)) {
        score += 100;
      }
      if (urlLower.includes(queryLower)) {
        score += 50;
      }
      
      // Fuzzy matching for individual words
      const queryWords = queryLower.split(/\s+/);
      queryWords.forEach(word => {
        if (titleLower.includes(word)) score += 20;
        if (urlLower.includes(word)) score += 10;
      });
      
      if (score > 0) {
        results.push({ tab, score });
      }
    });
    
    // Sort by score and return tabs
    return results
      .sort((a, b) => b.score - a.score)
      .map(result => result.tab);
  },

  /**
   * Highlight search terms in text
   * @param {string} text - Text to highlight
   * @param {string} query - Search query
   * @returns {string} HTML with highlighted terms
   */
  highlightText(text, query) {
    if (!query || query.trim() === '') {
      return this.escapeHtml(text);
    }
    
    const queryWords = query.trim().split(/\s+/);
    let highlightedText = this.escapeHtml(text);
    
    queryWords.forEach(word => {
      const regex = new RegExp(`(${word})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
    });
    
    return highlightedText;
  },

  /**
   * Escape HTML characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

/**
 * UI utility functions
 */
const UIUtils = {
  /**
   * Format file size in human readable format
   * @param {number} bytes - Size in bytes
   * @returns {string} Formatted size string
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  /**
   * Format date in relative time
   * @param {number} timestamp - Timestamp in milliseconds
   * @returns {string} Relative time string
   */
  formatRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  },

  /**
   * Debounce function calls
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in milliseconds
   * @returns {Function} Debounced function
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Throttle function calls
   * @param {Function} func - Function to throttle
   * @param {number} limit - Time limit in milliseconds
   * @returns {Function} Throttled function
   */
  throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  /**
   * Copy text to clipboard
   * @param {string} text - Text to copy
   * @returns {Promise<boolean>} Success status
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      return false;
    }
  },

  /**
   * Show toast notification
   * @param {string} message - Message to show
   * @param {string} type - Type of notification (success, error, info)
   * @param {number} duration - Duration in milliseconds
   */
  showToast(message, type = 'info', duration = 3000) {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Add styles
    Object.assign(toast.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '12px 16px',
      borderRadius: '6px',
      color: 'white',
      fontWeight: '500',
      zIndex: '10000',
      opacity: '0',
      transform: 'translateX(100%)',
      transition: 'all 0.3s ease',
      backgroundColor: type === 'success' ? '#28a745' : 
                      type === 'error' ? '#dc3545' : '#007bff'
    });
    
    document.body.appendChild(toast);
    
    // Animate in
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    });
    
    // Remove after duration
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, duration);
  }
};

/**
 * Date and time utility functions
 */
const DateUtils = {
  /**
   * Format date for display
   * @param {Date|number} date - Date object or timestamp
   * @param {string} format - Format type: 'short', 'long', 'time'
   * @returns {string} Formatted date string
   */
  format(date, format = 'short') {
    const dateObj = date instanceof Date ? date : new Date(date);
    
    switch (format) {
      case 'long':
        return dateObj.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      case 'time':
        return dateObj.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit'
        });
      case 'short':
      default:
        return dateObj.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
    }
  },

  /**
   * Check if date is today
   * @param {Date|number} date - Date to check
   * @returns {boolean} Whether date is today
   */
  isToday(date) {
    const dateObj = date instanceof Date ? date : new Date(date);
    const today = new Date();
    
    return dateObj.toDateString() === today.toDateString();
  },

  /**
   * Check if date is within last week
   * @param {Date|number} date - Date to check
   * @returns {boolean} Whether date is within last week
   */
  isThisWeek(date) {
    const dateObj = date instanceof Date ? date : new Date(date);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    return dateObj >= weekAgo;
  }
};

/**
 * URL utility functions
 */
const URLUtils = {
  /**
   * Extract domain from URL
   * @param {string} url - URL to parse
   * @returns {string} Domain name
   */
  getDomain(url) {
    try {
      return new URL(url).hostname;
    } catch (error) {
      return '';
    }
  },

  /**
   * Check if URL is valid
   * @param {string} url - URL to validate
   * @returns {boolean} Whether URL is valid
   */
  isValid(url) {
    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  },

  /**
   * Shorten URL for display
   * @param {string} url - URL to shorten
   * @param {number} maxLength - Maximum length
   * @returns {string} Shortened URL
   */
  shorten(url, maxLength = 50) {
    if (url.length <= maxLength) {
      return url;
    }
    
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      const path = urlObj.pathname + urlObj.search;
      
      if (domain.length >= maxLength - 3) {
        return domain.substring(0, maxLength - 3) + '...';
      }
      
      const remainingLength = maxLength - domain.length - 3;
      return domain + path.substring(0, remainingLength) + '...';
    } catch (error) {
      return url.substring(0, maxLength - 3) + '...';
    }
  }
};

// Export all utilities
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    StorageUtils,
    TabUtils,
    SessionUtils,
    WorkspaceUtils,
    SearchUtils,
    UIUtils,
    DateUtils,
    URLUtils
  };
} else {
  // Browser environment
  window.GodTabsUtils = {
    StorageUtils,
    TabUtils,
    SessionUtils,
    WorkspaceUtils,
    SearchUtils,
    UIUtils,
    DateUtils,
    URLUtils
  };
}