/**
 * BackSearch - Browser Extension for Search History Navigation
 * Manages search history tracking and navigation across multiple search engines
 */

// --- Default Search Engine Patterns ---
const DEFAULT_PATTERNS = [
  'google.com/search',
  'bing.com/search',
  'duckduckgo.com',
  'search.yahoo.com',
  'yandex.com/search',
  'baidu.com/s',
  'ecosia.org',
  'startpage.com',
  'search.com',
  'ask.com',
  'search.naver.com/search.naver',
  'search.aol.com',
  'webcrawler.com',
  'dogpile.com',
  'swisscows.com',
  'searxng.org',
  'search.brave.com',
  'gibiru.com',
  'mojeek.com',
  'creativecommons.org/search'
].sort(); // Keep patterns sorted for better maintainability

// --- State Management ---
const state = {
  customSearchPatterns: [], // User-defined search patterns
  excludeDomains: [],      // User-defined domains to exclude
  searchHistories: {},     // Maps tabId to array of search URLs
  searchIndices: {}        // Maps tabId to current position in history
};

/**
 * Updates custom settings from browser storage
 * @async
 */
async function updateCustomSettings() {
  try {
    const result = await browser.storage.local.get(['customSearchPatterns', 'excludeDomains']);
    
    state.customSearchPatterns = result.customSearchPatterns
      ? result.customSearchPatterns.split('\n').map(s => s.trim()).filter(Boolean)
      : [];
      
    state.excludeDomains = result.excludeDomains
      ? result.excludeDomains.split('\n').map(s => s.trim()).filter(Boolean)
      : [];
      
    console.log('Settings updated:', {
      patterns: state.customSearchPatterns,
      excluded: state.excludeDomains
    });
  } catch (error) {
    console.error('Failed to update settings:', error);
  }
}

// Load custom settings initially
updateCustomSettings();

// Update settings on changes.
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.customSearchPatterns || changes.excludeDomains)) {
    updateCustomSettings();
  }
});

// --- URL Validation Functions ---

/**
 * Checks if a URL matches any excluded domain
 * @param {string} url - URL to check
 * @returns {boolean} True if URL should be excluded
 */
function isExcluded(url) {
  return state.excludeDomains.some(domain => url.includes(domain));
}

/**
 * Determines if a URL is a search engine page
 * @param {string} url - URL to check
 * @returns {boolean} True if URL is a search page
 */
function isSearchPage(url) {
  if (isExcluded(url)) return false;
  const allPatterns = [...DEFAULT_PATTERNS, ...state.customSearchPatterns];
  return allPatterns.some(pattern => url.includes(pattern));
}

/**
 * Get the current search page (URL) from the history for a given tab.
 * @param {number} tabId - Tab ID
 * @returns {string|null} Current search page URL or null
 */
function getSearchPageForTab(tabId) {
  if (!state.searchHistories[tabId] || state.searchHistories[tabId].length === 0) return null;
  const index = state.searchIndices[tabId];
  return state.searchHistories[tabId][index];
}

// --- Recording & Navigation ---

// Record navigations: if the URL qualifies as a search page, add it to the tab's history.
browser.webNavigation.onCommitted.addListener(details => {
  const { tabId, url, frameId } = details;
  if (frameId !== 0) return; // Only track top-level navigations

  if (isSearchPage(url)) {
    if (!state.searchHistories[tabId]) {
      state.searchHistories[tabId] = [];
    }
    const history = state.searchHistories[tabId];
    // Avoid adding duplicate consecutive entries.
    if (history.length === 0 || history[history.length - 1] !== url) {
      history.push(url);
      console.log(`Tab ${tabId}: Added search page: ${url}`);
    }
    // Reset pointer to most recent.
    state.searchIndices[tabId] = history.length - 1;
  }
});

// Multi-hop navigation: when triggered, go back one step in the search history.
async function navigateBackSearch(tab) {
  const history = state.searchHistories[tab.id];
  if (!history || history.length === 0) {
    console.log(`Tab ${tab.id}: No search history available.`);
    return;
  }
  // If current page isn't a search page, reset pointer.
  if (!isSearchPage(tab.url)) {
    state.searchIndices[tab.id] = history.length - 1;
  } else {
    // Otherwise, move the pointer back if possible.
    if (state.searchIndices[tab.id] > 0) {
      state.searchIndices[tab.id]--;
    } else {
      console.log(`Tab ${tab.id}: Already at the beginning of history.`);
      return;
    }
  }
  const targetUrl = getSearchPageForTab(tab.id);
  if (targetUrl && tab.url !== targetUrl) {
    await browser.tabs.update(tab.id, { url: targetUrl });
    console.log(`Tab ${tab.id}: Navigating to ${targetUrl}`);
  }
}

// Listen for the keyboard command (default Alt+Left).
browser.commands.onCommand.addListener(async command => {
  if (command === "go-to-search") {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0]) {
      navigateBackSearch(tabs[0]);
    }
  }
});

// Handle toolbar icon clicks; check the "iconClickEnabled" option.
browser.browserAction.onClicked.addListener(async tab => {
  const result = await browser.storage.local.get("iconClickEnabled");
  const iconClickEnabled = (typeof result.iconClickEnabled === "undefined") ? true : result.iconClickEnabled;
  if (!iconClickEnabled) {
    console.log(`Tab ${tab.id}: Icon click is disabled by options.`);
    return;
  }
  navigateBackSearch(tab);
});

// --- Context Menu & Cleanup ---

// Create a context menu item (on right-click of the browser action) to open the options page.
browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: "open-options",
    title: "BackSearch Options",
    contexts: ["browser_action"]
  });
});

browser.contextMenus.onClicked.addListener(info => {
  if (info.menuItemId === "open-options") {
    browser.runtime.openOptionsPage();
  }
});

// Clean up history data when a tab is closed.
browser.tabs.onRemoved.addListener(tabId => {
  delete state.searchHistories[tabId];
  delete state.searchIndices[tabId];
});