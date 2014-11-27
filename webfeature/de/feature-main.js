var resizing = null;

function resize() {
	// clearTimeout(resizing);
	
	// resizing = setTimeout(function(){
		var SCROLLBAR_WIDTH = 17;
		var maxWidth = 1000;
		var maxHeight = 400;
		var newWidth = document.viewport.getWidth() < maxWidth ? maxWidth : document.viewport.getWidth();
		var newHeight = document.viewport.getHeight() < maxHeight ? maxHeight : document.viewport.getHeight();

		$('general').setStyle({ width: newWidth+'px', height: newHeight+'px'});

		if (navigator.userAgent.indexOf("Chrome") != -1) {
			var hasScrollbars = document.body.scrollHeight - document.body.clientHeight > SCROLLBAR_WIDTH;
		} else {
			var hasScrollbars = newHeight - document.body.scrollHeight > SCROLLBAR_WIDTH;
		}

		// if (hasScrollbars && navigator.userAgent.indexOf("MSIE") == -1) {
		// 	$('general').setStyle({ width: (newWidth - SCROLLBAR_WIDTH) + 'px'});
		// }

		if (document.viewport.getWidth() > maxWidth && document.viewport.getHeight() > maxHeight) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = 'auto';
		}

	// }, 50);
}

function FlashInit() {
	Event.observe(window, 'load', init);
	Event.observe(window, 'resize', resize);
}

function init() {
	$('logo').hide();
	$('flashcontent').removeClassName('hidden');

	var params = {
		quality: "high",
		scale: "noscale",
		wmode: "transparent",
		allowscriptaccess: "always",
		allowFullScreen: "true",
		bgcolor: "#FFFFFF",
		base: "swf/"
	};
	
	var flashvars = {
		siteXML: "../xml/site.xml",
		language: "en"
	};
	var attributes = {
		id: "flashcontent",
		name: "flashcontent"
	};
	swfobject.embedSWF("swf/main.swf", "flashcontent", "100%", "100%", "9.0.124", "expressInstall.swf", flashvars, params, attributes);

	resize();
}