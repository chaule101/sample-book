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

	// Also intercept for any canvas elements that get created later
	var originalGetContext = HTMLCanvasElement.prototype.getContext;
	HTMLCanvasElement.prototype.getContext = function(contextType, contextAttributes) {
		var context = originalGetContext.apply(this, arguments);

		// If it's a 2D context, intercept fillText and strokeText
		if (contextType === '2d' && context) {
			// Intercept fillText
			var originalContextFillText = context.fillText;
			if (originalContextFillText) {
				context.fillText = function(text, x, y, maxWidth) {
					if (typeof text === 'string' && (text.toLowerCase().includes('loading'))) {
						return; // Skip drawing this text
					}
					return originalContextFillText.apply(this, arguments);
				};
			}

			// Intercept strokeText
			var originalContextStrokeText = context.strokeText;
			if (originalContextStrokeText) {
				context.strokeText = function(text, x, y, maxWidth) {
					if (typeof text === 'string' && (text.toLowerCase().includes('loading'))) {
						return; // Skip drawing this text
					}
					return originalContextStrokeText.apply(this, arguments);
				};
			}
		}

		return context;
	};
})();

