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
            colorPickerGrid: true,
            colorPickerFrame: false,
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

        const scale = document.getElementById('cardScale');
        const motion = document.getElementById('motionEnabled');
        const pickerGrid = document.getElementById('colorPickerGrid');
        const pickerFrame = document.getElementById('colorPickerFrame');
        if (scale) scale.value = this.settings.cardScale;
        if (motion) motion.checked = this.settings.motionEnabled;
        if (pickerGrid) pickerGrid.checked = this.settings.colorPickerGrid;
        if (pickerFrame) pickerFrame.checked = this.settings.colorPickerFrame;
        this.updateScaleOutput();
        this.updateAccentControls();
    }

    setupAppearanceListeners() {
        document.querySelectorAll('input[name="layoutDensity"], input[name="fontStyle"], input[name="colorTheme"]')
            .forEach((input) => input.addEventListener('change', () => {
                this.settings[input.name] = input.value;
            }));

        const scale = document.getElementById('cardScale');
        const motion = document.getElementById('motionEnabled');
        const pickerGrid = document.getElementById('colorPickerGrid');
        const pickerFrame = document.getElementById('colorPickerFrame');
        document.querySelectorAll('[data-color-map]').forEach((map) => {
            map.addEventListener('click', (event) => {
                const color = this.sampleColorMap(map, event);
                if (!color) return;
                this.settings.accentColor = color;
                this.updateAccentControls();
            });
        });
        document.querySelectorAll('[data-accent]').forEach((button) => {
            button.addEventListener('click', () => {
                const color = button.dataset.accent;
                if (!color) return;
                this.settings.accentColor = color;
                this.updateAccentControls();
            });
        });
        scale?.addEventListener('input', () => {
            this.settings.cardScale = Number(scale.value);
            this.updateScaleOutput();
        });
        motion?.addEventListener('change', () => {
            this.settings.motionEnabled = motion.checked;
        });
        pickerGrid?.addEventListener('change', () => {
            this.settings.colorPickerGrid = pickerGrid.checked;
            this.updateAccentControls();
        });
        pickerFrame?.addEventListener('change', () => {
            this.settings.colorPickerFrame = pickerFrame.checked;
            this.updateAccentControls();
        });
        document.getElementById('resetAppearanceButton')?.addEventListener('click', () => {
            const defaults = this.getDefaultSettings();
            ['layoutDensity', 'fontStyle', 'colorTheme', 'accentColor', 'colorPickerGrid', 'colorPickerFrame', 'cardScale', 'motionEnabled']
                .forEach((key) => { this.settings[key] = defaults[key]; });
            this.loadAppearanceControls();
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
        const studio = document.getElementById('customColorStudio');
        if (studio) {
            studio.style.setProperty('--picker-color', normalizedColor);
            studio.classList.toggle('grid-enabled', Boolean(this.settings.colorPickerGrid));
            studio.classList.toggle('frame-enabled', Boolean(this.settings.colorPickerFrame));
        }

        document.querySelectorAll('[data-accent]').forEach((button) => {
            const isActive = String(button.dataset.accent || '').toUpperCase() === normalizedColor;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });
    }

    sampleColorMap(map, event) {
        const image = map.querySelector('img:not(.color-map-grid)');
        if (!image?.complete || !image.naturalWidth) return null;

        const rect = map.getBoundingClientRect();
        const xRatio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
        const yRatio = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
        const canvas = image._colorSampler || document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0);
        image._colorSampler = canvas;

        try {
            const pixel = context.getImageData(
                Math.min(image.naturalWidth - 1, Math.floor(xRatio * image.naturalWidth)),
                Math.min(image.naturalHeight - 1, Math.floor(yRatio * image.naturalHeight)),
                1,
                1
            ).data;
            const color = `#${[pixel[0], pixel[1], pixel[2]].map(value => value.toString(16).padStart(2, '0')).join('')}`;
            map.style.setProperty('--cursor-x', `${xRatio * 100}%`);
            map.style.setProperty('--cursor-y', `${yRatio * 100}%`);
            return color;
        } catch (error) {
            console.warn('Unable to sample the color map.', error);
            return null;
        }
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
        if (typeof window.applyInterfacePreferences === 'function') {
            window.applyInterfacePreferences(this.settings);
        }
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
