// Helper function to get relative path from script location (for WordPress compatibility)
(function() {
	var cachedBasePath = null;

	function getScriptPath() {
		// Return cached path if available
		if (cachedBasePath !== null) {
			return cachedBasePath;
		}

		var scriptPath = '';
		var debugMode = window.DEBUG_FLIPBOOK_PATHS === true;

		// Method 1: Use currentScript (most reliable, works in modern browsers)
		if (document.currentScript && document.currentScript.src) {
			var src = document.currentScript.src;
			scriptPath = src.substring(0, src.lastIndexOf('/') + 1);
			if (debugMode) {
				console.log('[getScriptPath] Method 1 (currentScript) found:', scriptPath);
			}
		}

		// Method 2: Find main.js script tag (fallback for older browsers)
		if (!scriptPath) {
			var scripts = document.getElementsByTagName('script');
			for (var i = scripts.length - 1; i >= 0; i--) {
				var src = scripts[i].src;
				if (src) {
					// Look for main.js or any flipbook-related script
					if (src.indexOf('main.js') !== -1 ||
					    (src.indexOf('flipbook') !== -1 && src.indexOf('.js') !== -1)) {
						scriptPath = src.substring(0, src.lastIndexOf('/') + 1);
						if (debugMode) {
							console.log('[getScriptPath] Method 2 (script tag search) found:', scriptPath, 'from:', src);
						}
						break;
					}
				}
			}
		}

		// Method 3: Find any script with 'flipbook' in the path
		if (!scriptPath) {
			var scripts = document.getElementsByTagName('script');
			for (var i = scripts.length - 1; i >= 0; i--) {
				var src = scripts[i].src;
				if (src && src.indexOf('flipbook') !== -1) {
					scriptPath = src.substring(0, src.lastIndexOf('/') + 1);
					if (debugMode) {
						console.log('[getScriptPath] Method 3 (flipbook search) found:', scriptPath, 'from:', src);
					}
					break;
				}
			}
		}

		if (debugMode && !scriptPath) {
			console.warn('[getScriptPath] No script path found! All methods failed.');
		}

		// Cache the result
		cachedBasePath = scriptPath;
		return scriptPath;
	}

	// Helper function to normalize and resolve relative paths
	function resolvePath(basePath, relativePath) {
		// If basePath is empty or invalid, return relative path as-is
		if (!basePath) {
			return relativePath;
		}

		// Use browser's built-in URL resolution if available (modern browsers)
		if (typeof URL !== 'undefined') {
			try {
				// Create a base URL from the script path
				var baseUrl = new URL(basePath, window.location.href);
				// Resolve the relative path
				var resolvedUrl = new URL(relativePath, baseUrl.href);
				return resolvedUrl.href;
			} catch (e) {
				// Fall back to manual resolution if URL constructor fails
			}
		}

		// Manual path resolution (fallback for older browsers)
		// Normalize basePath - ensure it ends with /
		if (!basePath.endsWith('/')) {
			basePath += '/';
		}

		// Remove leading slash from relativePath if present
		if (relativePath.charAt(0) === '/') {
			relativePath = relativePath.substring(1);
		}

		// Combine paths
		var fullPath = basePath + relativePath;

		// Resolve .. and . in the path
		var parts = fullPath.split('/');
		var resolved = [];

		for (var i = 0; i < parts.length; i++) {
			var part = parts[i];
			if (part === '' || part === '.') {
				// Skip empty parts and current directory
				if (i === 0 && fullPath.indexOf('://') !== -1) {
					// Preserve leading empty part for absolute URLs
					resolved.push('');
				}
				continue;
			} else if (part === '..') {
				// Go up one directory
				if (resolved.length > 0 && resolved[resolved.length - 1] !== '..') {
					resolved.pop();
				} else if (resolved.length === 0 || resolved[resolved.length - 1] === '') {
					// Can't go up from root
					continue;
				} else {
					resolved.push('..');
				}
			} else {
				// Add directory/file
				resolved.push(part);
			}
		}

		// Reconstruct the path
		var result = resolved.join('/');

		// Ensure absolute URLs start with protocol
		if (fullPath.indexOf('://') !== -1 && result.indexOf('://') === -1) {
			// Extract protocol from original path
			var protocolMatch = fullPath.match(/^([^:]+:\/\/)/);
			if (protocolMatch) {
				result = protocolMatch[1] + result.replace(/^\/+/, '');
			}
		}

		return result;
	}

	// Helper function to build relative paths from script location
	window.getFlipbookPath = function(relativePath) {
		var scriptPath = getScriptPath();

		// Debug mode: Enable by setting window.DEBUG_FLIPBOOK_PATHS = true in console
		var debugMode = window.DEBUG_FLIPBOOK_PATHS === true;

		if (debugMode) {
			console.log('[getFlipbookPath] Input relativePath:', relativePath);
			console.log('[getFlipbookPath] Detected scriptPath:', scriptPath);
		}

		// If script path is found, resolve the path properly
		if (scriptPath) {
			var resolved = resolvePath(scriptPath, relativePath);
			if (debugMode) {
				console.log('[getFlipbookPath] Resolved path:', resolved);
			}
			return resolved;
		}

		// Fallback: use relative path from script location
		// Since script is in js/, we go up one level with ../
		var fallback = '../' + relativePath;
		if (debugMode) {
			console.warn('[getFlipbookPath] Script path not found! Using fallback:', fallback);
			console.log('[getFlipbookPath] All script tags:', Array.from(document.getElementsByTagName('script')).map(function(s) { return s.src || 'inline'; }));
		}
		return fallback;
	};
})();

// Configure PDF.js worker path at the very beginning
// This ensures it's set before any PDF operations occur
(function() {
	var workerPath = window.getFlipbookPath('pdf.worker.js');
	if (typeof PDFJS !== 'undefined') {
		PDFJS.workerSrc = workerPath;
	}
	if (typeof pdfjsLib !== 'undefined') {
		pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
	}
	if (typeof window !== 'undefined') {
		window.PDFJS = window.PDFJS || {};
		window.PDFJS.workerSrc = workerPath;
	}
})();

// Intercept PDF.js rendering to force 2x scale for crisp text
// This ensures all PDF rendering uses 2x scale regardless of how the library calls it
(function() {
	var targetScale = 2.0; // Force 2x rendering for clarity

	// Intercept PDF.js getViewport to force 2x scale
	function interceptPDFJS() {
		// Try pdfjsLib (newer versions)
		if (typeof pdfjsLib !== 'undefined' && pdfjsLib.getDocument) {
			var originalGetDocument = pdfjsLib.getDocument;
			pdfjsLib.getDocument = function() {
				var promise = originalGetDocument.apply(this, arguments);
				// Intercept the promise to modify pages when they're loaded
				return promise.then(function(pdf) {
					var originalGetPage = pdf.getPage;
					pdf.getPage = function(pageNumber) {
						return originalGetPage.call(this, pageNumber).then(function(page) {
							// Intercept getViewport to force 2x scale
							var originalGetViewport = page.getViewport;
							page.getViewport = function(scale, rotation) {
								// Force 2x scale
								var viewport = originalGetViewport.call(this, targetScale, rotation || 0);
								return viewport;
							};

							// Intercept render to ensure 2x scale is used
							var originalRender = page.render;
							page.render = function(params) {
								// Force 2x scale in render parameters
								if (params && params.viewport) {
									// If viewport is provided, ensure it's at 2x
									if (params.viewport.scale !== targetScale) {
										params.viewport = page.getViewport(targetScale, params.viewport.rotation || 0);
									}
								} else {
									// Create viewport at 2x if not provided
									params = params || {};
									params.viewport = page.getViewport(targetScale, 0);
								}
								return originalRender.call(this, params);
							};

							return page;
						});
					};
					return pdf;
				});
			};
		}

		// Try PDFJS (older versions)
		if (typeof PDFJS !== 'undefined' && PDFJS.getDocument) {
			var originalGetDocument2 = PDFJS.getDocument;
			PDFJS.getDocument = function() {
				var promise = originalGetDocument2.apply(this, arguments);
				return promise.then(function(pdf) {
					var originalGetPage2 = pdf.getPage;
					pdf.getPage = function(pageNumber) {
						return originalGetPage2.call(this, pageNumber).then(function(page) {
							var originalGetViewport2 = page.getViewport;
							page.getViewport = function(scale, rotation) {
								return originalGetViewport2.call(this, targetScale, rotation || 0);
							};

							var originalRender2 = page.render;
							page.render = function(params) {
								if (params && params.viewport) {
									if (params.viewport.scale !== targetScale) {
										params.viewport = page.getViewport(targetScale, params.viewport.rotation || 0);
									}
								} else {
									params = params || {};
									params.viewport = page.getViewport(targetScale, 0);
								}
								return originalRender2.call(this, params);
							};

							return page;
						});
					};
					return pdf;
				});
			};
		}
	}

	// Try to intercept immediately
	interceptPDFJS();

	// Also try after a delay in case PDF.js loads later
	setTimeout(interceptPDFJS, 100);
	setTimeout(interceptPDFJS, 500);
})();

var template = {
	html: window.getFlipbookPath('../templates/default-book-view.html'),
	links: [{
		rel: 'stylesheet',
		href: window.getFlipbookPath('../css/font-awesome.min.css')
	}],
	styles: [
		window.getFlipbookPath('../css/short-black-book-view.css')
	],
	script: window.getFlipbookPath('default-book-view.js')
};

// Function to initialize and load the book
function loadBook() {
	// Ensure worker path is set before loading PDF
	var workerPath = window.getFlipbookPath('pdf.worker.js');
	if (typeof PDFJS !== 'undefined') {
		PDFJS.workerSrc = workerPath;
	}
	if (typeof pdfjsLib !== 'undefined') {
		pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
	}
	var PDF_PATH = window.getFlipbookPath('../books/pdf/ProfileBook.pdf');
	var container = $('#container-book');

	// Show the container
	container.show();

	// Hide the button
	$('#show-book-btn').addClass('hidden');

	// Suppress PDF.js console warnings (they're just warnings, not critical errors)
	var originalConsoleWarn = console.warn;
	var originalConsoleError = console.error;

	console.warn = function() {
		var args = Array.prototype.slice.call(arguments);
		var message = args.join(' ');
		// Suppress specific PDF.js warnings
		if (message.includes('Deprecated API usage') ||
				message.includes('moz-chunked-arraybuffer') ||
				message.includes('Permissions policy violation') ||
				message.includes('non-passive event listener')) {
			return; // Suppress these warnings
		}
		originalConsoleWarn.apply(console, args);
	};

	// Suppress "Cannot load PDF page" errors for pages beyond the PDF
	console.error = function() {
		var args = Array.prototype.slice.call(arguments);
		var message = args.join(' ');
		// Suppress page loading errors for non-existent pages
		if (message.includes('Cannot load PDF page')) {
			return; // Suppress this error
		}
		originalConsoleError.apply(console, args);
	};

	// Simple direct PDF loading - limit to actual PDF pages (75 pages)
	// The library calculates: pages = 4 (covers) + 2 * sheets
	// For 75 pages: sheets = (75-4)/2 = 35.5, so we need to limit it

	// Calculate device pixel ratio for high-DPI rendering
	var ratio = window.devicePixelRatio || 1;
	// Use 2x scale to match 50% zoom clarity (2x resolution = clearer text)
	var pdfScale = 2.0;

		var soundPath = window.getFlipbookPath('../sounds/start-flip.mp3');
		var options = {
		pdf: PDF_PATH,
		template: template,
		// Try multiple sound configuration formats
		sound: {
			startFlip: soundPath,
		},
		sounds: {
			startFlip: soundPath,
		},
		// Alternative format: separate properties
		soundStartFlip: soundPath,
		// Single propertiesCallback that handles both scale and sounds
		propertiesCallback: function(props) {
			// Increase PDF rendering scale for better text clarity
			// 2x scale matches the clarity you see at 50% browser zoom
			if (props.page) {
				props.page.scale = pdfScale;
			}

			// Set sounds in properties - try multiple formats
			// Always set sounds, even if they exist (override)
			var soundPath = window.getFlipbookPath('../sounds/start-flip.mp3');
			props.sound = {
				startFlip: soundPath,
			};
			props.sounds = {
				startFlip: soundPath,
			};

			// Also try as separate properties
			props.soundStartFlip = soundPath;

			return props;
		}
	};

	// Single loading overlay element
	var $singleLoadingOverlay = $('#single-loading-overlay');
	var $canvasLoadingCover = $('#canvas-loading-cover');

	// Track loading state
	var isCurrentlyLoading = false;
	var loadingTimeout = null;

	// Function to ensure only one loading indicator is visible
	function ensureSingleLoadingIndicator() {
		// Find all page-loading elements
		var pageLoadings = $('.page-loading');

		// Hide all HTML-based loading indicators
		pageLoadings.each(function() {
			var $el = $(this);
			$el.removeClass('loading-active');
			$el[0].style.setProperty('display', 'none', 'important');
			$el[0].style.setProperty('visibility', 'hidden', 'important');
			$el[0].style.setProperty('opacity', '0', 'important');
		});

		// Check if any pages are loading (not hidden by library)
		var visibleLoadings = pageLoadings.filter(function() {
			return !$(this).hasClass('hidden');
		});

		// Show cover if ANY page-loading elements exist (even if hidden)
		// This is more aggressive - we'll show the cover whenever page-loading elements exist
		var hasAnyLoading = pageLoadings.length > 0;

		// Clear any existing timeout
		if (loadingTimeout) {
			clearTimeout(loadingTimeout);
			loadingTimeout = null;
		}

		if (hasAnyLoading) {
			isCurrentlyLoading = true;

			// Show full screen cover to hide canvas loading indicators
			$canvasLoadingCover[0].style.cssText = 'display: block !important; position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; background-color: rgba(51, 51, 51, 0.98) !important; z-index: 999999 !important; pointer-events: none !important;';
			$canvasLoadingCover.addClass('show');

			// Force show overlay with maximum z-index
			$singleLoadingOverlay[0].style.cssText = 'display: block !important; position: absolute !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important; z-index: 1000000 !important; visibility: visible !important; opacity: 1 !important;';
			$singleLoadingOverlay.addClass('show');

			// Also try to hide canvas elements directly
			$('.flip-book canvas').each(function() {
				this.style.setProperty('opacity', '0', 'important');
				this.style.setProperty('visibility', 'hidden', 'important');
				this.style.setProperty('pointer-events', 'none', 'important');
			});
		} else {
			// Only hide after a delay to ensure loading is really done
			loadingTimeout = setTimeout(function() {
				if (isCurrentlyLoading) {
					isCurrentlyLoading = false;
					$canvasLoadingCover[0].style.setProperty('display', 'none', 'important');
					$canvasLoadingCover.removeClass('show');
					$singleLoadingOverlay[0].style.setProperty('display', 'none', 'important');
					$singleLoadingOverlay.removeClass('show');

					// Restore canvas elements
					$('.flip-book canvas').css({
						'opacity': '',
						'visibility': '',
						'pointer-events': ''
					});
				}
			}, 500); // Wait 500ms before hiding
		}
	}

	// Check if FlipBook is available
	if (typeof container.FlipBook === 'function') {
		try {
			var flipbookInstance = container.FlipBook(options);

			// --- Ensure canvas resolution is correct for crisp text ---
			// Canvas should be at 2x internal resolution, displayed at 1x size
			// PDF.js will render at 2x scale into the 2x canvas
			setTimeout(() => {
				const targetRatio = 2.0; // Target 2x resolution for crisp text

				function fixCanvasDPI() {
					$('.flip-book canvas').each(function () {
						const canvas = this;
						const rect = canvas.getBoundingClientRect();

						if (rect.width === 0 || rect.height === 0) {
							return; // Skip if canvas is not visible
						}

						// Calculate current effective resolution
						const currentRatio = canvas.width / rect.width;

						// Only adjust if not already at correct resolution (within 10% tolerance)
						if (Math.abs(currentRatio - targetRatio) > 0.1) {
							// Canvas needs to be resized to 2x resolution
							// Don't scale the context - PDF.js will render at 2x scale directly
							canvas.width = Math.round(rect.width * targetRatio);
							canvas.height = Math.round(rect.height * targetRatio);

							// Ensure image smoothing is disabled for crisp rendering
							const ctx = canvas.getContext('2d', { willReadFrequently: false });
							if (ctx) {
								ctx.imageSmoothingEnabled = false;
								ctx.webkitImageSmoothingEnabled = false;
								ctx.mozImageSmoothingEnabled = false;
								ctx.msImageSmoothingEnabled = false;
							}

							// Note: We don't scale the context here because PDF.js will render
							// at 2x scale directly into the 2x canvas, giving us crisp text
						}
					});
				}

				// Run immediately and periodically to catch new pages
				fixCanvasDPI();
				setInterval(fixCanvasDPI, 1000);

				// Also re-run when zooming or resizing window
				window.addEventListener('resize', fixCanvasDPI);
			}, 1500);


			// Try to enable sounds programmatically after initialization
			setTimeout(function() {
				// Try to enable sounds via the sounds button if it exists
				var soundsButton = container.find('.cmdSounds').first();
				if (soundsButton.length === 0) {
					// Try finding it in the document
					soundsButton = $(document).find('.cmdSounds').first();
				}

				if (soundsButton.length > 0) {
					// Always click to toggle/enable sounds
					soundsButton[0].click();

					// Wait a bit and click again if needed (toggle might have been off)
					setTimeout(function() {
						// Check if we need to click again
						var icon = soundsButton.find('.fa-volume-up, .fa-volume-off, .fa-volume-down');
						if (icon.length > 0) {
							// If it shows volume-off, click again to enable
							if (icon.hasClass('fa-volume-off')) {
								soundsButton[0].click();
							}
						}
					}, 200);
				}

				// Also try to enable sounds via the API if available
				if (flipbookInstance) {
					if (flipbookInstance.sounds) {
						// Try to enable sounds
						if (typeof flipbookInstance.sounds.enable === 'function') {
							flipbookInstance.sounds.enable();
						} else if (typeof flipbookInstance.sounds.setEnabled === 'function') {
							flipbookInstance.sounds.setEnabled(true);
						} else if (typeof flipbookInstance.sounds.toggle === 'function') {
							flipbookInstance.sounds.toggle();
						}

						// Force enable if already enabled but not working
						if (flipbookInstance.sounds.enabled === true) {
							// If audio objects are empty, manually load them
							if (flipbookInstance.sounds.audio && Object.keys(flipbookInstance.sounds.audio).length === 0) {
								// Try to manually create and load audio objects
								try {
									// Create audio elements for startFlip and endFlip
									var startFlipAudio = new Audio(window.getFlipbookPath('../sounds/start-flip.mp3'));

									// Preload the audio
									startFlipAudio.preload = 'auto';

									// Try to load them
									startFlipAudio.load();

									// Assign them to the sounds.audio object
									flipbookInstance.sounds.audio.startFlip = startFlipAudio;

									// Also try to set them in sounds.sounds if that exists
									if (flipbookInstance.sounds.sounds) {
										flipbookInstance.sounds.sounds.startFlip = startFlipAudio;
									}
								} catch (e) {
									// Silently handle errors
								}
							}

							// Try to manually load audio files if they're not loaded
							if (flipbookInstance.sounds.audio) {
								// Check if we need to reload or initialize audio
								if (typeof flipbookInstance.sounds.load === 'function') {
									flipbookInstance.sounds.load();
								}
							}
						}
					}

					// Try to access sounds through scene
					if (flipbookInstance.scene && flipbookInstance.scene.sounds) {
						if (typeof flipbookInstance.scene.sounds.enable === 'function') {
							flipbookInstance.scene.sounds.enable();
						}
					}
				}
			}, 1500);

			// Move cover to be inside the flipbook container for better positioning
			setTimeout(function() {
				var flipbookEl = container.find('.flip-book').first();
				if (flipbookEl.length > 0) {
					// Append cover to flipbook container
					$canvasLoadingCover.appendTo(flipbookEl);
					// Make it absolute within the flipbook
					$canvasLoadingCover.css({
						'position': 'absolute',
						'top': '0',
						'left': '0',
						'width': '100%',
						'height': '100%'
					});
				}
			}, 100);

			// Immediately ensure only one loading indicator is visible
			ensureSingleLoadingIndicator();

			// Monitor for loading indicators continuously - never stop
			var loadingObserver = setInterval(function() {
				ensureSingleLoadingIndicator();
			}, 20); // Check every 20ms for faster response

			// Also use MutationObserver to catch when loading indicators are added
			var observer = new MutationObserver(function(mutations) {
				ensureSingleLoadingIndicator();
			});

			// Observe the document body for changes (loading indicators might be anywhere)
			observer.observe(document.body, {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: ['class', 'style']
			});

			// Also listen for any click events that might trigger page flips
			$(document).on('click', '.cmdForward, .cmdBackward, .cmdFastForward, .cmdFastBackward', function() {
				// Check immediately and then again after a short delay
				ensureSingleLoadingIndicator();
				setTimeout(function() {
					ensureSingleLoadingIndicator();
				}, 50);
				setTimeout(function() {
					ensureSingleLoadingIndicator();
				}, 200);
			});

			// Also listen for when the library removes the hidden class from loading indicators
			var classObserver = new MutationObserver(function(mutations) {
				mutations.forEach(function(mutation) {
					if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
						var target = mutation.target;
						if (target.classList && target.classList.contains('page-loading')) {
							// A loading indicator's class changed, check again immediately
							ensureSingleLoadingIndicator();
						}
					} else if (mutation.type === 'childList') {
						// New elements added - check if any are page-loading
						mutation.addedNodes.forEach(function(node) {
							if (node.nodeType === 1) { // Element node
								if (node.classList && node.classList.contains('page-loading')) {
									// Observe this new page-loading element
									classObserver.observe(node, {
										attributes: true,
										attributeFilter: ['class']
									});
									ensureSingleLoadingIndicator();
								}
								// Also check descendants
								$(node).find('.page-loading').each(function() {
									classObserver.observe(this, {
										attributes: true,
										attributeFilter: ['class']
									});
									ensureSingleLoadingIndicator();
								});
							}
						});
					}
				});
			});

			// Observe the body for new page-loading elements
			classObserver.observe(document.body, {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: ['class']
			});

			// Also observe all existing page-loading elements individually
			function observeAllLoadingIndicators() {
				$('.page-loading').each(function() {
					classObserver.observe(this, {
						attributes: true,
						attributeFilter: ['class']
					});
				});
			}

			// Set up observers initially and periodically
			setTimeout(observeAllLoadingIndicators, 500);
			setInterval(observeAllLoadingIndicators, 2000);

			// Monitor page changes by watching for canvas updates
			var lastCanvasCount = 0;
			var canvasObserver = setInterval(function() {
				var currentCanvasCount = container.find('canvas').length;
				if (currentCanvasCount !== lastCanvasCount) {
					lastCanvasCount = currentCanvasCount;
					setTimeout(function() {
						ensureSingleLoadingIndicator();
					}, 100);
				}
			}, 100);

			// Wait a bit then log the actual page count
			setTimeout(function() {
				if (flipbookInstance && flipbookInstance.book) {
					var totalPages = flipbookInstance.book.getPages ? flipbookInstance.book.getPages() : 'unknown';
				}
			}, 2000);

			// Add drag-to-flip functionality
			// Wait longer for flipbook to fully initialize, then retry if needed
			var attemptSetup = function(attempt) {
				attempt = attempt || 1;
				var canvas = container.find('canvas');

				if (canvas.length > 0 || attempt >= 5) {
					setupDragToFlip(container, flipbookInstance);

					// If canvas not found, retry after a delay
					if (canvas.length === 0 && attempt < 5) {
						setTimeout(function() {
							attemptSetup(attempt + 1);
						}, 1000);
					}
				} else {
					setTimeout(function() {
						attemptSetup(attempt + 1);
					}, 1000);
				}
			};

			setTimeout(function() {
				attemptSetup(1);
			}, 2000);
		} catch (e) {
			console.error('Error loading flipbook:', e);
		}
	} else {
		console.error('FlipBook function not available');
	}

	// Function to setup drag-to-flip functionality
	function setupDragToFlip(container, flipbookInstance) {
		var isDragging = false;
		var startX = 0;
		var startY = 0;
		var dragThreshold = 30; // Minimum pixels to drag before triggering flip
		var hasFlipped = false; // Prevent multiple flips during one drag

		// Find the canvas element
		var canvas = container.find('canvas');
		if (canvas.length === 0) {
			setTimeout(function() {
				setupDragToFlip(container, flipbookInstance);
			}, 500);
			return;
		}

		var canvasElement = canvas.first();

		// Create an invisible overlay div that covers the entire canvas
		// This will intercept ALL mouse events before they reach the library
		var overlay = $('<div>', {
			css: {
				position: 'absolute',
				top: 0,
				left: 0,
				width: '100%',
				height: '100%',
				zIndex: 1000,
				cursor: 'grab',
				pointerEvents: 'auto'
			}
		});

		// Position overlay relative to canvas parent
		var canvasParent = canvasElement.parent();
		if (canvasParent.length > 0) {
			canvasParent.css('position', 'relative');
			overlay.appendTo(canvasParent);

			// Match overlay size to canvas
			var updateOverlaySize = function() {
				var canvasRect = canvasElement[0].getBoundingClientRect();
				overlay.css({
					width: canvasRect.width + 'px',
					height: canvasRect.height + 'px',
					top: canvasElement.position().top + 'px',
					left: canvasElement.position().left + 'px'
				});
			};

			updateOverlaySize();
			$(window).on('resize', updateOverlaySize);
		}

		// Helper function to navigate pages
		function navigatePage(direction) {
			if (hasFlipped) return; // Prevent multiple flips
			hasFlipped = true;

			// Try to find navigation buttons in the container (not just flipbookView)
			var navButton = null;
			if (direction === 'forward') {
				navButton = container.find('.cmdForward').first();
				if (navButton.length === 0) {
					navButton = $(document).find('.cmdForward').first();
				}
			} else if (direction === 'backward') {
				navButton = container.find('.cmdBackward').first();
				if (navButton.length === 0) {
					navButton = $(document).find('.cmdBackward').first();
				}
			}

			if (navButton && navButton.length > 0) {
				// Check if button is not disabled
				if (!navButton.hasClass('disabled') && navButton.is(':visible')) {
					navButton[0].click(); // Use native click instead of trigger
				}
			} else {
				// Fallback: try using flipbook instance API
				try {
					if (direction === 'forward' && flipbookInstance && flipbookInstance.book) {
						var currentPage = flipbookInstance.book.getCurrentPage ? flipbookInstance.book.getCurrentPage() : 0;
						var totalPages = flipbookInstance.book.getPages ? flipbookInstance.book.getPages() : 0;
						if (currentPage < totalPages - 1 && flipbookInstance.book.gotoPage) {
							flipbookInstance.book.gotoPage(currentPage + 1);
						}
					} else if (direction === 'backward' && flipbookInstance && flipbookInstance.book) {
						var currentPage = flipbookInstance.book.getCurrentPage ? flipbookInstance.book.getCurrentPage() : 0;
						if (currentPage > 0 && flipbookInstance.book.gotoPage) {
							flipbookInstance.book.gotoPage(currentPage - 1);
						}
					}
				} catch (err) {
					// Silently handle errors
				}
			}
		}

		// Mouse events on overlay - this intercepts ALL events before library
		overlay.on('mousedown', function(e) {
			// Don't interfere with buttons
			if ($(e.target).closest('a, button, input, .cmdForward, .cmdBackward, .controls, .fnav').length > 0) {
				return;
			}

			// Start drag from ANYWHERE on overlay
			isDragging = true;
			hasFlipped = false;
			startX = e.pageX || e.clientX;
			startY = e.pageY || e.clientY;

			overlay.css('cursor', 'grabbing');

			// CRITICAL: Prevent library from receiving this event
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();

			return false;
		});

		// Handle mousemove on document (overlay doesn't need it since it's always on top)
		$(document).on('mousemove', function(e) {
			if (!isDragging || hasFlipped) return;

			var currentX = e.pageX || e.clientX;
			var currentY = e.pageY || e.clientY;
			var deltaX = currentX - startX;
			var deltaY = currentY - startY;
			var dragDistance = Math.abs(deltaX);

			// Only trigger if horizontal drag is dominant
			if (Math.abs(deltaX) > Math.abs(deltaY) && dragDistance > dragThreshold) {
				// Prevent library's default behavior
				e.preventDefault();
				e.stopPropagation();
				e.stopImmediatePropagation();

				// Navigate based on direction
				if (deltaX > 0) {
					navigatePage('backward');
				} else if (deltaX < 0) {
					navigatePage('forward');
				}
			}
		});

		// Handle mouseup
		$(document).on('mouseup', function(e) {
			if (isDragging) {
				isDragging = false;
				hasFlipped = false;
				overlay.css('cursor', 'grab');
			}
		});

		// Touch events for trackpad gestures
		var touchStartX = 0;
		var touchStartY = 0;
		var touchHasFlipped = false;

		overlay.on('touchstart', function(e) {
			if ($(e.target).closest('a, button, input, .cmdForward, .cmdBackward, .controls, .fnav').length > 0) {
				return;
			}

			if (e.touches && e.touches.length > 0) {
				touchStartX = e.touches[0].pageX;
				touchStartY = e.touches[0].pageY;
				touchHasFlipped = false;
			}
			e.preventDefault();
			e.stopPropagation();
		});

		overlay.on('touchmove', function(e) {
			if (!e.touches || e.touches.length === 0 || touchHasFlipped) return;

			var currentX = e.touches[0].pageX;
			var currentY = e.touches[0].pageY;
			var deltaX = currentX - touchStartX;
			var deltaY = currentY - touchStartY;

			if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > dragThreshold) {
				touchHasFlipped = true;
				if (deltaX > 0) {
					navigatePage('backward');
				} else if (deltaX < 0) {
					navigatePage('forward');
				}
				touchStartX = currentX;
				e.preventDefault();
				e.stopPropagation();
			}
		});

		// Disable pointer events on canvas so library doesn't intercept
		// The overlay will handle all interactions
		canvasElement.css('pointer-events', 'none');
	}
}

// Wait for document ready, then set up button click handler
$(document).ready(function() {
	loadBook();
});

