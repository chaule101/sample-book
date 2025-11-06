var template = {
	html: 'templates/default-book-view.html',
	links: [{
		rel: 'stylesheet',
		href: 'css/font-awesome.min.css'
	}],
	styles: [
		'css/short-black-book-view.css'
	],
	script: 'js/default-book-view.js'
};

// Function to initialize and load the book
function loadBook() {
	var PDF_PATH = 'books/pdf/ProfileBook.pdf';
	var container = $('#container2');

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
	var options = {
		pdf: PDF_PATH,
		template: template,
		propertiesCallback: function(props) {
			// Override the page calculation to match actual PDF pages
			// The library might calculate 76, but PDF only has 75 pages
			// We'll let it calculate but catch the error
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
			console.log('Flipbook loaded:', flipbookInstance);

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
					console.log('Total pages in flipbook:', totalPages);
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
		console.error('FlipBook function not available. Make sure 3dflipbook.min.js is loaded.');
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
		console.log('Canvas found, setting up drag overlay');

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

			console.log('Navigating page:', direction);

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

			console.log('Navigation button found:', navButton.length, navButton);

			if (navButton && navButton.length > 0) {
				// Check if button is not disabled
				if (!navButton.hasClass('disabled') && navButton.is(':visible')) {
					console.log('Clicking navigation button');
					navButton[0].click(); // Use native click instead of trigger
				} else {
					console.log('Button is disabled or hidden');
				}
			} else {
				// Fallback: try using flipbook instance API
				console.log('No navigation button found, trying API');
				try {
					if (direction === 'forward' && flipbookInstance && flipbookInstance.book) {
						var currentPage = flipbookInstance.book.getCurrentPage ? flipbookInstance.book.getCurrentPage() : 0;
						var totalPages = flipbookInstance.book.getPages ? flipbookInstance.book.getPages() : 0;
						console.log('Current page:', currentPage, 'Total pages:', totalPages);
						if (currentPage < totalPages - 1 && flipbookInstance.book.gotoPage) {
							flipbookInstance.book.gotoPage(currentPage + 1);
						}
					} else if (direction === 'backward' && flipbookInstance && flipbookInstance.book) {
						var currentPage = flipbookInstance.book.getCurrentPage ? flipbookInstance.book.getCurrentPage() : 0;
						console.log('Current page:', currentPage);
						if (currentPage > 0 && flipbookInstance.book.gotoPage) {
							flipbookInstance.book.gotoPage(currentPage - 1);
						}
					}
				} catch (err) {
					console.log('Could not navigate page:', err);
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
			console.log('Overlay drag started at:', startX, startY, '- anywhere on page!');

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
				console.log('Horizontal drag detected on overlay - deltaX:', deltaX, 'deltaY:', deltaY);

				// Prevent library's default behavior
				e.preventDefault();
				e.stopPropagation();
				e.stopImmediatePropagation();

				// Navigate based on direction
				if (deltaX > 0) {
					console.log('Dragging right - going backward');
					navigatePage('backward');
				} else if (deltaX < 0) {
					console.log('Dragging left - going forward');
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

		console.log('Drag-to-flip overlay setup complete! You can now drag ANYWHERE on the pages.');
	}
}

// Wait for document ready, then set up button click handler
$(document).ready(function() {
	// Button click handler to load the book
	$('#show-book-btn').on('click', function() {
		loadBook();
	});
});

