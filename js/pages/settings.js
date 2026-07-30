// Settings management for Game Behaviour and other tabs

// =========================
// Settings Manager
// =========================

class SettingsManager {
    constructor() {
        this.settings = this.loadSettings();
        this.init();
    }

    // =========================
    // Initialization
    // =========================

    // Initialize the settings page
    init() {
        this.setupTabNavigation();
        this.loadCheckboxStates();
        this.loadAppearanceControls();
        this.setupEventListeners();
        this.setupAppearanceListeners();
    }

    // =========================
    // Settings Data
    // =========================

    // Load settings from localStorage
    loadSettings() {
        const defaultSettings = this.getDefaultSettings();

        try {
            const saved = localStorage.getItem('gameSettings');
            if (saved) {
                return {
                    ...defaultSettings,
                    ...JSON.parse(saved)
                };
            }
        } catch (error) {
            console.warn('Unable to load saved settings. Using defaults.', error);
        }

        return defaultSettings;
    }
    
    // Get default settings
    getDefaultSettings() {
        return {
            autoDraw: false,
            autoSkipBlock: false,
            autoSkipTrigger: false,
            autoSelectMaxValue: false,
            confirmEndTurn: true,
            confirmCounter: true,
            confirmTrigger: true,
    
            soundEffects: true,
            audioEnabled: true,
            layoutDensity: 'comfortable',
            fontStyle: 'modern',
            colorTheme: 'obsidian',
            accentColor: '#44d7b6',
            cardScale: 100,
            motionEnabled: true
        };
    }

    loadAppearanceControls() {
        ['layoutDensity', 'fontStyle', 'colorTheme'].forEach((name) => {
            const value = this.settings[name];
            const input = document.querySelector(`input[name="${name}"][value="${value}"]`);
            if (input) input.checked = true;
        });

        const accent = document.getElementById('accentColor');
        const scale = document.getElementById('cardScale');
        const motion = document.getElementById('motionEnabled');
        if (accent) accent.value = this.settings.accentColor;
        if (scale) scale.value = this.settings.cardScale;
        if (motion) motion.checked = this.settings.motionEnabled;
        this.updateScaleOutput();
        this.updateAccentControls();
    }

    setupAppearanceListeners() {
        document.querySelectorAll('input[name="layoutDensity"], input[name="fontStyle"], input[name="colorTheme"]')
            .forEach((input) => input.addEventListener('change', () => {
                this.settings[input.name] = input.value;
                this.previewAppearance();
            }));

        const accent = document.getElementById('accentColor');
        const scale = document.getElementById('cardScale');
        const motion = document.getElementById('motionEnabled');
        accent?.addEventListener('input', () => {
            this.settings.accentColor = accent.value;
            this.updateAccentControls();
            this.previewAppearance();
        });
        document.querySelectorAll('[data-accent]').forEach((button) => {
            button.addEventListener('click', () => {
                const color = button.dataset.accent;
                if (!accent || !color) return;
                accent.value = color;
                this.settings.accentColor = color;
                this.updateAccentControls();
                this.previewAppearance();
            });
        });
        scale?.addEventListener('input', () => {
            this.settings.cardScale = Number(scale.value);
            this.updateScaleOutput();
            this.previewAppearance();
        });
        motion?.addEventListener('change', () => {
            this.settings.motionEnabled = motion.checked;
            this.previewAppearance();
        });
        document.getElementById('resetAppearanceButton')?.addEventListener('click', () => {
            const defaults = this.getDefaultSettings();
            ['layoutDensity', 'fontStyle', 'colorTheme', 'accentColor', 'cardScale', 'motionEnabled']
                .forEach((key) => { this.settings[key] = defaults[key]; });
            this.loadAppearanceControls();
            this.previewAppearance();
        });
    }

    updateScaleOutput() {
        const output = document.getElementById('cardScaleOutput');
        if (output) output.textContent = `${this.settings.cardScale}%`;
    }

    updateAccentControls() {
        const normalizedColor = String(this.settings.accentColor || '#44d7b6').toUpperCase();
        const output = document.getElementById('accentColorValue');
        if (output) output.textContent = normalizedColor;

        document.querySelectorAll('[data-accent]').forEach((button) => {
            const isActive = String(button.dataset.accent || '').toUpperCase() === normalizedColor;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });
    }

    previewAppearance() {
        if (typeof window.applyInterfacePreferences === 'function') {
            window.applyInterfacePreferences(this.settings);
        }
        this.persistSettings();
    }

    persistSettings() {
        try {
            localStorage.setItem('gameSettings', JSON.stringify(this.settings));
        } catch (error) {
            console.warn('Unable to persist settings.', error);
        }
    }

    // Save settings to localStorage
    saveSettings() {
        this.persistSettings();
        this.showSaveNotification();
    }

    // =========================
    // Tab Navigation
    // =========================

    // Setup tab navigation functionality
    setupTabNavigation() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const tabName = button.getAttribute('data-tab');
                
                // Remove active class from all buttons and contents
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                // Add active class to clicked button and corresponding content
                button.classList.add('active');
                document.getElementById(tabName).classList.add('active');
            });
        });
    }

    // =========================
    // Checkbox State
    // =========================

    // Load checkbox states from saved settings
    loadCheckboxStates() {
        const checkboxes = document.querySelectorAll('.setting-checkbox');
        
        checkboxes.forEach(checkbox => {
            const setting = checkbox.getAttribute('data-setting');
            if (this.settings.hasOwnProperty(setting)) {
                checkbox.checked = this.settings[setting];
            }
        });
    }

    // =========================
    // Event Listeners
    // =========================

    // Setup event listeners for checkboxes and save button
    setupEventListeners() {
        const checkboxes = document.querySelectorAll('.setting-checkbox');
        const saveButton = document.getElementById('saveButton');

        // Update settings when checkbox is changed
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const setting = e.target.getAttribute('data-setting');
                this.settings[setting] = e.target.checked;
            });
        });

        // Save settings when save button is clicked
        saveButton.addEventListener('click', () => {
            this.saveSettings();
        });
    }

    // =========================
    // Save Feedback
    // =========================

    // Show save notification feedback
    showSaveNotification() {
        const saveButton = document.getElementById('saveButton');
        const originalText = saveButton.textContent;
        
        // Change button text to indicate save
        saveButton.textContent = '✓ Settings Saved!';
        saveButton.style.background = 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)';
        
        // Revert after 2 seconds
        setTimeout(() => {
            saveButton.textContent = originalText;
            saveButton.style.background = '';
        }, 2000);
    }
}

// =========================
// Page Load
// =========================

// Initialize settings manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new SettingsManager();
});
