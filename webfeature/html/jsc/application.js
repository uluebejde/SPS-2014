// 2014/04/05 18:06:24

// ../../../core/lib/iscroll.js
/*!
 * iScroll v4.1.9 ~ Copyright (c) 2011 Matteo Spinelli, http://cubiq.org
 * Released under MIT license, http://cubiq.org/license
 */

(function(){
var m = Math,
	vendor = (/webkit/i).test(navigator.appVersion) ? 'webkit' :
		(/firefox/i).test(navigator.userAgent) ? 'Moz' :
		'opera' in window ? 'O' : '',

	// Browser capabilities
	has3d = 'WebKitCSSMatrix' in window && 'm11' in new WebKitCSSMatrix(),
	hasTouch = 'ontouchstart' in window,
	hasTransform = vendor + 'Transform' in document.documentElement.style,
	isAndroid = (/android/gi).test(navigator.appVersion),
	isIDevice = (/iphone|ipad/gi).test(navigator.appVersion),
	isPlaybook = (/playbook/gi).test(navigator.appVersion),
	hasTransitionEnd = isIDevice || isPlaybook,
	nextFrame = (function() {
	    return window.requestAnimationFrame
			|| window.webkitRequestAnimationFrame
			|| window.mozRequestAnimationFrame
			|| window.oRequestAnimationFrame
			|| window.msRequestAnimationFrame
			|| function(callback) { return setTimeout(callback, 1); }
	})(),
	cancelFrame = (function () {
	    return window.cancelRequestAnimationFrame
			|| window.webkitCancelRequestAnimationFrame
			|| window.mozCancelRequestAnimationFrame
			|| window.oCancelRequestAnimationFrame
			|| window.msCancelRequestAnimationFrame
			|| clearTimeout
	})(),

	// Events
	RESIZE_EV = 'onorientationchange' in window ? 'orientationchange' : 'resize',
	START_EV = hasTouch ? 'touchstart' : 'mousedown',
	MOVE_EV = hasTouch ? 'touchmove' : 'mousemove',
	END_EV = hasTouch ? 'touchend' : 'mouseup',
	CANCEL_EV = hasTouch ? 'touchcancel' : 'mouseup',
	WHEEL_EV = vendor == 'Moz' ? 'DOMMouseScroll' : 'mousewheel',

	// Helpers
	trnOpen = 'translate' + (has3d ? '3d(' : '('),
	trnClose = has3d ? ',0)' : ')',

	// Constructor
	iScroll = function (el, options) {
		var that = this,
			doc = document,
			i;

		that.wrapper = typeof el == 'object' ? el : doc.getElementById(el);
		that.wrapper.style.overflow = 'hidden';
		that.scroller = that.wrapper.children[0];

		// Default options
		that.options = {
			hScroll: true,
			vScroll: true,
			x: 0,
			y: 0,
			bounce: true,
			bounceLock: false,
			momentum: true,
			lockDirection: true,
			useTransform: true,
			useTransition: false,
			topOffset: 0,
			checkDOMChanges: false,		// Experimental

			// Scrollbar
			hScrollbar: true,
			vScrollbar: true,
			fixedScrollbar: isAndroid,
			hideScrollbar: isIDevice,
			fadeScrollbar: isIDevice && has3d,
			scrollbarClass: '',

			// Zoom
			zoom: false,
			zoomMin: 1,
			zoomMax: 4,
			doubleTapZoom: 2,
			wheelAction: 'scroll',

			// Snap
			snap: false,
			snapThreshold: 1,

			// Events
			onRefresh: null,
			onBeforeScrollStart: function (e) { e.preventDefault(); },
			onScrollStart: null,
			onBeforeScrollMove: null,
			onScrollMove: null,
			onBeforeScrollEnd: null,
			onScrollEnd: null,
			onTouchEnd: null,
			onDestroy: null,
			onZoomStart: null,
			onZoom: null,
			onZoomEnd: null,
			
			// Custom
			id: null
		};

		// User defined options
		for (i in options) that.options[i] = options[i];
		
		// Set starting position
		that.x = that.options.x;
		that.y = that.options.y;

		// Normalize options
		that.options.useTransform = hasTransform ? that.options.useTransform : false;
		that.options.hScrollbar = that.options.hScroll && that.options.hScrollbar;
		that.options.vScrollbar = that.options.vScroll && that.options.vScrollbar;
		that.options.zoom = that.options.useTransform && that.options.zoom;
		that.options.useTransition = hasTransitionEnd && that.options.useTransition;
		
		// Set some default styles
		that.scroller.style[vendor + 'TransitionProperty'] = that.options.useTransform ? '-' + vendor.toLowerCase() + '-transform' : 'top left';
		that.scroller.style[vendor + 'TransitionDuration'] = '0';
		that.scroller.style[vendor + 'TransformOrigin'] = '0 0';
		if (that.options.useTransition) that.scroller.style[vendor + 'TransitionTimingFunction'] = 'cubic-bezier(0.33,0.66,0.66,1)';
		
		if (that.options.useTransform) that.scroller.style[vendor + 'Transform'] = trnOpen + that.x + 'px,' + that.y + 'px' + trnClose;
		else that.scroller.style.cssText += ';position:absolute;top:' + that.y + 'px;left:' + that.x + 'px';

		if (that.options.useTransition) that.options.fixedScrollbar = true;

		that.refresh();

		that._bind(RESIZE_EV, window);
		that._bind(START_EV);
		if (!hasTouch) {
			that._bind('mouseout', that.wrapper);
			that._bind(WHEEL_EV);
		}

		if (that.options.checkDOMChanges) that.checkDOMTime = setInterval(function () {
			that._checkDOMChanges();
		}, 500);
	};

// Prototype
iScroll.prototype = {
	enabled: true,
	x: 0,
	y: 0,
	steps: [],
	scale: 1,
	currPageX: 0, currPageY: 0,
	pagesX: [], pagesY: [],
	aniTime: null,
	wheelZoomCount: 0,
	
	handleEvent: function (e) {
		var that = this;
		switch(e.type) {
			case START_EV:
				if (!hasTouch && e.button !== 0) return;
				that._start(e);
				break;
			case MOVE_EV: that._move(e); break;
			case END_EV:
			case CANCEL_EV: that._end(e); break;
			case RESIZE_EV: that._resize(); break;
			case WHEEL_EV: that._wheel(e); break;
			case 'mouseout': that._mouseout(e); break;
			case 'webkitTransitionEnd': that._transitionEnd(e); break;
		}
	},
	
	_checkDOMChanges: function () {
		if (this.moved || this.zoomed || this.animating ||
			(this.scrollerW == this.scroller.offsetWidth * this.scale && this.scrollerH == this.scroller.offsetHeight * this.scale)) return;

		this.refresh();
	},
	
	_scrollbar: function (dir) {
		var that = this,
			doc = document,
			bar;

		if (!that[dir + 'Scrollbar']) {
			if (that[dir + 'ScrollbarWrapper']) {
				if (hasTransform) that[dir + 'ScrollbarIndicator'].style[vendor + 'Transform'] = '';
				that[dir + 'ScrollbarWrapper'].parentNode.removeChild(that[dir + 'ScrollbarWrapper']);
				that[dir + 'ScrollbarWrapper'] = null;
				that[dir + 'ScrollbarIndicator'] = null;
			}

			return;
		}

		if (!that[dir + 'ScrollbarWrapper']) {
			// Create the scrollbar wrapper
			if (that.options.id && !doc.getElementById(that.options.id)) {
				bar = doc.createElement('div');
				bar.id = that.options.id;
			}
			else if (that.options.id && doc.getElementById(that.options.id)) {
				bar = doc.getElementById(that.options.id);
			}
			else {
				bar = doc.createElement('div');
			}

			if (that.options.scrollbarClass) bar.className = that.options.scrollbarClass + dir.toUpperCase();
			else bar.style.cssText = 'position:absolute;z-index:100;' + (dir == 'h' ? 'height:7px;bottom:1px;left:2px;right:' + (that.vScrollbar ? '7' : '2') + 'px' : 'width:7px;bottom:' + (that.hScrollbar ? '7' : '2') + 'px;top:2px;right:1px');

			bar.style.cssText += ';pointer-events:none;-' + vendor + '-transition-property:opacity;-' + vendor + '-transition-duration:' + (that.options.fadeScrollbar ? '350ms' : '0') + ';overflow:hidden;opacity:' + (that.options.hideScrollbar ? '0' : '1');

			that.wrapper.appendChild(bar);
			that[dir + 'ScrollbarWrapper'] = bar;

			// Create the scrollbar indicator
			bar = doc.createElement('div');
			if (!that.options.scrollbarClass) {
				bar.style.cssText = 'position:absolute;z-index:100;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.9);-' + vendor + '-background-clip:padding-box;-' + vendor + '-box-sizing:border-box;' + (dir == 'h' ? 'height:100%' : 'width:100%') + ';-' + vendor + '-border-radius:3px;border-radius:3px';
			}
			bar.style.cssText += ';pointer-events:none;-' + vendor + '-transition-property:-' + vendor + '-transform;-' + vendor + '-transition-timing-function:cubic-bezier(0.33,0.66,0.66,1);-' + vendor + '-transition-duration:0;-' + vendor + '-transform:' + trnOpen + '0,0' + trnClose;
			if (that.options.useTransition) bar.style.cssText += ';-' + vendor + '-transition-timing-function:cubic-bezier(0.33,0.66,0.66,1)';

			that[dir + 'ScrollbarWrapper'].appendChild(bar);
			that[dir + 'ScrollbarIndicator'] = bar;
		}

		if (dir == 'h') {
			that.hScrollbarSize = that.hScrollbarWrapper.clientWidth;
			that.hScrollbarIndicatorSize = m.max(m.round(that.hScrollbarSize * that.hScrollbarSize / that.scrollerW), 8);
			that.hScrollbarIndicator.style.width = that.hScrollbarIndicatorSize + 'px';
			that.hScrollbarMaxScroll = that.hScrollbarSize - that.hScrollbarIndicatorSize;
			that.hScrollbarProp = that.hScrollbarMaxScroll / that.maxScrollX;
		} else {
			that.vScrollbarSize = that.vScrollbarWrapper.clientHeight;
			that.vScrollbarIndicatorSize = m.max(m.round(that.vScrollbarSize * that.vScrollbarSize / that.scrollerH), 8);
			that.vScrollbarIndicator.style.height = that.vScrollbarIndicatorSize + 'px';
			that.vScrollbarMaxScroll = that.vScrollbarSize - that.vScrollbarIndicatorSize;
			that.vScrollbarProp = that.vScrollbarMaxScroll / that.maxScrollY;
		}

		// Reset position
		that._scrollbarPos(dir, true);
	},
	
	_resize: function () {
		var that = this;
		setTimeout(function () { that.refresh(); }, isAndroid ? 200 : 0);
	},
	
	_pos: function (x, y) {
		x = this.hScroll ? x : 0;
		y = this.vScroll ? y : 0;

		if (this.options.useTransform) {
			this.scroller.style[vendor + 'Transform'] = trnOpen + x + 'px,' + y + 'px' + trnClose + ' scale(' + this.scale + ')';
		} else {
			x = m.round(x);
			y = m.round(y);
			this.scroller.style.left = x + 'px';
			this.scroller.style.top = y + 'px';
		}

		this.x = x;
		this.y = y;

		this._scrollbarPos('h');
		this._scrollbarPos('v');
	},

	_scrollbarPos: function (dir, hidden) {
		var that = this,
			pos = dir == 'h' ? that.x : that.y,
			size;

		if (!that[dir + 'Scrollbar']) return;

		pos = that[dir + 'ScrollbarProp'] * pos;

		if (pos < 0) {
			if (!that.options.fixedScrollbar) {
				size = that[dir + 'ScrollbarIndicatorSize'] + m.round(pos * 3);
				if (size < 8) size = 8;
				that[dir + 'ScrollbarIndicator'].style[dir == 'h' ? 'width' : 'height'] = size + 'px';
			}
			pos = 0;
		} else if (pos > that[dir + 'ScrollbarMaxScroll']) {
			if (!that.options.fixedScrollbar) {
				size = that[dir + 'ScrollbarIndicatorSize'] - m.round((pos - that[dir + 'ScrollbarMaxScroll']) * 3);
				if (size < 8) size = 8;
				that[dir + 'ScrollbarIndicator'].style[dir == 'h' ? 'width' : 'height'] = size + 'px';
				pos = that[dir + 'ScrollbarMaxScroll'] + (that[dir + 'ScrollbarIndicatorSize'] - size);
			} else {
				pos = that[dir + 'ScrollbarMaxScroll'];
			}
		}

		that[dir + 'ScrollbarWrapper'].style[vendor + 'TransitionDelay'] = '0';
		that[dir + 'ScrollbarWrapper'].style.opacity = hidden && that.options.hideScrollbar ? '0' : '1';
		that[dir + 'ScrollbarIndicator'].style[vendor + 'Transform'] = trnOpen + (dir == 'h' ? pos + 'px,0' : '0,' + pos + 'px') + trnClose;
	},
	
	_start: function (e) {
		var that = this,
			point = hasTouch ? e.touches[0] : e,
			matrix, x, y,
			c1, c2;

		if (!that.enabled) return;

		if (that.options.onBeforeScrollStart) that.options.onBeforeScrollStart.call(that, e);

		if (that.options.useTransition || that.options.zoom) that._transitionTime(0);

		that.moved = false;
		that.animating = false;
		that.zoomed = false;
		that.distX = 0;
		that.distY = 0;
		that.absDistX = 0;
		that.absDistY = 0;
		that.dirX = 0;
		that.dirY = 0;

		// Gesture start
		if (that.options.zoom && hasTouch && e.touches.length > 1) {
			c1 = m.abs(e.touches[0].pageX-e.touches[1].pageX);
			c2 = m.abs(e.touches[0].pageY-e.touches[1].pageY);
			that.touchesDistStart = m.sqrt(c1 * c1 + c2 * c2);

			that.originX = m.abs(e.touches[0].pageX + e.touches[1].pageX - that.wrapperOffsetLeft * 2) / 2 - that.x;
			that.originY = m.abs(e.touches[0].pageY + e.touches[1].pageY - that.wrapperOffsetTop * 2) / 2 - that.y;

			if (that.options.onZoomStart) that.options.onZoomStart.call(that, e);
		}

		if (that.options.momentum) {
			if (that.options.useTransform) {
				// Very lame general purpose alternative to CSSMatrix
				matrix = getComputedStyle(that.scroller, null)[vendor + 'Transform'].replace(/[^0-9-.,]/g, '').split(',');
				x = matrix[4] * 1;
				y = matrix[5] * 1;
			} else {
				x = getComputedStyle(that.scroller, null).left.replace(/[^0-9-]/g, '') * 1;
				y = getComputedStyle(that.scroller, null).top.replace(/[^0-9-]/g, '') * 1;
			}
			
			if (x != that.x || y != that.y) {
				if (that.options.useTransition) that._unbind('webkitTransitionEnd');
				else cancelFrame(that.aniTime);
				that.steps = [];
				that._pos(x, y);
			}
		}

		that.absStartX = that.x;	// Needed by snap threshold
		that.absStartY = that.y;

		that.startX = that.x;
		that.startY = that.y;
		that.pointX = point.pageX;
		that.pointY = point.pageY;

		that.startTime = e.timeStamp || Date.now();

		if (that.options.onScrollStart) that.options.onScrollStart.call(that, e);

		that._bind(MOVE_EV);
		that._bind(END_EV);
		that._bind(CANCEL_EV);
	},
	
	_move: function (e) {
		var that = this,
			point = hasTouch ? e.touches[0] : e,
			deltaX = point.pageX - that.pointX,
			deltaY = point.pageY - that.pointY,
			newX = that.x + deltaX,
			newY = that.y + deltaY,
			c1, c2, scale,
			timestamp = e.timeStamp || Date.now();

		if (that.options.onBeforeScrollMove) that.options.onBeforeScrollMove.call(that, e);

		// Zoom
		if (that.options.zoom && hasTouch && e.touches.length > 1) {
			c1 = m.abs(e.touches[0].pageX - e.touches[1].pageX);
			c2 = m.abs(e.touches[0].pageY - e.touches[1].pageY);
			that.touchesDist = m.sqrt(c1*c1+c2*c2);

			that.zoomed = true;

			scale = 1 / that.touchesDistStart * that.touchesDist * this.scale;

			if (scale < that.options.zoomMin) scale = 0.5 * that.options.zoomMin * Math.pow(2.0, scale / that.options.zoomMin);
			else if (scale > that.options.zoomMax) scale = 2.0 * that.options.zoomMax * Math.pow(0.5, that.options.zoomMax / scale);

			that.lastScale = scale / this.scale;

			newX = this.originX - this.originX * that.lastScale + this.x,
			newY = this.originY - this.originY * that.lastScale + this.y;

			this.scroller.style[vendor + 'Transform'] = trnOpen + newX + 'px,' + newY + 'px' + trnClose + ' scale(' + scale + ')';

			if (that.options.onZoom) that.options.onZoom.call(that, e);
			return;
		}

		that.pointX = point.pageX;
		that.pointY = point.pageY;

		// Slow down if outside of the boundaries
		if (newX > 0 || newX < that.maxScrollX) {
			newX = that.options.bounce ? that.x + (deltaX / 2) : newX >= 0 || that.maxScrollX >= 0 ? 0 : that.maxScrollX;
		}
		if (newY > that.minScrollY || newY < that.maxScrollY) { 
			newY = that.options.bounce ? that.y + (deltaY / 2) : newY >= that.minScrollY || that.maxScrollY >= 0 ? that.minScrollY : that.maxScrollY;
		}

		if (that.absDistX < 6 && that.absDistY < 6) {
			that.distX += deltaX;
			that.distY += deltaY;
			that.absDistX = m.abs(that.distX);
			that.absDistY = m.abs(that.distY);

			return;
		}

		// Lock direction
		if (that.options.lockDirection) {
			if (that.absDistX > that.absDistY + 5) {
				newY = that.y;
				deltaY = 0;
			} else if (that.absDistY > that.absDistX + 5) {
				newX = that.x;
				deltaX = 0;
			}
		}

		that.moved = true;
		that._pos(newX, newY);
		that.dirX = deltaX > 0 ? -1 : deltaX < 0 ? 1 : 0;
		that.dirY = deltaY > 0 ? -1 : deltaY < 0 ? 1 : 0;

		if (timestamp - that.startTime > 300) {
			that.startTime = timestamp;
			that.startX = that.x;
			that.startY = that.y;
		}
		
		if (that.options.onScrollMove) that.options.onScrollMove.call(that, e);
	},
	
	_end: function (e) {
		if (hasTouch && e.touches.length != 0) return;

		var that = this,
			point = hasTouch ? e.changedTouches[0] : e,
			target, ev,
			momentumX = { dist:0, time:0 },
			momentumY = { dist:0, time:0 },
			duration = (e.timeStamp || Date.now()) - that.startTime,
			newPosX = that.x,
			newPosY = that.y,
			distX, distY,
			newDuration,
			snap,
			scale;

		that._unbind(MOVE_EV);
		that._unbind(END_EV);
		that._unbind(CANCEL_EV);

		if (that.options.onBeforeScrollEnd) that.options.onBeforeScrollEnd.call(that, e);

		if (that.zoomed) {
			scale = that.scale * that.lastScale;
			scale = Math.max(that.options.zoomMin, scale);
			scale = Math.min(that.options.zoomMax, scale);
			that.lastScale = scale / that.scale;
			that.scale = scale;

			that.x = that.originX - that.originX * that.lastScale + that.x;
			that.y = that.originY - that.originY * that.lastScale + that.y;
			
			that.scroller.style[vendor + 'TransitionDuration'] = '200ms';
			that.scroller.style[vendor + 'Transform'] = trnOpen + that.x + 'px,' + that.y + 'px' + trnClose + ' scale(' + that.scale + ')';
			
			that.zoomed = false;
			that.refresh();

			if (that.options.onZoomEnd) that.options.onZoomEnd.call(that, e);
			return;
		}

		if (!that.moved) {
			if (hasTouch) {
				if (that.doubleTapTimer && that.options.zoom) {
					// Double tapped
					clearTimeout(that.doubleTapTimer);
					that.doubleTapTimer = null;
					if (that.options.onZoomStart) that.options.onZoomStart.call(that, e);
					that.zoom(that.pointX, that.pointY, that.scale == 1 ? that.options.doubleTapZoom : 1);
					if (that.options.onZoomEnd) {
						setTimeout(function() {
							that.options.onZoomEnd.call(that, e);
						}, 200); // 200 is default zoom duration
					}
				} else {
					that.doubleTapTimer = setTimeout(function () {
						that.doubleTapTimer = null;

						// Find the last touched element
						target = point.target;
						while (target.nodeType != 1) target = target.parentNode;

						if (target.tagName != 'SELECT' && target.tagName != 'INPUT' && target.tagName != 'TEXTAREA') {
							ev = document.createEvent('MouseEvents');
							ev.initMouseEvent('click', true, true, e.view, 1,
								point.screenX, point.screenY, point.clientX, point.clientY,
								e.ctrlKey, e.altKey, e.shiftKey, e.metaKey,
								0, null);
							ev._fake = true;
							target.dispatchEvent(ev);
						}
					}, that.options.zoom ? 250 : 0);
				}
			}

			that._resetPos(200);

			if (that.options.onTouchEnd) that.options.onTouchEnd.call(that, e);
			return;
		}

		if (duration < 300 && that.options.momentum) {
			momentumX = newPosX ? that._momentum(newPosX - that.startX, duration, -that.x, that.scrollerW - that.wrapperW + that.x, that.options.bounce ? that.wrapperW : 0) : momentumX;
			momentumY = newPosY ? that._momentum(newPosY - that.startY, duration, -that.y, (that.maxScrollY < 0 ? that.scrollerH - that.wrapperH + that.y - that.minScrollY : 0), that.options.bounce ? that.wrapperH : 0) : momentumY;

			newPosX = that.x + momentumX.dist;
			newPosY = that.y + momentumY.dist;

 			if ((that.x > 0 && newPosX > 0) || (that.x < that.maxScrollX && newPosX < that.maxScrollX)) momentumX = { dist:0, time:0 };
 			if ((that.y > that.minScrollY && newPosY > that.minScrollY) || (that.y < that.maxScrollY && newPosY < that.maxScrollY)) momentumY = { dist:0, time:0 };
		}

		if (momentumX.dist || momentumY.dist) {
			newDuration = m.max(m.max(momentumX.time, momentumY.time), 10);

			// Do we need to snap?
			if (that.options.snap) {
				distX = newPosX - that.absStartX;
				distY = newPosY - that.absStartY;
				if (m.abs(distX) < that.options.snapThreshold && m.abs(distY) < that.options.snapThreshold) { that.scrollTo(that.absStartX, that.absStartY, 200); }
				else {
					snap = that._snap(newPosX, newPosY);
					newPosX = snap.x;
					newPosY = snap.y;
					newDuration = m.max(snap.time, newDuration);
				}
			}

			that.scrollTo(m.round(newPosX), m.round(newPosY), newDuration);

			if (that.options.onTouchEnd) that.options.onTouchEnd.call(that, e);
			return;
		}

		// Do we need to snap?
		if (that.options.snap) {
			distX = newPosX - that.absStartX;
			distY = newPosY - that.absStartY;
			if (m.abs(distX) < that.options.snapThreshold && m.abs(distY) < that.options.snapThreshold) that.scrollTo(that.absStartX, that.absStartY, 200);
			else {
				snap = that._snap(that.x, that.y);
				if (snap.x != that.x || snap.y != that.y) that.scrollTo(snap.x, snap.y, snap.time);
			}

			if (that.options.onTouchEnd) that.options.onTouchEnd.call(that, e);
			return;
		}

		that._resetPos(200);
		if (that.options.onTouchEnd) that.options.onTouchEnd.call(that, e);
	},
	
	_resetPos: function (time) {
		var that = this,
			resetX = that.x >= 0 ? 0 : that.x < that.maxScrollX ? that.maxScrollX : that.x,
			resetY = that.y >= that.minScrollY || that.maxScrollY > 0 ? that.minScrollY : that.y < that.maxScrollY ? that.maxScrollY : that.y;

		if (resetX == that.x && resetY == that.y) {
			if (that.moved) {
				that.moved = false;
				if (that.options.onScrollEnd) that.options.onScrollEnd.call(that);		// Execute custom code on scroll end
			}

			if (that.hScrollbar && that.options.hideScrollbar) {
				if (vendor == 'webkit') that.hScrollbarWrapper.style[vendor + 'TransitionDelay'] = '300ms';
				that.hScrollbarWrapper.style.opacity = '0';
			}
			if (that.vScrollbar && that.options.hideScrollbar) {
				if (vendor == 'webkit') that.vScrollbarWrapper.style[vendor + 'TransitionDelay'] = '300ms';
				that.vScrollbarWrapper.style.opacity = '0';
			}

			return;
		}

		that.scrollTo(resetX, resetY, time || 0);
	},

	_wheel: function (e) {
		var that = this,
			wheelDeltaX, wheelDeltaY,
			deltaX, deltaY,
			deltaScale;

		if ('wheelDeltaX' in e) {
			wheelDeltaX = e.wheelDeltaX / 12;
			wheelDeltaY = e.wheelDeltaY / 12;
		} else if ('detail' in e) {
			wheelDeltaX = wheelDeltaY = -e.detail * 3;
		} else {
			wheelDeltaX = wheelDeltaY = -e.wheelDelta;
		}
		
		if (that.options.wheelAction == 'zoom') {
			deltaScale = that.scale * Math.pow(2, 1/3 * (wheelDeltaY ? wheelDeltaY / Math.abs(wheelDeltaY) : 0));
			if (deltaScale < that.options.zoomMin) deltaScale = that.options.zoomMin;
			if (deltaScale > that.options.zoomMax) deltaScale = that.options.zoomMax;
			
			if (deltaScale != that.scale) {
				if (!that.wheelZoomCount && that.options.onZoomStart) that.options.onZoomStart.call(that, e);
				that.wheelZoomCount++;
				
				that.zoom(e.pageX, e.pageY, deltaScale, 400);
				
				setTimeout(function() {
					that.wheelZoomCount--;
					if (!that.wheelZoomCount && that.options.onZoomEnd) that.options.onZoomEnd.call(that, e);
				}, 400);
			}
			
			return;
		}
		
		deltaX = that.x + wheelDeltaX;
		deltaY = that.y + wheelDeltaY;

		if (deltaX > 0) deltaX = 0;
		else if (deltaX < that.maxScrollX) deltaX = that.maxScrollX;

		if (deltaY > that.minScrollY) deltaY = that.minScrollY;
		else if (deltaY < that.maxScrollY) deltaY = that.maxScrollY;

		that.scrollTo(deltaX, deltaY, 0);
	},
	
	_mouseout: function (e) {
		var t = e.relatedTarget;

		if (!t) {
			this._end(e);
			return;
		}

		while (t = t.parentNode) if (t == this.wrapper) return;
		
		this._end(e);
	},

	_transitionEnd: function (e) {
		var that = this;

		if (e.target != that.scroller) return;

		that._unbind('webkitTransitionEnd');
		
		that._startAni();
	},


	/**
	 *
	 * Utilities
	 *
	 */
	_startAni: function () {
		var that = this,
			startX = that.x, startY = that.y,
			startTime = Date.now(),
			step, easeOut,
			animate;

		if (that.animating) return;
		
		if (!that.steps.length) {
			that._resetPos(400);
			return;
		}
		
		step = that.steps.shift();
		
		if (step.x == startX && step.y == startY) step.time = 0;

		that.animating = true;
		that.moved = true;
		
		if (that.options.useTransition) {
			that._transitionTime(step.time);
			that._pos(step.x, step.y);
			that.animating = false;
			if (step.time) that._bind('webkitTransitionEnd');
			else that._resetPos(0);
			return;
		}

		animate = function () {
			var now = Date.now(),
				newX, newY;

			if (now >= startTime + step.time) {
				that._pos(step.x, step.y);
				that.animating = false;
				if (that.options.onAnimationEnd) that.options.onAnimationEnd.call(that);			// Execute custom code on animation end
				that._startAni();
				return;
			}

			now = (now - startTime) / step.time - 1;
			easeOut = m.sqrt(1 - now * now);
			newX = (step.x - startX) * easeOut + startX;
			newY = (step.y - startY) * easeOut + startY;
			that._pos(newX, newY);
			if (that.animating) that.aniTime = nextFrame(animate);
		};

		animate();
	},

	_transitionTime: function (time) {
		time += 'ms';
		this.scroller.style[vendor + 'TransitionDuration'] = time;
		if (this.hScrollbar) this.hScrollbarIndicator.style[vendor + 'TransitionDuration'] = time;
		if (this.vScrollbar) this.vScrollbarIndicator.style[vendor + 'TransitionDuration'] = time;
	},

	_momentum: function (dist, time, maxDistUpper, maxDistLower, size) {
		var deceleration = 0.0006,
			speed = m.abs(dist) / time,
			newDist = (speed * speed) / (2 * deceleration),
			newTime = 0, outsideDist = 0;

		// Proportinally reduce speed if we are outside of the boundaries 
		if (dist > 0 && newDist > maxDistUpper) {
			outsideDist = size / (6 / (newDist / speed * deceleration));
			maxDistUpper = maxDistUpper + outsideDist;
			speed = speed * maxDistUpper / newDist;
			newDist = maxDistUpper;
		} else if (dist < 0 && newDist > maxDistLower) {
			outsideDist = size / (6 / (newDist / speed * deceleration));
			maxDistLower = maxDistLower + outsideDist;
			speed = speed * maxDistLower / newDist;
			newDist = maxDistLower;
		}

		newDist = newDist * (dist < 0 ? -1 : 1);
		newTime = speed / deceleration;

		return { dist: newDist, time: m.round(newTime) };
	},

	_offset: function (el) {
		var left = -el.offsetLeft,
			top = -el.offsetTop;
			
		while (el = el.offsetParent) {
			left -= el.offsetLeft;
			top -= el.offsetTop;
		}
		
		if (el != this.wrapper) {
			left *= this.scale;
			top *= this.scale;
		}

		return { left: left, top: top };
	},

	_snap: function (x, y) {
		var that = this,
			i, l,
			page, time,
			sizeX, sizeY;

		// Check page X
		page = that.pagesX.length - 1;
		for (i=0, l=that.pagesX.length; i<l; i++) {
			if (x >= that.pagesX[i]) {
				page = i;
				break;
			}
		}
		if (page == that.currPageX && page > 0 && that.dirX < 0) page--;
		x = that.pagesX[page];
		sizeX = m.abs(x - that.pagesX[that.currPageX]);
		sizeX = sizeX ? m.abs(that.x - x) / sizeX * 500 : 0;
		that.currPageX = page;

		// Check page Y
		page = that.pagesY.length-1;
		for (i=0; i<page; i++) {
			if (y >= that.pagesY[i]) {
				page = i;
				break;
			}
		}
		if (page == that.currPageY && page > 0 && that.dirY < 0) page--;
		y = that.pagesY[page];
		sizeY = m.abs(y - that.pagesY[that.currPageY]);
		sizeY = sizeY ? m.abs(that.y - y) / sizeY * 500 : 0;
		that.currPageY = page;

		// Snap with constant speed (proportional duration)
		time = m.round(m.max(sizeX, sizeY)) || 200;

		return { x: x, y: y, time: time };
	},

	_bind: function (type, el, bubble) {
		(el || this.scroller).addEventListener(type, this, !!bubble);
	},

	_unbind: function (type, el, bubble) {
		(el || this.scroller).removeEventListener(type, this, !!bubble);
	},


	/**
	 *
	 * Public methods
	 *
	 */
	destroy: function () {
		var that = this;

		that.scroller.style[vendor + 'Transform'] = '';

		// Remove the scrollbars
		that.hScrollbar = false;
		that.vScrollbar = false;
		that._scrollbar('h');
		that._scrollbar('v');

		// Remove the event listeners
		that._unbind(RESIZE_EV, window);
		that._unbind(START_EV);
		that._unbind(MOVE_EV);
		that._unbind(END_EV);
		that._unbind(CANCEL_EV);
		
		if (that.options.hasTouch) {
			that._unbind('mouseout', that.wrapper);
			that._unbind(WHEEL_EV);
		}
		
		if (that.options.useTransition) that._unbind('webkitTransitionEnd');
		
		if (that.options.checkDOMChanges) clearInterval(that.checkDOMTime);
		
		if (that.options.onDestroy) that.options.onDestroy.call(that);
	},

	refresh: function () {
		var that = this,
			offset,
			i, l,
			els,
			pos = 0,
			page = 0;

		if (that.scale < that.options.zoomMin) that.scale = that.options.zoomMin;
		that.wrapperW = that.wrapper.clientWidth || 1;
		that.wrapperH = that.wrapper.clientHeight || 1;

		that.minScrollY = -that.options.topOffset || 0;
		that.scrollerW = m.round(that.scroller.offsetWidth * that.scale);
		that.scrollerH = m.round((that.scroller.offsetHeight + that.minScrollY) * that.scale);
		that.maxScrollX = that.wrapperW - that.scrollerW;
		that.maxScrollY = that.wrapperH - that.scrollerH + that.minScrollY;
		that.dirX = 0;
		that.dirY = 0;

		if (that.options.onRefresh) that.options.onRefresh.call(that);

		that.hScroll = that.options.hScroll && that.maxScrollX < 0;
		that.vScroll = that.options.vScroll && (!that.options.bounceLock && !that.hScroll || that.scrollerH > that.wrapperH);

		that.hScrollbar = that.hScroll && that.options.hScrollbar;
		that.vScrollbar = that.vScroll && that.options.vScrollbar && that.scrollerH > that.wrapperH;

		offset = that._offset(that.wrapper);
		that.wrapperOffsetLeft = -offset.left;
		that.wrapperOffsetTop = -offset.top;

		// Prepare snap
		if (typeof that.options.snap == 'string') {
			that.pagesX = [];
			that.pagesY = [];
			els = that.scroller.querySelectorAll(that.options.snap);
			for (i=0, l=els.length; i<l; i++) {
				pos = that._offset(els[i]);
				pos.left += that.wrapperOffsetLeft;
				pos.top += that.wrapperOffsetTop;
				that.pagesX[i] = pos.left < that.maxScrollX ? that.maxScrollX : pos.left * that.scale;
				that.pagesY[i] = pos.top < that.maxScrollY ? that.maxScrollY : pos.top * that.scale;
			}
		} else if (that.options.snap) {
			that.pagesX = [];
			while (pos >= that.maxScrollX) {
				that.pagesX[page] = pos;
				pos = pos - that.wrapperW;
				page++;
			}
			if (that.maxScrollX%that.wrapperW) that.pagesX[that.pagesX.length] = that.maxScrollX - that.pagesX[that.pagesX.length-1] + that.pagesX[that.pagesX.length-1];

			pos = 0;
			page = 0;
			that.pagesY = [];
			while (pos >= that.maxScrollY) {
				that.pagesY[page] = pos;
				pos = pos - that.wrapperH;
				page++;
			}
			if (that.maxScrollY%that.wrapperH) that.pagesY[that.pagesY.length] = that.maxScrollY - that.pagesY[that.pagesY.length-1] + that.pagesY[that.pagesY.length-1];
		}

		// Prepare the scrollbars
		that._scrollbar('h');
		that._scrollbar('v');

		if (!that.zoomed) {
			that.scroller.style[vendor + 'TransitionDuration'] = '0';
			that._resetPos(200);
		}
	},

	scrollTo: function (x, y, time, relative) {
		var that = this,
			step = x,
			i, l;

		that.stop();

		if (!step.length) step = [{ x: x, y: y, time: time, relative: relative }];
		
		for (i=0, l=step.length; i<l; i++) {
			if (step[i].relative) { step[i].x = that.x - step[i].x; step[i].y = that.y - step[i].y; }
			that.steps.push({ x: step[i].x, y: step[i].y, time: step[i].time || 0 });
		}

		that._startAni();
	},

	scrollToElement: function (el, time) {
		var that = this, pos;
		el = el.nodeType ? el : that.scroller.querySelector(el);
		if (!el) return;

		pos = that._offset(el);
		pos.left += that.wrapperOffsetLeft;
		pos.top += that.wrapperOffsetTop;

		pos.left = pos.left > 0 ? 0 : pos.left < that.maxScrollX ? that.maxScrollX : pos.left;
		pos.top = pos.top > that.minScrollY ? that.minScrollY : pos.top < that.maxScrollY ? that.maxScrollY : pos.top;
		time = time === undefined ? m.max(m.abs(pos.left)*2, m.abs(pos.top)*2) : time;

		that.scrollTo(pos.left, pos.top, time);
	},

	scrollToPage: function (pageX, pageY, time) {
		var that = this, x, y;

		if (that.options.onScrollStart) that.options.onScrollStart.call(that);

		if (that.options.snap) {
			pageX = pageX == 'next' ? that.currPageX+1 : pageX == 'prev' ? that.currPageX-1 : pageX;
			pageY = pageY == 'next' ? that.currPageY+1 : pageY == 'prev' ? that.currPageY-1 : pageY;

			pageX = pageX < 0 ? 0 : pageX > that.pagesX.length-1 ? that.pagesX.length-1 : pageX;
			pageY = pageY < 0 ? 0 : pageY > that.pagesY.length-1 ? that.pagesY.length-1 : pageY;

			that.currPageX = pageX;
			that.currPageY = pageY;
			x = that.pagesX[pageX];
			y = that.pagesY[pageY];
		} else {
			x = -that.wrapperW * pageX;
			y = -that.wrapperH * pageY;
			if (x < that.maxScrollX) x = that.maxScrollX;
			if (y < that.maxScrollY) y = that.maxScrollY;
		}

		that.scrollTo(x, y, time || 400);
	},

	disable: function () {
		this.stop();
		this._resetPos(0);
		this.enabled = false;

		// If disabled after touchstart we make sure that there are no left over events
		this._unbind(MOVE_EV);
		this._unbind(END_EV);
		this._unbind(CANCEL_EV);
	},
	
	enable: function () {
		this.enabled = true;
	},
	
	stop: function () {
		if (this.options.useTransition) this._unbind('webkitTransitionEnd');
		else cancelFrame(this.aniTime);
		this.steps = [];
		this.moved = false;
		this.animating = false;
	},
	
	zoom: function (x, y, scale, time) {
		var that = this,
			relScale = scale / that.scale;

		if (!that.options.useTransform) return;

		that.zoomed = true;
		time = time === undefined ? 200 : time;
		x = x - that.wrapperOffsetLeft - that.x;
		y = y - that.wrapperOffsetTop - that.y;
		that.x = x - x * relScale + that.x;
		that.y = y - y * relScale + that.y;

		that.scale = scale;
		that.refresh();

		that.x = that.x > 0 ? 0 : that.x < that.maxScrollX ? that.maxScrollX : that.x;
		that.y = that.y > that.minScrollY ? that.minScrollY : that.y < that.maxScrollY ? that.maxScrollY : that.y;

		that.scroller.style[vendor + 'TransitionDuration'] = time + 'ms';
		that.scroller.style[vendor + 'Transform'] = trnOpen + that.x + 'px,' + that.y + 'px' + trnClose + ' scale(' + scale + ')';
		that.zoomed = false;
	},
	
	isReady: function () {
		return !this.moved && !this.zoomed && !this.animating;
	}
};

if (typeof exports !== 'undefined') exports.iScroll = iScroll;
else window.iScroll = iScroll;

})();


// ../../../core/lib/jsii-1.0.0.js
(function(){
			
    var preventConstructor;
    
    FixedClass = function(){};
    
	FixedClass.prototype.__jsii = new Object();
	FixedClass.prototype.__jsii.wasInheritedCalled = false;
    
    FixedClass.extend = function(properties) {

        var eClass = this.prototype;
		var eJsii = eClass.__jsii;

        function nClass() {
            if (!preventConstructor && this.init) {
                this.init.apply(this, arguments);
            }
        }

        preventConstructor = true;
        
        nClass.prototype = new this();
        
        preventConstructor = false;

		nClass.prototype.__jsii = new Object();
		var nJsii = nClass.prototype.__jsii;
		nJsii.methods = {};
		nJsii.methodsIndex = {};
        nJsii.metadata = nClass;

        for (var methodName in eJsii.methods) {
			nJsii.methods[methodName] = [];
            
            for (var i = 0; i < eJsii.methods[methodName].length; i++) {
                nJsii.methods[methodName].push(eJsii.methods[methodName][i]);
            }
        }

        for (var property in properties) {
            if (typeof(properties[property]) == "function") {
                if (!nJsii.methods[property]) {
                    nJsii.methods[property] = [];
                }
                nJsii.methods[property].push(properties[property]);
            }
        }

        for (var methodName in nJsii.methods) {
            nJsii.methodsIndex[methodName] = nJsii.methods[methodName].length - 1;
        }
        
        for (var methodName in nJsii.methods) {
            var method = nJsii.methods[methodName];
            
            var execute = function(method, methodName) {
                return function() {
                    var oldIndex = this.__jsii.methodsIndex[methodName];

                    if (this.__jsii.wasInheritedCalled) {
						if (this.__jsii.methodsIndex[methodName] > 0) {
                        	this.__jsii.methodsIndex[methodName]--;
						 } else {
							throw new Error('The method ' + methodName + ' doesn\'t exist.');
						}
                    }

                    while (this.__jsii.methodsIndex[methodName] > 0 && !method[this.__jsii.methodsIndex[methodName]]) {
                        this.__jsii.methodsIndex[methodName]--;
                    }
                    
                    if (!method[this.__jsii.methodsIndex[methodName]]) {
                        this.__jsii.methodsIndex[methodName] = oldIndex;
                        throw new Error("The method " + methodName + " doesn't exist.");
                    }
                    
                    this.__jsii.wasInheritedCalled = false;
                    
                    var result = method[this.__jsii.methodsIndex[methodName]].apply(this, arguments);
                    
                    this.__jsii.methodsIndex[methodName] = oldIndex;
                                    
                    return result;
                };
            };
            
            nClass.prototype[methodName] = execute(method, methodName);
        }

        nClass.prototype.inherited = function() {
            this.__jsii.wasInheritedCalled = true;
            return this;
        };

        nClass.constructor = nClass;
        nClass.extend = this.extend;

        return nClass;
    };
})();

// ../../../core/lib/jquery-1.4.4.min.js
/*!
 * jQuery JavaScript Library v1.4.4
 * http://jquery.com/
 *
 * Copyright 2010, John Resig
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://jquery.org/license
 *
 * Includes Sizzle.js
 * http://sizzlejs.com/
 * Copyright 2010, The Dojo Foundation
 * Released under the MIT, BSD, and GPL Licenses.
 *
 * Date: Thu Nov 11 19:04:53 2010 -0500
 */
(function(E,B){function ka(a,b,d){if(d===B&&a.nodeType===1){d=a.getAttribute("data-"+b);if(typeof d==="string"){try{d=d==="true"?true:d==="false"?false:d==="null"?null:!c.isNaN(d)?parseFloat(d):Ja.test(d)?c.parseJSON(d):d}catch(e){}c.data(a,b,d)}else d=B}return d}function U(){return false}function ca(){return true}function la(a,b,d){d[0].type=a;return c.event.handle.apply(b,d)}function Ka(a){var b,d,e,f,h,l,k,o,x,r,A,C=[];f=[];h=c.data(this,this.nodeType?"events":"__events__");if(typeof h==="function")h=
h.events;if(!(a.liveFired===this||!h||!h.live||a.button&&a.type==="click")){if(a.namespace)A=RegExp("(^|\\.)"+a.namespace.split(".").join("\\.(?:.*\\.)?")+"(\\.|$)");a.liveFired=this;var J=h.live.slice(0);for(k=0;k<J.length;k++){h=J[k];h.origType.replace(X,"")===a.type?f.push(h.selector):J.splice(k--,1)}f=c(a.target).closest(f,a.currentTarget);o=0;for(x=f.length;o<x;o++){r=f[o];for(k=0;k<J.length;k++){h=J[k];if(r.selector===h.selector&&(!A||A.test(h.namespace))){l=r.elem;e=null;if(h.preType==="mouseenter"||
h.preType==="mouseleave"){a.type=h.preType;e=c(a.relatedTarget).closest(h.selector)[0]}if(!e||e!==l)C.push({elem:l,handleObj:h,level:r.level})}}}o=0;for(x=C.length;o<x;o++){f=C[o];if(d&&f.level>d)break;a.currentTarget=f.elem;a.data=f.handleObj.data;a.handleObj=f.handleObj;A=f.handleObj.origHandler.apply(f.elem,arguments);if(A===false||a.isPropagationStopped()){d=f.level;if(A===false)b=false;if(a.isImmediatePropagationStopped())break}}return b}}function Y(a,b){return(a&&a!=="*"?a+".":"")+b.replace(La,
"`").replace(Ma,"&")}function ma(a,b,d){if(c.isFunction(b))return c.grep(a,function(f,h){return!!b.call(f,h,f)===d});else if(b.nodeType)return c.grep(a,function(f){return f===b===d});else if(typeof b==="string"){var e=c.grep(a,function(f){return f.nodeType===1});if(Na.test(b))return c.filter(b,e,!d);else b=c.filter(b,e)}return c.grep(a,function(f){return c.inArray(f,b)>=0===d})}function na(a,b){var d=0;b.each(function(){if(this.nodeName===(a[d]&&a[d].nodeName)){var e=c.data(a[d++]),f=c.data(this,
e);if(e=e&&e.events){delete f.handle;f.events={};for(var h in e)for(var l in e[h])c.event.add(this,h,e[h][l],e[h][l].data)}}})}function Oa(a,b){b.src?c.ajax({url:b.src,async:false,dataType:"script"}):c.globalEval(b.text||b.textContent||b.innerHTML||"");b.parentNode&&b.parentNode.removeChild(b)}function oa(a,b,d){var e=b==="width"?a.offsetWidth:a.offsetHeight;if(d==="border")return e;c.each(b==="width"?Pa:Qa,function(){d||(e-=parseFloat(c.css(a,"padding"+this))||0);if(d==="margin")e+=parseFloat(c.css(a,
"margin"+this))||0;else e-=parseFloat(c.css(a,"border"+this+"Width"))||0});return e}function da(a,b,d,e){if(c.isArray(b)&&b.length)c.each(b,function(f,h){d||Ra.test(a)?e(a,h):da(a+"["+(typeof h==="object"||c.isArray(h)?f:"")+"]",h,d,e)});else if(!d&&b!=null&&typeof b==="object")c.isEmptyObject(b)?e(a,""):c.each(b,function(f,h){da(a+"["+f+"]",h,d,e)});else e(a,b)}function S(a,b){var d={};c.each(pa.concat.apply([],pa.slice(0,b)),function(){d[this]=a});return d}function qa(a){if(!ea[a]){var b=c("<"+
a+">").appendTo("body"),d=b.css("display");b.remove();if(d==="none"||d==="")d="block";ea[a]=d}return ea[a]}function fa(a){return c.isWindow(a)?a:a.nodeType===9?a.defaultView||a.parentWindow:false}var t=E.document,c=function(){function a(){if(!b.isReady){try{t.documentElement.doScroll("left")}catch(j){setTimeout(a,1);return}b.ready()}}var b=function(j,s){return new b.fn.init(j,s)},d=E.jQuery,e=E.$,f,h=/^(?:[^<]*(<[\w\W]+>)[^>]*$|#([\w\-]+)$)/,l=/\S/,k=/^\s+/,o=/\s+$/,x=/\W/,r=/\d/,A=/^<(\w+)\s*\/?>(?:<\/\1>)?$/,
C=/^[\],:{}\s]*$/,J=/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g,w=/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,I=/(?:^|:|,)(?:\s*\[)+/g,L=/(webkit)[ \/]([\w.]+)/,g=/(opera)(?:.*version)?[ \/]([\w.]+)/,i=/(msie) ([\w.]+)/,n=/(mozilla)(?:.*? rv:([\w.]+))?/,m=navigator.userAgent,p=false,q=[],u,y=Object.prototype.toString,F=Object.prototype.hasOwnProperty,M=Array.prototype.push,N=Array.prototype.slice,O=String.prototype.trim,D=Array.prototype.indexOf,R={};b.fn=b.prototype={init:function(j,
s){var v,z,H;if(!j)return this;if(j.nodeType){this.context=this[0]=j;this.length=1;return this}if(j==="body"&&!s&&t.body){this.context=t;this[0]=t.body;this.selector="body";this.length=1;return this}if(typeof j==="string")if((v=h.exec(j))&&(v[1]||!s))if(v[1]){H=s?s.ownerDocument||s:t;if(z=A.exec(j))if(b.isPlainObject(s)){j=[t.createElement(z[1])];b.fn.attr.call(j,s,true)}else j=[H.createElement(z[1])];else{z=b.buildFragment([v[1]],[H]);j=(z.cacheable?z.fragment.cloneNode(true):z.fragment).childNodes}return b.merge(this,
j)}else{if((z=t.getElementById(v[2]))&&z.parentNode){if(z.id!==v[2])return f.find(j);this.length=1;this[0]=z}this.context=t;this.selector=j;return this}else if(!s&&!x.test(j)){this.selector=j;this.context=t;j=t.getElementsByTagName(j);return b.merge(this,j)}else return!s||s.jquery?(s||f).find(j):b(s).find(j);else if(b.isFunction(j))return f.ready(j);if(j.selector!==B){this.selector=j.selector;this.context=j.context}return b.makeArray(j,this)},selector:"",jquery:"1.4.4",length:0,size:function(){return this.length},
toArray:function(){return N.call(this,0)},get:function(j){return j==null?this.toArray():j<0?this.slice(j)[0]:this[j]},pushStack:function(j,s,v){var z=b();b.isArray(j)?M.apply(z,j):b.merge(z,j);z.prevObject=this;z.context=this.context;if(s==="find")z.selector=this.selector+(this.selector?" ":"")+v;else if(s)z.selector=this.selector+"."+s+"("+v+")";return z},each:function(j,s){return b.each(this,j,s)},ready:function(j){b.bindReady();if(b.isReady)j.call(t,b);else q&&q.push(j);return this},eq:function(j){return j===
-1?this.slice(j):this.slice(j,+j+1)},first:function(){return this.eq(0)},last:function(){return this.eq(-1)},slice:function(){return this.pushStack(N.apply(this,arguments),"slice",N.call(arguments).join(","))},map:function(j){return this.pushStack(b.map(this,function(s,v){return j.call(s,v,s)}))},end:function(){return this.prevObject||b(null)},push:M,sort:[].sort,splice:[].splice};b.fn.init.prototype=b.fn;b.extend=b.fn.extend=function(){var j,s,v,z,H,G=arguments[0]||{},K=1,Q=arguments.length,ga=false;
if(typeof G==="boolean"){ga=G;G=arguments[1]||{};K=2}if(typeof G!=="object"&&!b.isFunction(G))G={};if(Q===K){G=this;--K}for(;K<Q;K++)if((j=arguments[K])!=null)for(s in j){v=G[s];z=j[s];if(G!==z)if(ga&&z&&(b.isPlainObject(z)||(H=b.isArray(z)))){if(H){H=false;v=v&&b.isArray(v)?v:[]}else v=v&&b.isPlainObject(v)?v:{};G[s]=b.extend(ga,v,z)}else if(z!==B)G[s]=z}return G};b.extend({noConflict:function(j){E.$=e;if(j)E.jQuery=d;return b},isReady:false,readyWait:1,ready:function(j){j===true&&b.readyWait--;
if(!b.readyWait||j!==true&&!b.isReady){if(!t.body)return setTimeout(b.ready,1);b.isReady=true;if(!(j!==true&&--b.readyWait>0))if(q){var s=0,v=q;for(q=null;j=v[s++];)j.call(t,b);b.fn.trigger&&b(t).trigger("ready").unbind("ready")}}},bindReady:function(){if(!p){p=true;if(t.readyState==="complete")return setTimeout(b.ready,1);if(t.addEventListener){t.addEventListener("DOMContentLoaded",u,false);E.addEventListener("load",b.ready,false)}else if(t.attachEvent){t.attachEvent("onreadystatechange",u);E.attachEvent("onload",
b.ready);var j=false;try{j=E.frameElement==null}catch(s){}t.documentElement.doScroll&&j&&a()}}},isFunction:function(j){return b.type(j)==="function"},isArray:Array.isArray||function(j){return b.type(j)==="array"},isWindow:function(j){return j&&typeof j==="object"&&"setInterval"in j},isNaN:function(j){return j==null||!r.test(j)||isNaN(j)},type:function(j){return j==null?String(j):R[y.call(j)]||"object"},isPlainObject:function(j){if(!j||b.type(j)!=="object"||j.nodeType||b.isWindow(j))return false;if(j.constructor&&
!F.call(j,"constructor")&&!F.call(j.constructor.prototype,"isPrototypeOf"))return false;for(var s in j);return s===B||F.call(j,s)},isEmptyObject:function(j){for(var s in j)return false;return true},error:function(j){throw j;},parseJSON:function(j){if(typeof j!=="string"||!j)return null;j=b.trim(j);if(C.test(j.replace(J,"@").replace(w,"]").replace(I,"")))return E.JSON&&E.JSON.parse?E.JSON.parse(j):(new Function("return "+j))();else b.error("Invalid JSON: "+j)},noop:function(){},globalEval:function(j){if(j&&
l.test(j)){var s=t.getElementsByTagName("head")[0]||t.documentElement,v=t.createElement("script");v.type="text/javascript";if(b.support.scriptEval)v.appendChild(t.createTextNode(j));else v.text=j;s.insertBefore(v,s.firstChild);s.removeChild(v)}},nodeName:function(j,s){return j.nodeName&&j.nodeName.toUpperCase()===s.toUpperCase()},each:function(j,s,v){var z,H=0,G=j.length,K=G===B||b.isFunction(j);if(v)if(K)for(z in j){if(s.apply(j[z],v)===false)break}else for(;H<G;){if(s.apply(j[H++],v)===false)break}else if(K)for(z in j){if(s.call(j[z],
z,j[z])===false)break}else for(v=j[0];H<G&&s.call(v,H,v)!==false;v=j[++H]);return j},trim:O?function(j){return j==null?"":O.call(j)}:function(j){return j==null?"":j.toString().replace(k,"").replace(o,"")},makeArray:function(j,s){var v=s||[];if(j!=null){var z=b.type(j);j.length==null||z==="string"||z==="function"||z==="regexp"||b.isWindow(j)?M.call(v,j):b.merge(v,j)}return v},inArray:function(j,s){if(s.indexOf)return s.indexOf(j);for(var v=0,z=s.length;v<z;v++)if(s[v]===j)return v;return-1},merge:function(j,
s){var v=j.length,z=0;if(typeof s.length==="number")for(var H=s.length;z<H;z++)j[v++]=s[z];else for(;s[z]!==B;)j[v++]=s[z++];j.length=v;return j},grep:function(j,s,v){var z=[],H;v=!!v;for(var G=0,K=j.length;G<K;G++){H=!!s(j[G],G);v!==H&&z.push(j[G])}return z},map:function(j,s,v){for(var z=[],H,G=0,K=j.length;G<K;G++){H=s(j[G],G,v);if(H!=null)z[z.length]=H}return z.concat.apply([],z)},guid:1,proxy:function(j,s,v){if(arguments.length===2)if(typeof s==="string"){v=j;j=v[s];s=B}else if(s&&!b.isFunction(s)){v=
s;s=B}if(!s&&j)s=function(){return j.apply(v||this,arguments)};if(j)s.guid=j.guid=j.guid||s.guid||b.guid++;return s},access:function(j,s,v,z,H,G){var K=j.length;if(typeof s==="object"){for(var Q in s)b.access(j,Q,s[Q],z,H,v);return j}if(v!==B){z=!G&&z&&b.isFunction(v);for(Q=0;Q<K;Q++)H(j[Q],s,z?v.call(j[Q],Q,H(j[Q],s)):v,G);return j}return K?H(j[0],s):B},now:function(){return(new Date).getTime()},uaMatch:function(j){j=j.toLowerCase();j=L.exec(j)||g.exec(j)||i.exec(j)||j.indexOf("compatible")<0&&n.exec(j)||
[];return{browser:j[1]||"",version:j[2]||"0"}},browser:{}});b.each("Boolean Number String Function Array Date RegExp Object".split(" "),function(j,s){R["[object "+s+"]"]=s.toLowerCase()});m=b.uaMatch(m);if(m.browser){b.browser[m.browser]=true;b.browser.version=m.version}if(b.browser.webkit)b.browser.safari=true;if(D)b.inArray=function(j,s){return D.call(s,j)};if(!/\s/.test("\u00a0")){k=/^[\s\xA0]+/;o=/[\s\xA0]+$/}f=b(t);if(t.addEventListener)u=function(){t.removeEventListener("DOMContentLoaded",u,
false);b.ready()};else if(t.attachEvent)u=function(){if(t.readyState==="complete"){t.detachEvent("onreadystatechange",u);b.ready()}};return E.jQuery=E.$=b}();(function(){c.support={};var a=t.documentElement,b=t.createElement("script"),d=t.createElement("div"),e="script"+c.now();d.style.display="none";d.innerHTML="   <link/><table></table><a href='/a' style='color:red;float:left;opacity:.55;'>a</a><input type='checkbox'/>";var f=d.getElementsByTagName("*"),h=d.getElementsByTagName("a")[0],l=t.createElement("select"),
k=l.appendChild(t.createElement("option"));if(!(!f||!f.length||!h)){c.support={leadingWhitespace:d.firstChild.nodeType===3,tbody:!d.getElementsByTagName("tbody").length,htmlSerialize:!!d.getElementsByTagName("link").length,style:/red/.test(h.getAttribute("style")),hrefNormalized:h.getAttribute("href")==="/a",opacity:/^0.55$/.test(h.style.opacity),cssFloat:!!h.style.cssFloat,checkOn:d.getElementsByTagName("input")[0].value==="on",optSelected:k.selected,deleteExpando:true,optDisabled:false,checkClone:false,
scriptEval:false,noCloneEvent:true,boxModel:null,inlineBlockNeedsLayout:false,shrinkWrapBlocks:false,reliableHiddenOffsets:true};l.disabled=true;c.support.optDisabled=!k.disabled;b.type="text/javascript";try{b.appendChild(t.createTextNode("window."+e+"=1;"))}catch(o){}a.insertBefore(b,a.firstChild);if(E[e]){c.support.scriptEval=true;delete E[e]}try{delete b.test}catch(x){c.support.deleteExpando=false}a.removeChild(b);if(d.attachEvent&&d.fireEvent){d.attachEvent("onclick",function r(){c.support.noCloneEvent=
false;d.detachEvent("onclick",r)});d.cloneNode(true).fireEvent("onclick")}d=t.createElement("div");d.innerHTML="<input type='radio' name='radiotest' checked='checked'/>";a=t.createDocumentFragment();a.appendChild(d.firstChild);c.support.checkClone=a.cloneNode(true).cloneNode(true).lastChild.checked;c(function(){var r=t.createElement("div");r.style.width=r.style.paddingLeft="1px";t.body.appendChild(r);c.boxModel=c.support.boxModel=r.offsetWidth===2;if("zoom"in r.style){r.style.display="inline";r.style.zoom=
1;c.support.inlineBlockNeedsLayout=r.offsetWidth===2;r.style.display="";r.innerHTML="<div style='width:4px;'></div>";c.support.shrinkWrapBlocks=r.offsetWidth!==2}r.innerHTML="<table><tr><td style='padding:0;display:none'></td><td>t</td></tr></table>";var A=r.getElementsByTagName("td");c.support.reliableHiddenOffsets=A[0].offsetHeight===0;A[0].style.display="";A[1].style.display="none";c.support.reliableHiddenOffsets=c.support.reliableHiddenOffsets&&A[0].offsetHeight===0;r.innerHTML="";t.body.removeChild(r).style.display=
"none"});a=function(r){var A=t.createElement("div");r="on"+r;var C=r in A;if(!C){A.setAttribute(r,"return;");C=typeof A[r]==="function"}return C};c.support.submitBubbles=a("submit");c.support.changeBubbles=a("change");a=b=d=f=h=null}})();var ra={},Ja=/^(?:\{.*\}|\[.*\])$/;c.extend({cache:{},uuid:0,expando:"jQuery"+c.now(),noData:{embed:true,object:"clsid:D27CDB6E-AE6D-11cf-96B8-444553540000",applet:true},data:function(a,b,d){if(c.acceptData(a)){a=a==E?ra:a;var e=a.nodeType,f=e?a[c.expando]:null,h=
c.cache;if(!(e&&!f&&typeof b==="string"&&d===B)){if(e)f||(a[c.expando]=f=++c.uuid);else h=a;if(typeof b==="object")if(e)h[f]=c.extend(h[f],b);else c.extend(h,b);else if(e&&!h[f])h[f]={};a=e?h[f]:h;if(d!==B)a[b]=d;return typeof b==="string"?a[b]:a}}},removeData:function(a,b){if(c.acceptData(a)){a=a==E?ra:a;var d=a.nodeType,e=d?a[c.expando]:a,f=c.cache,h=d?f[e]:e;if(b){if(h){delete h[b];d&&c.isEmptyObject(h)&&c.removeData(a)}}else if(d&&c.support.deleteExpando)delete a[c.expando];else if(a.removeAttribute)a.removeAttribute(c.expando);
else if(d)delete f[e];else for(var l in a)delete a[l]}},acceptData:function(a){if(a.nodeName){var b=c.noData[a.nodeName.toLowerCase()];if(b)return!(b===true||a.getAttribute("classid")!==b)}return true}});c.fn.extend({data:function(a,b){var d=null;if(typeof a==="undefined"){if(this.length){var e=this[0].attributes,f;d=c.data(this[0]);for(var h=0,l=e.length;h<l;h++){f=e[h].name;if(f.indexOf("data-")===0){f=f.substr(5);ka(this[0],f,d[f])}}}return d}else if(typeof a==="object")return this.each(function(){c.data(this,
a)});var k=a.split(".");k[1]=k[1]?"."+k[1]:"";if(b===B){d=this.triggerHandler("getData"+k[1]+"!",[k[0]]);if(d===B&&this.length){d=c.data(this[0],a);d=ka(this[0],a,d)}return d===B&&k[1]?this.data(k[0]):d}else return this.each(function(){var o=c(this),x=[k[0],b];o.triggerHandler("setData"+k[1]+"!",x);c.data(this,a,b);o.triggerHandler("changeData"+k[1]+"!",x)})},removeData:function(a){return this.each(function(){c.removeData(this,a)})}});c.extend({queue:function(a,b,d){if(a){b=(b||"fx")+"queue";var e=
c.data(a,b);if(!d)return e||[];if(!e||c.isArray(d))e=c.data(a,b,c.makeArray(d));else e.push(d);return e}},dequeue:function(a,b){b=b||"fx";var d=c.queue(a,b),e=d.shift();if(e==="inprogress")e=d.shift();if(e){b==="fx"&&d.unshift("inprogress");e.call(a,function(){c.dequeue(a,b)})}}});c.fn.extend({queue:function(a,b){if(typeof a!=="string"){b=a;a="fx"}if(b===B)return c.queue(this[0],a);return this.each(function(){var d=c.queue(this,a,b);a==="fx"&&d[0]!=="inprogress"&&c.dequeue(this,a)})},dequeue:function(a){return this.each(function(){c.dequeue(this,
a)})},delay:function(a,b){a=c.fx?c.fx.speeds[a]||a:a;b=b||"fx";return this.queue(b,function(){var d=this;setTimeout(function(){c.dequeue(d,b)},a)})},clearQueue:function(a){return this.queue(a||"fx",[])}});var sa=/[\n\t]/g,ha=/\s+/,Sa=/\r/g,Ta=/^(?:href|src|style)$/,Ua=/^(?:button|input)$/i,Va=/^(?:button|input|object|select|textarea)$/i,Wa=/^a(?:rea)?$/i,ta=/^(?:radio|checkbox)$/i;c.props={"for":"htmlFor","class":"className",readonly:"readOnly",maxlength:"maxLength",cellspacing:"cellSpacing",rowspan:"rowSpan",
colspan:"colSpan",tabindex:"tabIndex",usemap:"useMap",frameborder:"frameBorder"};c.fn.extend({attr:function(a,b){return c.access(this,a,b,true,c.attr)},removeAttr:function(a){return this.each(function(){c.attr(this,a,"");this.nodeType===1&&this.removeAttribute(a)})},addClass:function(a){if(c.isFunction(a))return this.each(function(x){var r=c(this);r.addClass(a.call(this,x,r.attr("class")))});if(a&&typeof a==="string")for(var b=(a||"").split(ha),d=0,e=this.length;d<e;d++){var f=this[d];if(f.nodeType===
1)if(f.className){for(var h=" "+f.className+" ",l=f.className,k=0,o=b.length;k<o;k++)if(h.indexOf(" "+b[k]+" ")<0)l+=" "+b[k];f.className=c.trim(l)}else f.className=a}return this},removeClass:function(a){if(c.isFunction(a))return this.each(function(o){var x=c(this);x.removeClass(a.call(this,o,x.attr("class")))});if(a&&typeof a==="string"||a===B)for(var b=(a||"").split(ha),d=0,e=this.length;d<e;d++){var f=this[d];if(f.nodeType===1&&f.className)if(a){for(var h=(" "+f.className+" ").replace(sa," "),
l=0,k=b.length;l<k;l++)h=h.replace(" "+b[l]+" "," ");f.className=c.trim(h)}else f.className=""}return this},toggleClass:function(a,b){var d=typeof a,e=typeof b==="boolean";if(c.isFunction(a))return this.each(function(f){var h=c(this);h.toggleClass(a.call(this,f,h.attr("class"),b),b)});return this.each(function(){if(d==="string")for(var f,h=0,l=c(this),k=b,o=a.split(ha);f=o[h++];){k=e?k:!l.hasClass(f);l[k?"addClass":"removeClass"](f)}else if(d==="undefined"||d==="boolean"){this.className&&c.data(this,
"__className__",this.className);this.className=this.className||a===false?"":c.data(this,"__className__")||""}})},hasClass:function(a){a=" "+a+" ";for(var b=0,d=this.length;b<d;b++)if((" "+this[b].className+" ").replace(sa," ").indexOf(a)>-1)return true;return false},val:function(a){if(!arguments.length){var b=this[0];if(b){if(c.nodeName(b,"option")){var d=b.attributes.value;return!d||d.specified?b.value:b.text}if(c.nodeName(b,"select")){var e=b.selectedIndex;d=[];var f=b.options;b=b.type==="select-one";
if(e<0)return null;var h=b?e:0;for(e=b?e+1:f.length;h<e;h++){var l=f[h];if(l.selected&&(c.support.optDisabled?!l.disabled:l.getAttribute("disabled")===null)&&(!l.parentNode.disabled||!c.nodeName(l.parentNode,"optgroup"))){a=c(l).val();if(b)return a;d.push(a)}}return d}if(ta.test(b.type)&&!c.support.checkOn)return b.getAttribute("value")===null?"on":b.value;return(b.value||"").replace(Sa,"")}return B}var k=c.isFunction(a);return this.each(function(o){var x=c(this),r=a;if(this.nodeType===1){if(k)r=
a.call(this,o,x.val());if(r==null)r="";else if(typeof r==="number")r+="";else if(c.isArray(r))r=c.map(r,function(C){return C==null?"":C+""});if(c.isArray(r)&&ta.test(this.type))this.checked=c.inArray(x.val(),r)>=0;else if(c.nodeName(this,"select")){var A=c.makeArray(r);c("option",this).each(function(){this.selected=c.inArray(c(this).val(),A)>=0});if(!A.length)this.selectedIndex=-1}else this.value=r}})}});c.extend({attrFn:{val:true,css:true,html:true,text:true,data:true,width:true,height:true,offset:true},
attr:function(a,b,d,e){if(!a||a.nodeType===3||a.nodeType===8)return B;if(e&&b in c.attrFn)return c(a)[b](d);e=a.nodeType!==1||!c.isXMLDoc(a);var f=d!==B;b=e&&c.props[b]||b;var h=Ta.test(b);if((b in a||a[b]!==B)&&e&&!h){if(f){b==="type"&&Ua.test(a.nodeName)&&a.parentNode&&c.error("type property can't be changed");if(d===null)a.nodeType===1&&a.removeAttribute(b);else a[b]=d}if(c.nodeName(a,"form")&&a.getAttributeNode(b))return a.getAttributeNode(b).nodeValue;if(b==="tabIndex")return(b=a.getAttributeNode("tabIndex"))&&
b.specified?b.value:Va.test(a.nodeName)||Wa.test(a.nodeName)&&a.href?0:B;return a[b]}if(!c.support.style&&e&&b==="style"){if(f)a.style.cssText=""+d;return a.style.cssText}f&&a.setAttribute(b,""+d);if(!a.attributes[b]&&a.hasAttribute&&!a.hasAttribute(b))return B;a=!c.support.hrefNormalized&&e&&h?a.getAttribute(b,2):a.getAttribute(b);return a===null?B:a}});var X=/\.(.*)$/,ia=/^(?:textarea|input|select)$/i,La=/\./g,Ma=/ /g,Xa=/[^\w\s.|`]/g,Ya=function(a){return a.replace(Xa,"\\$&")},ua={focusin:0,focusout:0};
c.event={add:function(a,b,d,e){if(!(a.nodeType===3||a.nodeType===8)){if(c.isWindow(a)&&a!==E&&!a.frameElement)a=E;if(d===false)d=U;else if(!d)return;var f,h;if(d.handler){f=d;d=f.handler}if(!d.guid)d.guid=c.guid++;if(h=c.data(a)){var l=a.nodeType?"events":"__events__",k=h[l],o=h.handle;if(typeof k==="function"){o=k.handle;k=k.events}else if(!k){a.nodeType||(h[l]=h=function(){});h.events=k={}}if(!o)h.handle=o=function(){return typeof c!=="undefined"&&!c.event.triggered?c.event.handle.apply(o.elem,
arguments):B};o.elem=a;b=b.split(" ");for(var x=0,r;l=b[x++];){h=f?c.extend({},f):{handler:d,data:e};if(l.indexOf(".")>-1){r=l.split(".");l=r.shift();h.namespace=r.slice(0).sort().join(".")}else{r=[];h.namespace=""}h.type=l;if(!h.guid)h.guid=d.guid;var A=k[l],C=c.event.special[l]||{};if(!A){A=k[l]=[];if(!C.setup||C.setup.call(a,e,r,o)===false)if(a.addEventListener)a.addEventListener(l,o,false);else a.attachEvent&&a.attachEvent("on"+l,o)}if(C.add){C.add.call(a,h);if(!h.handler.guid)h.handler.guid=
d.guid}A.push(h);c.event.global[l]=true}a=null}}},global:{},remove:function(a,b,d,e){if(!(a.nodeType===3||a.nodeType===8)){if(d===false)d=U;var f,h,l=0,k,o,x,r,A,C,J=a.nodeType?"events":"__events__",w=c.data(a),I=w&&w[J];if(w&&I){if(typeof I==="function"){w=I;I=I.events}if(b&&b.type){d=b.handler;b=b.type}if(!b||typeof b==="string"&&b.charAt(0)==="."){b=b||"";for(f in I)c.event.remove(a,f+b)}else{for(b=b.split(" ");f=b[l++];){r=f;k=f.indexOf(".")<0;o=[];if(!k){o=f.split(".");f=o.shift();x=RegExp("(^|\\.)"+
c.map(o.slice(0).sort(),Ya).join("\\.(?:.*\\.)?")+"(\\.|$)")}if(A=I[f])if(d){r=c.event.special[f]||{};for(h=e||0;h<A.length;h++){C=A[h];if(d.guid===C.guid){if(k||x.test(C.namespace)){e==null&&A.splice(h--,1);r.remove&&r.remove.call(a,C)}if(e!=null)break}}if(A.length===0||e!=null&&A.length===1){if(!r.teardown||r.teardown.call(a,o)===false)c.removeEvent(a,f,w.handle);delete I[f]}}else for(h=0;h<A.length;h++){C=A[h];if(k||x.test(C.namespace)){c.event.remove(a,r,C.handler,h);A.splice(h--,1)}}}if(c.isEmptyObject(I)){if(b=
w.handle)b.elem=null;delete w.events;delete w.handle;if(typeof w==="function")c.removeData(a,J);else c.isEmptyObject(w)&&c.removeData(a)}}}}},trigger:function(a,b,d,e){var f=a.type||a;if(!e){a=typeof a==="object"?a[c.expando]?a:c.extend(c.Event(f),a):c.Event(f);if(f.indexOf("!")>=0){a.type=f=f.slice(0,-1);a.exclusive=true}if(!d){a.stopPropagation();c.event.global[f]&&c.each(c.cache,function(){this.events&&this.events[f]&&c.event.trigger(a,b,this.handle.elem)})}if(!d||d.nodeType===3||d.nodeType===
8)return B;a.result=B;a.target=d;b=c.makeArray(b);b.unshift(a)}a.currentTarget=d;(e=d.nodeType?c.data(d,"handle"):(c.data(d,"__events__")||{}).handle)&&e.apply(d,b);e=d.parentNode||d.ownerDocument;try{if(!(d&&d.nodeName&&c.noData[d.nodeName.toLowerCase()]))if(d["on"+f]&&d["on"+f].apply(d,b)===false){a.result=false;a.preventDefault()}}catch(h){}if(!a.isPropagationStopped()&&e)c.event.trigger(a,b,e,true);else if(!a.isDefaultPrevented()){var l;e=a.target;var k=f.replace(X,""),o=c.nodeName(e,"a")&&k===
"click",x=c.event.special[k]||{};if((!x._default||x._default.call(d,a)===false)&&!o&&!(e&&e.nodeName&&c.noData[e.nodeName.toLowerCase()])){try{if(e[k]){if(l=e["on"+k])e["on"+k]=null;c.event.triggered=true;e[k]()}}catch(r){}if(l)e["on"+k]=l;c.event.triggered=false}}},handle:function(a){var b,d,e,f;d=[];var h=c.makeArray(arguments);a=h[0]=c.event.fix(a||E.event);a.currentTarget=this;b=a.type.indexOf(".")<0&&!a.exclusive;if(!b){e=a.type.split(".");a.type=e.shift();d=e.slice(0).sort();e=RegExp("(^|\\.)"+
d.join("\\.(?:.*\\.)?")+"(\\.|$)")}a.namespace=a.namespace||d.join(".");f=c.data(this,this.nodeType?"events":"__events__");if(typeof f==="function")f=f.events;d=(f||{})[a.type];if(f&&d){d=d.slice(0);f=0;for(var l=d.length;f<l;f++){var k=d[f];if(b||e.test(k.namespace)){a.handler=k.handler;a.data=k.data;a.handleObj=k;k=k.handler.apply(this,h);if(k!==B){a.result=k;if(k===false){a.preventDefault();a.stopPropagation()}}if(a.isImmediatePropagationStopped())break}}}return a.result},props:"altKey attrChange attrName bubbles button cancelable charCode clientX clientY ctrlKey currentTarget data detail eventPhase fromElement handler keyCode layerX layerY metaKey newValue offsetX offsetY pageX pageY prevValue relatedNode relatedTarget screenX screenY shiftKey srcElement target toElement view wheelDelta which".split(" "),
fix:function(a){if(a[c.expando])return a;var b=a;a=c.Event(b);for(var d=this.props.length,e;d;){e=this.props[--d];a[e]=b[e]}if(!a.target)a.target=a.srcElement||t;if(a.target.nodeType===3)a.target=a.target.parentNode;if(!a.relatedTarget&&a.fromElement)a.relatedTarget=a.fromElement===a.target?a.toElement:a.fromElement;if(a.pageX==null&&a.clientX!=null){b=t.documentElement;d=t.body;a.pageX=a.clientX+(b&&b.scrollLeft||d&&d.scrollLeft||0)-(b&&b.clientLeft||d&&d.clientLeft||0);a.pageY=a.clientY+(b&&b.scrollTop||
d&&d.scrollTop||0)-(b&&b.clientTop||d&&d.clientTop||0)}if(a.which==null&&(a.charCode!=null||a.keyCode!=null))a.which=a.charCode!=null?a.charCode:a.keyCode;if(!a.metaKey&&a.ctrlKey)a.metaKey=a.ctrlKey;if(!a.which&&a.button!==B)a.which=a.button&1?1:a.button&2?3:a.button&4?2:0;return a},guid:1E8,proxy:c.proxy,special:{ready:{setup:c.bindReady,teardown:c.noop},live:{add:function(a){c.event.add(this,Y(a.origType,a.selector),c.extend({},a,{handler:Ka,guid:a.handler.guid}))},remove:function(a){c.event.remove(this,
Y(a.origType,a.selector),a)}},beforeunload:{setup:function(a,b,d){if(c.isWindow(this))this.onbeforeunload=d},teardown:function(a,b){if(this.onbeforeunload===b)this.onbeforeunload=null}}}};c.removeEvent=t.removeEventListener?function(a,b,d){a.removeEventListener&&a.removeEventListener(b,d,false)}:function(a,b,d){a.detachEvent&&a.detachEvent("on"+b,d)};c.Event=function(a){if(!this.preventDefault)return new c.Event(a);if(a&&a.type){this.originalEvent=a;this.type=a.type}else this.type=a;this.timeStamp=
c.now();this[c.expando]=true};c.Event.prototype={preventDefault:function(){this.isDefaultPrevented=ca;var a=this.originalEvent;if(a)if(a.preventDefault)a.preventDefault();else a.returnValue=false},stopPropagation:function(){this.isPropagationStopped=ca;var a=this.originalEvent;if(a){a.stopPropagation&&a.stopPropagation();a.cancelBubble=true}},stopImmediatePropagation:function(){this.isImmediatePropagationStopped=ca;this.stopPropagation()},isDefaultPrevented:U,isPropagationStopped:U,isImmediatePropagationStopped:U};
var va=function(a){var b=a.relatedTarget;try{for(;b&&b!==this;)b=b.parentNode;if(b!==this){a.type=a.data;c.event.handle.apply(this,arguments)}}catch(d){}},wa=function(a){a.type=a.data;c.event.handle.apply(this,arguments)};c.each({mouseenter:"mouseover",mouseleave:"mouseout"},function(a,b){c.event.special[a]={setup:function(d){c.event.add(this,b,d&&d.selector?wa:va,a)},teardown:function(d){c.event.remove(this,b,d&&d.selector?wa:va)}}});if(!c.support.submitBubbles)c.event.special.submit={setup:function(){if(this.nodeName.toLowerCase()!==
"form"){c.event.add(this,"click.specialSubmit",function(a){var b=a.target,d=b.type;if((d==="submit"||d==="image")&&c(b).closest("form").length){a.liveFired=B;return la("submit",this,arguments)}});c.event.add(this,"keypress.specialSubmit",function(a){var b=a.target,d=b.type;if((d==="text"||d==="password")&&c(b).closest("form").length&&a.keyCode===13){a.liveFired=B;return la("submit",this,arguments)}})}else return false},teardown:function(){c.event.remove(this,".specialSubmit")}};if(!c.support.changeBubbles){var V,
xa=function(a){var b=a.type,d=a.value;if(b==="radio"||b==="checkbox")d=a.checked;else if(b==="select-multiple")d=a.selectedIndex>-1?c.map(a.options,function(e){return e.selected}).join("-"):"";else if(a.nodeName.toLowerCase()==="select")d=a.selectedIndex;return d},Z=function(a,b){var d=a.target,e,f;if(!(!ia.test(d.nodeName)||d.readOnly)){e=c.data(d,"_change_data");f=xa(d);if(a.type!=="focusout"||d.type!=="radio")c.data(d,"_change_data",f);if(!(e===B||f===e))if(e!=null||f){a.type="change";a.liveFired=
B;return c.event.trigger(a,b,d)}}};c.event.special.change={filters:{focusout:Z,beforedeactivate:Z,click:function(a){var b=a.target,d=b.type;if(d==="radio"||d==="checkbox"||b.nodeName.toLowerCase()==="select")return Z.call(this,a)},keydown:function(a){var b=a.target,d=b.type;if(a.keyCode===13&&b.nodeName.toLowerCase()!=="textarea"||a.keyCode===32&&(d==="checkbox"||d==="radio")||d==="select-multiple")return Z.call(this,a)},beforeactivate:function(a){a=a.target;c.data(a,"_change_data",xa(a))}},setup:function(){if(this.type===
"file")return false;for(var a in V)c.event.add(this,a+".specialChange",V[a]);return ia.test(this.nodeName)},teardown:function(){c.event.remove(this,".specialChange");return ia.test(this.nodeName)}};V=c.event.special.change.filters;V.focus=V.beforeactivate}t.addEventListener&&c.each({focus:"focusin",blur:"focusout"},function(a,b){function d(e){e=c.event.fix(e);e.type=b;return c.event.trigger(e,null,e.target)}c.event.special[b]={setup:function(){ua[b]++===0&&t.addEventListener(a,d,true)},teardown:function(){--ua[b]===
0&&t.removeEventListener(a,d,true)}}});c.each(["bind","one"],function(a,b){c.fn[b]=function(d,e,f){if(typeof d==="object"){for(var h in d)this[b](h,e,d[h],f);return this}if(c.isFunction(e)||e===false){f=e;e=B}var l=b==="one"?c.proxy(f,function(o){c(this).unbind(o,l);return f.apply(this,arguments)}):f;if(d==="unload"&&b!=="one")this.one(d,e,f);else{h=0;for(var k=this.length;h<k;h++)c.event.add(this[h],d,l,e)}return this}});c.fn.extend({unbind:function(a,b){if(typeof a==="object"&&!a.preventDefault)for(var d in a)this.unbind(d,
a[d]);else{d=0;for(var e=this.length;d<e;d++)c.event.remove(this[d],a,b)}return this},delegate:function(a,b,d,e){return this.live(b,d,e,a)},undelegate:function(a,b,d){return arguments.length===0?this.unbind("live"):this.die(b,null,d,a)},trigger:function(a,b){return this.each(function(){c.event.trigger(a,b,this)})},triggerHandler:function(a,b){if(this[0]){var d=c.Event(a);d.preventDefault();d.stopPropagation();c.event.trigger(d,b,this[0]);return d.result}},toggle:function(a){for(var b=arguments,d=
1;d<b.length;)c.proxy(a,b[d++]);return this.click(c.proxy(a,function(e){var f=(c.data(this,"lastToggle"+a.guid)||0)%d;c.data(this,"lastToggle"+a.guid,f+1);e.preventDefault();return b[f].apply(this,arguments)||false}))},hover:function(a,b){return this.mouseenter(a).mouseleave(b||a)}});var ya={focus:"focusin",blur:"focusout",mouseenter:"mouseover",mouseleave:"mouseout"};c.each(["live","die"],function(a,b){c.fn[b]=function(d,e,f,h){var l,k=0,o,x,r=h||this.selector;h=h?this:c(this.context);if(typeof d===
"object"&&!d.preventDefault){for(l in d)h[b](l,e,d[l],r);return this}if(c.isFunction(e)){f=e;e=B}for(d=(d||"").split(" ");(l=d[k++])!=null;){o=X.exec(l);x="";if(o){x=o[0];l=l.replace(X,"")}if(l==="hover")d.push("mouseenter"+x,"mouseleave"+x);else{o=l;if(l==="focus"||l==="blur"){d.push(ya[l]+x);l+=x}else l=(ya[l]||l)+x;if(b==="live"){x=0;for(var A=h.length;x<A;x++)c.event.add(h[x],"live."+Y(l,r),{data:e,selector:r,handler:f,origType:l,origHandler:f,preType:o})}else h.unbind("live."+Y(l,r),f)}}return this}});
c.each("blur focus focusin focusout load resize scroll unload click dblclick mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave change select submit keydown keypress keyup error".split(" "),function(a,b){c.fn[b]=function(d,e){if(e==null){e=d;d=null}return arguments.length>0?this.bind(b,d,e):this.trigger(b)};if(c.attrFn)c.attrFn[b]=true});E.attachEvent&&!E.addEventListener&&c(E).bind("unload",function(){for(var a in c.cache)if(c.cache[a].handle)try{c.event.remove(c.cache[a].handle.elem)}catch(b){}});
(function(){function a(g,i,n,m,p,q){p=0;for(var u=m.length;p<u;p++){var y=m[p];if(y){var F=false;for(y=y[g];y;){if(y.sizcache===n){F=m[y.sizset];break}if(y.nodeType===1&&!q){y.sizcache=n;y.sizset=p}if(y.nodeName.toLowerCase()===i){F=y;break}y=y[g]}m[p]=F}}}function b(g,i,n,m,p,q){p=0;for(var u=m.length;p<u;p++){var y=m[p];if(y){var F=false;for(y=y[g];y;){if(y.sizcache===n){F=m[y.sizset];break}if(y.nodeType===1){if(!q){y.sizcache=n;y.sizset=p}if(typeof i!=="string"){if(y===i){F=true;break}}else if(k.filter(i,
[y]).length>0){F=y;break}}y=y[g]}m[p]=F}}}var d=/((?:\((?:\([^()]+\)|[^()]+)+\)|\[(?:\[[^\[\]]*\]|['"][^'"]*['"]|[^\[\]'"]+)+\]|\\.|[^ >+~,(\[\\]+)+|[>+~])(\s*,\s*)?((?:.|\r|\n)*)/g,e=0,f=Object.prototype.toString,h=false,l=true;[0,0].sort(function(){l=false;return 0});var k=function(g,i,n,m){n=n||[];var p=i=i||t;if(i.nodeType!==1&&i.nodeType!==9)return[];if(!g||typeof g!=="string")return n;var q,u,y,F,M,N=true,O=k.isXML(i),D=[],R=g;do{d.exec("");if(q=d.exec(R)){R=q[3];D.push(q[1]);if(q[2]){F=q[3];
break}}}while(q);if(D.length>1&&x.exec(g))if(D.length===2&&o.relative[D[0]])u=L(D[0]+D[1],i);else for(u=o.relative[D[0]]?[i]:k(D.shift(),i);D.length;){g=D.shift();if(o.relative[g])g+=D.shift();u=L(g,u)}else{if(!m&&D.length>1&&i.nodeType===9&&!O&&o.match.ID.test(D[0])&&!o.match.ID.test(D[D.length-1])){q=k.find(D.shift(),i,O);i=q.expr?k.filter(q.expr,q.set)[0]:q.set[0]}if(i){q=m?{expr:D.pop(),set:C(m)}:k.find(D.pop(),D.length===1&&(D[0]==="~"||D[0]==="+")&&i.parentNode?i.parentNode:i,O);u=q.expr?k.filter(q.expr,
q.set):q.set;if(D.length>0)y=C(u);else N=false;for(;D.length;){q=M=D.pop();if(o.relative[M])q=D.pop();else M="";if(q==null)q=i;o.relative[M](y,q,O)}}else y=[]}y||(y=u);y||k.error(M||g);if(f.call(y)==="[object Array]")if(N)if(i&&i.nodeType===1)for(g=0;y[g]!=null;g++){if(y[g]&&(y[g]===true||y[g].nodeType===1&&k.contains(i,y[g])))n.push(u[g])}else for(g=0;y[g]!=null;g++)y[g]&&y[g].nodeType===1&&n.push(u[g]);else n.push.apply(n,y);else C(y,n);if(F){k(F,p,n,m);k.uniqueSort(n)}return n};k.uniqueSort=function(g){if(w){h=
l;g.sort(w);if(h)for(var i=1;i<g.length;i++)g[i]===g[i-1]&&g.splice(i--,1)}return g};k.matches=function(g,i){return k(g,null,null,i)};k.matchesSelector=function(g,i){return k(i,null,null,[g]).length>0};k.find=function(g,i,n){var m;if(!g)return[];for(var p=0,q=o.order.length;p<q;p++){var u,y=o.order[p];if(u=o.leftMatch[y].exec(g)){var F=u[1];u.splice(1,1);if(F.substr(F.length-1)!=="\\"){u[1]=(u[1]||"").replace(/\\/g,"");m=o.find[y](u,i,n);if(m!=null){g=g.replace(o.match[y],"");break}}}}m||(m=i.getElementsByTagName("*"));
return{set:m,expr:g}};k.filter=function(g,i,n,m){for(var p,q,u=g,y=[],F=i,M=i&&i[0]&&k.isXML(i[0]);g&&i.length;){for(var N in o.filter)if((p=o.leftMatch[N].exec(g))!=null&&p[2]){var O,D,R=o.filter[N];D=p[1];q=false;p.splice(1,1);if(D.substr(D.length-1)!=="\\"){if(F===y)y=[];if(o.preFilter[N])if(p=o.preFilter[N](p,F,n,y,m,M)){if(p===true)continue}else q=O=true;if(p)for(var j=0;(D=F[j])!=null;j++)if(D){O=R(D,p,j,F);var s=m^!!O;if(n&&O!=null)if(s)q=true;else F[j]=false;else if(s){y.push(D);q=true}}if(O!==
B){n||(F=y);g=g.replace(o.match[N],"");if(!q)return[];break}}}if(g===u)if(q==null)k.error(g);else break;u=g}return F};k.error=function(g){throw"Syntax error, unrecognized expression: "+g;};var o=k.selectors={order:["ID","NAME","TAG"],match:{ID:/#((?:[\w\u00c0-\uFFFF\-]|\\.)+)/,CLASS:/\.((?:[\w\u00c0-\uFFFF\-]|\\.)+)/,NAME:/\[name=['"]*((?:[\w\u00c0-\uFFFF\-]|\\.)+)['"]*\]/,ATTR:/\[\s*((?:[\w\u00c0-\uFFFF\-]|\\.)+)\s*(?:(\S?=)\s*(['"]*)(.*?)\3|)\s*\]/,TAG:/^((?:[\w\u00c0-\uFFFF\*\-]|\\.)+)/,CHILD:/:(only|nth|last|first)-child(?:\((even|odd|[\dn+\-]*)\))?/,
POS:/:(nth|eq|gt|lt|first|last|even|odd)(?:\((\d*)\))?(?=[^\-]|$)/,PSEUDO:/:((?:[\w\u00c0-\uFFFF\-]|\\.)+)(?:\((['"]?)((?:\([^\)]+\)|[^\(\)]*)+)\2\))?/},leftMatch:{},attrMap:{"class":"className","for":"htmlFor"},attrHandle:{href:function(g){return g.getAttribute("href")}},relative:{"+":function(g,i){var n=typeof i==="string",m=n&&!/\W/.test(i);n=n&&!m;if(m)i=i.toLowerCase();m=0;for(var p=g.length,q;m<p;m++)if(q=g[m]){for(;(q=q.previousSibling)&&q.nodeType!==1;);g[m]=n||q&&q.nodeName.toLowerCase()===
i?q||false:q===i}n&&k.filter(i,g,true)},">":function(g,i){var n,m=typeof i==="string",p=0,q=g.length;if(m&&!/\W/.test(i))for(i=i.toLowerCase();p<q;p++){if(n=g[p]){n=n.parentNode;g[p]=n.nodeName.toLowerCase()===i?n:false}}else{for(;p<q;p++)if(n=g[p])g[p]=m?n.parentNode:n.parentNode===i;m&&k.filter(i,g,true)}},"":function(g,i,n){var m,p=e++,q=b;if(typeof i==="string"&&!/\W/.test(i)){m=i=i.toLowerCase();q=a}q("parentNode",i,p,g,m,n)},"~":function(g,i,n){var m,p=e++,q=b;if(typeof i==="string"&&!/\W/.test(i)){m=
i=i.toLowerCase();q=a}q("previousSibling",i,p,g,m,n)}},find:{ID:function(g,i,n){if(typeof i.getElementById!=="undefined"&&!n)return(g=i.getElementById(g[1]))&&g.parentNode?[g]:[]},NAME:function(g,i){if(typeof i.getElementsByName!=="undefined"){for(var n=[],m=i.getElementsByName(g[1]),p=0,q=m.length;p<q;p++)m[p].getAttribute("name")===g[1]&&n.push(m[p]);return n.length===0?null:n}},TAG:function(g,i){return i.getElementsByTagName(g[1])}},preFilter:{CLASS:function(g,i,n,m,p,q){g=" "+g[1].replace(/\\/g,
"")+" ";if(q)return g;q=0;for(var u;(u=i[q])!=null;q++)if(u)if(p^(u.className&&(" "+u.className+" ").replace(/[\t\n]/g," ").indexOf(g)>=0))n||m.push(u);else if(n)i[q]=false;return false},ID:function(g){return g[1].replace(/\\/g,"")},TAG:function(g){return g[1].toLowerCase()},CHILD:function(g){if(g[1]==="nth"){var i=/(-?)(\d*)n((?:\+|-)?\d*)/.exec(g[2]==="even"&&"2n"||g[2]==="odd"&&"2n+1"||!/\D/.test(g[2])&&"0n+"+g[2]||g[2]);g[2]=i[1]+(i[2]||1)-0;g[3]=i[3]-0}g[0]=e++;return g},ATTR:function(g,i,n,
m,p,q){i=g[1].replace(/\\/g,"");if(!q&&o.attrMap[i])g[1]=o.attrMap[i];if(g[2]==="~=")g[4]=" "+g[4]+" ";return g},PSEUDO:function(g,i,n,m,p){if(g[1]==="not")if((d.exec(g[3])||"").length>1||/^\w/.test(g[3]))g[3]=k(g[3],null,null,i);else{g=k.filter(g[3],i,n,true^p);n||m.push.apply(m,g);return false}else if(o.match.POS.test(g[0])||o.match.CHILD.test(g[0]))return true;return g},POS:function(g){g.unshift(true);return g}},filters:{enabled:function(g){return g.disabled===false&&g.type!=="hidden"},disabled:function(g){return g.disabled===
true},checked:function(g){return g.checked===true},selected:function(g){return g.selected===true},parent:function(g){return!!g.firstChild},empty:function(g){return!g.firstChild},has:function(g,i,n){return!!k(n[3],g).length},header:function(g){return/h\d/i.test(g.nodeName)},text:function(g){return"text"===g.type},radio:function(g){return"radio"===g.type},checkbox:function(g){return"checkbox"===g.type},file:function(g){return"file"===g.type},password:function(g){return"password"===g.type},submit:function(g){return"submit"===
g.type},image:function(g){return"image"===g.type},reset:function(g){return"reset"===g.type},button:function(g){return"button"===g.type||g.nodeName.toLowerCase()==="button"},input:function(g){return/input|select|textarea|button/i.test(g.nodeName)}},setFilters:{first:function(g,i){return i===0},last:function(g,i,n,m){return i===m.length-1},even:function(g,i){return i%2===0},odd:function(g,i){return i%2===1},lt:function(g,i,n){return i<n[3]-0},gt:function(g,i,n){return i>n[3]-0},nth:function(g,i,n){return n[3]-
0===i},eq:function(g,i,n){return n[3]-0===i}},filter:{PSEUDO:function(g,i,n,m){var p=i[1],q=o.filters[p];if(q)return q(g,n,i,m);else if(p==="contains")return(g.textContent||g.innerText||k.getText([g])||"").indexOf(i[3])>=0;else if(p==="not"){i=i[3];n=0;for(m=i.length;n<m;n++)if(i[n]===g)return false;return true}else k.error("Syntax error, unrecognized expression: "+p)},CHILD:function(g,i){var n=i[1],m=g;switch(n){case "only":case "first":for(;m=m.previousSibling;)if(m.nodeType===1)return false;if(n===
"first")return true;m=g;case "last":for(;m=m.nextSibling;)if(m.nodeType===1)return false;return true;case "nth":n=i[2];var p=i[3];if(n===1&&p===0)return true;var q=i[0],u=g.parentNode;if(u&&(u.sizcache!==q||!g.nodeIndex)){var y=0;for(m=u.firstChild;m;m=m.nextSibling)if(m.nodeType===1)m.nodeIndex=++y;u.sizcache=q}m=g.nodeIndex-p;return n===0?m===0:m%n===0&&m/n>=0}},ID:function(g,i){return g.nodeType===1&&g.getAttribute("id")===i},TAG:function(g,i){return i==="*"&&g.nodeType===1||g.nodeName.toLowerCase()===
i},CLASS:function(g,i){return(" "+(g.className||g.getAttribute("class"))+" ").indexOf(i)>-1},ATTR:function(g,i){var n=i[1];n=o.attrHandle[n]?o.attrHandle[n](g):g[n]!=null?g[n]:g.getAttribute(n);var m=n+"",p=i[2],q=i[4];return n==null?p==="!=":p==="="?m===q:p==="*="?m.indexOf(q)>=0:p==="~="?(" "+m+" ").indexOf(q)>=0:!q?m&&n!==false:p==="!="?m!==q:p==="^="?m.indexOf(q)===0:p==="$="?m.substr(m.length-q.length)===q:p==="|="?m===q||m.substr(0,q.length+1)===q+"-":false},POS:function(g,i,n,m){var p=o.setFilters[i[2]];
if(p)return p(g,n,i,m)}}},x=o.match.POS,r=function(g,i){return"\\"+(i-0+1)},A;for(A in o.match){o.match[A]=RegExp(o.match[A].source+/(?![^\[]*\])(?![^\(]*\))/.source);o.leftMatch[A]=RegExp(/(^(?:.|\r|\n)*?)/.source+o.match[A].source.replace(/\\(\d+)/g,r))}var C=function(g,i){g=Array.prototype.slice.call(g,0);if(i){i.push.apply(i,g);return i}return g};try{Array.prototype.slice.call(t.documentElement.childNodes,0)}catch(J){C=function(g,i){var n=0,m=i||[];if(f.call(g)==="[object Array]")Array.prototype.push.apply(m,
g);else if(typeof g.length==="number")for(var p=g.length;n<p;n++)m.push(g[n]);else for(;g[n];n++)m.push(g[n]);return m}}var w,I;if(t.documentElement.compareDocumentPosition)w=function(g,i){if(g===i){h=true;return 0}if(!g.compareDocumentPosition||!i.compareDocumentPosition)return g.compareDocumentPosition?-1:1;return g.compareDocumentPosition(i)&4?-1:1};else{w=function(g,i){var n,m,p=[],q=[];n=g.parentNode;m=i.parentNode;var u=n;if(g===i){h=true;return 0}else if(n===m)return I(g,i);else if(n){if(!m)return 1}else return-1;
for(;u;){p.unshift(u);u=u.parentNode}for(u=m;u;){q.unshift(u);u=u.parentNode}n=p.length;m=q.length;for(u=0;u<n&&u<m;u++)if(p[u]!==q[u])return I(p[u],q[u]);return u===n?I(g,q[u],-1):I(p[u],i,1)};I=function(g,i,n){if(g===i)return n;for(g=g.nextSibling;g;){if(g===i)return-1;g=g.nextSibling}return 1}}k.getText=function(g){for(var i="",n,m=0;g[m];m++){n=g[m];if(n.nodeType===3||n.nodeType===4)i+=n.nodeValue;else if(n.nodeType!==8)i+=k.getText(n.childNodes)}return i};(function(){var g=t.createElement("div"),
i="script"+(new Date).getTime(),n=t.documentElement;g.innerHTML="<a name='"+i+"'/>";n.insertBefore(g,n.firstChild);if(t.getElementById(i)){o.find.ID=function(m,p,q){if(typeof p.getElementById!=="undefined"&&!q)return(p=p.getElementById(m[1]))?p.id===m[1]||typeof p.getAttributeNode!=="undefined"&&p.getAttributeNode("id").nodeValue===m[1]?[p]:B:[]};o.filter.ID=function(m,p){var q=typeof m.getAttributeNode!=="undefined"&&m.getAttributeNode("id");return m.nodeType===1&&q&&q.nodeValue===p}}n.removeChild(g);
n=g=null})();(function(){var g=t.createElement("div");g.appendChild(t.createComment(""));if(g.getElementsByTagName("*").length>0)o.find.TAG=function(i,n){var m=n.getElementsByTagName(i[1]);if(i[1]==="*"){for(var p=[],q=0;m[q];q++)m[q].nodeType===1&&p.push(m[q]);m=p}return m};g.innerHTML="<a href='#'></a>";if(g.firstChild&&typeof g.firstChild.getAttribute!=="undefined"&&g.firstChild.getAttribute("href")!=="#")o.attrHandle.href=function(i){return i.getAttribute("href",2)};g=null})();t.querySelectorAll&&
function(){var g=k,i=t.createElement("div");i.innerHTML="<p class='TEST'></p>";if(!(i.querySelectorAll&&i.querySelectorAll(".TEST").length===0)){k=function(m,p,q,u){p=p||t;m=m.replace(/\=\s*([^'"\]]*)\s*\]/g,"='$1']");if(!u&&!k.isXML(p))if(p.nodeType===9)try{return C(p.querySelectorAll(m),q)}catch(y){}else if(p.nodeType===1&&p.nodeName.toLowerCase()!=="object"){var F=p.getAttribute("id"),M=F||"__sizzle__";F||p.setAttribute("id",M);try{return C(p.querySelectorAll("#"+M+" "+m),q)}catch(N){}finally{F||
p.removeAttribute("id")}}return g(m,p,q,u)};for(var n in g)k[n]=g[n];i=null}}();(function(){var g=t.documentElement,i=g.matchesSelector||g.mozMatchesSelector||g.webkitMatchesSelector||g.msMatchesSelector,n=false;try{i.call(t.documentElement,"[test!='']:sizzle")}catch(m){n=true}if(i)k.matchesSelector=function(p,q){q=q.replace(/\=\s*([^'"\]]*)\s*\]/g,"='$1']");if(!k.isXML(p))try{if(n||!o.match.PSEUDO.test(q)&&!/!=/.test(q))return i.call(p,q)}catch(u){}return k(q,null,null,[p]).length>0}})();(function(){var g=
t.createElement("div");g.innerHTML="<div class='test e'></div><div class='test'></div>";if(!(!g.getElementsByClassName||g.getElementsByClassName("e").length===0)){g.lastChild.className="e";if(g.getElementsByClassName("e").length!==1){o.order.splice(1,0,"CLASS");o.find.CLASS=function(i,n,m){if(typeof n.getElementsByClassName!=="undefined"&&!m)return n.getElementsByClassName(i[1])};g=null}}})();k.contains=t.documentElement.contains?function(g,i){return g!==i&&(g.contains?g.contains(i):true)}:t.documentElement.compareDocumentPosition?
function(g,i){return!!(g.compareDocumentPosition(i)&16)}:function(){return false};k.isXML=function(g){return(g=(g?g.ownerDocument||g:0).documentElement)?g.nodeName!=="HTML":false};var L=function(g,i){for(var n,m=[],p="",q=i.nodeType?[i]:i;n=o.match.PSEUDO.exec(g);){p+=n[0];g=g.replace(o.match.PSEUDO,"")}g=o.relative[g]?g+"*":g;n=0;for(var u=q.length;n<u;n++)k(g,q[n],m);return k.filter(p,m)};c.find=k;c.expr=k.selectors;c.expr[":"]=c.expr.filters;c.unique=k.uniqueSort;c.text=k.getText;c.isXMLDoc=k.isXML;
c.contains=k.contains})();var Za=/Until$/,$a=/^(?:parents|prevUntil|prevAll)/,ab=/,/,Na=/^.[^:#\[\.,]*$/,bb=Array.prototype.slice,cb=c.expr.match.POS;c.fn.extend({find:function(a){for(var b=this.pushStack("","find",a),d=0,e=0,f=this.length;e<f;e++){d=b.length;c.find(a,this[e],b);if(e>0)for(var h=d;h<b.length;h++)for(var l=0;l<d;l++)if(b[l]===b[h]){b.splice(h--,1);break}}return b},has:function(a){var b=c(a);return this.filter(function(){for(var d=0,e=b.length;d<e;d++)if(c.contains(this,b[d]))return true})},
not:function(a){return this.pushStack(ma(this,a,false),"not",a)},filter:function(a){return this.pushStack(ma(this,a,true),"filter",a)},is:function(a){return!!a&&c.filter(a,this).length>0},closest:function(a,b){var d=[],e,f,h=this[0];if(c.isArray(a)){var l,k={},o=1;if(h&&a.length){e=0;for(f=a.length;e<f;e++){l=a[e];k[l]||(k[l]=c.expr.match.POS.test(l)?c(l,b||this.context):l)}for(;h&&h.ownerDocument&&h!==b;){for(l in k){e=k[l];if(e.jquery?e.index(h)>-1:c(h).is(e))d.push({selector:l,elem:h,level:o})}h=
h.parentNode;o++}}return d}l=cb.test(a)?c(a,b||this.context):null;e=0;for(f=this.length;e<f;e++)for(h=this[e];h;)if(l?l.index(h)>-1:c.find.matchesSelector(h,a)){d.push(h);break}else{h=h.parentNode;if(!h||!h.ownerDocument||h===b)break}d=d.length>1?c.unique(d):d;return this.pushStack(d,"closest",a)},index:function(a){if(!a||typeof a==="string")return c.inArray(this[0],a?c(a):this.parent().children());return c.inArray(a.jquery?a[0]:a,this)},add:function(a,b){var d=typeof a==="string"?c(a,b||this.context):
c.makeArray(a),e=c.merge(this.get(),d);return this.pushStack(!d[0]||!d[0].parentNode||d[0].parentNode.nodeType===11||!e[0]||!e[0].parentNode||e[0].parentNode.nodeType===11?e:c.unique(e))},andSelf:function(){return this.add(this.prevObject)}});c.each({parent:function(a){return(a=a.parentNode)&&a.nodeType!==11?a:null},parents:function(a){return c.dir(a,"parentNode")},parentsUntil:function(a,b,d){return c.dir(a,"parentNode",d)},next:function(a){return c.nth(a,2,"nextSibling")},prev:function(a){return c.nth(a,
2,"previousSibling")},nextAll:function(a){return c.dir(a,"nextSibling")},prevAll:function(a){return c.dir(a,"previousSibling")},nextUntil:function(a,b,d){return c.dir(a,"nextSibling",d)},prevUntil:function(a,b,d){return c.dir(a,"previousSibling",d)},siblings:function(a){return c.sibling(a.parentNode.firstChild,a)},children:function(a){return c.sibling(a.firstChild)},contents:function(a){return c.nodeName(a,"iframe")?a.contentDocument||a.contentWindow.document:c.makeArray(a.childNodes)}},function(a,
b){c.fn[a]=function(d,e){var f=c.map(this,b,d);Za.test(a)||(e=d);if(e&&typeof e==="string")f=c.filter(e,f);f=this.length>1?c.unique(f):f;if((this.length>1||ab.test(e))&&$a.test(a))f=f.reverse();return this.pushStack(f,a,bb.call(arguments).join(","))}});c.extend({filter:function(a,b,d){if(d)a=":not("+a+")";return b.length===1?c.find.matchesSelector(b[0],a)?[b[0]]:[]:c.find.matches(a,b)},dir:function(a,b,d){var e=[];for(a=a[b];a&&a.nodeType!==9&&(d===B||a.nodeType!==1||!c(a).is(d));){a.nodeType===1&&
e.push(a);a=a[b]}return e},nth:function(a,b,d){b=b||1;for(var e=0;a;a=a[d])if(a.nodeType===1&&++e===b)break;return a},sibling:function(a,b){for(var d=[];a;a=a.nextSibling)a.nodeType===1&&a!==b&&d.push(a);return d}});var za=/ jQuery\d+="(?:\d+|null)"/g,$=/^\s+/,Aa=/<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/ig,Ba=/<([\w:]+)/,db=/<tbody/i,eb=/<|&#?\w+;/,Ca=/<(?:script|object|embed|option|style)/i,Da=/checked\s*(?:[^=]|=\s*.checked.)/i,fb=/\=([^="'>\s]+\/)>/g,P={option:[1,
"<select multiple='multiple'>","</select>"],legend:[1,"<fieldset>","</fieldset>"],thead:[1,"<table>","</table>"],tr:[2,"<table><tbody>","</tbody></table>"],td:[3,"<table><tbody><tr>","</tr></tbody></table>"],col:[2,"<table><tbody></tbody><colgroup>","</colgroup></table>"],area:[1,"<map>","</map>"],_default:[0,"",""]};P.optgroup=P.option;P.tbody=P.tfoot=P.colgroup=P.caption=P.thead;P.th=P.td;if(!c.support.htmlSerialize)P._default=[1,"div<div>","</div>"];c.fn.extend({text:function(a){if(c.isFunction(a))return this.each(function(b){var d=
c(this);d.text(a.call(this,b,d.text()))});if(typeof a!=="object"&&a!==B)return this.empty().append((this[0]&&this[0].ownerDocument||t).createTextNode(a));return c.text(this)},wrapAll:function(a){if(c.isFunction(a))return this.each(function(d){c(this).wrapAll(a.call(this,d))});if(this[0]){var b=c(a,this[0].ownerDocument).eq(0).clone(true);this[0].parentNode&&b.insertBefore(this[0]);b.map(function(){for(var d=this;d.firstChild&&d.firstChild.nodeType===1;)d=d.firstChild;return d}).append(this)}return this},
wrapInner:function(a){if(c.isFunction(a))return this.each(function(b){c(this).wrapInner(a.call(this,b))});return this.each(function(){var b=c(this),d=b.contents();d.length?d.wrapAll(a):b.append(a)})},wrap:function(a){return this.each(function(){c(this).wrapAll(a)})},unwrap:function(){return this.parent().each(function(){c.nodeName(this,"body")||c(this).replaceWith(this.childNodes)}).end()},append:function(){return this.domManip(arguments,true,function(a){this.nodeType===1&&this.appendChild(a)})},
prepend:function(){return this.domManip(arguments,true,function(a){this.nodeType===1&&this.insertBefore(a,this.firstChild)})},before:function(){if(this[0]&&this[0].parentNode)return this.domManip(arguments,false,function(b){this.parentNode.insertBefore(b,this)});else if(arguments.length){var a=c(arguments[0]);a.push.apply(a,this.toArray());return this.pushStack(a,"before",arguments)}},after:function(){if(this[0]&&this[0].parentNode)return this.domManip(arguments,false,function(b){this.parentNode.insertBefore(b,
this.nextSibling)});else if(arguments.length){var a=this.pushStack(this,"after",arguments);a.push.apply(a,c(arguments[0]).toArray());return a}},remove:function(a,b){for(var d=0,e;(e=this[d])!=null;d++)if(!a||c.filter(a,[e]).length){if(!b&&e.nodeType===1){c.cleanData(e.getElementsByTagName("*"));c.cleanData([e])}e.parentNode&&e.parentNode.removeChild(e)}return this},empty:function(){for(var a=0,b;(b=this[a])!=null;a++)for(b.nodeType===1&&c.cleanData(b.getElementsByTagName("*"));b.firstChild;)b.removeChild(b.firstChild);
return this},clone:function(a){var b=this.map(function(){if(!c.support.noCloneEvent&&!c.isXMLDoc(this)){var d=this.outerHTML,e=this.ownerDocument;if(!d){d=e.createElement("div");d.appendChild(this.cloneNode(true));d=d.innerHTML}return c.clean([d.replace(za,"").replace(fb,'="$1">').replace($,"")],e)[0]}else return this.cloneNode(true)});if(a===true){na(this,b);na(this.find("*"),b.find("*"))}return b},html:function(a){if(a===B)return this[0]&&this[0].nodeType===1?this[0].innerHTML.replace(za,""):null;
else if(typeof a==="string"&&!Ca.test(a)&&(c.support.leadingWhitespace||!$.test(a))&&!P[(Ba.exec(a)||["",""])[1].toLowerCase()]){a=a.replace(Aa,"<$1></$2>");try{for(var b=0,d=this.length;b<d;b++)if(this[b].nodeType===1){c.cleanData(this[b].getElementsByTagName("*"));this[b].innerHTML=a}}catch(e){this.empty().append(a)}}else c.isFunction(a)?this.each(function(f){var h=c(this);h.html(a.call(this,f,h.html()))}):this.empty().append(a);return this},replaceWith:function(a){if(this[0]&&this[0].parentNode){if(c.isFunction(a))return this.each(function(b){var d=
c(this),e=d.html();d.replaceWith(a.call(this,b,e))});if(typeof a!=="string")a=c(a).detach();return this.each(function(){var b=this.nextSibling,d=this.parentNode;c(this).remove();b?c(b).before(a):c(d).append(a)})}else return this.pushStack(c(c.isFunction(a)?a():a),"replaceWith",a)},detach:function(a){return this.remove(a,true)},domManip:function(a,b,d){var e,f,h,l=a[0],k=[];if(!c.support.checkClone&&arguments.length===3&&typeof l==="string"&&Da.test(l))return this.each(function(){c(this).domManip(a,
b,d,true)});if(c.isFunction(l))return this.each(function(x){var r=c(this);a[0]=l.call(this,x,b?r.html():B);r.domManip(a,b,d)});if(this[0]){e=l&&l.parentNode;e=c.support.parentNode&&e&&e.nodeType===11&&e.childNodes.length===this.length?{fragment:e}:c.buildFragment(a,this,k);h=e.fragment;if(f=h.childNodes.length===1?h=h.firstChild:h.firstChild){b=b&&c.nodeName(f,"tr");f=0;for(var o=this.length;f<o;f++)d.call(b?c.nodeName(this[f],"table")?this[f].getElementsByTagName("tbody")[0]||this[f].appendChild(this[f].ownerDocument.createElement("tbody")):
this[f]:this[f],f>0||e.cacheable||this.length>1?h.cloneNode(true):h)}k.length&&c.each(k,Oa)}return this}});c.buildFragment=function(a,b,d){var e,f,h;b=b&&b[0]?b[0].ownerDocument||b[0]:t;if(a.length===1&&typeof a[0]==="string"&&a[0].length<512&&b===t&&!Ca.test(a[0])&&(c.support.checkClone||!Da.test(a[0]))){f=true;if(h=c.fragments[a[0]])if(h!==1)e=h}if(!e){e=b.createDocumentFragment();c.clean(a,b,e,d)}if(f)c.fragments[a[0]]=h?e:1;return{fragment:e,cacheable:f}};c.fragments={};c.each({appendTo:"append",
prependTo:"prepend",insertBefore:"before",insertAfter:"after",replaceAll:"replaceWith"},function(a,b){c.fn[a]=function(d){var e=[];d=c(d);var f=this.length===1&&this[0].parentNode;if(f&&f.nodeType===11&&f.childNodes.length===1&&d.length===1){d[b](this[0]);return this}else{f=0;for(var h=d.length;f<h;f++){var l=(f>0?this.clone(true):this).get();c(d[f])[b](l);e=e.concat(l)}return this.pushStack(e,a,d.selector)}}});c.extend({clean:function(a,b,d,e){b=b||t;if(typeof b.createElement==="undefined")b=b.ownerDocument||
b[0]&&b[0].ownerDocument||t;for(var f=[],h=0,l;(l=a[h])!=null;h++){if(typeof l==="number")l+="";if(l){if(typeof l==="string"&&!eb.test(l))l=b.createTextNode(l);else if(typeof l==="string"){l=l.replace(Aa,"<$1></$2>");var k=(Ba.exec(l)||["",""])[1].toLowerCase(),o=P[k]||P._default,x=o[0],r=b.createElement("div");for(r.innerHTML=o[1]+l+o[2];x--;)r=r.lastChild;if(!c.support.tbody){x=db.test(l);k=k==="table"&&!x?r.firstChild&&r.firstChild.childNodes:o[1]==="<table>"&&!x?r.childNodes:[];for(o=k.length-
1;o>=0;--o)c.nodeName(k[o],"tbody")&&!k[o].childNodes.length&&k[o].parentNode.removeChild(k[o])}!c.support.leadingWhitespace&&$.test(l)&&r.insertBefore(b.createTextNode($.exec(l)[0]),r.firstChild);l=r.childNodes}if(l.nodeType)f.push(l);else f=c.merge(f,l)}}if(d)for(h=0;f[h];h++)if(e&&c.nodeName(f[h],"script")&&(!f[h].type||f[h].type.toLowerCase()==="text/javascript"))e.push(f[h].parentNode?f[h].parentNode.removeChild(f[h]):f[h]);else{f[h].nodeType===1&&f.splice.apply(f,[h+1,0].concat(c.makeArray(f[h].getElementsByTagName("script"))));
d.appendChild(f[h])}return f},cleanData:function(a){for(var b,d,e=c.cache,f=c.event.special,h=c.support.deleteExpando,l=0,k;(k=a[l])!=null;l++)if(!(k.nodeName&&c.noData[k.nodeName.toLowerCase()]))if(d=k[c.expando]){if((b=e[d])&&b.events)for(var o in b.events)f[o]?c.event.remove(k,o):c.removeEvent(k,o,b.handle);if(h)delete k[c.expando];else k.removeAttribute&&k.removeAttribute(c.expando);delete e[d]}}});var Ea=/alpha\([^)]*\)/i,gb=/opacity=([^)]*)/,hb=/-([a-z])/ig,ib=/([A-Z])/g,Fa=/^-?\d+(?:px)?$/i,
jb=/^-?\d/,kb={position:"absolute",visibility:"hidden",display:"block"},Pa=["Left","Right"],Qa=["Top","Bottom"],W,Ga,aa,lb=function(a,b){return b.toUpperCase()};c.fn.css=function(a,b){if(arguments.length===2&&b===B)return this;return c.access(this,a,b,true,function(d,e,f){return f!==B?c.style(d,e,f):c.css(d,e)})};c.extend({cssHooks:{opacity:{get:function(a,b){if(b){var d=W(a,"opacity","opacity");return d===""?"1":d}else return a.style.opacity}}},cssNumber:{zIndex:true,fontWeight:true,opacity:true,
zoom:true,lineHeight:true},cssProps:{"float":c.support.cssFloat?"cssFloat":"styleFloat"},style:function(a,b,d,e){if(!(!a||a.nodeType===3||a.nodeType===8||!a.style)){var f,h=c.camelCase(b),l=a.style,k=c.cssHooks[h];b=c.cssProps[h]||h;if(d!==B){if(!(typeof d==="number"&&isNaN(d)||d==null)){if(typeof d==="number"&&!c.cssNumber[h])d+="px";if(!k||!("set"in k)||(d=k.set(a,d))!==B)try{l[b]=d}catch(o){}}}else{if(k&&"get"in k&&(f=k.get(a,false,e))!==B)return f;return l[b]}}},css:function(a,b,d){var e,f=c.camelCase(b),
h=c.cssHooks[f];b=c.cssProps[f]||f;if(h&&"get"in h&&(e=h.get(a,true,d))!==B)return e;else if(W)return W(a,b,f)},swap:function(a,b,d){var e={},f;for(f in b){e[f]=a.style[f];a.style[f]=b[f]}d.call(a);for(f in b)a.style[f]=e[f]},camelCase:function(a){return a.replace(hb,lb)}});c.curCSS=c.css;c.each(["height","width"],function(a,b){c.cssHooks[b]={get:function(d,e,f){var h;if(e){if(d.offsetWidth!==0)h=oa(d,b,f);else c.swap(d,kb,function(){h=oa(d,b,f)});if(h<=0){h=W(d,b,b);if(h==="0px"&&aa)h=aa(d,b,b);
if(h!=null)return h===""||h==="auto"?"0px":h}if(h<0||h==null){h=d.style[b];return h===""||h==="auto"?"0px":h}return typeof h==="string"?h:h+"px"}},set:function(d,e){if(Fa.test(e)){e=parseFloat(e);if(e>=0)return e+"px"}else return e}}});if(!c.support.opacity)c.cssHooks.opacity={get:function(a,b){return gb.test((b&&a.currentStyle?a.currentStyle.filter:a.style.filter)||"")?parseFloat(RegExp.$1)/100+"":b?"1":""},set:function(a,b){var d=a.style;d.zoom=1;var e=c.isNaN(b)?"":"alpha(opacity="+b*100+")",f=
d.filter||"";d.filter=Ea.test(f)?f.replace(Ea,e):d.filter+" "+e}};if(t.defaultView&&t.defaultView.getComputedStyle)Ga=function(a,b,d){var e;d=d.replace(ib,"-$1").toLowerCase();if(!(b=a.ownerDocument.defaultView))return B;if(b=b.getComputedStyle(a,null)){e=b.getPropertyValue(d);if(e===""&&!c.contains(a.ownerDocument.documentElement,a))e=c.style(a,d)}return e};if(t.documentElement.currentStyle)aa=function(a,b){var d,e,f=a.currentStyle&&a.currentStyle[b],h=a.style;if(!Fa.test(f)&&jb.test(f)){d=h.left;
e=a.runtimeStyle.left;a.runtimeStyle.left=a.currentStyle.left;h.left=b==="fontSize"?"1em":f||0;f=h.pixelLeft+"px";h.left=d;a.runtimeStyle.left=e}return f===""?"auto":f};W=Ga||aa;if(c.expr&&c.expr.filters){c.expr.filters.hidden=function(a){var b=a.offsetHeight;return a.offsetWidth===0&&b===0||!c.support.reliableHiddenOffsets&&(a.style.display||c.css(a,"display"))==="none"};c.expr.filters.visible=function(a){return!c.expr.filters.hidden(a)}}var mb=c.now(),nb=/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
ob=/^(?:select|textarea)/i,pb=/^(?:color|date|datetime|email|hidden|month|number|password|range|search|tel|text|time|url|week)$/i,qb=/^(?:GET|HEAD)$/,Ra=/\[\]$/,T=/\=\?(&|$)/,ja=/\?/,rb=/([?&])_=[^&]*/,sb=/^(\w+:)?\/\/([^\/?#]+)/,tb=/%20/g,ub=/#.*$/,Ha=c.fn.load;c.fn.extend({load:function(a,b,d){if(typeof a!=="string"&&Ha)return Ha.apply(this,arguments);else if(!this.length)return this;var e=a.indexOf(" ");if(e>=0){var f=a.slice(e,a.length);a=a.slice(0,e)}e="GET";if(b)if(c.isFunction(b)){d=b;b=null}else if(typeof b===
"object"){b=c.param(b,c.ajaxSettings.traditional);e="POST"}var h=this;c.ajax({url:a,type:e,dataType:"html",data:b,complete:function(l,k){if(k==="success"||k==="notmodified")h.html(f?c("<div>").append(l.responseText.replace(nb,"")).find(f):l.responseText);d&&h.each(d,[l.responseText,k,l])}});return this},serialize:function(){return c.param(this.serializeArray())},serializeArray:function(){return this.map(function(){return this.elements?c.makeArray(this.elements):this}).filter(function(){return this.name&&
!this.disabled&&(this.checked||ob.test(this.nodeName)||pb.test(this.type))}).map(function(a,b){var d=c(this).val();return d==null?null:c.isArray(d)?c.map(d,function(e){return{name:b.name,value:e}}):{name:b.name,value:d}}).get()}});c.each("ajaxStart ajaxStop ajaxComplete ajaxError ajaxSuccess ajaxSend".split(" "),function(a,b){c.fn[b]=function(d){return this.bind(b,d)}});c.extend({get:function(a,b,d,e){if(c.isFunction(b)){e=e||d;d=b;b=null}return c.ajax({type:"GET",url:a,data:b,success:d,dataType:e})},
getScript:function(a,b){return c.get(a,null,b,"script")},getJSON:function(a,b,d){return c.get(a,b,d,"json")},post:function(a,b,d,e){if(c.isFunction(b)){e=e||d;d=b;b={}}return c.ajax({type:"POST",url:a,data:b,success:d,dataType:e})},ajaxSetup:function(a){c.extend(c.ajaxSettings,a)},ajaxSettings:{url:location.href,global:true,type:"GET",contentType:"application/x-www-form-urlencoded",processData:true,async:true,xhr:function(){return new E.XMLHttpRequest},accepts:{xml:"application/xml, text/xml",html:"text/html",
script:"text/javascript, application/javascript",json:"application/json, text/javascript",text:"text/plain",_default:"*/*"}},ajax:function(a){var b=c.extend(true,{},c.ajaxSettings,a),d,e,f,h=b.type.toUpperCase(),l=qb.test(h);b.url=b.url.replace(ub,"");b.context=a&&a.context!=null?a.context:b;if(b.data&&b.processData&&typeof b.data!=="string")b.data=c.param(b.data,b.traditional);if(b.dataType==="jsonp"){if(h==="GET")T.test(b.url)||(b.url+=(ja.test(b.url)?"&":"?")+(b.jsonp||"callback")+"=?");else if(!b.data||
!T.test(b.data))b.data=(b.data?b.data+"&":"")+(b.jsonp||"callback")+"=?";b.dataType="json"}if(b.dataType==="json"&&(b.data&&T.test(b.data)||T.test(b.url))){d=b.jsonpCallback||"jsonp"+mb++;if(b.data)b.data=(b.data+"").replace(T,"="+d+"$1");b.url=b.url.replace(T,"="+d+"$1");b.dataType="script";var k=E[d];E[d]=function(m){if(c.isFunction(k))k(m);else{E[d]=B;try{delete E[d]}catch(p){}}f=m;c.handleSuccess(b,w,e,f);c.handleComplete(b,w,e,f);r&&r.removeChild(A)}}if(b.dataType==="script"&&b.cache===null)b.cache=
false;if(b.cache===false&&l){var o=c.now(),x=b.url.replace(rb,"$1_="+o);b.url=x+(x===b.url?(ja.test(b.url)?"&":"?")+"_="+o:"")}if(b.data&&l)b.url+=(ja.test(b.url)?"&":"?")+b.data;b.global&&c.active++===0&&c.event.trigger("ajaxStart");o=(o=sb.exec(b.url))&&(o[1]&&o[1].toLowerCase()!==location.protocol||o[2].toLowerCase()!==location.host);if(b.dataType==="script"&&h==="GET"&&o){var r=t.getElementsByTagName("head")[0]||t.documentElement,A=t.createElement("script");if(b.scriptCharset)A.charset=b.scriptCharset;
A.src=b.url;if(!d){var C=false;A.onload=A.onreadystatechange=function(){if(!C&&(!this.readyState||this.readyState==="loaded"||this.readyState==="complete")){C=true;c.handleSuccess(b,w,e,f);c.handleComplete(b,w,e,f);A.onload=A.onreadystatechange=null;r&&A.parentNode&&r.removeChild(A)}}}r.insertBefore(A,r.firstChild);return B}var J=false,w=b.xhr();if(w){b.username?w.open(h,b.url,b.async,b.username,b.password):w.open(h,b.url,b.async);try{if(b.data!=null&&!l||a&&a.contentType)w.setRequestHeader("Content-Type",
b.contentType);if(b.ifModified){c.lastModified[b.url]&&w.setRequestHeader("If-Modified-Since",c.lastModified[b.url]);c.etag[b.url]&&w.setRequestHeader("If-None-Match",c.etag[b.url])}o||w.setRequestHeader("X-Requested-With","XMLHttpRequest");w.setRequestHeader("Accept",b.dataType&&b.accepts[b.dataType]?b.accepts[b.dataType]+", */*; q=0.01":b.accepts._default)}catch(I){}if(b.beforeSend&&b.beforeSend.call(b.context,w,b)===false){b.global&&c.active--===1&&c.event.trigger("ajaxStop");w.abort();return false}b.global&&
c.triggerGlobal(b,"ajaxSend",[w,b]);var L=w.onreadystatechange=function(m){if(!w||w.readyState===0||m==="abort"){J||c.handleComplete(b,w,e,f);J=true;if(w)w.onreadystatechange=c.noop}else if(!J&&w&&(w.readyState===4||m==="timeout")){J=true;w.onreadystatechange=c.noop;e=m==="timeout"?"timeout":!c.httpSuccess(w)?"error":b.ifModified&&c.httpNotModified(w,b.url)?"notmodified":"success";var p;if(e==="success")try{f=c.httpData(w,b.dataType,b)}catch(q){e="parsererror";p=q}if(e==="success"||e==="notmodified")d||
c.handleSuccess(b,w,e,f);else c.handleError(b,w,e,p);d||c.handleComplete(b,w,e,f);m==="timeout"&&w.abort();if(b.async)w=null}};try{var g=w.abort;w.abort=function(){w&&Function.prototype.call.call(g,w);L("abort")}}catch(i){}b.async&&b.timeout>0&&setTimeout(function(){w&&!J&&L("timeout")},b.timeout);try{w.send(l||b.data==null?null:b.data)}catch(n){c.handleError(b,w,null,n);c.handleComplete(b,w,e,f)}b.async||L();return w}},param:function(a,b){var d=[],e=function(h,l){l=c.isFunction(l)?l():l;d[d.length]=
encodeURIComponent(h)+"="+encodeURIComponent(l)};if(b===B)b=c.ajaxSettings.traditional;if(c.isArray(a)||a.jquery)c.each(a,function(){e(this.name,this.value)});else for(var f in a)da(f,a[f],b,e);return d.join("&").replace(tb,"+")}});c.extend({active:0,lastModified:{},etag:{},handleError:function(a,b,d,e){a.error&&a.error.call(a.context,b,d,e);a.global&&c.triggerGlobal(a,"ajaxError",[b,a,e])},handleSuccess:function(a,b,d,e){a.success&&a.success.call(a.context,e,d,b);a.global&&c.triggerGlobal(a,"ajaxSuccess",
[b,a])},handleComplete:function(a,b,d){a.complete&&a.complete.call(a.context,b,d);a.global&&c.triggerGlobal(a,"ajaxComplete",[b,a]);a.global&&c.active--===1&&c.event.trigger("ajaxStop")},triggerGlobal:function(a,b,d){(a.context&&a.context.url==null?c(a.context):c.event).trigger(b,d)},httpSuccess:function(a){try{return!a.status&&location.protocol==="file:"||a.status>=200&&a.status<300||a.status===304||a.status===1223}catch(b){}return false},httpNotModified:function(a,b){var d=a.getResponseHeader("Last-Modified"),
e=a.getResponseHeader("Etag");if(d)c.lastModified[b]=d;if(e)c.etag[b]=e;return a.status===304},httpData:function(a,b,d){var e=a.getResponseHeader("content-type")||"",f=b==="xml"||!b&&e.indexOf("xml")>=0;a=f?a.responseXML:a.responseText;f&&a.documentElement.nodeName==="parsererror"&&c.error("parsererror");if(d&&d.dataFilter)a=d.dataFilter(a,b);if(typeof a==="string")if(b==="json"||!b&&e.indexOf("json")>=0)a=c.parseJSON(a);else if(b==="script"||!b&&e.indexOf("javascript")>=0)c.globalEval(a);return a}});
if(E.ActiveXObject)c.ajaxSettings.xhr=function(){if(E.location.protocol!=="file:")try{return new E.XMLHttpRequest}catch(a){}try{return new E.ActiveXObject("Microsoft.XMLHTTP")}catch(b){}};c.support.ajax=!!c.ajaxSettings.xhr();var ea={},vb=/^(?:toggle|show|hide)$/,wb=/^([+\-]=)?([\d+.\-]+)(.*)$/,ba,pa=[["height","marginTop","marginBottom","paddingTop","paddingBottom"],["width","marginLeft","marginRight","paddingLeft","paddingRight"],["opacity"]];c.fn.extend({show:function(a,b,d){if(a||a===0)return this.animate(S("show",
3),a,b,d);else{d=0;for(var e=this.length;d<e;d++){a=this[d];b=a.style.display;if(!c.data(a,"olddisplay")&&b==="none")b=a.style.display="";b===""&&c.css(a,"display")==="none"&&c.data(a,"olddisplay",qa(a.nodeName))}for(d=0;d<e;d++){a=this[d];b=a.style.display;if(b===""||b==="none")a.style.display=c.data(a,"olddisplay")||""}return this}},hide:function(a,b,d){if(a||a===0)return this.animate(S("hide",3),a,b,d);else{a=0;for(b=this.length;a<b;a++){d=c.css(this[a],"display");d!=="none"&&c.data(this[a],"olddisplay",
d)}for(a=0;a<b;a++)this[a].style.display="none";return this}},_toggle:c.fn.toggle,toggle:function(a,b,d){var e=typeof a==="boolean";if(c.isFunction(a)&&c.isFunction(b))this._toggle.apply(this,arguments);else a==null||e?this.each(function(){var f=e?a:c(this).is(":hidden");c(this)[f?"show":"hide"]()}):this.animate(S("toggle",3),a,b,d);return this},fadeTo:function(a,b,d,e){return this.filter(":hidden").css("opacity",0).show().end().animate({opacity:b},a,d,e)},animate:function(a,b,d,e){var f=c.speed(b,
d,e);if(c.isEmptyObject(a))return this.each(f.complete);return this[f.queue===false?"each":"queue"](function(){var h=c.extend({},f),l,k=this.nodeType===1,o=k&&c(this).is(":hidden"),x=this;for(l in a){var r=c.camelCase(l);if(l!==r){a[r]=a[l];delete a[l];l=r}if(a[l]==="hide"&&o||a[l]==="show"&&!o)return h.complete.call(this);if(k&&(l==="height"||l==="width")){h.overflow=[this.style.overflow,this.style.overflowX,this.style.overflowY];if(c.css(this,"display")==="inline"&&c.css(this,"float")==="none")if(c.support.inlineBlockNeedsLayout)if(qa(this.nodeName)===
"inline")this.style.display="inline-block";else{this.style.display="inline";this.style.zoom=1}else this.style.display="inline-block"}if(c.isArray(a[l])){(h.specialEasing=h.specialEasing||{})[l]=a[l][1];a[l]=a[l][0]}}if(h.overflow!=null)this.style.overflow="hidden";h.curAnim=c.extend({},a);c.each(a,function(A,C){var J=new c.fx(x,h,A);if(vb.test(C))J[C==="toggle"?o?"show":"hide":C](a);else{var w=wb.exec(C),I=J.cur()||0;if(w){var L=parseFloat(w[2]),g=w[3]||"px";if(g!=="px"){c.style(x,A,(L||1)+g);I=(L||
1)/J.cur()*I;c.style(x,A,I+g)}if(w[1])L=(w[1]==="-="?-1:1)*L+I;J.custom(I,L,g)}else J.custom(I,C,"")}});return true})},stop:function(a,b){var d=c.timers;a&&this.queue([]);this.each(function(){for(var e=d.length-1;e>=0;e--)if(d[e].elem===this){b&&d[e](true);d.splice(e,1)}});b||this.dequeue();return this}});c.each({slideDown:S("show",1),slideUp:S("hide",1),slideToggle:S("toggle",1),fadeIn:{opacity:"show"},fadeOut:{opacity:"hide"},fadeToggle:{opacity:"toggle"}},function(a,b){c.fn[a]=function(d,e,f){return this.animate(b,
d,e,f)}});c.extend({speed:function(a,b,d){var e=a&&typeof a==="object"?c.extend({},a):{complete:d||!d&&b||c.isFunction(a)&&a,duration:a,easing:d&&b||b&&!c.isFunction(b)&&b};e.duration=c.fx.off?0:typeof e.duration==="number"?e.duration:e.duration in c.fx.speeds?c.fx.speeds[e.duration]:c.fx.speeds._default;e.old=e.complete;e.complete=function(){e.queue!==false&&c(this).dequeue();c.isFunction(e.old)&&e.old.call(this)};return e},easing:{linear:function(a,b,d,e){return d+e*a},swing:function(a,b,d,e){return(-Math.cos(a*
Math.PI)/2+0.5)*e+d}},timers:[],fx:function(a,b,d){this.options=b;this.elem=a;this.prop=d;if(!b.orig)b.orig={}}});c.fx.prototype={update:function(){this.options.step&&this.options.step.call(this.elem,this.now,this);(c.fx.step[this.prop]||c.fx.step._default)(this)},cur:function(){if(this.elem[this.prop]!=null&&(!this.elem.style||this.elem.style[this.prop]==null))return this.elem[this.prop];var a=parseFloat(c.css(this.elem,this.prop));return a&&a>-1E4?a:0},custom:function(a,b,d){function e(l){return f.step(l)}
var f=this,h=c.fx;this.startTime=c.now();this.start=a;this.end=b;this.unit=d||this.unit||"px";this.now=this.start;this.pos=this.state=0;e.elem=this.elem;if(e()&&c.timers.push(e)&&!ba)ba=setInterval(h.tick,h.interval)},show:function(){this.options.orig[this.prop]=c.style(this.elem,this.prop);this.options.show=true;this.custom(this.prop==="width"||this.prop==="height"?1:0,this.cur());c(this.elem).show()},hide:function(){this.options.orig[this.prop]=c.style(this.elem,this.prop);this.options.hide=true;
this.custom(this.cur(),0)},step:function(a){var b=c.now(),d=true;if(a||b>=this.options.duration+this.startTime){this.now=this.end;this.pos=this.state=1;this.update();this.options.curAnim[this.prop]=true;for(var e in this.options.curAnim)if(this.options.curAnim[e]!==true)d=false;if(d){if(this.options.overflow!=null&&!c.support.shrinkWrapBlocks){var f=this.elem,h=this.options;c.each(["","X","Y"],function(k,o){f.style["overflow"+o]=h.overflow[k]})}this.options.hide&&c(this.elem).hide();if(this.options.hide||
this.options.show)for(var l in this.options.curAnim)c.style(this.elem,l,this.options.orig[l]);this.options.complete.call(this.elem)}return false}else{a=b-this.startTime;this.state=a/this.options.duration;b=this.options.easing||(c.easing.swing?"swing":"linear");this.pos=c.easing[this.options.specialEasing&&this.options.specialEasing[this.prop]||b](this.state,a,0,1,this.options.duration);this.now=this.start+(this.end-this.start)*this.pos;this.update()}return true}};c.extend(c.fx,{tick:function(){for(var a=
c.timers,b=0;b<a.length;b++)a[b]()||a.splice(b--,1);a.length||c.fx.stop()},interval:13,stop:function(){clearInterval(ba);ba=null},speeds:{slow:600,fast:200,_default:400},step:{opacity:function(a){c.style(a.elem,"opacity",a.now)},_default:function(a){if(a.elem.style&&a.elem.style[a.prop]!=null)a.elem.style[a.prop]=(a.prop==="width"||a.prop==="height"?Math.max(0,a.now):a.now)+a.unit;else a.elem[a.prop]=a.now}}});if(c.expr&&c.expr.filters)c.expr.filters.animated=function(a){return c.grep(c.timers,function(b){return a===
b.elem}).length};var xb=/^t(?:able|d|h)$/i,Ia=/^(?:body|html)$/i;c.fn.offset="getBoundingClientRect"in t.documentElement?function(a){var b=this[0],d;if(a)return this.each(function(l){c.offset.setOffset(this,a,l)});if(!b||!b.ownerDocument)return null;if(b===b.ownerDocument.body)return c.offset.bodyOffset(b);try{d=b.getBoundingClientRect()}catch(e){}var f=b.ownerDocument,h=f.documentElement;if(!d||!c.contains(h,b))return d||{top:0,left:0};b=f.body;f=fa(f);return{top:d.top+(f.pageYOffset||c.support.boxModel&&
h.scrollTop||b.scrollTop)-(h.clientTop||b.clientTop||0),left:d.left+(f.pageXOffset||c.support.boxModel&&h.scrollLeft||b.scrollLeft)-(h.clientLeft||b.clientLeft||0)}}:function(a){var b=this[0];if(a)return this.each(function(x){c.offset.setOffset(this,a,x)});if(!b||!b.ownerDocument)return null;if(b===b.ownerDocument.body)return c.offset.bodyOffset(b);c.offset.initialize();var d,e=b.offsetParent,f=b.ownerDocument,h=f.documentElement,l=f.body;d=(f=f.defaultView)?f.getComputedStyle(b,null):b.currentStyle;
for(var k=b.offsetTop,o=b.offsetLeft;(b=b.parentNode)&&b!==l&&b!==h;){if(c.offset.supportsFixedPosition&&d.position==="fixed")break;d=f?f.getComputedStyle(b,null):b.currentStyle;k-=b.scrollTop;o-=b.scrollLeft;if(b===e){k+=b.offsetTop;o+=b.offsetLeft;if(c.offset.doesNotAddBorder&&!(c.offset.doesAddBorderForTableAndCells&&xb.test(b.nodeName))){k+=parseFloat(d.borderTopWidth)||0;o+=parseFloat(d.borderLeftWidth)||0}e=b.offsetParent}if(c.offset.subtractsBorderForOverflowNotVisible&&d.overflow!=="visible"){k+=
parseFloat(d.borderTopWidth)||0;o+=parseFloat(d.borderLeftWidth)||0}d=d}if(d.position==="relative"||d.position==="static"){k+=l.offsetTop;o+=l.offsetLeft}if(c.offset.supportsFixedPosition&&d.position==="fixed"){k+=Math.max(h.scrollTop,l.scrollTop);o+=Math.max(h.scrollLeft,l.scrollLeft)}return{top:k,left:o}};c.offset={initialize:function(){var a=t.body,b=t.createElement("div"),d,e,f,h=parseFloat(c.css(a,"marginTop"))||0;c.extend(b.style,{position:"absolute",top:0,left:0,margin:0,border:0,width:"1px",
height:"1px",visibility:"hidden"});b.innerHTML="<div style='position:absolute;top:0;left:0;margin:0;border:5px solid #000;padding:0;width:1px;height:1px;'><div></div></div><table style='position:absolute;top:0;left:0;margin:0;border:5px solid #000;padding:0;width:1px;height:1px;' cellpadding='0' cellspacing='0'><tr><td></td></tr></table>";a.insertBefore(b,a.firstChild);d=b.firstChild;e=d.firstChild;f=d.nextSibling.firstChild.firstChild;this.doesNotAddBorder=e.offsetTop!==5;this.doesAddBorderForTableAndCells=
f.offsetTop===5;e.style.position="fixed";e.style.top="20px";this.supportsFixedPosition=e.offsetTop===20||e.offsetTop===15;e.style.position=e.style.top="";d.style.overflow="hidden";d.style.position="relative";this.subtractsBorderForOverflowNotVisible=e.offsetTop===-5;this.doesNotIncludeMarginInBodyOffset=a.offsetTop!==h;a.removeChild(b);c.offset.initialize=c.noop},bodyOffset:function(a){var b=a.offsetTop,d=a.offsetLeft;c.offset.initialize();if(c.offset.doesNotIncludeMarginInBodyOffset){b+=parseFloat(c.css(a,
"marginTop"))||0;d+=parseFloat(c.css(a,"marginLeft"))||0}return{top:b,left:d}},setOffset:function(a,b,d){var e=c.css(a,"position");if(e==="static")a.style.position="relative";var f=c(a),h=f.offset(),l=c.css(a,"top"),k=c.css(a,"left"),o=e==="absolute"&&c.inArray("auto",[l,k])>-1;e={};var x={};if(o)x=f.position();l=o?x.top:parseInt(l,10)||0;k=o?x.left:parseInt(k,10)||0;if(c.isFunction(b))b=b.call(a,d,h);if(b.top!=null)e.top=b.top-h.top+l;if(b.left!=null)e.left=b.left-h.left+k;"using"in b?b.using.call(a,
e):f.css(e)}};c.fn.extend({position:function(){if(!this[0])return null;var a=this[0],b=this.offsetParent(),d=this.offset(),e=Ia.test(b[0].nodeName)?{top:0,left:0}:b.offset();d.top-=parseFloat(c.css(a,"marginTop"))||0;d.left-=parseFloat(c.css(a,"marginLeft"))||0;e.top+=parseFloat(c.css(b[0],"borderTopWidth"))||0;e.left+=parseFloat(c.css(b[0],"borderLeftWidth"))||0;return{top:d.top-e.top,left:d.left-e.left}},offsetParent:function(){return this.map(function(){for(var a=this.offsetParent||t.body;a&&!Ia.test(a.nodeName)&&
c.css(a,"position")==="static";)a=a.offsetParent;return a})}});c.each(["Left","Top"],function(a,b){var d="scroll"+b;c.fn[d]=function(e){var f=this[0],h;if(!f)return null;if(e!==B)return this.each(function(){if(h=fa(this))h.scrollTo(!a?e:c(h).scrollLeft(),a?e:c(h).scrollTop());else this[d]=e});else return(h=fa(f))?"pageXOffset"in h?h[a?"pageYOffset":"pageXOffset"]:c.support.boxModel&&h.document.documentElement[d]||h.document.body[d]:f[d]}});c.each(["Height","Width"],function(a,b){var d=b.toLowerCase();
c.fn["inner"+b]=function(){return this[0]?parseFloat(c.css(this[0],d,"padding")):null};c.fn["outer"+b]=function(e){return this[0]?parseFloat(c.css(this[0],d,e?"margin":"border")):null};c.fn[d]=function(e){var f=this[0];if(!f)return e==null?null:this;if(c.isFunction(e))return this.each(function(l){var k=c(this);k[d](e.call(this,l,k[d]()))});if(c.isWindow(f))return f.document.compatMode==="CSS1Compat"&&f.document.documentElement["client"+b]||f.document.body["client"+b];else if(f.nodeType===9)return Math.max(f.documentElement["client"+
b],f.body["scroll"+b],f.documentElement["scroll"+b],f.body["offset"+b],f.documentElement["offset"+b]);else if(e===B){f=c.css(f,d);var h=parseFloat(f);return c.isNaN(h)?f:h}else return this.css(d,typeof e==="string"?e:e+"px")}})})(window);


// ../../../core/lib/jquery.xml2json.js
/*
 ### jQuery XML to JSON Plugin v1.0 - 2008-07-01 ###
 * http://www.fyneworks.com/ - diego@fyneworks.com
 * Dual licensed under the MIT and GPL licenses:
 *   http://www.opensource.org/licenses/mit-license.php
 *   http://www.gnu.org/licenses/gpl.html
 ###
 Website: http://www.fyneworks.com/jquery/xml-to-json/
*//*
 # INSPIRED BY: http://www.terracoder.com/
           AND: http://www.thomasfrank.se/xml_to_json.html
											AND: http://www.kawa.net/works/js/xml/objtree-e.html
*//*
 This simple script converts XML (document of code) into a JSON object. It is the combination of 2
 'xml to json' great parsers (see below) which allows for both 'simple' and 'extended' parsing modes.
*/
// Avoid collisions
;if(window.jQuery) (function($){
 
 // Add function to jQuery namespace
 $.extend({
  
  // converts xml documents and xml text to json object
  xml2json: function(xml, extended) {
   if(!xml) return {}; // quick fail
   
   //### PARSER LIBRARY
   // Core function
   function parseXML(node, simple){
    if(!node) return null;
    var txt = '', obj = null, att = null;
    var nt = node.nodeType, nn = jsVar(node.localName || node.nodeName);
    var nv = node.text || node.nodeValue || '';
    /*DBG*/ //if(window.console) console.log(['x2j',nn,nt,nv.length+' bytes']);
    if(node.childNodes){
     if(node.childNodes.length>0){
      /*DBG*/ //if(window.console) console.log(['x2j',nn,'CHILDREN',node.childNodes]);
      $.each(node.childNodes, function(n,cn){
       var cnt = cn.nodeType, cnn = jsVar(cn.localName || cn.nodeName);
       var cnv = cn.text || cn.nodeValue || '';
       /*DBG*/ //if(window.console) console.log(['x2j',nn,'node>a',cnn,cnt,cnv]);
       if(cnt == 8){
        /*DBG*/ //if(window.console) console.log(['x2j',nn,'node>b',cnn,'COMMENT (ignore)']);
        return; // ignore comment node
       }
       else if(cnt == 3 || cnt == 4 || !cnn){
        // ignore white-space in between tags
        if(cnv.match(/^\s+$/)){
         /*DBG*/ //if(window.console) console.log(['x2j',nn,'node>c',cnn,'WHITE-SPACE (ignore)']);
         return;
        };
        /*DBG*/ //if(window.console) console.log(['x2j',nn,'node>d',cnn,'TEXT']);
        txt += cnv.replace(/^\s+/,'').replace(/\s+$/,'');
								// make sure we ditch trailing spaces from markup
       }
       else{
        /*DBG*/ //if(window.console) console.log(['x2j',nn,'node>e',cnn,'OBJECT']);
        obj = obj || {};
        if(obj[cnn]){
         /*DBG*/ //if(window.console) console.log(['x2j',nn,'node>f',cnn,'ARRAY']);
         if(!obj[cnn].length) obj[cnn] = myArr(obj[cnn]);
         if(obj[cnn].constructor != Array) obj[cnn] = myArr(obj[cnn]);
         obj[cnn][ obj[cnn].length ] = parseXML(cn, true/* simple */);
         obj[cnn].length = obj[cnn].length;
        }
        else{
         /*DBG*/ //if(window.console) console.log(['x2j',nn,'node>g',cnn,'dig deeper...']);
         obj[cnn] = parseXML(cn);
        };
       };
      });
     };//node.childNodes.length>0
    };//node.childNodes
    if(node.attributes){
     if(node.attributes.length>0){
      /*DBG*/ //if(window.console) console.log(['x2j',nn,'ATTRIBUTES',node.attributes])
      att = {}; obj = obj || {};
      $.each(node.attributes, function(a,at){
       var atn = jsVar(at.name), atv = at.value;
       att[atn] = atv;
       if(obj[atn]){
        /*DBG*/ //if(window.console) console.log(['x2j',nn,'attr>',atn,'ARRAY']);
        if(!obj[atn].length) obj[atn] = myArr(obj[atn]);//[ obj[ atn ] ];
        obj[atn][ obj[atn].length ] = atv;
        obj[atn].length = obj[atn].length;
       }
       else{
        /*DBG*/ //if(window.console) console.log(['x2j',nn,'attr>',atn,'TEXT']);
        obj[atn] = atv;
       };
      });
      //obj['attributes'] = att;
     };//node.attributes.length>0
    };//node.attributes
    if(obj){
     obj = $.extend( (txt!='' ? new String(txt) : {}),/* {text:txt},*/ obj || {}/*, att || {}*/);
     txt = (obj.text) ? (typeof(obj.text)=='object' ? obj.text : [obj.text || '']).concat([txt]) : txt;
     if(txt) obj.text = txt;
     txt = '';
    };
    var out = obj || txt;
    //console.log([extended, simple, out]);
    if(extended){
     if(txt) out = {};//new String(out);
     txt = out.text || txt || '';
     if(txt) out.text = txt;
     if(!simple) out = myArr(out);
    };
    return out;
   };// parseXML
   // Core Function End
   // Utility functions
   var jsVar = function(s){ return String(s || '').replace(/-/g,"_"); };
   var isNum = function(s){ return (typeof s == "number") || String((s && typeof s == "string") ? s : '').test(/^((-)?([0-9]*)((\.{0,1})([0-9]+))?$)/); };
   var myArr = function(o){
    if(o.constructor != Array) o = [ o ]; o.length=o.length;
    // here is where you can attach additional functionality, such as searching and sorting...
    return o;
   };
   // Utility functions End
   //### PARSER LIBRARY END
   
   // Convert plain text to xml
   if(typeof xml=='string') xml = $.text2xml(xml);
   
   // Quick fail if not xml (or if this is a node)
   if(!xml.nodeType) return;
   if(xml.nodeType == 3 || xml.nodeType == 4) return xml.nodeValue;
   
   // Find xml root node
   var root = (xml.nodeType == 9) ? xml.documentElement : xml;
   
   // Convert xml to json
   var out = parseXML(root, true /* simple */);
   
   // Clean-up memory
   xml = null; root = null;
   
   // Send output
   return out;
  },
  
  // Convert text to XML DOM
  text2xml: function(str) {
   // NOTE: I'd like to use jQuery for this, but jQuery makes all tags uppercase
   //return $(xml)[0];
   var out;
   try{
    var xml = ($.browser.msie)?new ActiveXObject("Microsoft.XMLDOM"):new DOMParser();
    xml.async = false;
   }catch(e){ throw new Error("XML Parser could not be instantiated") };
   try{
    if($.browser.msie) out = (xml.loadXML(str))?xml:false;
    else out = xml.parseFromString(str, "text/xml");
   }catch(e){ throw new Error("Error parsing XML string") };
   return out;
  }
		
 }); // extend $

})(jQuery);


// ../../../core/lib/jquery.jsonp.js
// jquery.jsonp 2.1.3 (c)2010 Julian Aubourg | MIT License
// http://code.google.com/p/jquery-jsonp/
(function(e,b){function d(){}function t(C){c=[C]}function m(C){f.insertBefore(C,f.firstChild)}function l(E,C,D){return E&&E.apply(C.context||C,D)}function k(C){return/\?/.test(C)?"&":"?"}var n="async",s="charset",q="",A="error",r="_jqjsp",w="on",o=w+"click",p=w+A,a=w+"load",i=w+"readystatechange",z="removeChild",g="<script/>",v="success",y="timeout",x=e.browser,f=e("head")[0]||document.documentElement,u={},j=0,c,h={callback:r,url:location.href};function B(C){C=e.extend({},h,C);var Q=C.complete,E=C.dataFilter,M=C.callbackParameter,R=C.callback,G=C.cache,J=C.pageCache,I=C.charset,D=C.url,L=C.data,P=C.timeout,O,K=0,H=d;C.abort=function(){!K++&&H()};if(l(C.beforeSend,C,[C])===false||K){return C}D=D||q;L=L?((typeof L)=="string"?L:e.param(L,C.traditional)):q;D+=L?(k(D)+L):q;M&&(D+=k(D)+encodeURIComponent(M)+"=?");!G&&!J&&(D+=k(D)+"_"+(new Date()).getTime()+"=");D=D.replace(/=\?(&|$)/,"="+R+"$1");function N(S){!K++&&b(function(){H();J&&(u[D]={s:[S]});E&&(S=E.apply(C,[S]));l(C.success,C,[S,v]);l(Q,C,[C,v])},0)}function F(S){!K++&&b(function(){H();J&&S!=y&&(u[D]=S);l(C.error,C,[C,S]);l(Q,C,[C,S])},0)}J&&(O=u[D])?(O.s?N(O.s[0]):F(O)):b(function(T,S,U){if(!K){U=P>0&&b(function(){F(y)},P);H=function(){U&&clearTimeout(U);T[i]=T[o]=T[a]=T[p]=null;f[z](T);S&&f[z](S)};window[R]=t;T=e(g)[0];T.id=r+j++;if(I){T[s]=I}function V(W){(T[o]||d)();W=c;c=undefined;W?N(W[0]):F(A)}if(x.msie){T.event=o;T.htmlFor=T.id;T[i]=function(){T.readyState=="loaded"&&V()}}else{T[p]=T[a]=V;x.opera?((S=e(g)[0]).text="jQuery('#"+T.id+"')[0]."+p+"()"):T[n]=n}T.src=D;m(T);S&&m(S)}},0);return C}B.setup=function(C){e.extend(h,C)};e.jsonp=B})(jQuery,setTimeout);

// ../../../core/lib/jquery.json-2.2.min.js

(function($){$.toJSON=function(o)
{if(typeof(JSON)=='object'&&JSON.stringify)
return JSON.stringify(o);var type=typeof(o);if(o===null)
return"null";if(type=="undefined")
return undefined;if(type=="number"||type=="boolean")
return o+"";if(type=="string")
return $.quoteString(o);if(type=='object')
{if(typeof o.toJSON=="function")
return $.toJSON(o.toJSON());if(o.constructor===Date)
{var month=o.getUTCMonth()+1;if(month<10)month='0'+month;var day=o.getUTCDate();if(day<10)day='0'+day;var year=o.getUTCFullYear();var hours=o.getUTCHours();if(hours<10)hours='0'+hours;var minutes=o.getUTCMinutes();if(minutes<10)minutes='0'+minutes;var seconds=o.getUTCSeconds();if(seconds<10)seconds='0'+seconds;var milli=o.getUTCMilliseconds();if(milli<100)milli='0'+milli;if(milli<10)milli='0'+milli;return'"'+year+'-'+month+'-'+day+'T'+
hours+':'+minutes+':'+seconds+'.'+milli+'Z"';}
if(o.constructor===Array)
{var ret=[];for(var i=0;i<o.length;i++)
ret.push($.toJSON(o[i])||"null");return"["+ret.join(",")+"]";}
var pairs=[];for(var k in o){var name;var type=typeof k;if(type=="number")
name='"'+k+'"';else if(type=="string")
name=$.quoteString(k);else
continue;if(typeof o[k]=="function")
continue;var val=$.toJSON(o[k]);pairs.push(name+":"+val);}
return"{"+pairs.join(", ")+"}";}};$.evalJSON=function(src)
{if(typeof(JSON)=='object'&&JSON.parse)
return JSON.parse(src);return eval("("+src+")");};$.secureEvalJSON=function(src)
{if(typeof(JSON)=='object'&&JSON.parse)
return JSON.parse(src);var filtered=src;filtered=filtered.replace(/\\["\\\/bfnrtu]/g,'@');filtered=filtered.replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,']');filtered=filtered.replace(/(?:^|:|,)(?:\s*\[)+/g,'');if(/^[\],:{}\s]*$/.test(filtered))
return eval("("+src+")");else
throw new SyntaxError("Error parsing JSON, source is not valid.");};$.quoteString=function(string)
{if(string.match(_escapeable))
{return'"'+string.replace(_escapeable,function(a)
{var c=_meta[a];if(typeof c==='string')return c;c=a.charCodeAt();return'\\u00'+Math.floor(c/16).toString(16)+(c%16).toString(16);})+'"';}
return'"'+string+'"';};var _escapeable=/["\\\x00-\x1f\x7f-\x9f]/g;var _meta={'\b':'\\b','\t':'\\t','\n':'\\n','\f':'\\f','\r':'\\r','"':'\\"','\\':'\\\\'};})(jQuery);

// ../../../core/lib/jquery.listEvents.js
(function($) {
	$.fn.listHandlers = function(events, outputFunction) {
	    return this.each(function(i){
	        var elem = this,
	            dEvents = $(this).data('events');
	        if (!dEvents) {return;}
	        $.each(dEvents, function(name, handler){
	            if((new RegExp('^(' + (events === '*' ? '.+' : events.replace(',','|').replace(/^on/i,'')) + ')$' ,'i')).test(name)) {
	               $.each(handler, function(i,handler){
	                   outputFunction(elem, '\n' + i + ': [' + name + '] : ' + handler );
	               });
	           }
	        });
	    });
	};
})(jQuery);


// ../../../core/lib/iDetector.js
/**
 * @author vebersol
 * @author aavila
 * 2010.07.01
 */

/**
  *
  *
  * Allowed Options:
  *
  * verticalStyles: an Object that contain each allowed device name and an Array with all css required for this device on vertical position.
  * horizontalStyles: an Object that contain each allowed device name and an Array with all css required for this device on vertical position.
  * standardStyles: an Array with all css required for not allowed devices, like common browsers.
  * cssPath: an string with correct path to css.
  * allowedDevices: an Array with allowed devices.
  * linksClassName: a class name for all css added dinamically.
  *
  * Example:
  * var options = {
  *		verticalStyles: {
  *		    ipad: ['ipad.css'],
  * 		iphone: ['iphone.css'],
  *			ipod: ['ipod.css']
  *		},
  *		horizontalStyles: {
  *			ipad: ['hor_ipad.css'],
  *			iphone: ['hor_iphone.css'],
  *			ipod: ['hor_ipod.css']
  *		},
  *		standardStyles: ['common.css'],
  *		cssPath: '../_css/',
  *		allowedDevices: ['ipad', 'ipod', 'iphone'],
  *     linksClassName: 'iDetector'
  *	}
  *
  * var detector = new iDetector(options);
  */

function iDetector(options){
	// on defining allowed devices, ipod MUST come before iphone.
	if (options) {
		this.options = options;
		this.linksClassName = options.linksClassName ? options.linksClassName : 'iDetector';
	}
}

iDetector.prototype = {

	addRotationEvent: function() {
		var _this = this;
		window.onorientationchange = function(){
			_this.defineStyles();
		};

	},

	addStyles: function(filenames) {
		this.removeLinkTags();
		var path = typeof(this.options.cssPath) != "undefined" ? this.options.cssPath : '';

		if (filenames.length > 0) {
		    for (var i = 0; i < filenames.length; i++) {
			    var html = document.createElement('link');
			    html.media = 'screen';
			    html.rel = 'stylesheet';
			    html.type = 'text/css';
			    html.href = path + filenames[i];
			    html.className = this.linksClassName;
			    html.id = filenames[i];

			    var head = document.getElementsByTagName('head')[0];
			    head.appendChild(html);
		    }
		}
	},

	allowedDevices: function() {
		if (!this.options.allowedDevices)
			return ['ipad', 'ipod','iphone','android'];
		else
			return this.options.allowedDevices;
	},

	defineStyles: function() {
		if (this.options) {
			var styles;
			var orientation = this.getOrientation();
			var deviceName = this.getDeviceName();

			if (deviceName && orientation == 0) {
				styles = typeof(this.options.verticalStyles[deviceName]) != "undefined" ? this.options.verticalStyles[deviceName] : this.options.standardStyles;
			}
			else if (deviceName && orientation != 0) {
				styles = typeof(this.options.horizontalStyles[deviceName]) != "undefined" ? this.options.horizontalStyles[deviceName] : this.options.standardStyles;
			}
			else {
				styles = this.options.standardStyles;
			}

			this.addStyles(styles);
		}
		else
			return false;
	},

	detectAgent: function() {
		var devices = this.allowedDevices();
		var agent = this.getAgent();
		for(var i = 0; i < devices.length; i++) {
	        if (agent.search(devices[i]) > 0) {
				return true;
	        }
	    }
		return false;
	},

	getAgent: function() {
		return navigator.userAgent.toLowerCase();
	},

	getDeviceName: function() {
		var devices = this.allowedDevices();
		var agent = this.getAgent();
		for(var i = 0; i < devices.length; i++) {
	        if (agent.search(devices[i]) > 0) {
				return devices[i];
	        }
	    }
		return false;
	},

	getOrientation: function() {
		if (this.getDeviceName() != false) {
			if (typeof(window.orientation) != "undefined")
				return window.orientation;
		}

		return false;
	},

	getOrientationType: function() {
	    var orientation = this.getOrientation();
	    var type = '';
        switch (orientation) {
            case 0 :
			case 180 :
            	type = 'portrait';
            break;
			
            case 90 :
			case -90 :
            	type = 'landscape';
            break;
        }

        return type;
	},

	getSizes: function() {
        var device = this.getDeviceName();
        var devicesSizes = this.defaultSizes();
        var orientationType = this.getOrientationType();

        if (devicesSizes[device]['browser'][orientationType])
            return devicesSizes[device]['browser'][orientationType];
        else
            return false;
	},

	defaultSizes: function() {
        var sizes = {'ipad':
                        {'browser':
                            {'portrait': {'width': 768, 'height': 946},
                            'landscape': {'width': 1024, 'height': 690}}
                        },
                    'iphone':
                        {'browser':
                            {'portrait': {'width': 320, 'height': 356},
                            'landscape': {'width': 480, 'height': 208}}
                        },
                    };
        return sizes;
	},

	removeLinkTags: function() {
		var tags = document.getElementsByTagName('link');
		for (var i = 0; i < tags.length; i++) {
			if (tags[i].className == this.linksClassName) {
				tags[i].parentNode.removeChild(tags[i]);
				i--;
			}
		}
	}

};

// ../../../core/lib/jquery.touchwipe.min.js
/**
 * jQuery Plugin to obtain touch gestures from iPhone, iPod Touch and iPad, should also work with Android mobile phones (not tested yet!)
 * Common usage: wipe images (left and right to show the previous or next image)
 * 
 * @author Andreas Waltl, netCU Internetagentur (http://www.netcu.de)
 * @version 1.1.1 (9th December 2010) - fix bug (older IE's had problems)
 * @version 1.1 (1st September 2010) - support wipe up and wipe down
 * @version 1.0 (15th July 2010)
 */
(function($){$.fn.touchwipe=function(settings){var config={min_move_x:20,min_move_y:20,wipeLeft:function(){},wipeRight:function(){},wipeUp:function(){},wipeDown:function(){},preventDefaultEvents:true};if(settings)$.extend(config,settings);this.each(function(){var startX;var startY;var isMoving=false;function cancelTouch(){this.removeEventListener('touchmove',onTouchMove);startX=null;isMoving=false}function onTouchMove(e){if(config.preventDefaultEvents){e.preventDefault()}if(isMoving){var x=e.touches[0].pageX;var y=e.touches[0].pageY;var dx=startX-x;var dy=startY-y;if(Math.abs(dx)>=config.min_move_x){cancelTouch();if(dx>0){config.wipeLeft()}else{config.wipeRight()}}else if(Math.abs(dy)>=config.min_move_y){cancelTouch();if(dy>0){config.wipeDown()}else{config.wipeUp()}}}}function onTouchStart(e){if(e.touches.length==1){startX=e.touches[0].pageX;startY=e.touches[0].pageY;isMoving=true;this.addEventListener('touchmove',onTouchMove,false)}}if('ontouchstart'in document.documentElement){this.addEventListener('touchstart',onTouchStart,false)}});return this}})(jQuery);

// ../../../core/core/Alias.js

 jQuery.noConflict();

/* Alias for console functions */
function cl(param) {
	try {
		if (arguments.length > 1) {
			console.log(arguments);
		}
		else {
			console.log(param);
		}
		
	}
	catch (e) {}
}

function cd() {
	try {
		console.dir(arguments);
	}
	catch (e) {}
}

function cg() {
	try {
		console.group();
		for (var i = 0; i < arguments.length; i++) {
			console.log(arguments[i]);
		}
		console.groupEnd();
		
	}
	catch (e) {}
}

/**
 * No conflit namespace
 * SAP - Siemens Answers Player
 * SAP.core - core classes
 * SAP.core.mobile - special core classes fot mobile version
 * SAP.components - component classes
 * SAP.component.slide - slide classes for multimedia stories
 * SAP.component.mobile - special component classes for mobile version 
 * SAP.global - global parameters
 * SAP.i - instances
 * SAP.story - multimedia stories
 */
var SAP = {
	core: {
		mobile: {},
		android: {}
	},
	component: {
		slide: {},
		mobile: {},
		android: {}
	}, 
	global: {},
	i: {},
	story: {}
};

var HMI_FEATURE_DEBUG = (HMI_FEATURE_DEBUG || false);


// ../../../core/core/ClientDetect.js

SAP.core.ClientDetect = FixedClass.extend({
	init: function () {
		this.supportedBrowsers = {};
		this.exceptionBrowsers = {};
		this.browser = null;
		this.version = null;
		this.os = null;
		this.osVersion = null;
		this.userAgent = navigator.userAgent.toLowerCase();

		this.config();
		this.setUp();

		this.hasSupport = this.isSupportedClient();
	},

	config: function() {
		this.supportedBrowsers = {
			firefox: {minVersion: 4},
			chrome: {minVersion: 9},
			safari: {minVersion: 5, os: ['mac', 'ipad', 'iphone']},
			opera: {minVersion: 10},
			android: {minVersion: 2}
		};

//		this.exceptionBrowsers = {
//			//chrome: {minVersion: 10, maxVersion:10, os:['windows'], osVersion:['seven']}
//		};
	},

	setUp: function() {
		if (this.userAgent.search('android') != -1) {
			var i = this.userAgent.search('android ');
			this.os = 'android';
			this.browser = 'android';
			this.dimensions = {
				height : screen.height,
				width : screen.width,
				ratio : window.devicePixelRatio
			};
			this.osVersion = parseFloat(this.userAgent.substr((i + 8)));
			this.version = this.osVersion;
		} else {

			if (this.userAgent.search('firefox') != -1) {
				this.browser = 'firefox';
			}
			else if (this.userAgent.search('chrome') != -1) {
				this.browser = 'chrome';
			}
			else if (this.userAgent.search('safari') != -1) {
				this.browser = 'safari';
			}
			else if (this.userAgent.search('opera') != -1) {
				this.browser = 'opera';
			}
			else if (this.userAgent.search('msie') != -1) {
				this.browser = 'msie';
			}

			if (this.userAgent.search('windows') != -1) {
				this.os = 'windows';
				if (this.userAgent.search('windows nt 6.1') != -1) {
					this.osVersion = 'seven';
				}
				else if (this.userAgent.search('windows nt 6.0') != -1) {
					this.osVersion = 'vista';
				}
			}
			else if (this.userAgent.search('linux') != -1) {
				this.os = 'linux';
			}
			else if (this.userAgent.search('ipad') != -1) {
				this.os = 'ipad';
			}
			else if (this.userAgent.search('iphone') != -1) {
				this.os = 'iphone';
			}
			else if (this.userAgent.search('mac') != -1) {
				this.os = 'mac';
			}

			if (this.browser == 'firefox' || this.browser == 'chrome') {
				var i = this.userAgent.search(this.browser+'/');
				this.version = parseFloat(this.userAgent.substr((i + this.browser.length + 1)));
			}
			else if (this.browser == 'safari' || this.browser == 'opera') {
				var i = this.userAgent.search('version/');
				this.version = parseFloat(this.userAgent.substr((i + 8)));
			}
			else if (this.browser == 'msie') {
				var i = this.userAgent.search('msie ');
				this.version = parseFloat(this.userAgent.substr((i + 5)));
			}
		}
	},

	isSupportedClient: function() {
		// if (this.exceptionBrowsers[this.browser]) {
		// 	if (
		// 			 this.exceptionBrowsers[this.browser].minVersion >= this.version &&
		// 			 this.exceptionBrowsers[this.browser].maxVersion <= this.version &&
		// 			(this.exceptionBrowsers[this.browser].os && jQuery.inArray(this.os, this.exceptionBrowsers[this.browser].os) != -1) &&
		// 			(this.exceptionBrowsers[this.browser].osVersion && jQuery.inArray(this.osVersion, this.exceptionBrowsers[this.browser].osVersion) != -1)
		// 	) {
		// 		return false;
		// 	}
		// }

		if (this.supportedBrowsers[this.browser] && this.supportedBrowsers[this.browser].minVersion <= this.version) {
			if (this.supportedBrowsers[this.browser].os && jQuery.inArray(this.os, this.supportedBrowsers[this.browser].os) == -1) {
				return false;
			}
			return true;
		}
		return false;
	}

});

// ../../../core/core/XML.js

SAP.core.XML = FixedClass.extend({
	init: function(file, hasLanguage) {
		this.file = file;
		this.hasLanguage = (hasLanguage || false);
	},
	
	load: function(callback) {
		var path = SAP.global.paths.xml;
		
		if (this.hasLanguage) {
			path = SAP.global.language +' / '+ SAP.global.paths.xml +  '/';
		}
		
		path = '';
		
		jQuery.get(path + this.file, function(xml) {
			callback(jQuery.xml2json(xml));
		});
	}
});

// ../../../core/core/StringBuffer.js

SAP.core.StringBuffer = FixedClass.extend({
	
	init: function() {
		this.buffer = [];
	},
	
	append: function(str) {
		this.buffer.push(str);
	},
	
	getString: function() {
		var str = this.buffer.join("");
		this.clear();
		return str;
	},
	
	clear: function() {
		this.buffer = [];
	}

});

// ../../../core/core/Util.js

SAP.core.Util = FixedClass.extend({
	init: function () {
	},
	
	getRandom: function(notStartParam) {
		
		var paramSeparator = notStartParam ? '&' : '?';
		
		if (HMI_FEATURE_DEBUG) {
			return paramSeparator + Math.random().toString().replace('0.', '');
		}
		
		return '';
	},
	
	getHash: function(n) {
		var hash = window.location.hash.toString().split('/');
		if (!isNaN(n)) {
			return (hash[n]) ? hash[n] : null;
		}
		return hash;
	},
	
	setHash: function(query) {
		if (query) {
			window.location.hash = '/' + (query || '');
		}
		else {
			window.location.hash = '';
		}
	},
	
	getLanguage: function() {
		return HMI_FEATURE_LANG;
	},
	
	formatData: function(data, filter) {
		if (data && !jQuery.isArray(data.story)) {
			data.story = jQuery.makeArray(data.story);
		}
		
		SAP.global.footer = {};
		if (data && data.footer) {
			SAP.global.footer = data.footer;
		}
		
		var removeStory = [];
		
		for (var i = 0; i < data.story.length; i++) {
			if (filter && data.story[i].version && data.story[i].version.search(filter) == -1) {
				//removeStory.push(i);
				data.story[i].type = 'disabled';
				continue;
			}
			
			if (data.story[i].links) {
				data.story[i].links = data.story[i].links.link;
			}
			
			if (data.story[i].author.links) {
				data.story[i].author.links = data.story[i].author.links.link;
			}
			
			if (data.story[i].type == 'video') {
				if (data.story[i].videos.video.length >= 2) {
					for (var j = 0; j < data.story[i].videos.video.length; j++) {
						data.story[i].videos.video[j].files = data.story[i].videos.video[j].files.file;
						
						for (var k = 0; k < data.story[i].videos.video[j].files.length; k++) {
							data.story[i].videos.video[j].files[k] = data.story[i].videos.video[j].files[k];
						}
						
						if (!data.story[i].videos.video[j].label) {						
							if (data.story[i].videos.video[j].type == 'hd') {
								data.story[i].videos.video[j].label = '720p (HD)';
							} 
							else {
								data.story[i].videos.video[j].label = '480p';
							}
						}

						if (data.story[i].videos.video[j].subtitle) {
							data.story[i].videos.video[j].subtitle = data.story[i].videos.video[j].subtitle;
						}
					}
				
					data.story[i].videos = data.story[i].videos.video;
				} 
				else {
					var videoFiles = data.story[i].videos.video;
					var arrFiles = [];
			
					data.story[i].videos = [videoFiles];
					
					for (var l = 0; l < videoFiles.files.file.length; l++) {
						arrFiles.push(videoFiles.files.file[l]); 
					}
					
					data.story[i].videos[0].files = arrFiles;
					
					delete data.story[i].videos[0].files.file;
								
					if (data.story[i].videos[0].type == 'hd') {
						data.story[i].videos[0].label = '720p (HD)';
					} else {
						data.story[i].videos[0].label = '480p';
					}
					
					if (data.story[i].videos[0].files.subtitle)
						data.story[i].videos[0].files.subtitle = data.story[i].videos[0].files.subtitle;
				}
			} 
			else if (data.story[i].type == 'gallery' || data.story[i].type == 'multimedia') {
				if (jQuery.isArray(data.story[i].slides)) {
					if (filter) {
						for (var j = 0; j < data.story[i].slides.length; j++) {
							if (data.story[i].slides[j].version && data.story[i].slides[j].version.search(filter) != -1) {
								data.story[i].slides = data.story[i].slides[j].slide;
								break;
							}
						}
					}
					else {
						data.story[i].slides = data.story[i].slides[0].slide;
					}
				}
				else {
					data.story[i].slides = data.story[i].slides.slide;
				}
			}
		}
		
		for (var i = 0; i < removeStory.length; i++) {
			data.story.splice(removeStory[i], 1);
		}
		
		return data;
	},
	
	relateComments: function(data) {
		for (var i = 0; i < data.story.length; i++) {
			data.story[i].comments = this.getCommentsFromStory(data.socialMedias.story, data.story[i].socialMediaName);
		}
		
		return data;
	},
	
	getCommentsFromStory: function(comments, socialMediaName) {
		for (var i = 0; i < comments.length; i++) {
			if (comments[i].name == socialMediaName) {
				 return comments[i];
			}
		}
		return false;
	},
	
	inArray: function(needle, haystack, argStrict) {
    	var key = '',
		strict = !! argStrict;

	    if (strict) {
	        for (key in haystack) {
	            if (haystack[key] === needle) {
	                return true;
	            }
	        }
	    } else {
	        for (key in haystack) {
	            if (haystack[key] == needle) {
	                return true;
	            }
	        }
	    }
	
	    return false;
	},
	
	round5: function(x) {
		return (x % 5) >= 2.5 ? parseInt(x / 5) * 5 + 5 : parseInt(x / 5) * 5;
	},
	
	getSupportedVideo: function(files) {
		if (jQuery.isArray(files)) {
			for (var i = 0; i < files.length; i++) {
				
				if (!files[i]) {
					continue;
				}
				
				var extension = files[i].split('.').pop();
				
				if (SAP.i.client.browser == 'firefox' || SAP.i.client.browser == 'chrome') {
					if (extension == 'webm') {
						return files[i];
					}
					else if (extension == 'ogg') {
						return files[i];
					}
				}
				else if (SAP.i.client.os == 'iphone' && extension == 'm4v') {
					return files[i];
				}
				else if (extension == 'mp4' || extension == 'mp3') {
					return files[i];
				}
				
			}
		}
		else {
			return files;
		}
	},
	
	getNormalVideoId: function(data) {
		if (data && data.videos) {
			if (jQuery.isArray(data.videos)) {
				for (var i = 0; i < data.videos.length; i++) {
					if (data.videos[i].type == 'normal') {
						return data.videos[i].id;
					}
				}
				return data.videos[0].id;
			}
			else {
				return data.videos.id;
			}
		}
		return '';
	},
	
	
	getStoryById: function(id, stories) {
		for (var j = 0; j < stories.length; j++) {
			var currentItem = stories[j];
			if (stories[j].type == 'video') {
				if (stories[j].videos) {
					if (jQuery.isArray(stories[j].videos)) {
						for (var k = 0; k < stories[j].videos.length; k++) {
							if (stories[j].videos[k].id == id) {
								return currentItem;
							}
						}
					}
				}
			}
			else if (currentItem.id == id) {
				return currentItem;
			}
		}
	},
	
	openWindow: function(url, target, appMethod) {
		SAP.i.eventBus.fireEvent('WindowOpenedEvent');
		
		target = (target || null);
		if (SAP.global.app) {
			switch (appMethod) {
				case 'mailto' :
					document.location = 'myapp::mailto::'+ url;
				break;
				
				case 'share-twitter' :
				case 'share-facebook' :
				case 'share-youtube' :
				default :
					document.location = 'myapp::open-browser::' + url;
				break;
			}
			
		}
		else {
			window.open(url, target);
		}
	},
	
	truncate: function(text, length) {
		if (text.length > length) {
			text = text.substring(0, length);
			text = text.replace(/\w+$/, '');
			text = text + '...';
		}
		
		return text;
	},
	
	copyToClipboard: function(str) {
		if (SAP.global.app) {
			document.location = 'myapp::copy-to-clipboard::'+ str;
		}
	},
	
	checkEmail: function(str) {
		
		if (!str || typeof(str) != 'string') {
			return false;
		}
		
		var filter = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
		return filter.test(str);
		
	},
	
	isOnline: function() {
		if (SAP.global.app) {
			return HMI_FEATURE_IS_ONLINE;
		}
		else {
			return true;
		}
	},
	
	isFavorite: function() {
		if (SAP.global.app) {
			return HMI_FEATURE_FAVORITE;
		}
		else {
			return false;
		}
	},
	
	resizeImage: function(element, width, height, fixedTop) {
		if (element.is(':visible')) {
			element.css({
				'width': 'auto',
				'height': 'auto'
			});
			
			
			if (element.width() > element.height()) {
				element.css('height', '100%');
			}
			else {
				element.css('width', '100%');
			}
			
			if (element.width() > width) {
				element.css('margin-left', -(element.width() / 2) + 'px');
				element.css('left', '50%');
			}
			else {
				element.css({
					height: 'auto',
					width: '100%',
					marginLeft: 0,
					left: 0
				});
			}
			
			
			if (element.height() > height && !fixedTop) {
				element.css('margin-top', -(element.height() / 2) + 'px');
				element.css('top', '50%');
			}
			else if (element.height() > height && fixedTop) {
				element.css({
					marginTop: 0,
					top: 0
				});
			}
			else if (element.height() == height) {
				element.css({
					height: '100%',
					width: 'auto',
					marginTop: 0,
					top: 0
				});
			}
			else {
				element.css({
					height: '100%',
					width: 'auto',
					marginTop: 0,
					top: 0
				});
				
				var dif = width - element.width();
				if (dif < 0) {
					element.css('left', dif +'px');
				}
			}
		}
	},
	
	stringBuffer: function() {
		return new SAP.core.StringBuffer();
	},
	
	enableDone: function() {
		if (SAP.global.app && !SAP.global.dev) {
			document.location = 'myapp::enableDone';
		}
	},
	
	iOSConfirm: function(config) {
		document.location = 'myapp::confirm::' + jQuery.toJSON(config);
	},
	
	formatTime: function(time) {
		var minutes = Math.floor(time / 60);
		var seconds = Math.round(time - (minutes * 60));

		if (seconds == 60) {
			seconds = 0;
			minutes = minutes + 1;			
		}

		if (seconds < 10)
			seconds = "0" + seconds;

		return minutes + ":" + seconds;
	},
	
	parseLinks: function(text) {
		var regexp = /((ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?)/gi;
		return text.replace(regexp,'<a href="$1">$1</a>');
	},

	// Returns an array index based in the percentage of each element.
	// Example: [0.4, 0.3, 0.2, 0.1]
	// It means that the first element has a 40% chance of being randomly chosen.
	randPct: function(a, func) {
		var ceil = 0,
			floor = 0,
			list = func? a.map(func) : a,
			total = this.reduce(list, function(a, b) { return a + b; }),
			rand = Math.random() * total;

		for (var i=0, len=list.length; i<len; i++){
			floor = ceil;
			ceil = floor+list[i];

			if (rand>=floor && rand<ceil) return i;
		}
	},

	//Array.reduce polyfill implementation due to GLORIOUS, MAGNIFICENT prototype.js overwriting native reduce method
	//source: developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/Reduce
	reduce: function(arr, callback, opt_initialValue){
	    'use strict';
		var array = arr;
	    if (null === array || 'undefined' === typeof array) {
	      // At the moment all modern browsers, that support strict mode, have
	      // native implementation of arrayay.prototype.reduce. For instance, IE8
	      // does not support strict mode, so array check is actually useless.
	      throw new TypeError(
	          'arrayay.prototype.reduce called on null or undefined');
	    }
	    if ('function' !== typeof callback) {
	      throw new TypeError(callback + ' is not a function');
	    }
	    var index, value,
	        length = array.length >>> 0,
	        isValueSet = false;
	    if (2 < arguments.length) {
	      value = opt_initialValue;
	      isValueSet = true;
	    }
	    for (index = 0; length > index; ++index) {
	      if (array.hasOwnProperty(index)) {
	        if (isValueSet) {
	          value = callback(value, array[index], index, array);
	        }
	        else {
	          value = array[index];
	          isValueSet = true;
	        }
	      }
	    }
	    if (!isValueSet) {
	      throw new TypeError('Reduce of empty array with no initial value');
	    }
	    return value;
	},

	isMobile: function () {
		return !!navigator.userAgent.match(/Mobile/);
	},

	moveArrayItens: function (array, old_index, new_index) {
	    if (new_index >= array.length) {
	        var k = new_index - array.length;
	        while ((k--) + 1) {
	            array.push(undefined);
	        }
	    }
	    array.splice(new_index, 0, array.splice(old_index, 1)[0]);
	    return array;
	},


});

// ../../../core/core/Tracking.js

var ste = ste || false;

SAP.core.Tracking = FixedClass.extend({
	init: function () {
		this.config = jQuery.extend({
			id: 'answers',
			format: 'html5',
			lang: 'en',
			type: 'feature',
			path: '',
		}, HMI_FEATURE_STE_CONFIG);
	},
	
	getPath: function() {
		if (!SAP.i.util.isOnline()) return;
		return window.location.hash.toString().replace('#', '');
	},
	
	updateId: function() {
		this.config.id = (HMI_FEATURE_STE_CONFIG.id || 'answers');
		this.config.vid = HMI_FEATURE_STE_CONFIG.vid;
	},
	
	debug: function(name, o) {
		var elem = jQuery('#sap-track-debugger');
		if (elem.length) {
			elem.append('<p><strong>'+ name +':</strong><br />'+ jQuery.toJSON(o) +'</p>');
			elem[0].scrollTop = elem[0].scrollHeight;
		}
		
	},
	
	/**
	 * Track pages
	 * @param {String} name - name of current 'page' - Required
	 */
	page: function(name, path, id) {
		if (!SAP.i.util.isOnline()) return;
		
		
		if (id) {
			this.config.id = (id || 'answers');
		}
		else {
			this.updateId();
		}
		
		path = path || '';
		var o = {type:this.config.type, format:this.config.format, id:this.config.id, lang:this.config.lang, path:path, name:name, vid: this.config.vid};
		cl('Tracking.page', o);
		this.debug('ste.feature.page', o);
		if (ste) {
			ste.feature.page(o);
		}
	},
	
	/**
	 * Track links
	 * @param {String} url - full or relative URL (relative to html) of current link - Required
	 * @param {String} name - name of current link, if name is present the url will not be shown in OMTR
	 */
	link: function(url, path, id) {
		if (!SAP.i.util.isOnline()) return;
		this.updateId();
		path = path || '';
		id = id || this.config.id;
		cl('Tracking.link', {type:this.config.type, format:this.config.format, id:id, lang:this.config.lang, path:path, url:url, vid: this.config.vid});
		var o = {type:this.config.type, format:this.config.format, id:id, lang:this.config.lang, path:path, url:url, vid: this.config.vid};
		this.debug('ste.feature.link', o);
		if (ste) {
			ste.feature.link(o);
		}
	},
	
	/**
	 * Track newsletter
	 * @param {String} url - url to newsletter if Opt-In form is hosted externally; no conversion will be recorded for the feature
	 * @param {String} name - name of newsletter
	 */
	optin: function(url, name, path, id) {
		if (!SAP.i.util.isOnline()) return;
		
		if (id) {
			this.config.id = (id || 'answers');
		}
		else {
			this.updateId();
		}
		
		name = name || '';
		path = path || '';
		url = url || '';
		cl('Tracking.optin', {type:this.config.type, format:this.config.format, id:this.config.id, lang:this.config.lang, path:path, name:name, vid: this.config.vid});
		var o = {type:this.config.type, format:this.config.format, id:this.config.id, lang:this.config.lang, path:path, name:name, vid: this.config.vid};
		this.debug('ste.feature.optin', o);
		if (ste) {
			ste.feature.optin(o);
		}
	},
	
	/**
	 * Track forms
	 * @param {String} url - url to contactform if it is hosted externally; no conversion will be recorded for the feature
	 * @param {String} name - name of contact-form
	 */
	contactform: function(url, name, path) {
		if (!SAP.i.util.isOnline()) return;
		this.updateId();
		name = name || '';
		path = path || '';
		url = url || '';
		cl('Tracking.contactform', {type:this.config.type, format:this.config.format, id:this.config.id, lang:this.config.lang, path:path, url:url, name:name, vid: this.config.vid});
		var o = {type:this.config.type, format:this.config.format, id:this.config.id, lang:this.config.lang, path:path, url:url, name:name, vid: this.config.vid};
		this.debug('ste.feature.contactform', o);
		if (ste) {
			ste.feature.contactform(o);
		}
	},
	
	/**
	 * Track forms
	 * @param {String} url - url to contactform if it is hosted externally; no conversion will be recorded for the feature
	 * @param {String} name - name of contact-form with high value
	 */
	contactform_h: function(url, name) {
		if (!SAP.i.util.isOnline()) return;
		this.updateId();
		name = name || '';
		url = url || '';
		cl('Tracking.contactform_h', {type:this.config.type, format:this.config.format, id:this.config.id, lang:this.config.lang, path:'', url:url, name:name, vid: this.config.vid});
		var o = {type:this.config.type, format:this.config.format, id:this.config.id, lang:this.config.lang, path:'', url:url, name:name, vid: this.config.vid};
		this.debug('ste.feature.contactform_h', o);
		if (ste) {
			ste.feature.contactform_h(o);
		}
	},
	
	/**
	 * Track RSS
	 * @param {String} name - name of RSS
	 */
	rss: function(name) {
		if (!SAP.i.util.isOnline()) return;
		this.updateId();
		name = name || '';
		cl('Tracking.rss', {type:this.config.type, format:this.config.format, id:this.config.id, lang:this.config.lang, path:'', name:name, vid: this.config.vid});
		var o = {type:this.config.type, format:this.config.format, id:this.config.id, lang:this.config.lang, path:'', name:name, vid: this.config.vid};
		this.debug('ste.feature.rss', o);
		if (ste) {
			ste.feature.rss(o);
		}
	},
	
	/**
	 * Track share buttons
	 * @param {String} url - full URL - Required
	 * @param {String} name - name of share link
	 */
	share: function(url, name, path) {
		if (!SAP.i.util.isOnline()) return;
		this.updateId();
		name = name || '';
		path = path || '';
		cl('Tracking.share', {type:this.config.type, format:this.config.format, id:this.config.id, lang:this.config.lang, path:path, url:url, name:name, vid: this.config.vid});
		var o = {type:this.config.type, format:this.config.format, id:this.config.id, lang:this.config.lang, path:path, url:url, name:name, vid: this.config.vid};
		this.debug('ste.feature.share', o);
		if (ste) {
			ste.feature.share(o);
		}
	},
	
	/**
	 * Track downloads
	 * @param {String} url - full or relative URL (relative to html) - Required
	 * @param {String} name - name of download, if name is present the url will not be shown in OMTR
	 */
	download: function(url, name) {
		if (!SAP.i.util.isOnline()) return;
		this.updateId();
		name = name || '';
		cl('Tracking.download', {type:this.config.type, format:this.config.format, id:this.config.id, lang:this.config.lang, path:'', url:url, name:name, vid: this.config.vid});
		var o = {type:this.config.type, format:this.config.format, id:this.config.id, lang:this.config.lang, path:'', url:url, name:name, vid: this.config.vid};
		this.debug('ste.feature.download', o);
		if (ste) {
			ste.feature.download(o);
		}
	},
	
	/**
	 * Track exit
	 * @param {String} url - full URL of exit link - Required
	 * @param {String} name - name of exit link, if name is present the url will not be shown in OMTR
	 */
	exit: function(url, name) {
		if (!SAP.i.util.isOnline()) return;
		this.updateId();
		name = name || '';
		cl('Tracking.exit', {type:this.config.type, format:this.config.format, id:this.config.id, lang:this.config.lang, path:'', url:url, name:name, vid: this.config.vid});
		var o = {type:this.config.type, format:this.config.format, id:this.config.id, lang:this.config.lang, path:'', url:url, name:name, vid: this.config.vid};
		this.debug('ste.feature.exit', o);
		if (ste) {
			ste.feature.exit(o);
		}
	},
	
	/**
	 * Track mailto
	 * @param {String} name - recipients email address and optional subject e.g. user@host?subject=test - Required
	 */
	mailto: function(name) {
		if (!SAP.i.util.isOnline()) return;
		this.updateId();
		cl('Tracking.mailto', {type:this.config.type, format:this.config.format, id:this.config.id, lang:this.config.lang, path:'', name:name, vid: this.config.vid});
		var o = {type:this.config.type, format:this.config.format, id:this.config.id, lang:this.config.lang, path:'', name:name, vid: this.config.vid};
		this.debug('ste.feature.mailto', o);
		if (ste) {
			ste.feature.mailto(o);
		}
	},
	
	/**
	 * Track story
	 * @param {String} name - name of story (if not already clear by Path)
	 */
	listento: function(name) {
		if (!SAP.i.util.isOnline()) return;
		this.updateId();
		name = name || '';
		cl('Tracking.listento', {type:this.config.type, format:this.config.format, id:this.config.id, lang:this.config.lang, path:'', name:name, vid: this.config.vid});
		var o = {type:this.config.type, format:this.config.format, id:this.config.id, lang:this.config.lang, path:'', name:name, vid: this.config.vid};
		this.debug('ste.feature.listento', o);
		if (ste) {
			ste.feature.listento(o);
		}
	},
	
	/**
	 * Track anything else
	 * @param {String} name - any value e.g. 'video_setvolume:75'
	 */
	temptrack: function(name, id) {
		return false;
		
		this.updateId();
		name = name || '';
		id = id || this.config.id;
		cl('Tracking.temptrack', {type:this.config.type, format:this.config.format, id: id, lang:this.config.lang, path:'', name:name, vid: this.config.vid});
		var o = {type:this.config.type, format:this.config.format, id:id, lang:this.config.lang, path:'', name:name, vid: this.config.vid};
		this.debug('ste.feature.temptrack', o);
		if (ste) {
			ste.feature.temptrack(o);
		}
	},
	
	/**
	 * Track video when opened
	 * @param {String} name - the name of the media item - Required
	 * @param {int} length - in seconds - Required
	 * @param {String} playername - name of mediaplayer used
	 */
	videoOpen: function(name, length, playername) {
		if (!SAP.i.util.isOnline()) return;
		this.updateId();
		playername = playername || 'HTML5 Player';
		var o = {type:this.config.type, format:this.config.format, id:this.config.id, lang:this.config.lang, path:'', name:name, length:length, playername:playername, vid: this.config.vid};
		cl('Tracking.videoOpen', o);
		this.debug('ste.feature.video.open', o);
		if (ste) {
			ste.feature.video.open(o);
		}
	},
	
	/**
	 * Track video when played
	 * @param {String} name - the name of the media item - Required
	 * @param {int} offset - offset in seconds, 0 if begin - Required
	 */
	videoPlay: function(name, offset) {
		if (!SAP.i.util.isOnline()) return;
		this.updateId();
		cl('Tracking.videoPlay', {type:this.config.type, format:this.config.format, id:this.config.id, lang:this.config.lang, path:'', name:name, offset:offset, vid: this.config.vid});
		var o = {type:this.config.type, format:this.config.format, id:this.config.id, lang:this.config.lang, path:'', name:name, offset:offset, vid: this.config.vid};
		this.debug('ste.feature.video.play', o);
		if (ste) {
			ste.feature.video.play(o);
		}
	},
	
	/**
	 * Track video when stop
	 * @param {String} name - the name of the media item - Required
	 * @param {int} offset - offset in seconds - Required
	 */
	videoStop: function(name, offset) {
		if (!SAP.i.util.isOnline()) return;
		this.updateId();
		cl('Tracking.videoStop', {type:this.config.type, format:this.config.format, id:this.config.id, lang:this.config.lang, path:'', name:name, offset:offset, vid: this.config.vid});
		var o = {type:this.config.type, format:this.config.format, id:this.config.id, lang:this.config.lang, path:'', name:name, offset:offset, vid: this.config.vid};
		this.debug('ste.feature.video.stop', o);
		if (ste) {
			ste.feature.video.stop(o);
		}
	},
	
	/**
	 * Track video when closed
	 * @param {String} name - the name of the media item - Required
	 */
	videoClose: function(name, data) {
		if (!SAP.i.util.isOnline()) return;
		this.updateId();
		cl('Tracking.videoClose', {type:this.config.type, format:this.config.format, id:this.config.id, lang:this.config.lang, path:'', name:name, vid: this.config.vid});
		var o = {type:this.config.type, format:this.config.format, id:this.config.id, lang:this.config.lang, path:'', name:name, vid: this.config.vid};
		this.debug('ste.feature.video.close', o);
		if (ste) {
			ste.feature.video.close(o);
		}
		
	}
	
});

// ../../../core/core/Main.js
SAP.core.Main = FixedClass.extend({
    init: function() {
        jQuery('body').prepend('<div id="storytelling-body"><div id="storytelling-stage"></div></div>');
        this.timerResizeId = null;
    },

    start: function() {
        var _this = this;

        jQuery('#footer-player').remove();

        SAP.i.idHelper = new SAP.core.IdHelper();
        SAP.i.eventBus = new SAP.core.EventBus();
        SAP.i.detector = new iDetector({});
        SAP.i.effectHelper = new SAP.core.EffectHelper();

        this.createGeneralPreloader();

        SAP.i.playerController = new SAP.core.PlayerController();
        SAP.i.tooltip = new SAP.component.Tooltip();

        this.bindEvents();

        this.loadBackground(function() {
            _this.loadConfig(function() {
                _this.loadXML(function(data) {
                    SAP.i.stage = new SAP.component.Stage('storytelling-stage');
                    //          SAP.i.stage.addComponent(_this.preLoader);
                    SAP.i.stage.onAttach(data);
                });
            });
        });
    },

    createGeneralPreloader: function() {
        SAP.i.preLoader = new SAP.component.PreLoader();
        jQuery('#storytelling-body').append(SAP.i.preLoader.getHTML());
        SAP.i.preLoader.onAttach();
        SAP.i.preLoader.hide();
    },

    loadXML: function(callback) {
        var _this = this;

        var labelsXML = new SAP.core.XML(SAP.global.paths.locale + SAP.global.language + '.xml' + SAP.i.util.getRandom());

        labelsXML.load(function(data) {
            SAP.global.labels = {};

            for (var i = 0; i < data.label.length; i++) {
                SAP.global.labels[data.label[i].id] = data.label[i].value;
            }

            _this.loadStories(callback);
        });
    },

    loadStories: function(callback) {
        var _this = this;
        var url = location.protocol + '//gdata.youtube.com/feeds/api/playlists/' + YT_PLAYLIST_ID + '?v=2&alt=json';

        jQuery.getJSON(url, function(data) {
            _this.preLoader = new SAP.component.ImagePreLoader();
            callback({
                yt: data
            });
        });


    },

    loadBackground: function(callback) {
        var bgXML = new SAP.core.XML(SAP.global.paths.xml + 'background.xml' + SAP.i.util.getRandom());

        bgXML.load(function(data) {
            SAP.global.background = data.background;
            callback();
        });
    },


    loadConfig: function(callback) {
        var cfgXML = new SAP.core.XML(SAP.global.paths.xml + 'urlconfig.xml' + SAP.i.util.getRandom());

        cfgXML.load(function(data) {
            SAP.global.url = data;
            callback();
        });
    },

    bindEvents: function() {
        var _this = this;

        jQuery(window).bind('hashchange', function() {
            SAP.i.eventBus.fireEvent('HashChangedEvent', {
                hash: SAP.i.util.getHash()
            });
        });

        jQuery(window).bind('resize', function() {
            clearTimeout(_this.timerResizeId);
            _this.timerResizeId = setTimeout(function() {
                SAP.i.eventBus.fireEvent('WindowResizedEvent');
            }, 10);

        });

        jQuery(window).bind('orientationchange', function() {
            SAP.i.tooltipMobile.hide();
            SAP.i.eventBus.fireEvent('OrientationChangedEvent', {
                orientation: SAP.i.detector.getOrientationType()
            });
        });
    },

    calculateSize: function() {
        var storytellingBody = jQuery('#storytelling-body');
        var extract = storytellingBody.get(0).className.match(/storytelling-(.)*?-resolution/g);
        var w = jQuery('body').width();
        var className = '';

        if (w <= 800) {
            className = 'storytelling-low-resolution';
        } else if (w <= 1024) {
            className = 'storytelling-small-resolution';
        } else if (w <= 1152) {
            className = 'storytelling-normal-resolution';
        } else if (w <= 1280) {
            className = 'storytelling-medium-resolution';
        } else if (w <= 1680) {
            className = 'storytelling-big-resolution';
        } else {
            className = 'storytelling-high-resolution';
        }

        if (SAP.i.detector.detectAgent()) {
            className += ' ' + SAP.i.client.os + ' ' + SAP.i.client.os + '-' + SAP.i.detector.getOrientationType();
        }

        className += ' storytelling-' + SAP.i.util.getLanguage();

        if (extract) {
            if (extract[0] == className) {
                return null;
            }
            storytellingBody.removeClass(extract[0]);
        }
        storytellingBody.addClass(className);

    }
});


SAP.i.client = new SAP.core.ClientDetect();

if (SAP.i.client.hasSupport) {
    SAP.i.util = new SAP.core.Util();
    SAP.i.track = new SAP.core.Tracking();
    SAP.global = {
        comments: {},
        language: SAP.i.util.getLanguage(),
        paths: {
            img: HMI_FEATURE_PATH + 'img/',
            xml_global: HMI_FEATURE_PATH + 'xml/',
            json_global: HMI_FEATURE_PATH + HMI_FEATURE_JSON_PATH,
            xml: HMI_FEATURE_PATH + HMI_FEATURE_XML_PATH,
            media: HMI_FEATURE_PATH + 'media/',
            root: HMI_FEATURE_PATH,
            locale: HMI_FEATURE_PATH + 'locale/'
        },
        hashName: '#/',
        app: false,
        mobile: SAP.i.util.isMobile(),
        volume: 1,
        timers: {},
        iframe: (typeof(HMI_FEATURE_IFRAME) !== "undefined" ? HMI_FEATURE_IFRAME : false),
        favCallback: function() {}
    };

    var siemensAnswerPlayer = new SAP.core.Main();

    jQuery(document).ready(function() {
        siemensAnswerPlayer.start();
    });
}

// ../../../core/core/EffectHelper.js

SAP.core.EffectHelper = FixedClass.extend({
	init: function() {
		
	},
	
	addEffect: function(elements, name, value) {
		var prefix = this.definePrefix();
		var effectName = prefix + name;
		
		if (elements.length && elements.length > 0) {
			for (var i = 0; i < elements.length; i++) {
				elements[i].style[effectName] = value;
			}
		}
		else {
			elements.style[effectName] = value;
		}
	},
	
	definePrefix: function() {
		var availableBrowsers = this.getAvailableBrowsers();
		
		for (browser in jQuery.browser) {
			if (this.inArray(browser, availableBrowsers)) {
				if (browser == 'mozilla') {
					return 'Moz';
				}
				return 'Webkit';
			}
		}
	},
	
	getAvailableBrowsers: function() {
		return ['mozilla', 'chrome', 'safari'];
	},
	
	inArray: function(value, array) {
		for(var i = 0; i < array.length; i++){
			if(value == array[i]){
				return true;
			}
		}
		return false;
	}
});

// ../../../core/core/Event.js

SAP.core.Event = FixedClass.extend({
	init: function(attributes) {
		this.propagation = true;
		if (attributes) {
			for (var i in attributes) {
				eval('this.' + i + '=attributes[i];');
				var camel = ('get-' + i).replace(/(\-[a-z])/g, function($1){return $1.toUpperCase().replace('-','');});
				eval('this.' + camel + ' = function () { return this.' + i + ' };');
			}	
		}
	},
	
	stopPropagation: function(stop) {
		if (stop === false) {
			this.propagation = true;
		} else {
			this.propagation = false;
		}
	}
});

// ../../../core/core/HandlerRegistration.js

SAP.core.HandlerRegistration = FixedClass.extend({
	init: function(eventBus, eventName, handler) {
		this.eventBus = eventBus;
		this.eventName = eventName;
		this.handler = handler;
	},
	
	removeHandler: function() {
		this.eventBus.removeHandler(this.eventName, this.handler);
	}
});

// ../../../core/core/EventBus.js

SAP.core.EventBus = FixedClass.extend({
	init: function() {
		this.handlersMap = {};
	},
	
	addHandler: function(eventName, handler) {
		var handlers = this.handlersMap[eventName];
		if (!handlers) {
			handlers = [];
			this.handlersMap[eventName] = handlers;
		}
		handlers.push(handler);
		return new SAP.core.HandlerRegistration(this, eventName, handler);
	},
	
	removeHandler: function(eventName, handler) {
		var handlers = this.handlersMap[eventName];
		var pos = -1;
		for (var i = 0; i < handlers.length; i++) {
			if (handlers[i] == handler) {
				pos = i;
				break;
			}
		}
		if (pos >= 0) {
			handlers.splice(i, 1);
		}
	},
	
	fireEvent: function(event, attributes) {
		var _this = this;
		var eventName = event;
		var event = new SAP.core.Event(attributes);
		
		if (this.isEventHandled(eventName)) {
			var handlers = this.handlersMap[eventName];
			//TODO: event bubble
//			for (var i = 0; i < handlers.length; i++) {
//				handlers[i](event);
//			}
			
			for (var i = (handlers.length - 1); i >= 0 ; i--) {
				handlers[i](event);
				if (event.propagation == false) {
					break;
				}
			}
		}
	},
	
	isEventHandled: function(eventName) {
		return this.handlersMap[eventName] && this.handlersMap[eventName].length > 0;
	}
});

// ../../../core/core/IdHelper.js

SAP.core.IdHelper = FixedClass.extend({
	init: function() {
		this.currentId = 0;
	},
	
	getNextId: function() {
		this.currentId++;
//		return 'storytelling_component_' + Math.random().toString().replace('0.', '');
		return 'storytelling_component_' + this.currentId;
	}
});

// ../../../core/core/Component.js

SAP.core.Component = FixedClass.extend({
	init: function(elementId) {
		if (elementId) {
			this.elementId = elementId;
		} else {
			this.elementId = SAP.i.idHelper.getNextId();
		}
		
		this.data = {elementId: this.elementId};
		
		this.components = [];
		this.eventHandlers = [];
		this.util = new SAP.core.Util();
	},
	
	resize: function() {
		// IMPLEMENT
	},
	
	callResize: function() {
		this.resize();
		
		for (var i = 0; i < this.components.length; i++) {
			this.components[i].callResize();
		}
	},
	
	replaceContent: function(html, relativePath) {
		var extract = html.match(/\{(.)*?\}/g);
		
		if (extract && jQuery.isArray(extract)) {
			for (var i = 0; i < extract.length; i++) {
				var name = extract[i].substring(1, extract[i].length - 1);
				try {
					var value = eval('this.data.' + name);
				} 
				catch (e) {
					var value = 'replace content error: '+ e.message;
				}
				html = html.replace(extract[i], value);
			}
		}
		
		if (!relativePath) {
			html = html.replace(/src=\"/g, 'src="'+ SAP.global.paths.root);
			html = html.replace(/poster=\"/g, 'poster="'+ SAP.global.paths.root);
		}
		
		return html;
	},
	
	setAttribute: function(attr, value) {
		this.data[attr] = value;
	},	
	
	attachComponent: function(component) {
		jQuery('#' + this.elementId).append(component.getHTML());
		component.onAttach();
	},
	
	addComponent: function(component) {
		component.parent = this;
		this.components.push(component);
		this.attachComponent(component);
	},
	
	addEventHandler: function(eventName, handler) {
		this.eventHandlers.push(SAP.i.eventBus.addHandler(eventName, handler));
	},
	
	removeEventHandlers: function() {
		while (this.eventHandlers.length > 0) {
			var ev = this.eventHandlers.pop();
			ev.removeHandler();
		}
	},
	
	translate: function(key, arrParam) {
		if (arrParam) {
			var label = (this.data.label && this.data.label[key]
				&& typeof(this.data.label[key]) == 'string') ? this.data.label[key] : SAP.global.labels[key];
				
			for (var i = 0; i < arrParam.length; i++) {
				label = label.replace('{'+i+'}', arrParam[i]);
			}
			
			label.replace(/\[br\]/g, '<br>');
			
			return label;
		}
		
		if (this.data.label && this.data.label[key] && typeof(this.data.label[key]) == 'string') {
			return this.data.label[key].replace(/\[br\]/g, '<br>');
		}
		else if (SAP.global.labels && SAP.global.labels[key]) {
			return SAP.global.labels[key].replace(/\[br\]/g, '<br>');
		}
		
//		return (this.data.label && this.data.label[key]
//			&& typeof(this.data.label[key]) == 'string') ? this.data.label[key] : SAP.global.labels[key];
	},
	
	callOnAttachEvents: function() {
		this.onAttach();
		this.dispachOnAttachComponentEvents();
	},
	
	dispachOnAttachComponentEvents: function() {
		for (var i = 0; i < this.components.length; i++) {
			this.components[i].callOnAttachEvents();
		}
	},
	
	onAttach: function() {
		this.element = jQuery('#' + this.elementId);
	},
	
	callOnDetachEvents: function() {
		this.dispachOnDetachComponentEvents();
		this.onDetach();
	},
	
	dispachOnDetachComponentEvents: function() {
		for (var i = 0; i < this.components.length; i++) {
			this.components[i].callOnDetachEvents();
		}
	},
	
	onDetach: function() {
		this.removeEventHandlers();
		this.element.remove();
	},
	
	getHTML: function() {
		return null;
	}
});

// ../../../core/core/PlayerController.js

SAP.core.PlayerController = FixedClass.extend({
	init: function() {
		this.eventHandlers = [];
		this.player = null;
		this.currentType;

		this.bindHandlers();

		screenLocker = new SAP.component.ScreenLocker();
		this.addComponent(screenLocker);

		this.playerContainer = jQuery('<div class="storytelling-player-container"></div>');
		jQuery('#storytelling-body').prepend(this.playerContainer);

		this.util = new SAP.core.Util();
	},

	addEventHandler: function(eventName, handler) {
		this.eventHandlers.push(SAP.i.eventBus.addHandler(eventName, handler));
	},

	removeEventHandlers: function() {
		while (this.eventHandlers.length > 0) {
			var ev = this.eventHandlers.pop();
			ev.removeHandler();
		}
	},

	attachComponent: function(component) {
		jQuery('body').append(component.getHTML());
		component.onAttach();
	},

	addComponent: function(component) {
		this.attachComponent(component);
	},

	addPlayer: function(component) {
		var _this = this;
		this.playerContainer.css({
			'opacity': 1,
			'z-index': 100
		});

		this.playerContainer.append(component.getHTML());
		component.onAttach();
	},

	switchToVideo: function(data, storiesLength) {
		if (this.player) {
			// this.player.callOnDetachEvents();
			this.player.trackCloseStory(data);
		}

		this.player = new SAP.component.VideoPlayer(data, storiesLength);
		this.addPlayer(this.player);
		this.currentType = 'video';
	},

	bindHandlers: function() {
		var _this = this;

		this.addEventHandler('ItemSelectedEvent', function(ev) {
			SAP.i.preLoader.show();

			var data = ev.getData();
			SAP.global.storyId = data.yt.media$group.yt$videoid.$t;

			jQuery('#toolbar-zone').hide();
			jQuery('#content-zone').hide();
			jQuery('#footer-zone').hide();

			jQuery('#storytelling-body').css({
				height: '100%',
				zIndex: '1000'
			});

			var minHeight = (SAP.i.client.os == 'iphone') ? 320 : 640;

			_this.playerContainer.css({
				'opacity': 0,
				'z-index': -1,
				'min-height': minHeight +'px'
			});

			if (SAP.i.client.os == 'ipad' && SAP.i.client.version == 7) {
				_this.playerContainer.css('height', jQuery(window).height() - 20);
			}

			SAP.i.effectHelper.addEffect(_this.playerContainer, 'Transition', 'opacity 1.2s linear');

			var storiesLength = ev.getStoriesLength();
			if (_this.player) {
				_this.player.hide();
			}

			_this.switchToVideo(data, storiesLength);

			HMI_FEATURE_STE_CONFIG.id = data.yt.media$group.yt$videoid.$t;

			setTimeout(function() {
				jQuery('#storytelling-body').css({
					display: 'block',
					overflow: 'visible'
				});
			}, 100);

		});

		this.addEventHandler('PlayerClosedEvent', function(ev) {
			_this.player = null;

			jQuery('#toolbar-zone').show();
			jQuery('#content-zone').show();
			jQuery('#footer-zone').show();

			_this.util.setHash();

			SAP.i.effectHelper.addEffect(_this.playerContainer, 'Transition', 'none');

			_this.playerContainer.css({
				'opacity': 0,
				'z-index': -1,
				'min-height': '1px'
			});

			jQuery('#storytelling-body').css({
				height: 'auto',
				zIndex: '100'
			});

		});

		this.addEventHandler('WindowResizedEvent', function() {
			if (_this.player) {
				_this.player.callResize();
			}
		});
	}

});

// ../../../core/components/ScreenLocker.js

SAP.component.ScreenLocker =  SAP.core.Component.extend({
	init: function() {
		this.inherited().init();
	},
	
	getHTML: function() {
		var result = this.replaceContent(
			'<div class="storytelling-screen-locker" id="{elementId}"><!-- --></div>'
		);
		
		return result;
	},
	
	show: function() {
		var _this = this;
		
		this.element.css({
			'opacity': 0,
			'z-index': 9999
		});
		
		setTimeout(function() {
			_this.element.css('opacity', 1);
		});
	},
	
	hide: function() {
		var _this = this;

		setTimeout(function() {
			_this.element.css({
				'opacity': 0,
				'z-index': -1
			});
		});
	},
	
	onAttach: function() {
		this.inherited().onAttach();
	}
});

// ../../../core/components/PreLoader.js

SAP.component.PreLoader =  SAP.core.Component.extend({
	init: function() {
		this.inherited().init();
	},
	
	show: function() {
		var _this = this;
		
		this.count = 0;
		
//		if (SAP.i.client.browser == 'firefox') {
//			this.rotate();
//		}
//		else {
//			SAP.i.effectHelper.addEffect(this.icon, 'AnimationName', 'preloader');
//			SAP.i.effectHelper.addEffect(this.icon, 'AnimationDuration', '0.8s');
//			SAP.i.effectHelper.addEffect(this.icon, 'AnimationIterationCount', 'infinite');
//			SAP.i.effectHelper.addEffect(this.icon, 'AnimationTimingFunction', 'linear');
//		}
		
		this.element.css({
			'opacity': 0,
			'z-index': 9998
		});
		
		setTimeout(function() {
			_this.element.css('opacity', 1);
		}, 1000);
	},
	
	rotate: function() {
		var _this = this;
		var elem = this.element.find('img')[0];
		elem.style.MozTransform = 'scale(1) rotate('+this.count+'deg)';
		elem.style.WebkitTransform = 'scale(1) rotate('+this.count+'deg)';
		if (this.count==360) { this.count = 0 }
		this.count+=45;
		setTimeout(function() {
			_this.rotate();
		}, 100);
	},
	
	hide: function() {
		var _this = this;

		setTimeout(function() {
			_this.element.css({
				'opacity': 0,
				'z-index': -1
			});
		}, 1000);
		
//		SAP.i.effectHelper.addEffect(this.icon, 'Animation', 'none');
	},
	
	getHTML: function() {
		var html;
		html  = '<div class="storytelling-pre-loader" id="{elementId}">';
		html +=		'<div class="content">';
//		html +=			(SAP.global.app) ? '<div class="box-img-loading"><img src="'+ SAP.global.paths.img +'preloader_ios.png"/></div><div class="box-loading"><span class="label-loading">'+ this.translate('loading') +'</span><span class="progress">0%</span></div>' : '<img src="img/preloader.png" /><span class="progress"></span>';
		html +=		'</div>';
		html +=	'</div>';
		
		return this.replaceContent(html, SAP.global.app);
	},
	
	setProgress: function(value) {
		this.element.find('.progress').html(value +'%');
	},
	
	onAttach: function() {
		this.inherited().onAttach();
		
		this.icon = this.element.find('img');
		this.progress = this.element.find('.progress');
	}
});

// ../../../core/components/ImagePreLoader.js

SAP.component.ImagePreLoader = SAP.component.PreLoader.extend({
	init: function(images) {
		this.inherited().init();
		
		this.timerId = null;
		
		this.images = (images || []);
		
		
		//this.images = this.images.reverse();
	},
	
	load: function(images, callback) {
		this.show();
		this.progress.html('0%');
		
		this.startFakeProgress();
		
		if (images && images.length > 0) {
			this.images = images;

			this.imagesLoaded = 0;
			this.totalImages = images.length;
			
			var _this = this;
			var imageObjs = [];
			
			for (var i = 0; i < this.images.length; i++) {
				imageObjs[i] = new Image();
				imageObjs[i].src = SAP.global.paths.root + this.images[i];
				imageObjs[i].onload = function(){
					_this.imagesLoaded++;
					clearTimeout(_this.timerId);
					_this.timerId = setTimeout(function() {
						_this.updateLoader(callback);
					}, 500);
					
				};
			}
		}
		else {
			this.updateLoader(callback);
		}
	},
	
	updateLoader: function(callback) {
		var _this = this;
		var percent = parseInt((100 / this.totalImages) * this.imagesLoaded);
		this.stopFakeProgress();
		this.progress.html(percent + '%');
		
		if (this.imagesLoaded == this.totalImages) {
			
			setTimeout(function() {
				if (typeof(callback) == 'function') {
					_this.hide();
					callback.apply();
				} else {
					_this.hide();
				}
			}, 500);
			
			
		}
	},
	
	onAttach: function() {
		this.inherited().onAttach();
		
		if (this.images.length) {
			this.load(this.images);
		}
	},
	
	startFakeProgress: function() {
		var _this = this
		this.videoLoadProgress = parseInt(this.progress.html().replace('%', ''));
		this.progress.html(this.videoLoadProgress + '%');
		this.fakeLoadingIntervalId = setInterval(function() {
			_this.videoLoadProgress += 1;
			_this.progress.html(_this.videoLoadProgress + '%');
			if (_this.videoLoadProgress >= 99) {
				clearInterval(_this.fakeLoadingIntervalId);
			}
		}, 100);
	},
	
	stopFakeProgress: function() {
		clearInterval(this.fakeLoadingIntervalId);
		SAP.i.preLoader.setProgress(100);
	}
});

// ../../../core/components/Stage.js

SAP.component.Stage =  SAP.core.Component.extend({
	init: function(elementId) {
		this.inherited().init(elementId);
		this.topStory = null;
	},
	
//	loadSocialMediaData: function(callback) {
//		var xml = new SAP.core.XML(SAP.global.paths.xml_global + HMI_FEATURE_SOCIAL_MEDIA_FILES.stories + SAP.i.util.getRandom());
//		
//		var _this = this;
//		
//		xml.load(function(data) {
//			_this.data['socialMedias'] = data;
//			_this.data['story'] = _this.util.relateComments(_this.data).story;
//			
//			callback();
//		});
//	},
	
	loadComponents: function() {
		var _this = this;
		this.detailBox = new SAP.component.DetailBox(this.topStory);
		this.addComponent(this.detailBox);
		
		if (this.data.yt.feed.entry.length > 1) {
			this.contentStream = new SAP.component.ContentStream(this.data.yt.feed.entry);
			this.addComponent(this.contentStream);
		}

	},
	
	openPlayer: function() {
		var hashStr = window.location.hash.toString();

		if (hashStr.search(SAP.global.hashName) == 0) {
			var hashArr = hashStr.split('/');
			if (hashArr[1]) {
				for (var i = 0; i < this.data.yt.feed.entry.length; i++) {
					var currentItem = this.data.yt.feed.entry[i];
					if (currentItem.media$group.yt$videoid.$t == hashArr[1]) {
						SAP.i.eventBus.fireEvent('ItemSelectedEvent', {data: {yt:currentItem}, storiesLength: this.data.yt.feed.entry.length});
						return;
					}
				}
			}
		} else {
			SAP.i.eventBus.fireEvent('ItemSelectedEvent', {data: {yt: this.topStory}, storiesLength: this.data.yt.feed.entry.length});
		}
	},
	
	bindHandlers: function() {
		var _this = this;
		
		this.addEventHandler('HashChangedEvent', function(ev){
			if (SAP.i.util.getHash(1)) {
				_this.openPlayer();
			}
			else {
				SAP.i.eventBus.fireEvent('PlayerClosedEvent');
			}
		});

		this.addEventHandler('WindowResizedEvent', function() {
			_this.callResize();
		});
	},
	
	resize: function() {
		siemensAnswerPlayer.calculateSize();
	},
	
	onAttach: function(data) {
		this.inherited().onAttach();
		
		var _this = this;
		
		this.data = jQuery.extend(this.data, data);

		this.topStory = this.data.yt.feed.entry[0];
		SAP.global.storyId = this.topStory.media$group.yt$videoid.$t;
		
		siemensAnswerPlayer.calculateSize();
		
		this.loadComponents();
		this.bindHandlers();

		if (SAP.global.url.starturl || SAP.global.url.closeurl) {
			this.openPlayer();
			jQuery('#storytelling-stage').hide();
		} else {
			setTimeout(function() {
				_this.openPlayer();
			}, 2500);
		}
	}
});

// ../../../core/components/DetailBox.js
SAP.component.DetailBox =  SAP.core.Component.extend({
	init: function(data) {
		this.inherited().init();

		this.data = jQuery.extend(this.data, data);
		this.availableMedias = ['facebook', 'twitter', 'youtube'];

		HMI_FEATURE_STE_CONFIG.id = this.data.nameSpace;

		this.backgrounds = SAP.global.background;
	},

	getHTML: function() {
		var _this = this;
		var storyHash =  SAP.global.hashName + this.data.media$group.yt$videoid.$t;
		
		var href = 'href="' + storyHash + '"';

        if (SAP.global.url.starturl) {
            if (SAP.global.iframe) {
                href = 'href="javascript:;" data-href="' + SAP.global.url.starturl + storyHash + '"';
            } else {
                href = 'href="' + SAP.global.url.starturl + storyHash + '"';
            }
        }

		var authorName = this.data.media$group.media$credit[0].yt$display;
		var storyAuthor = this.translate('storyBy') + ' ' + authorName;
		var arrDate = this.data.media$group.yt$uploaded.$t.substr(0, 10).split('-');
		var date = this.parseISO8601(this.data.media$group.yt$uploaded.$t);

		var month = this.translate('months').split(',');
		var dateStr = month[date.getMonth()] +' '+ date.getDate() +', '+ date.getFullYear();

		var title = this.data.media$group.media$title.$t.replace('Press Conference - ', '').replace('Pressekonferenz - ', '').substr(0, 40);

		var description = this.data.media$group.media$description.$t.substr(0, 120);
		description = SAP.i.util.parseLinks(description);

		var buffer = SAP.i.util.stringBuffer();

		buffer.append('<div id="storytelling-background">');

		for(var i = 0, len = this.backgrounds.length; i < len; i++) {
			buffer.append('	<img id="bg-' + this.backgrounds[i].id + '" src="' + SAP.global.paths.img + this.backgrounds[i].url + '" alt="" />');
		}

		buffer.append('</div>');
		buffer.append('<div class="storytelling-detail-wrapper" id="{elementId}">');
		buffer.append(	'<article class="storytelling-detail-box">');
		buffer.append(		'<header>');
		buffer.append(			'<time>'+ dateStr +'</time>');
		buffer.append(			'<span class="break"><!-- --></span>');
		buffer.append(			'<h1>'+ title +'</h1>');
		buffer.append(		'</header>');
		buffer.append(		'<div class="storytelling-description-story">');
		//buffer.append(			'<p>'+ description +'...</p>');
		buffer.append(			'<a class="info" ' + href + '><span class="storytelling-detail-button-play"></span>'+ storyAuthor + '</a>');
		buffer.append(		'</div>');
		buffer.append(	'</article>');
		buffer.append('</div>');
		buffer.append('<span class="break"><!-- --></span>');

		return this.replaceContent(buffer.getString(), true);
	},

	parseISO8601: function(str) {
		// we assume str is a UTC date ending in 'Z'

		var parts = str.split('T'),
		dateParts = parts[0].split('-'),
		timeParts = parts[1].split('Z'),
		timeSubParts = timeParts[0].split(':'),
		timeSecParts = timeSubParts[2].split('.'),
		timeHours = Number(timeSubParts[0]),
		_date = new Date;

		_date.setUTCFullYear(Number(dateParts[0]));
		_date.setUTCMonth(Number(dateParts[1])-1);
		_date.setUTCDate(Number(dateParts[2]));
		_date.setUTCHours(Number(timeHours));
		_date.setUTCMinutes(Number(timeSubParts[1]));
		_date.setUTCSeconds(Number(timeSecParts[0]));
		if (timeSecParts[1]) _date.setUTCMilliseconds(Number(timeSecParts[1]));

		// by using setUTC methods the date has already been converted to local time(?)
		return _date;
	},

	getButtonAction: function(type) {
		if (type == 'video') {
			return this.translate('watch');
		} else {
			return this.translate('view');
		}
	},

	getInfoReference: function(type) {
		if (type == 'video') {
			return this.translate('filmBy');
		} else {
			return this.translate('storyBy');
		}
	},

	onAttach: function() {
		this.detailBox = jQuery('.storytelling-detail-box');

		this.inherited().onAttach();

		this.img = jQuery('#storytelling-background img');
		this.button = this.element.find('a.storytelling-detail-button');

		this.randomizeBackground();
		this.bindIframeClick();
	},

	bindIframeClick: function () {
		if (SAP.global.iframe) {
            this.element.find('a.info').bind('click', function(ev) {
                ev.preventDefault();

                window.top.location.href = jQuery(this).data('href');
            });
        }
	},

	randomizeBackground: function() {
		var _this = this,
			deeplink = SAP.i.util.getHash(2) || SAP.i.util.getHash(1),
			current = 0;

		if (deeplink) {
			current = this.img.index(jQuery('#bg-' + deeplink));
		} else {
			current = SAP.i.util.randPct(this.backgrounds, function(elem) {
				return elem.pct;
			});
		}

		this.img.not(this.img.eq(current)).fadeTo(0,0);

		setInterval(function() {
			if (deeplink) {
				deeplink = null;
			} else {
				current = SAP.i.util.randPct(
					_this.backgrounds.map(function(elem, i) {
						return i==current? 0 : elem.pct;
					})
				);

				_this.img.not(_this.img.eq(current)).fadeTo(500,0);
				_this.img.eq(current).fadeTo(500,1);
			}
		}, 10000);
	}
});

// ../../../core/components/Layer.js

SAP.component.Layer =  SAP.core.Component.extend({
	init: function(data) {
		this.inherited().init();
		this.data = jQuery.extend(data, this.data);
		
		this.trackName = 'Layer';
	},
	
	getHTML: function() {
		var result = this.replaceContent(
			'<article id="{elementId}" class="storytelling-layer">' +
				'<a href="javascript:;" class="storytelling-layer-close"><span>' + this.translate('close') + '</span></a>' + 
				'<header>' +
					'<h1>Layer Component Title</h1>' +
				'</header>' +
			'</article>'
		);
		
		return result;
	},
	
	open: function(dontTrack) {
		var _this = this;
		
		SAP.i.eventBus.fireEvent('LayerOpeneningEvent', {layer: this});
		
		this.element.removeClass('hidden-layer');
		SAP.i.effectHelper.addEffect(this.element.get(0), 'Transition', 'all 0.5s ease-out');
		
		this.element.css('bottom', this.videoBarHeight + 'px');
		
		setTimeout(function() {
			if (!dontTrack) {
				SAP.i.track.page(_this.trackName, _this.trackPath);
			}
			SAP.i.eventBus.fireEvent('LayerOpenedEvent', {layer: _this});
		}, 499);
	},
	
	close: function(callback) {
		var _this = this;
	
		SAP.i.eventBus.fireEvent('LayerClosingEvent', {layer: this});
		
		this.element.css('bottom', '-'+ (this.element.get(0).offsetHeight + this.videoBarHeight) +'px');
		this.element.addClass('hidden-layer');
		
		if (this.layerName == 'Content Stream Layer') {
			var _this = this;
			var elem = this.element.find('.list-items');

			setTimeout(function() {
				SAP.i.effectHelper.addEffect(elem, 'Transform', 'translateX(0px)');
				elem.css('left', 0);
				_this.contentStream.currentPosition = 0;
			}, 1000);
		}
		
		setTimeout(function() {
			if (typeof(callback) == 'function') {
				callback.apply();
			}
			SAP.i.eventBus.fireEvent('LayerClosedEvent', {layer: _this});
		}, 500);
	},
	
	onAttach: function() {
		var _this = this;
		
		this.videoBarHeight = this.parent.footer.is(':visible') ? this.parent.controlsHeight - 17 : this.parent.controlsHeight;
		
		this.inherited().onAttach();
		
		this.closeButton = this.element.find('.storytelling-layer-close');
		this.closeButton.bind('click', function() {
			_this.close();
		});
		
		var element = this.element[0];

		if(SAP.i.client.os == 'android'){
			var height = SAP.i.client.dimensions.height < SAP.i.client.dimensions.width ? SAP.i.client.dimensions.height : SAP.i.client.dimensions.width;
			jQuery('#storytelling-body').css('height', height + 'px !important');
		}
		
		if (SAP.i.client.os == 'iphone') {
			this.height = (jQuery('#storytelling-body').hasClass('iphone-landscape')) ? 255 : 420;
			this.element.height(this.height);
		}
		else {
			this.height = this.element.innerHeight();
		}
		
		this.element.css('bottom', '-'+ (this.height + this.videoBarHeight) + 'px');
		
		this.bindHandlers();
	},
	
	bindHandlers: function() {
		var _this = this;
		
		this.addEventHandler('OrientationChangedEvent', function(ev){
			if (SAP.i.client.os == 'iphone') {
				_this.height = (ev.orientation == 'landscape') ? 255 : 420;
				_this.element.height(_this.height);
			}
		});
		
	},

	getLayerName: function() {
		return null;
	}
});

// ../../../core/components/ContentStreamLayer.js

SAP.component.ContentStreamLayer = SAP.component.Layer.extend({
	init: function(data) {
		this.inherited().init(data);
		
		this.layerName = 'Content Stream Layer';
		this.trackName = 'stream';
		this.trackPath = 'stream';
		
	},
	
	getHTML: function() {
		var result = this.replaceContent(
			'<article id="{elementId}" class="storytelling-layer storytelling-layer-content-stream">'+
			'	<a href="javascript:;" class="storytelling-layer-close"><span>' + this.translate('close') + '</span></a>'+
			'</article>'
		);
		
		return result;
	},
	
	onAttach: function() {
		this.inherited().onAttach();
		
		this.contentStream = new SAP.component.ContentStream(SAP.i.stage.data.yt.feed.entry, true);
		this.addComponent(this.contentStream);
		
		this.videoBarHeight += 1;
		
		this.element.css('bottom', '-250px');
		
//		var element = this.element[0];
//		this.height += this.contentStream.element.innerHeight();
//		
//		this.element.css('bottom', '-'+ (this.height + this.videoBarHeight) + 'px'); // increases new height
//		
//		if (SAP.i.client.os == 'ipad' || SAP.i.client.os == 'android') {
//			this.element.css('bottom', '-'+ (this.height) + 'px'); // increases new height
//		}
//		SAP.i.effectHelper.addEffect(element, 'Transform', 'translateY(' + (this.height + this.videoBarHeight) + 'px)');

//		if (!SAP.i.detector.detectAgent() || SAP.i.detector.detectAgent() && this.data.type != 'video') {
//			SAP.i.eventBus.fireEvent('ContentSteamLayerAttachedEvent');
//		}
	},
		
	getLayerName: function() {
		return 'contentStreamLayer';
	}
});

// ../../../core/components/InfoLayer.js

SAP.component.InfoLayer = SAP.component.Layer.extend({
	init: function(data) {
		this.inherited().init(data);
		this.layerName = 'Info Layer';
		this.trackName = 'info';
		this.trackPath = 'info';
	},	

	getHTML: function() {
		
		var buffer = SAP.i.util.stringBuffer();
		
		this.data.yt.media$group.media$description.$t = SAP.i.util.parseLinks(this.data.yt.media$group.media$description.$t);
		
		buffer.append('<article id="{elementId}" class="storytelling-layer storytelling-layer-info">');
		buffer.append(	'<a href="javascript:;" class="storytelling-layer-close"><span>' + this.translate('close') + '</span></a>');
		buffer.append(	'<header><hgroup><h1>{yt.title.$t}</h1></hgroup></header>');
		buffer.append(	'<div class="storytelling-layer-content storytelling-layer-content-column-1 ">{yt.media$group.media$description.$t}</div>');
		buffer.append(	'<div class="storytelling-layer-content storytelling-layer-content-column-2">');
		buffer.append(		'<h3>'+ this.translate('category') +':</h3>');
		buffer.append(		'<p>{yt.media$group.media$category[0].label}</p>'); 
		buffer.append(		'<h3>'+ this.translate('tags') +':</h3>');
		buffer.append(		'<p>{yt.media$group.media$keywords.$t}</p>'); 
		buffer.append(		'<h3>'+ this.translate('license') +':</h3>');
		buffer.append(		'<p>'+ this.translate('youtubeLicense') +'</p>'); 
		buffer.append(	'</div>');
		buffer.append('</article>'); 
		
		return this.replaceContent(buffer.getString());
	},
	
	onAttach: function() {
		this.inherited().onAttach();
		
		this.element.css('bottom', '-500px');
		
	},
	
	getLayerName: function() {
		return 'infoLayer';
	}
});

// ../../../core/components/ContentStream.js

var css3 = true; //TODO
SAP.component.ContentStream =  SAP.core.Component.extend({
	init: function(data, fromLayer) {
		this.inherited().init();
		this.fromLayer = (fromLayer || false);
		this.data.items = (data || []);
		this.sensibilityArea = 200;
		this.speedBase = 20;
		
		this.boxItemWidth = 178;
		this.mouseSpeed = 0;
		
		if (this.fromLayer) {
			this.width = jQuery(window).width();
		} 
		else if (SAP.i.client.os == 'iphone') {
			this.width = SAP.i.detector.getSizes().width;
		}
		else {
			this.width = 535;
		}
		
		this.currentPosition = 0;
		this.animateTimer = null;
		this.historyPosition = [];
		
		this.isMobile = (navigator.userAgent.indexOf('Mobile') != -1); //TODO
		
		if ((this.data.items.length * 0.2) < 3) {
			this.transitionTime = (this.data.items.length * 0.2).toFixed(1);
		} else {
			this.transitionTime = 3;
		}
		
	},
	
	initAnimation: function() {
		var _this = this;
		
		if (this.fromLayer) {
			this.stream.css({left: 0});
		}
		else {
			this.stream.animate({left: 0}, 1500);
		}
		
	},
	
	startAnimation: function() {
		if (this.element.width() > this.stream.width()) {
			return false;
		}
		
		this.stopAnimation();
		this.slide(this.mouseSpeed);
		
		var _this = this;
		this.animateTimer = setInterval(function() {
			_this.slide(_this.mouseSpeed);
		}, 30);
	},

	stopAnimation: function() {
		clearInterval(this.animateTimer);
	},
	
	decreaseSpeed: function(pos) {				
		if (css3) {
			var counter = 7;
			pos = this.currentPosition + counter * pos;
		
		
			if (pos < this.width - this.streamWidth) {
				pos = this.width - this.streamWidth;
			} else if (pos > 0) {
				pos = 0;
			}
			
			this.currentPosition = pos;
			this.moveTo(pos);
			
			var _this = this;
			setTimeout(function(){
				_this.stream[0].style.WebkitTransition = 'none';
				_this.stream[0].style.MozTransition = 'none';
			}, 1000);
		} else {
			var initalPos = pos;
			var counter = 5;
			var decreaseNum = pos * counter / 100;
			var timer = null;
			
			var _this = this;
			var move = function() {
				initalPos -= decreaseNum;
				_this.goTo(initalPos);
				if (counter-- <= 0) {
					clearInterval(timer);
				}
			}
			timer = setInterval(move, 30);	
		}
	},
	
	goTo: function(pos) {
		if ((pos < this.width - this.streamWidth) && (this.element.width() < this.stream.width())){
			pos = this.width - this.streamWidth;
		}
		else if (pos > 0) {
			pos = 0;
		}
		
		this.currentPosition = pos;
		this.moveTo(pos);
	},
	
	moveTo: function(pos) {
		this.stream.css({left: pos});
	},
	
	slide: function(pos) {
		pos = pos / this.sensibilityArea * this.speedBase;
		var newPosition = this.currentPosition + pos;
		this.goTo(newPosition);
	},
	
	startCapturing: function() {
		var _this = this;
				
		var execute = function() {
			_this.historyPosition.unshift(_this.currentTouchMove);

			if (_this.historyPosition.length > 10) {
				_this.historyPosition.pop();
			}
		}
		
		_this.capturing = setInterval(execute, 10);
	},
	
	stopCapturing: function() {
		clearInterval(this.capturing);
	},
	
	bindEvents: function() {
		var _this = this;
		
		if (!this.isMobile) {
			
			this.element.find('.list-items .photo').bind('focus', function() {
				var widthLi = jQuery(this).closest('li').outerWidth(true);
				var indexLi = jQuery(this).closest('li').index();
				
				if (jQuery(this).closest('#storytelling-stage').length) {
					var stageElem = jQuery(this).closest('#storytelling-stage');
				}
				else {
					var stageElem = jQuery(this).closest('.storytelling-player-container')
				}
				
				var widthStage = stageElem.width();
				
				if ((widthLi * (indexLi+1)) > widthStage) {
					jQuery(this).closest('ul').css('left', (widthStage - (widthLi * (indexLi+1))));
				}
				else if (indexLi == 0) {
					jQuery(this).closest('ul').css('left', 0);
				}
			});
			
			
			this.stream[0].onmouseover = function(ev) {
				jQuery('.storytelling-detail-button-video').focus();
				_this.startAnimation();
			};

			this.stream[0].onmousemove = function(ev) {
				var x = ev.pageX - parseInt(_this.element.css('left'));

				if (x <= _this.sensibilityArea || x >= (_this.width - _this.sensibilityArea)) {
					if (x < _this.width / 2) {
						_this.mouseSpeed = _this.sensibilityArea - x;
					} else {
						_this.mouseSpeed = (_this.width - x - _this.sensibilityArea);
					}
				} else {
					_this.mouseSpeed = 0;
				}
			};

			this.stream[0].onmouseout = function(ev) {
				_this.stopAnimation();
			};
		}
		
	},
	
	getRoundHistoryPosition: function() {
		var finalPos = 0;
		
		for (i in this.historyPosition) {
			if (typeof(this.historyPosition[i]) == 'number') {
				finalPos += this.historyPosition[i];
			}
		}
				
		return finalPos / this.historyPosition.length;
	},
	
	populateO: function() {
		if (this.data.items.length) {
//			var start = this.fromLayer ? 0 : 1; 
			for (var i = 0; i < this.data.items.length; i++) {
				if (this.data.items[i].id != SAP.global.storyId) {
					var currentItem = this.data.items[i];
					
					if (SAP.global.app && !SAP.i.util.isOnline() && HMI_FEATURE_FAVORITES && jQuery.inArray(currentItem.id, HMI_FEATURE_FAVORITES) == -1) {
						continue;
					}
					
					switch (currentItem.type) {
						case 'video':
							this.addComponent(new SAP.component.VideoBoxItem(currentItem, this.fromLayer));
						break;
					}
				}
			}
		}
	},
	
	populate: function() {
		if (this.data.items.length) {
	
			for (var i = 0; i < this.data.items.length; i++) {
				
				this.addComponent(new SAP.component.VideoBoxItem(this.data.items[i], this.fromLayer));

				// if (this.data.items[i].media$group.yt$videoid.$t != SAP.global.storyId) {
				// 	this.addComponent(new SAP.component.VideoBoxItem(this.data.items[0], this.fromLayer));	
				// }
			}
		}
	},
	
	attachComponent: function(component) {
		var li = document.createElement('li');
		li.innerHTML = component.getHTML();
		li.className = 'panel';
		jQuery('#' + this.elementId + ' .list-items').append(li);
		component.onAttach();
	},
	
	getHTML: function() {
		var result = this.replaceContent(
			'<div class="storytelling-content-stream" id="{elementId}">'+
			'	<div id="wrapper-list-items"><ul class="list-items"></ul></div>'+
			'</div>'
		);
		
		return result;
	},
	
	resize: function() {
		if (this.fromLayer) {
			this.width = jQuery(window).width();
		}
	},
	
	onAttach: function() {
		this.inherited().onAttach();
		
		this.stream = this.element.find('.list-items');
		
		this.populate();
		
		this.boxItemWidth = this.stream.find('li:first').width() + parseInt(this.stream.find('li:first').css('margin-right'));
		
		var newWidth = (this.stream.find('> li').length * this.boxItemWidth);
		this.streamWidth = newWidth;
		
		this.stream[0].style.width = newWidth + 'px';
		
		this.stream.css({left: -newWidth});
		
		switch(SAP.i.client.os){
			case 'ipad':
			case 'iphone':
			case 'android':
				var scroll = new iScroll('wrapper-list-items', {hScrollbar:false, vScrollbar:false, vScroll:false, overflow:'visible'});
				break;
			default:
				break;
		}
		
		
		this.bindEvents();
//		this.bindHandlers();
		
		var _this = this;
		setTimeout(function(){
			_this.initAnimation();
		}, 900);
	},
		
	isAvailableLink: function(element) {
		if (element.nodeName == 'IMG' || (element.nodeName == 'SPAN' && element.className == 'icon')) {
			return true;
		}
			
		
		return false;
	}
	
});

// ../../../core/components/BoxItem.js
SAP.component.BoxItem = SAP.core.Component.extend({
    init: function(data, fromLayer) {
        this.inherited().init();

        this.fromLayer = (fromLayer || false);
        this.data = jQuery.extend(data, this.data);
        this.socialMedias = this.data['socialMedias'];

        this.authorNameFloatElement = jQuery('<div />');
        this.authorNameFloatElement.css({
            position: 'absolute',
            left: '-9999px',
            top: '-9999px',
            background: 'blue',
            fontSize: '11px'
        });

        jQuery('body').append(this.authorNameFloatElement);
    },

    getHTML: function() {
        var hashLink = SAP.global.hashName + this.data.media$group.yt$videoid.$t;
        var author = ''; //this.getAuthorName();
        var href = 'href="' + hashLink + '"';

        if (SAP.global.url.starturl) {
            if (SAP.global.iframe) {
                href = 'href="javascript:;" data-href="' + SAP.global.url.starturl + hashLink + '"';
            } else {
                href = 'href="' + SAP.global.url.starturl + hashLink + '"';
            }
        }

        var html = '';
        html += '<div class="storytelling-box-item" id="{elementId}">';
        html += '<a class="photo" ' + href + '><span class="icon"><!-- --></span><img src="' + this.data.media$group.media$thumbnail[1].url + '" alt="" /></a>';
        html += '<article><hgroup><h1>' + this.data.media$group.media$title.$t.replace('Press Conference', '').replace('Pressekonferenz', '').replace(' - ', '').substr(0, 30) + '...</h1>' + author + '</hgroup></article>';
        html += '</div>';

        return this.replaceContent(html, true);
    },

    abbrName: function(name) {
        var finalName = name.split(' ');

        if (finalName.length > 1) {
            var strName = '';

            for (var i = 0; i < finalName.length - 1; i++) {
                strName += finalName[i].charAt(0) + '. ';
            }

            finalName = strName + finalName[finalName.length - 1];
        } else {
            finalName = finalName[0];
        }

        return finalName;
    },

    getAuthorNameO: function() {
        var availableWidth = 123;
        var name = (this.data.author.shortName) ? this.data.author.shortName : this.data.author.name;
        var fontSize = 12;

        if (this.data.author.boxItemName) {
            return '<h2 style="font-size:' + fontSize + 'px;">' + this.data.author.boxItemName + '</h2>';
        }

        this.authorNameFloatElement.html(name);

        if (this.authorNameFloatElement.width() > availableWidth) {
            this.authorNameFloatElement.css('font-size', '10px');
            if (this.authorNameFloatElement.width() > availableWidth) {
                name = this.abbrName(name);
            } else {
                fontSize = 10;
            }
        }

        if (HMI_FEATURE_LANG == 'ko') {
            var finalTemplate = '<h2 style="font-size:' + fontSize + 'px;">' + name + ' ' + this.translate('by') + '</h2>';
        } else {
            var finalTemplate = '<h2 style="font-size:' + fontSize + 'px;">' + this.translate('by') + ' ' + name + '</h2>';
        }

        return finalTemplate;
    },

    getAuthorName: function() {
        var availableWidth = 123;
        var name = this.data.media$group.media$credit[0].yt$display;
        var fontSize = 12;

        if (this.data.author.boxItemName) {
            return '<h2 style="font-size:' + fontSize + 'px;">' + this.data.author.boxItemName + '</h2>';
        }

        this.authorNameFloatElement.html(name);

        if (this.authorNameFloatElement.width() > availableWidth) {
            this.authorNameFloatElement.css('font-size', '10px');
            if (this.authorNameFloatElement.width() > availableWidth) {
                name = this.abbrName(name);
            } else {
                fontSize = 10;
            }
        }

        if (HMI_FEATURE_LANG == 'ko') {
            var finalTemplate = '<h2 style="font-size:' + fontSize + 'px;">' + name + ' ' + this.translate('by') + '</h2>';
        } else {
            var finalTemplate = '<h2 style="font-size:' + fontSize + 'px;">' + this.translate('by') + ' ' + name + '</h2>';
        }

        return finalTemplate;
    },

    bindEvents: function() {
        var _this = this;
        if (SAP.global.app) {
            this.element.find('a.photo').bind('click', function(ev) {
                ev.preventDefault();
                var id = this.href.split('/').pop();
                SAP.global.videoId = null;
                var story = SAP.i.util.getStoryById(id, HMI_FEATURE_DATA.story);
                document.location = 'myapp::open-story::' + story.id;

            });
        }

        if (SAP.global.iframe) {
            this.element.find('a.photo').bind('click', function(ev) {
                ev.preventDefault();

                window.top.location.href = jQuery(this).data('href');
            });
        }
    },

    onAttach: function() {
        this.inherited().onAttach();
        this.bindEvents();
        this.fixForIpad();
    },

    fixForIpad: function() {
        if (SAP.i.detector.detectAgent()) {
            this.element.find('.watch').attr('href', SAP.global.hashName + SAP.i.util.getNormalVideoId(this.data));
        }
    }
});

// ../../../core/components/VideoBoxItem.js

SAP.component.VideoBoxItem = SAP.component.BoxItem.extend({
	init: function(data, fromLayer) {
		this.inherited().init(data, fromLayer);
	},
	
	onAttach: function() {
		this.inherited().onAttach();
		this.element.addClass('storytelling-video-box-item');
	}
});

// ../../../core/components/Player.js
SAP.component.Player = SAP.core.Component.extend({
    init: function(data, storiesLength) {
        this.inherited().init();
        screenLocker.show();

        this.data = jQuery.extend(data, this.data);
        this.storiesLength = storiesLength;

        //		this.availableMedias = ['facebook', 'twitter', 'youtube'];

        this.controlsHeight = 93;
        this.loadingLayer = false;
        this.openLayerTimerId = null;

        this.contentStreamButton = '#storitelling-yt-stream-button';
        //		this.shareButton = '#custom_button_share a';
        //removing info button
       // this.infoButton = '#storitelling-yt-info-button';
        //		this.socialMediaButton = '#custom_button_social_media a';
        //		this.appBackButton = '#custom_button_app_back a';
        //		this.appFavoriteButton = '#custom_button_app_favorite a';
        //removing video quality button
        //this.videoQualityButton = '.video_type';

        this.openedLayer = null;
        this.openedButton = null;

        //		FAVORITE_DOWNLOADING = false;
    },

    getHTML: function() {
        var result = this.replaceContent(
            '<div class="storytelling-player" id="{elementId}">' +
            '	<div class="close-component">' +
            '		<a href="javascript:;" onclick="void(0)"><span>' + this.translate('close') + '</span></a>' +
            '	</div>' +
            '</div>'
        );

        return result;
    },

    show: function() {
        var _this = this;

        setTimeout(function() {
            _this.element.css({
                'visibility': 'visible',
                'z-index': 3
            });

            screenLocker.hide();
            //			SAP.i.preLoader.hide();
            //			jQuery('body').css("overflow", "hidden");
        }, 1000);
    },

    hide: function() {
        this.callOnDetachEvents();
    },

    close: function() {
        if (this.video) {

            var videoObj = this.getVideoObjById(this.hashName);
            var label = videoObj.label.split(' ')[0];

            if (!this.video[0].paused) {
                SAP.i.track.videoStop(label, parseInt(this.video[0].currentTime));
            }

            SAP.i.track.videoClose(label, parseInt(this.video[0].currentTime));

        }
        //		else if (this.data.type != "video") {
        //			SAP.i.track.page('entry');
        //		}

        this.callOnDetachEvents();

        if (SAP.global.url.closeurl) {
            window.location.href = SAP.global.url.closeurl;
        } else {
            SAP.i.eventBus.fireEvent('PlayerClosedEvent', {
                data: this.data
            });
        }

    },

    //	attachComponent: function(component) {
    //		jQuery('#' + this.elementId).find('.player_wrapper').append(component.getHTML());
    //		component.onAttach();
    //	},

    createLayers: function() {

        var _this = this;
        //		if (this.storiesLength > 1 && SAP.i.client.os != 'iphone') {
        this.contentStreamComponentLayer = new SAP.component.ContentStreamLayer(this.data);
        this.addComponent(this.contentStreamComponentLayer);
        //		}
        //		else {
        //			setTimeout(function() {
        //				_this.openFooter();
        //			}, 1000);
        //		}

        //		this.shareComponentLayer = new SAP.component.ShareLayer(this.data);
        //		this.addComponent(this.shareComponentLayer);

        //removing infolayer
        // this.infoComponentLayer = new SAP.component.InfoLayer(this.data);
        // this.addComponent(this.infoComponentLayer);

        //		this.socialMediaComponentLayer = new SAP.component.SocialMediaLayer(this.data, comments);
        //		this.addComponent(this.socialMediaComponentLayer);

        this.bindLayers();
    },

    toggleLayers: function(button, layer, dontTrack) {
        var _this = this;

        if (this.loadingLayer) {
            return false;
        }

        this.loadingLayer = true;
        clearTimeout(this.openLayerTimerId);

        if (this.openedLayer) {
            if (this.openedLayer != layer) {
                this.closeLayer(function() {
                    _this.openLayerTimerId = setTimeout(function() {
                        _this.openLayer(button, layer, dontTrack);
                    }, 500);
                });
            } else {
                this.closeLayer();
            }
        } else {
            this.openLayer(button, layer, dontTrack);
        }
    },

    hideVideo: function() {},

    showVideo: function() {},

    openLayer: function(button, layer, dontTrack) {
        if (layer) {
            clearTimeout(this.openLayerTimerId);
            button.addClass('active');
            layer.open(dontTrack);

            this.openedLayer = layer;
            this.openedButton = button;

            //			this.hideVideo();
        }
    },

    closeLayer: function(callback) {
        //		this.showVideo();
        if (this.openedLayer) {
            this.openedLayer.close(callback);
            this.openedButton.removeClass('active');
            this.openedLayer = null;
            this.openedButton = null;
        }
    },

    bindLayers: function() {
        var _this = this;

        if (this.storiesLength > 1) {
            jQuery(this.contentStreamButton).bind('click', function() {
                _this.toggleLayers(jQuery(this), _this.contentStreamComponentLayer);
            });
        }

        //		jQuery(this.shareButton).bind('click', function() {
        //			_this.toggleLayers(jQuery(this), _this.shareComponentLayer);
        //		});

        //removing infoButton
        // jQuery(this.infoButton).bind('click', function() {
        //     _this.toggleLayers(jQuery(this), _this.infoComponentLayer);
        // });

        //		jQuery(this.socialMediaButton).bind('click', function() {
        //			_this.toggleLayers(jQuery(this), _this.socialMediaComponentLayer);
        //		});

        //		jQuery(this.appBackButton).bind('touchstart', function() {
        //			document.location = 'myapp::close-start';
        //		});
        
        //remove video quality popup
        // jQuery(this.videoQualityButton).bind('touchstart', function() {
        //     if (_this.player) {
        //         clearTimeout(_this.player.videoControlsTimerId);
        //     }
        // });

        //		jQuery(this.appFavoriteButton).bind('click', function() {
        //			var elem = jQuery(this);
        //
        //			if (FAVORITE_DOWNLOADING) {
        //				var dataDownloading = {
        //						title: ' ',
        //						message: _this.translate('confirmCancelFavorite')
        //				};
        //				
        //				var confirmDialogDownloading = new SAP.component.ConfirmDialog(dataDownloading, function() {
        //					elem.toggleClass('selected');
        //					
        //					var videoType = _this.videoObj ? _this.videoObj.type : '';
        //					document.location = 'myapp::addToFavorite::'+ videoType;
        //					HMI_FEATURE_FAVORITE = !HMI_FEATURE_FAVORITE;
        //				}, true, _this.translate('yes'), _this.translate('no'));
        //
        ////				SAP.global.favCallback = function() {
        ////					HMI_FEATURE_FAVORITE = !HMI_FEATURE_FAVORITE;
        ////					elem.toggleClass('selected');
        ////				};
        ////
        ////				_this.util.iOSConfirm({
        ////					title: '',
        ////					message: _this.translate('confirmCancelFavorite'),
        ////					btYes: _this.translate('yes'),
        ////					btNo: _this.translate('no'),
        ////					action: 'addToFavorite',
        ////					videoType: _this.videoObj ? _this.videoObj.type : '',
        ////					callback: 'SAP.global.favCallback'
        ////				});
        //			} else {
        //				var data = {
        //					title: (HMI_FEATURE_FAVORITE) ? _this.translate('deleteFavorite') : _this.translate('addFavorite'),
        //					message: (HMI_FEATURE_FAVORITE) ? _this.translate('confirmDeleteFavorite') : _this.translate('confirmSaveFavorite')
        //				};
        //				
        //				var Labelbutton = (HMI_FEATURE_FAVORITE) ? _this.translate('delete') : _this.translate('download');
        //				
        //				var confirmDialog = new SAP.component.ConfirmDialog(data, function() {
        //					HMI_FEATURE_FAVORITE = !HMI_FEATURE_FAVORITE;
        //					
        //					if (HMI_FEATURE_FAVORITE) {
        //						SAP.i.track.page('addtofav');
        //						FAVORITE_DOWNLOADING = true;
        //					}
        //					
        //					_this.donwloadingFavorite = HMI_FEATURE_FAVORITE;
        //					elem.toggleClass('selected');
        //					
        //					var videoType = _this.videoObj ? _this.videoObj.type : '';
        //					document.location = 'myapp::addToFavorite::'+ videoType;
        //					
        //				}, true, Labelbutton);
        //
        ////				SAP.global.favCallback = function() {
        ////					HMI_FEATURE_FAVORITE = !HMI_FEATURE_FAVORITE;
        ////
        ////					if (HMI_FEATURE_FAVORITE) {
        ////						SAP.i.track.page('addtofav');
        ////						FAVORITE_DOWNLOADING = true;
        ////					}
        ////
        ////					_this.donwloadingFavorite = HMI_FEATURE_FAVORITE;
        ////					elem.toggleClass('selected');
        ////				};
        ////				
        ////				_this.util.iOSConfirm({
        ////					title: (HMI_FEATURE_FAVORITE) ? _this.translate('deleteFavorite') : _this.translate('addFavorite'),
        ////					message: (HMI_FEATURE_FAVORITE) ? _this.translate('confirmDeleteFavorite') : _this.translate('confirmSaveFavorite'),
        ////					btYes: (HMI_FEATURE_FAVORITE) ? _this.translate('delete') : _this.translate('download'),
        ////					btNo: _this.translate('cancel'),
        ////					action: 'addToFavorite',
        ////					videoType: _this.videoObj ? _this.videoObj.type : '',
        ////					callback: 'SAP.global.favCallback'
        ////				});
        //			}
        //		});
    },

    openFooter: function() {},

    bindHandlers: function() {
        var _this = this;

        this.addEventHandler('LayerClosedEvent', function(ev) {
            if (_this.openedButton && _this.openedLayer == ev.getLayer()) {
                _this.openedButton.removeClass('active');
                _this.openedLayer = null;
                _this.openedButton = null;
            }

            _this.loadingLayer = false;
        });

        this.addEventHandler('LayerOpenedEvent', function(ev) {
            _this.loadingLayer = false;
        });

        this.addEventHandler('ContentSteamLayerAttachedEvent', function(ev) {
            setTimeout(function() {
                _this.openFooter();
            }, 1000);
        });

    },

    onAttach: function() {
        this.inherited().onAttach();

        var _this = this;

        this.closeButton = this.element.find('.close-component');
        this.closeButton.bind('click', function() {
            _this.close();
        });

        this.hashName = this.util.getHash(1);

        jQuery(window).bind('hashchange', function() {
            if (_this.data.type == 'video') {
                if (!_this.video.get(0).paused) {
                    _this.player.playPauseEvent(_this.playButton, _this.video.get(0));
                }
            } else if (_this.data.type == 'multimedia') {
                _this.element.find('video, audio').each(function() {
                    this.pause();
                })
            }
        })

        this.footer = this.element.find('#footer-player');

        this.bindHandlers();

        this.createLayers();
        //		this.getSocialMediaInfo();

        this.getFooter();

        //		if (SAP.global.debuggTrack) {
        //			this.trackDebugger();
        //		}

    },


    //	trackDebugger: function() {
    //		var html = '';
    //		html += '<div id="sap-track-debugger" style="position:absolute; top:10px; left:10px; width:500px; height:400px; background:#fff; border:1px solid yellow; overflow-y:scroll; word-wrap:break-word; z-index:100; color:#000;"></div>';
    //		this.element.append(html);
    //	},

    getVisibleArea: function() {
        
        // for ipad development only
        if (SAP.global.dev && SAP.i.client.os == 'ipad') {
            return window.outerHeight - 44;
        }

        var footerHeight = (SAP.global.app) ? 0 : 20;

        //		var h1 = jQuery(window).height() - jQuery('#footer-player').outerHeight();
        var h1 = jQuery(window).height() - footerHeight;
        //		var h2 = jQuery('.storytelling-player-container').height() - jQuery('#footer-player').outerHeight();
        var h2 = jQuery('.storytelling-player-container').height() - footerHeight;

        return Math.max(h1, h2);
    },


    //	getSocialMediaInfo: function() {
    //		var _this = this;
    //		if (!SAP.global.comments[this.data.socialMediaId]) {
    //			this.socialMediaInfo = new SAP.core.SocialMediaInfo(this.data.socialMediaId, function(comments) {
    //				SAP.global.comments[_this.data.socialMediaId] = comments;
    //				_this.createLayers(SAP.global.comments[_this.data.socialMediaId]);
    //				if (_this.data.type != 'video') {
    //					_this.bindLayers();
    //				}
    //				//_this.socialMediaInfo.showPlayerInfo(SAP.global.comments[_this.data.socialMediaId], _this.element, _this.availableMedias);
    //			});
    //		} else {
    //			var _self = this;
    //			this.socialMediaInfo = new SAP.core.SocialMediaInfo();
    //			this.createLayers(SAP.global.comments[this.data.socialMediaId]);
    //			if (_this.data.type != 'video') {
    //				this.bindLayers();
    //			}
    //			
    ////			var addComents = function() {
    ////				clearInterval(verifyLayer);
    ////				_self.socialMediaInfo.showPlayerInfo(SAP.global.comments[_this.data.socialMediaId], _this.element, _this.availableMedias);
    ////			};
    ////			
    ////			var verifyLayer = setInterval(function() {
    ////				if (_this.element.find('#custom_button_social_media .btn-social-media-player .number').length > 0) {				
    ////					addComents();
    ////				}
    ////			}, 500);
    //		}
    //	},

    //	setupTooltips: function() {
    //		SAP.i.tooltip.bind(this.contentStreamButton, this.translate('contentStream'));
    //		SAP.i.tooltip.bind(this.shareButton, this.translate('shareStory'));
    //		SAP.i.tooltip.bind(this.infoButton, this.translate('info'));
    //		SAP.i.tooltip.bind(this.socialMediaButton, this.translate('commentLayer'), 'last');
    //		
    ////		SAP.i.tooltip.bind(this.appFavoriteButton, this.translate('tooltipFavorite'));
    //
    //		
    //	},

    //	closures: function(top) {
    //		if (!this.closureOpened) {
    //			
    //			top = (top || 50);
    //			
    //			var closures = this.data.closures.closure;
    //
    //			this.closeLayer();
    //			
    //			this.closureElement = jQuery('<div class="closure"></div>');
    //			this.closureElement.css({
    //				height: jQuery(window).height()
    //			});
    //
    //			if (top > 50) {
    //				this.closureElement.css({paddingTop: top +'px'});
    //			}
    //			
    //			if (typeof(closures) == 'string') {
    //				this.closureElement.append(jQuery('<p></p>').html(closures));
    //			}
    //			else {
    //				for (var i = 0; i < closures.length; i++) {
    //					if (closures[i].type == 'url') {
    //						var arrowIcon = (this.data.userStory) ? '<img src="'+ SAP.global.paths.img +'arrow_extern.png" />' : '<img src="'+ SAP.global.paths.img +'arrow_icon.png" />' ;
    //						this.closureElement.append(jQuery('<p class="closure-links"></p>').append('<span class="more-links">' + this.translate('closureMoreLinks') + '</span><a href="javascript:;" rel="nofollow"><span class="closure-link-icon">' + arrowIcon + '</span><span class="closure-link-text">' + closures[i].label + '</span><span class="break"><!-- --></span></a><span class="break"><!-- --></span>'));
    //						this.closureElement.find('p > a').bind('click', {closure: closures[i]}, function(ev) {
    //							SAP.i.track.link(ev.data.closure.link);
    //							SAP.i.util.openWindow(ev.data.closure.link, '_blank');
    //						});
    //						
    //						if (this.data.closures.disclaimer) {
    //							this.closureElement.append(jQuery('<p class="closure-disclaimer"></p>').append(this.data.closures.disclaimer));
    //						}
    //					}
    //					else {
    //						this.closureElement.append(jQuery('<p></p>').html(closures[i]));
    //					}
    //				}
    //				
    //				this.closureLink = this.closureElement.find('p > a');
    //			}
    //			
    //			this.element.prepend(this.closureElement);
    //			
    //			var width = jQuery('.storytelling-player-container').width();
    //			
    //			if (this.data.type == "video") {
    //				this.resizeSubtitle(width);
    //			}
    //			
    //			var _this = this;
    //			
    //			if (this.data.nameSpace == 'licensetoboard') {
    //				this.closureElement.css('opacity', 0.65);
    //			}
    //			else {
    //				this.closureElement.css('opacity', 1);
    //			}
    //			
    //			_this.closuresLength = this.closureElement.find('p').length;
    //			
    //			// show closures effect
    //			this.showClosureElements();
    //			
    //			var width = jQuery(document).width();
    //			this.resizeClosureElements(width);			
    //			this.closureOpened = true;
    //		}
    //	},

    //	showClosureElements: function() {
    //		var _this = this;
    //		var timeToWait = 0;
    //		this.closureElement.find('p').each(function(index) {
    //			var _self = this;
    //			_self.closureIndex = index;
    //			setTimeout(function() {
    //				jQuery(_self).fadeIn(function() {_this.showFinalLayer(_self.closureIndex)});
    //			}, timeToWait);
    //			timeToWait += 2500;
    //		});
    //	},

    //	resize: function() {
    //		var width = jQuery(document).width();
    //		this.resizeClosureElements(width);
    //	},
    //	
    //	resizeClosureElements: function(width) {
    //		if (this.closureElement && SAP.i.client.os != 'iphone') {
    //			var fontSize = Math.ceil(0.020 * width);
    //			this.closureElement.find('p').css('font-size', fontSize +'px');
    //		}
    //		
    //		if (this.closureLink && SAP.i.client.os != 'iphone') {
    //			var imgSize = (this.data.userStory) ? Math.ceil(0.008 * width) : Math.ceil(0.007 * width);
    //			this.closureLink.find('img').css('width', imgSize);
    //		}
    //	},

    //	removeClosures: function() {
    //		jQuery('.storytelling-player-container').find('.closure').remove();
    //		
    //		if (this.openedLayer) {
    //			this.closeLayer();
    //			clearTimeout(this.openLayerTimerId);
    //		}
    //		
    //		this.closureOpened = false;		
    //	},

    getFooter: function() {
        if (!SAP.global.app) {
            var footer = typeof(HMI_FEATURE_FOOTER) != 'undefined' ? HMI_FEATURE_FOOTER : 'global';
            jQuery.ajax({
                url: HMI_FEATURE_PATH + 'locale/footer/' + footer + '.html',
                success: function(data) {
                    jQuery('#footer-player').html(data);
                }
            });
        }
    },

    //	getSlideByName: function() {
    //		for (var i = 0; i < this.data.slides.length; i++) {
    //			if (this.data.slides[i].name == this.slideName) {
    //				return i;
    //			}
    //		}
    //		
    //		return 0;
    //	},

    trackCloseStory: function(data) {
        if (this.video) {
            var videoObj = this.getVideoObjById(this.hashName);
            var label = videoObj.label.split(' ')[0];

            if (!this.video[0].paused) {
                SAP.i.track.videoStop(label, parseInt(this.video[0].currentTime));
            }

            SAP.i.track.videoClose(label, data);
        }
    }
});

// ../../../core/components/VideoPlayer.js


SAP.component.VideoPlayer = SAP.component.Player.extend({
	init: function(data, storiesLength) {
		this.inherited().init(data, storiesLength);
		this.storiesLength = storiesLength;
		this.player;
		this.metadataLoaded = false;
		this.controlsReady = false;
		this.fakeLoadingIntervalId = null;
		this.ytPlayer = null;
		this.selectedQuality = '';
		this.volume = 100;
		this.firstime = true;
		this.onplay = false;
		this.times;
		this.qualityClick = false;

		this.qualityLabel = {
			'hd1080':'1080p (HD)',
			'hd720':'720p (HD)',
			'highres':'HD',
			'large':'480p',
			'medium':'360p',
			'small':'240p',
			'tiny': 'Tiny',
			'auto': 'Auto'
		};
	

		var _this = this;
	},

	startFakeProgress: function() {
		var _this = this;

		this.videoLoadProgress = 0;
		SAP.i.preLoader.setProgress(this.videoLoadProgress);

		clearInterval(this.fakeLoadingIntervalId);
		this.fakeLoadingIntervalId = setInterval(function() {
			_this.videoLoadProgress += 1;
			SAP.i.preLoader.setProgress(_this.videoLoadProgress);
			if (_this.videoLoadProgress >= 99) {
				_this.stopFakeProgress();
			}
		}, 100);
	},

	stopFakeProgress: function() {
		clearInterval(this.fakeLoadingIntervalId);
		SAP.i.preLoader.setProgress(99);
	},


	getHTML: function(data) {
		var buffer = SAP.i.util.stringBuffer();
		buffer.append('<div class="storytelling-player {nameSpace}" id="{elementId}">');
		buffer.append(	'<div class="tooltip-mask"><!-- --></div>');
		buffer.append(	'<div class="close-component">');
		buffer.append(		'<a href="javascript:;" onclick="void(0)"><span>' + this.translate('close') + '</span><span class="bt-close"></span></a>');
		buffer.append(	'</div>');
		buffer.append(	'<div id="storitelling-yt-player-wrapper" class="player_wrapper">video</div>');
		buffer.append(	'<a href="javascript:;" id="overlay-fake"><!-- --></a>');
		buffer.append(	'<div id="storitelling-yt-player-toolbar">');
		buffer.append(		'<span id="storitelling-yt-stream-button">stream</span>');
		buffer.append(		'<span id="storitelling-yt-play-button">play</span>');
		buffer.append(		'<span id="storitelling-yt-pause-button">pause</span>');
		buffer.append(		'<span id="storitelling-yt-bar"><span id="storitelling-yt-buffer-bar"></span><span id="storitelling-yt-progress-bar"></span></span>');
		buffer.append(		'<span id="storitelling-yt-time-display">0:00 / 0:00</span>');
		buffer.append(		'<span id="storitelling-yt-volume-button">');
		buffer.append(			'<span class="volume_bar"><span class="volume_max_icon"></span><div class="volume_box"><span class="volume_wrapper"><span class="volume_height" style="height:100%;"><span class="volume_pointer"></span></span></span></div><span class="volume_min_icon"></span></span>');
		buffer.append(		'</span>');
		buffer.append(		'<span id="storitelling-yt-fullscreen-button"></span>');
		//buffer.append(		'<span id="storitelling-yt-info-button" class="right"></span>');
		// buffer.append(		'<span id="storitelling-yt-bandwidth-button" class="right hover">');
		// buffer.append(			'<span class="storitelling-yt-bandwidth-label"></span>');
		// buffer.append(			'<span class="storitelling-yt-bandwidth-icon" style="display:none;"></span>');
		// buffer.append(			'<span class="storitelling-yt-bandwidth-options"></span>');
		// buffer.append(		'</span>');
		buffer.append(	'</div>');
		buffer.append(	'<div id="footer-player"></div>');
		buffer.append('</div>');
		return this.replaceContent(buffer.getString());
	},


	onAttach: function() {
		this.inherited().onAttach();

		this.toolbar = this.element.find('#storitelling-yt-player-toolbar');
		this.playButton = this.toolbar.find('#storitelling-yt-play-button');
		this.pauseButton = this.toolbar.find('#storitelling-yt-pause-button');
		this.timeDisplay = this.toolbar.find('#storitelling-yt-time-display');
		this.bar = this.element.find('#storitelling-yt-bar');
		this.progressBar = this.toolbar.find('#storitelling-yt-progress-bar');
		this.bufferBar = this.toolbar.find('#storitelling-yt-buffer-bar');
		// this.bandwidthButton = this.toolbar.find('#storitelling-yt-bandwidth-button');
		this.volumeMaxButton = this.toolbar.find('.volume_max_icon');
		this.volumeMinButton = this.toolbar.find('.volume_min_icon');
		this.volumeButton = this.toolbar.find('#storitelling-yt-volume-button');
		this.volumeBar = this.toolbar.find('.volume_wrapper');
		this.volumeBarValue = this.toolbar.find('.volume_height');
		this.fullscreenButton = this.toolbar.find('#storitelling-yt-fullscreen-button');
		this.overlay = this.element.find('#overlay-fake');
		this.optionsm =  this.element.find('.storitelling-yt-bandwidth-options');
		this.optionsm.removeClass('hover');

		if (SAP.global.mobile){
			this.overlay.hide();
		}

		var width = jQuery('.storytelling-player-container').width();
		var height = this.getVisibleArea();

		this.ytPlayer = this.embedYoutubePlayer(this.data.yt.media$group.yt$videoid.$t, '100%', '100%');



		this.show();
		this.bindEvents();
	},

	hideBarOnTime: function(){
		var _this = this;

		clearTimeout(_this.times);
			_this.times = setTimeout(function() {
				if (!_this.toolbar.hasClass('hover')) {
					SAP.i.playerController.player.closeLayer(function () {
						_this.toolbar.hide();
						jQuery('.overlay-fake').show();
					});
				}

			}, 2000);
	},

	haltHiding: function () {
		clearTimeout(_this.times);
	},

	bindEvents: function() {
		//_this.pause();
		var _this = this,
			time;


		window.onhashchange = function(){
		    _this.close();
		}

		// _this.bandwidthButton.bind('click', function(){
			
		// 	if(_this.qualityClick == false){
		// 		_this.bandwidthButton.css("background","none");
		// 		_this.qualityClick = true;
		// 	}else{
		// 		_this.bandwidthButton.css("background-color","#F48B1A");
		// 		_this.qualityClick = false;
		// 	}
		// 	_this.optionsm.toggle();
		// });


		jQuery(document).bind('mousemove.ccvideoplayer touchstart.ccvideoplayer', function (e) {
			e.stopPropagation();
			_this.toolbar.show();
	        jQuery('.overlay-fake').hide();
			
			_this.hideBarOnTime();

		});


		_this.toolbar.bind('mouseenter', function () {
			jQuery(this).addClass('hover');
		});
		_this.toolbar.bind('mouseleave', function () {
			jQuery(this).removeClass('hover');
		});


		this.overlay.bind('touchstart.ccvideoplayer', function(){
			if(_this.onplay == false){
				_this.onplay = true;
				_this.play();
				window.setTimeout(function () {
					_this.play();
				}, 0)

			}else{
				_this.onplay = false;
				_this.pause();
				_this.pauseButton.hide();
			}
		});

		this.element.find('#footer-player a').bind('click', function() {
			_this.pause(_this.video[0]);
			_this.onplay = false;
		});

		this.playButton.bind('click', function() {
			_this.play();
			_this.onplay = true;
			
		});

		this.pauseButton.bind('click', function() {
			_this.pause();
			_this.onplay = false;
			this.hide();
		});


		this.fullscreenButton.bind('click', function() {
			if (_this.fullScreenMode) {
				_this.closeFullScreen();
			}
			else {
				_this.openFullScreen(_this.element.get(0));
			}
		});

		/* seek */
		this.bar.bind('mouseup', function(ev) {
			var elem = jQuery(ev.currentTarget);
			elem.unbind('mousemove');
			_this.seekTo(_this.calculateProgress(ev));
		}).bind('mouseleave', function(ev) {
			jQuery(ev.currentTarget).unbind('mousemove');
			_this.startTimeUpdate();
		}).bind('mousedown', function(ev) {
			ev.preventDefault();
			_this.stopTimeUpdate();
			var elem = jQuery(ev.currentTarget);
			elem.bind('mousemove', function(ev) {
				_this.calculateProgress(ev);
			});
			_this.calculateProgress(ev);
		});

		/* volume */
		this.volumeMaxButton.bind('click', function() {
			_this.volume += 10;

			if (_this.volume > 100) {
				_this.volume = 100;
			}

			_this.volumeTo(_this.volume);
			_this.volumeBarValue.height(_this.volume +'%');

		});

		this.volumeMinButton.bind('click', function() {
			_this.volume -= 10;
			if (_this.volume < 0) {
				_this.volume = 0;
			}

			_this.volumeTo(_this.volume);
			_this.volumeBarValue.height(_this.volume +'%');
		});

		/* volume bar */
		this.volumeBar.bind('mouseup', function(ev) {
			var elem = jQuery(ev.currentTarget);
			elem.unbind('mousemove');
		}).bind('mouseleave', function(ev) {
			jQuery(ev.currentTarget).unbind('mousemove');
		}).bind('mousedown', function(ev) {
			ev.preventDefault();
			var elem = jQuery(ev.currentTarget);
			elem.bind('mousemove', function(ev) {
				_this.volumeTo(_this.calculateVolume(ev));
				_this.volumeBarValue.height(_this.volume +'%');
			});
			_this.volumeTo(_this.calculateVolume(ev));
			_this.volumeBarValue.height(_this.volume +'%');
		});

	},


	openFullScreen: function(element) {
		if (element.webkitRequestFullScreen) {
			element.webkitRequestFullScreen();
			this.fullScreenMode = true;
		}
		else if (element.mozRequestFullScreen) {
			element.mozRequestFullScreen();
			this.fullScreenMode = true;
		}
	},


	closeFullScreen: function() {
		if (document.webkitCancelFullScreen) {
			document.webkitCancelFullScreen();
			this.fullScreenMode = false;
		}
		else if (document.mozCancelFullScreen) {
			document.mozCancelFullScreen();
			this.fullScreenMode = false;
		}
	},

	openPlayerControls: function() {
		var _this = this;
		if (this.controlsReady) {
			return false;
		}

		if (SAP.i.detector.detectAgent()) {
			this.volumeButton.hide();
			this.fullscreenButton.hide();
		}

		this.controlsReady = true;
		
		setTimeout(function() {
			_this.toolbar.animate({bottom:40}, 1500);
		}, 1000);

		this.getVolume();
	},

	getVolume: function() {
		if (this.ytPlayer.isMuted()) {
			this.ytPlayer.unMute()
		}
		this.volume = this.ytPlayer.getVolume() * 10;
		this.volumeBarValue.height(this.volume +'%');
	},

	setVideoSwitch: function() {
		this.player.changeVideo = function(video, newVideo) {
			window.location.hash = SAP.global.hashName + newVideo.id;
		}
	},


	resize: function() {
		this.inherited().resize();
		var width = jQuery('.storytelling-player-container').width();
		var height = this.getVisibleArea();
		//ie9+
		jQuery('.storytelling-player-container').height(window.innerHeight);
		jQuery('.storytelling-player-container').width(window.innerWidth);
	},

	calculateProgress: function(ev) {
		var elem = jQuery(ev.currentTarget);
		var x = (ev.clientX - elem.offset().left) * 100;
		var w = elem.width();
		var perc = x / w;
		var seconds = perc * this.durationTime / 100;
		this.progressBar.width(perc+'%');
		return seconds;
	},

	calculateVolume: function(ev) {
		var elem = jQuery(ev.currentTarget);
		var h = elem.height();
		var top = elem.offset().top - jQuery(document).scrollTop();
		this.volume = parseInt((((ev.clientY - top) / h) - 1) * -100);
		return this.volume;
	},


	play: function() {
		this.openPlayerControls();
		this.ytPlayer.playVideo();
	},

	pause: function() {
		this.ytPlayer.pauseVideo();
	},

	seekTo: function(value) {
		this.ytPlayer.seekTo(value);
	},


	volumeTo: function(value) {
		this.ytPlayer.setVolume(value / 10);
	},


	startTimeUpdate: function() {
		var _this = this;
		this.stopTimeUpdate();
		this.timeUpdateTimerId = setInterval(function() {
			var currentTime = _this.ytPlayer.getCurrentTime();
			_this.progressBar.width(((currentTime * 100) / _this.durationTime) + '%');
			_this.timeDisplay.html(SAP.i.util.formatTime(currentTime) +' / '+ _this.durationFormatedTime);
		}, 250);
	},

	stopTimeUpdate: function() {
		clearInterval(this.timeUpdateTimerId);
	},

	startBufferUpdate: function() {
		var _this = this;
		var videoBytesTotal = _this.ytPlayer.getVideoBytesTotal();
		this.bufferTimerId = setInterval(function() {
			_this.bufferBar.width(((_this.ytPlayer.getVideoBytesLoaded() * 100) / videoBytesTotal) + '%');
			if (_this.ytPlayer.getVideoBytesLoaded() == videoBytesTotal) {
				clearInterval(_this.bufferTimerId);
			}
		}, 250);
	},

	setupAvailableQualityLevels: function(qualities) {
		if (this.setupAvailableQualityLevelsReady) return;

		qualities = (qualities || []);

		if (qualities.length) {
			var _this = this,
				options = this.bandwidthButton.find('.storitelling-yt-bandwidth-options');

			this.bandwidthButton.find('.storitelling-yt-bandwidth-icon').show();
			options.empty();

			for (var i = 0; i < qualities.length; i++) {
				var selected = (_this.selectedQuality == qualities[i]) ? 'selected' : '';
				options.append('<span class="'+ qualities[i] +'"><span class="'+ selected +'"></span>'+ this.qualityLabel[qualities[i]] +'</span>');
			}
			this.setupAvailableQualityLevelsReady = true;

			options.find('> span').bind('click', function() {
//				_this.pause();
				_this.ytPlayer.setPlaybackQuality(this.className);
			});
		}
	},

	embedYoutubePlayer: function(videoId, w, h) {
		var _this = this;

		

		var yt = new YT.Player('storitelling-yt-player-wrapper', {
			height: h,
			width: w,
			videoId: videoId,
			playerVars: {
				enablejsapi: 1,
				origin: window.location.protocol +'//'+ window.location.host ,
				controls: 0,
				showinfo: 0,
				fs: 1,
				rel: 0,
				html5: 1,
				iv_load_policy: 3
			},
			events: {
				onReady: function() {
//					_this.stopFakeProgress();
					SAP.i.preLoader.hide();
					_this.resize();
					if (!SAP.i.detector.detectAgent()) {
						_this.play();
					}
				},
				onStateChange: function(ev) {
					var state = ['ended', 'playing', 'paused', 'buffering', 'cued'];
				
					switch (state[ev.data]) {
						case 'playing':
							
							_this.startBufferUpdate();
							_this.durationTime = _this.ytPlayer.getDuration();
							_this.durationFormatedTime = SAP.i.util.formatTime(_this.durationTime)

							_this.playButton.hide();
							_this.pauseButton.show();
							_this.startTimeUpdate();

							if (SAP.i.detector.detectAgent()) {
								_this.openPlayerControls();
							}
							_this.overlay.show();
							_this.hideBarOnTime();
							_this.onplay = true;

						break;

						case 'paused':
							_this.onplay = false;
						case 'buffering': 
							_this.playButton.show();
							_this.stopTimeUpdate();
						break;

						case 'ended':
							_this.stopTimeUpdate();
							_this.timeDisplay.html(SAP.i.util.formatTime(_this.durationTime) +' / '+ _this.durationFormatedTime);
							_this.progressBar.width('100%');
						break;
					}

					//_this.setupAvailableQualityLevels(ev.target.getAvailableQualityLevels());
				},

				// onPlaybackQualityChange: function(ev) {
				// 	_this.bandwidthButton.find('.storitelling-yt-bandwidth-label').html(_this.qualityLabel[ev.data]);
				// 	_this.bandwidthButton.find('.selected').removeClass('selected');
				// 	_this.bandwidthButton.find('.'+ev.data +' span').addClass('selected');
				// 	_this.selectedQuality = ev.data;
				// }
			}
		});

		return yt;
	},

	onDetach: function() {
		this.inherited().onDetach();
		if (this.ytPlayer) {
			this.ytPlayer.destroy();
		}
		this.stopTimeUpdate();
	}
});

// ../../../core/components/Tooltip.js

SAP.component.Tooltip =  SAP.core.Component.extend({
	init: function() {
		this.tooltipId = 'storytelling-tooltip';
		this.tooltip = null;
		
		this.body = jQuery('#storytelling-body');
	},
	
	create: function(label, element, mousePos, type) {
		if (!this.tooltip) {	
			this.tooltip = jQuery('<div id="'+this.tooltipId+'"></div>');
			this.body.append(this.tooltip);
		}
		
		var html = '<span class="tooltip-label">' + label.replace(/\[br\]/g, '<br>') + '</span>' +
					'<span class="tooltip-arrow"><!-- --></span>';
					
		this.tooltip.html(html);
		
		var _this = this;
		
		this.tooltip.bind('mouseenter', function(ev) {
			clearTimeout(SAP.global.timers.tooltip);
		});
		
		this.tooltip.bind('mouseleave', function(ev) {
			clearTimeout(SAP.global.timers.tooltip);
			SAP.global.timers.tooltip = setTimeout(function() {_this.hide(this); }, 100);
		});
		
		
		this.show(element, mousePos, type);
	},
	
	setup: function(element, mousePos, type, tooltipPosition) {
		var tooltipLeft, arrowPos;
		
		if (type) {
			this.tooltip.attr('class', type);
		}
		else {
			this.tooltip.attr('class', '');
		}
		
		var element = jQuery(element);
		var content = this.tooltip.find('.tooltip-label')
		var position = element.offset();
		var arrow = this.tooltip.find('.tooltip-arrow');
		
		if (this.tooltip.width() >= element.width()) {
			tooltipLeft = element.offset().left + (element.outerWidth() / 2) - (content.outerWidth() / 2);
			
			if (tooltipLeft < 10) {
				tooltipLeft = 10;
			}
			else if ((tooltipLeft + content.outerWidth()) >= this.body.width() - 10) {
				tooltipLeft = this.body.width() - content.outerWidth() - 10;
			}
		}
		else {
			var contentWidth = (type == 'share-layer-tooltip') ? content.outerWidth() : content.width();
			if (mousePos) {
				tooltipLeft = mousePos - (content.outerWidth() / 2);
			}
			else {
				tooltipLeft = element.offset().left + (element.outerWidth() / 2) - (content.outerWidth() / 2);
			}
		}
		
		var top = position.top - this.tooltip.outerHeight();
		if (tooltipPosition == 'bottom') {
			top = position.top + element.outerHeight() + 25;
		}
				
		this.tooltip.css({
			top: top,
			left: tooltipLeft,
			'z-index': 200,
			visibility: 'visible'
		});
		
		if (mousePos) {
			arrowPos = (this.tooltip.outerWidth() / 2) - (arrow.outerWidth() / 2);
		}
		else {
			arrowPos = element.offset().left - this.tooltip.offset().left + (element.outerWidth() / 2) - (arrow.outerWidth() / 2);
		}

		arrow.css('left', arrowPos);
	},
	
	show: function(element, mousePos, type) {
		this.setup(element, mousePos, type);
	},
	
	hide: function() {
		if (this.tooltip) {
			this.tooltip.css({
				'visibility': 'hidden',
				top: 0,
				left: 0
			});
		}
	},
	
	bind: function(button, label, type) {
		var _this = this;
		
		button = jQuery(button);
		
		button.bind('mouseenter', function() {
			clearTimeout(_this.outicon);
			_this.create(label, this, null, type);
		});
		
		button.bind('mouseleave', function() {
			_this.outicon = setTimeout(function() {
				_this.hide(this);				
			}, 0);
		});
	}
});

