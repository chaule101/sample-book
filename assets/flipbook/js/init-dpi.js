// Initialization script for flipbook
// This file contains initialization code that needs to run at specific points during page load

(function() {
	'use strict';

	// Force high DPI rendering by overriding devicePixelRatio
	// This ensures consistent 2x rendering across all devices
	function forceHighDPIRendering() {
		try {
			Object.defineProperty(window, 'devicePixelRatio', {
				get: function() { return 2.0; },
				configurable: true
			});
		} catch (e) {
			console.warn('Could not override devicePixelRatio:', e);
		}
	}

	// Configure PDF.js worker path
	// This must be set before any PDF operations occur
	function configurePDFWorker() {
		var workerPath = 'assets/flipbook/js/pdf.worker.js';

		// Try multiple ways to set the worker path for compatibility
		if (typeof PDFJS !== 'undefined') {
			PDFJS.workerSrc = workerPath;
		}
		if (typeof pdfjsLib !== 'undefined') {
			pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
			console.log('pdfjsLib.GlobalWorkerOptions.workerSrc set to:', pdfjsLib.GlobalWorkerOptions.workerSrc);
		}
		// Set on global object for older versions
		if (typeof window !== 'undefined') {
			window.PDFJS = window.PDFJS || {};
			window.PDFJS.workerSrc = workerPath;
		}
	}

	// Run initialization functions
	// Only force DPI on first load (check if already set)
	if (!window._flipbookInit) {
		forceHighDPIRendering();
		window._flipbookInit = true;
	}

	// Always configure PDF worker (in case it gets reset)
	configurePDFWorker();
})();

