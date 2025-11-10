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
		// Use relative path helper if available (from main.js), otherwise use relative path
		var workerPath;
		if (typeof window.getFlipbookPath === 'function') {
			workerPath = window.getFlipbookPath('pdf.worker.js');
		} else {
			// Fallback: use relative path from script location
			// Since this script is in js/, pdf.worker.js is in the same directory
			var scripts = document.getElementsByTagName('script');
			for (var i = scripts.length - 1; i >= 0; i--) {
				var src = scripts[i].src;
				if (src && src.indexOf('init-dpi.js') !== -1) {
					workerPath = src.substring(0, src.lastIndexOf('/') + 1) + 'pdf.worker.js';
					break;
				}
			}
			// Last fallback
			if (!workerPath) {
				workerPath = 'pdf.worker.js';
			}
		}

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

