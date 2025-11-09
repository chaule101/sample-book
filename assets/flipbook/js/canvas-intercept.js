// Override canvas fillText and strokeText to prevent drawing "Loading..." text
(function() {
	// Intercept fillText for all canvas contexts
	var originalFillText = CanvasRenderingContext2D.prototype.fillText;
	CanvasRenderingContext2D.prototype.fillText = function(text, x, y, maxWidth) {
		// Don't draw "Loading..." text - we'll show our own centered indicator
		if (typeof text === 'string' && (text.toLowerCase().includes('loading'))) {
			return; // Skip drawing this text
		}
		// Call original fillText for everything else
		return originalFillText.apply(this, arguments);
	};

	// Also intercept strokeText in case it's used
	var originalStrokeText = CanvasRenderingContext2D.prototype.strokeText;
	CanvasRenderingContext2D.prototype.strokeText = function(text, x, y, maxWidth) {
		if (typeof text === 'string' && (text.toLowerCase().includes('loading'))) {
			return; // Skip drawing this text
		}
		return originalStrokeText.apply(this, arguments);
	};

	// Intercept getContext to handle both text interception and scaling
	var originalGetContext = HTMLCanvasElement.prototype.getContext;
	HTMLCanvasElement.prototype.getContext = function(contextType, contextAttributes) {
		var context = originalGetContext.apply(this, arguments);

		// If it's a 2D context, intercept fillText and strokeText
		if (contextType === '2d' && context) {
			// Intercept fillText
			var originalContextFillText = context.fillText;
			if (originalContextFillText && !context._fillTextIntercepted) {
				context.fillText = function(text, x, y, maxWidth) {
					if (typeof text === 'string' && (text.toLowerCase().includes('loading'))) {
						return; // Skip drawing this text
					}
					return originalContextFillText.apply(this, arguments);
				};
				context._fillTextIntercepted = true;
			}

			// Intercept strokeText
			var originalContextStrokeText = context.strokeText;
			if (originalContextStrokeText && !context._strokeTextIntercepted) {
				context.strokeText = function(text, x, y, maxWidth) {
					if (typeof text === 'string' && (text.toLowerCase().includes('loading'))) {
						return; // Skip drawing this text
					}
					return originalContextStrokeText.apply(this, arguments);
				};
				context._strokeTextIntercepted = true;
			}
		}

		return context;
	};
})();

// Aggressively intercept canvas creation to ensure high resolution BEFORE rendering
// This ensures canvases are created at high resolution from the very start
(function() {
	var devicePixelRatio = window.devicePixelRatio || 1;
	var targetScale = 2.0; // 2x resolution to match 50% zoom clarity
	var cssScale = 0.5; // Scale down to 50% size to match 50% browser zoom
	var canvasInfoMap = new WeakMap();

	// Intercept document.createElement to mark canvas elements immediately
	// This MUST run before the flipbook library creates any canvases
	var originalCreateElement = document.createElement;
	document.createElement = function(tagName, options) {
		var element = originalCreateElement.call(this, tagName, options);

		if (tagName.toLowerCase() === 'canvas') {
			// Mark this canvas for high-resolution treatment immediately
			canvasInfoMap.set(element, {
				scaled: false,
				logicalWidth: null,
				logicalHeight: null,
				contextScaled: false
			});
		}

		return element;
	};

	// Intercept width/height setters at prototype level - MUST run before flipbook library
	var originalWidthDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width');
	var originalHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'height');

	if (originalWidthDescriptor && originalHeightDescriptor) {
		Object.defineProperty(HTMLCanvasElement.prototype, 'width', {
			get: function() {
				return originalWidthDescriptor.get.call(this);
			},
			set: function(value) {
				var canvasInfo = canvasInfoMap.get(this);
				if (canvasInfo && value > 0 && !canvasInfo.scaled) {
					// First time setting width - scale it up immediately
					var scaledWidth = Math.floor(value * targetScale);
					originalWidthDescriptor.set.call(this, scaledWidth);
					canvasInfo.logicalWidth = value;
					// Set CSS width to logical size immediately
					if (this.style) {
						this.style.width = value + 'px';
					}
				} else {
					originalWidthDescriptor.set.call(this, value);
				}
			},
			enumerable: true,
			configurable: true
		});

		Object.defineProperty(HTMLCanvasElement.prototype, 'height', {
			get: function() {
				return originalHeightDescriptor.get.call(this);
			},
			set: function(value) {
				var canvasInfo = canvasInfoMap.get(this);
				if (canvasInfo && value > 0 && !canvasInfo.scaled) {
					// First time setting height - scale it up immediately
					var scaledHeight = Math.floor(value * targetScale);
					originalHeightDescriptor.set.call(this, scaledHeight);
					canvasInfo.logicalHeight = value;
					// Set CSS height to logical size immediately
					if (this.style) {
						this.style.height = value + 'px';
					}
					// Mark as scaled once both width and height are set
					if (canvasInfo.logicalWidth !== null && canvasInfo.logicalHeight !== null) {
						canvasInfo.scaled = true;
					}
				} else {
					originalHeightDescriptor.set.call(this, value);
				}
			},
			enumerable: true,
			configurable: true
		});
	}

	// Intercept getContext to handle canvas scaling
	// Note: This is a second interception, but we need to handle scaling
	// The first interception handles text, this one handles scaling
	var originalGetContext2 = HTMLCanvasElement.prototype.getContext;
	HTMLCanvasElement.prototype.getContext = function(contextType, contextAttributes) {
		// Call the first interception (which handles text)
		var context = originalGetContext2.call(this, contextType, contextAttributes);

		// Handle canvas scaling for 2d contexts
		if (contextType === '2d' && context) {
			var canvasInfo = canvasInfoMap.get(this);
			if (canvasInfo && canvasInfo.scaled && !canvasInfo.contextScaled) {
				// Canvas is at 2x internal resolution (e.g., 2000x2000 pixels)
				// CSS size is at 1x (e.g., 1000x1000 pixels)
				// PDF.js will render at 2x scale, which means it will render 2x pixels
				// We DON'T scale the context, so PDF.js renders directly into the 2x canvas
				// This gives us crisp 2x rendering displayed at 1x size
				canvasInfo.contextScaled = true;

				// Ensure canvas image smoothing is disabled for crisp rendering
				context.imageSmoothingEnabled = false;
				context.webkitImageSmoothingEnabled = false;
				context.mozImageSmoothingEnabled = false;
				context.msImageSmoothingEnabled = false;
			}
		}

		return context;
	};
})();

