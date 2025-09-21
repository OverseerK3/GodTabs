// GodTabs Content Script
// Placeholder for future functionality to interact with web pages

/**
 * Content Script for GodTabs Extension
 * 
 * This content script runs on all web pages and can be used to enhance
 * tab management features by interacting with the page content.
 * 
 * Potential future features:
 * - Page analysis for better tab grouping
 * - Extract page metadata for tab previews
 * - Monitor page activity for auto-tab management
 * - Inject tab management shortcuts into pages
 * - Track user interaction patterns
 */

// Content script initialization
(function() {
  'use strict';
  
  console.log('GodTabs content script loaded on:', window.location.href);
  
  // Initialize content script
  init();
  
  function init() {
    // Only run on actual web pages, not extension pages
    if (window.location.protocol === 'chrome-extension:') {
      return;
    }
    
    // Set up page monitoring
    setupPageMonitoring();
    
    // Listen for messages from extension
    setupMessageListener();
    
    // Set up keyboard shortcuts (if enabled)
    setupKeyboardShortcuts();
  }
  
  // Monitor page changes and activity
  function setupPageMonitoring() {
    // Monitor page title changes
    let lastTitle = document.title;
    const titleObserver = new MutationObserver(() => {
      if (document.title !== lastTitle) {
        lastTitle = document.title;
        notifyTabUpdate({
          type: 'titleChange',
          title: document.title,
          url: window.location.href
        });
      }
    });
    
    // Observe title changes
    const titleElement = document.querySelector('title');
    if (titleElement) {
      titleObserver.observe(titleElement, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }
    
    // Monitor page activity for tab priority scoring
    let activityScore = 0;
    let lastActivity = Date.now();
    
    // Track user interactions
    const activityEvents = ['click', 'scroll', 'keydown', 'mousemove'];
    activityEvents.forEach(event => {
      document.addEventListener(event, () => {
        activityScore++;
        lastActivity = Date.now();
      }, { passive: true });
    });
    
    // Report activity periodically
    setInterval(() => {
      if (activityScore > 0) {
        notifyTabUpdate({
          type: 'activityUpdate',
          score: activityScore,
          lastActivity: lastActivity
        });
        activityScore = 0;
      }
    }, 30000); // Every 30 seconds
  }
  
  // Listen for messages from the extension
  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.action) {
        case 'getPageInfo':
          sendResponse(getPageInfo());
          break;
        
        case 'highlightTab':
          highlightTab();
          sendResponse({ success: true });
          break;
        
        case 'extractPageData':
          sendResponse(extractPageData());
          break;
        
        default:
          sendResponse({ error: 'Unknown action' });
      }
    });
  }
  
  // Set up keyboard shortcuts that work within pages
  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Check if shortcuts are enabled (would need to get from storage)
      // For now, just log the key combination
      if (e.ctrlKey || e.metaKey) {
        console.log('Potential shortcut:', e.key);
        
        // Example: Ctrl+Shift+H to highlight current tab
        if (e.shiftKey && e.key === 'H') {
          e.preventDefault();
          highlightTab();
        }
      }
    });
  }
  
  // Get comprehensive page information
  function getPageInfo() {
    return {
      title: document.title,
      url: window.location.href,
      domain: window.location.hostname,
      protocol: window.location.protocol,
      description: getMetaContent('description'),
      keywords: getMetaContent('keywords'),
      author: getMetaContent('author'),
      favicon: getFaviconUrl(),
      wordCount: getWordCount(),
      hasMedia: hasMediaContent(),
      isForm: hasFormElements(),
      lastModified: document.lastModified,
      timestamp: Date.now()
    };
  }
  
  // Extract structured data from the page
  function extractPageData() {
    return {
      headings: extractHeadings(),
      links: extractLinks(),
      images: extractImages(),
      metadata: extractMetadata(),
      pageType: detectPageType()
    };
  }
  
  // Utility functions
  function getMetaContent(name) {
    const meta = document.querySelector(`meta[name="${name}"], meta[property="og:${name}"]`);
    return meta ? meta.getAttribute('content') : null;
  }
  
  function getFaviconUrl() {
    const favicon = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
    if (favicon) {
      return new URL(favicon.href, window.location.origin).href;
    }
    return `${window.location.origin}/favicon.ico`;
  }
  
  function getWordCount() {
    const text = document.body.innerText || '';
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }
  
  function hasMediaContent() {
    return {
      images: document.querySelectorAll('img').length > 0,
      videos: document.querySelectorAll('video').length > 0,
      audio: document.querySelectorAll('audio').length > 0
    };
  }
  
  function hasFormElements() {
    return document.querySelectorAll('form, input, textarea, select').length > 0;
  }
  
  function extractHeadings() {
    const headings = [];
    document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
      headings.push({
        level: parseInt(heading.tagName.charAt(1)),
        text: heading.textContent.trim(),
        id: heading.id
      });
    });
    return headings;
  }
  
  function extractLinks() {
    const links = [];
    document.querySelectorAll('a[href]').forEach(link => {
      links.push({
        text: link.textContent.trim(),
        href: link.href,
        internal: link.hostname === window.location.hostname
      });
    });
    return links.slice(0, 50); // Limit to first 50 links
  }
  
  function extractImages() {
    const images = [];
    document.querySelectorAll('img[src]').forEach(img => {
      images.push({
        src: img.src,
        alt: img.alt,
        width: img.width,
        height: img.height
      });
    });
    return images.slice(0, 20); // Limit to first 20 images
  }
  
  function extractMetadata() {
    const metadata = {};
    document.querySelectorAll('meta').forEach(meta => {
      const name = meta.getAttribute('name') || meta.getAttribute('property');
      const content = meta.getAttribute('content');
      if (name && content) {
        metadata[name] = content;
      }
    });
    return metadata;
  }
  
  function detectPageType() {
    // Simple page type detection based on content
    if (document.querySelector('article')) return 'article';
    if (document.querySelector('form')) return 'form';
    if (document.querySelector('video, audio')) return 'media';
    if (document.querySelector('[data-testid*="shop"], .product, .cart')) return 'ecommerce';
    if (document.querySelector('.search, [role="search"]')) return 'search';
    return 'general';
  }
  
  function highlightTab() {
    // Add a visual highlight to indicate this tab
    const highlight = document.createElement('div');
    highlight.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 4px;
      background: linear-gradient(90deg, #4CAF50, #2196F3);
      z-index: 10000;
      animation: pulse 2s ease-in-out;
    `;
    
    // Add pulse animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(highlight);
    
    // Remove highlight after animation
    setTimeout(() => {
      highlight.remove();
      style.remove();
    }, 2000);
  }
  
  function notifyTabUpdate(data) {
    // Send update to background script
    chrome.runtime.sendMessage({
      action: 'tabUpdate',
      data: data,
      url: window.location.href,
      timestamp: Date.now()
    }).catch(error => {
      // Ignore errors if extension context is invalidated
      console.log('Extension context invalidated, content script will reload');
    });
  }
  
  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    notifyTabUpdate({
      type: 'beforeUnload',
      timeOnPage: Date.now() - performance.timing.navigationStart
    });
  });
  
})();

// Export for debugging
window.GodTabsContent = {
  getPageInfo: () => getPageInfo(),
  extractPageData: () => extractPageData()
};