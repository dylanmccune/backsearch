/**
 * Options page handler for BackSearch extension
 * Manages user preferences and custom search settings
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const elements = {
    iconToggle: document.getElementById('iconClickEnabled'),
    searchPatterns: document.getElementById('customSearchPatterns'),
    excludeDomains: document.getElementById('excludeDomains')
  };

  /**
   * Saves a setting to browser storage
   * @param {string} key - Setting key
   * @param {any} value - Setting value
   */
  async function saveSetting(key, value) {
    try {
      await browser.storage.local.set({ [key]: value });
      console.log(`Setting "${key}" updated:`, value);
    } catch (error) {
      console.error(`Failed to save ${key}:`, error);
    }
  }

  // Load initial settings
  try {
    const defaults = {
      iconClickEnabled: true,
      customSearchPatterns: '',
      excludeDomains: ''
    };

    const stored = await browser.storage.local.get(Object.keys(defaults));
    const settings = { ...defaults, ...stored };

    elements.iconToggle.checked = settings.iconClickEnabled;
    elements.searchPatterns.value = settings.customSearchPatterns;
    elements.excludeDomains.value = settings.excludeDomains;
  } catch (error) {
    console.error('Failed to load settings:', error);
  }

  // Event Listeners
  elements.iconToggle.addEventListener('change', () => 
    saveSetting('iconClickEnabled', elements.iconToggle.checked));

  elements.searchPatterns.addEventListener('change', () =>
    saveSetting('customSearchPatterns', elements.searchPatterns.value));

  elements.excludeDomains.addEventListener('change', () =>
    saveSetting('excludeDomains', elements.excludeDomains.value));
});
