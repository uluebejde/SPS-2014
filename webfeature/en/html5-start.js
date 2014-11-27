var HMI_FEATURE_LANG = 'en';
var HMI_FEATURE_PATH = "/topics/global/en/events/hannover-messe/Documents/2014/webfeature/html/";
if (typeof(HMI_FEATURE_WCMS_MAIN) !== "undefined") {
	HMI_FEATURE_PATH = HMI_FEATURE_WCMS_MAIN;
} 
var HMI_FEATURE_XML_PATH = '../' + HMI_FEATURE_LANG + '/xml/';
var HMI_FEATURE_JSON_PATH = '../' + HMI_FEATURE_LANG + '/json/';
var HMI_FEATURE_DEBUG = true;
var HMI_FEATURE_FOOTER = 'all/' + HMI_FEATURE_LANG;
var HMI_FEATURE_APP_STORE = true;
var HMI_FEATURE_TEXT_DIR = 'ltr';

var YT_PLAYLIST_ID = 'PLw7lLwXw4H52znoBdbNJfcRmHT5QnUldj';



var HMI_FEATURE_SOCIAL_MEDIA_FILES = {
	stories: '../xml/data.xml',
	story: '../xml/story.xml'
};

var HMI_FEATURE_STE_CONFIG = {
	format: 'html5',
	lang: HMI_FEATURE_LANG,
	type: 'answersplayer'
};

(function(){
	var cssFiles = [
		HMI_FEATURE_PATH + 'css/core.css'
	];

	if (document.getElementById('developmentTag')) {
		var jsFiles = [ location.protocol + '//www.youtube.com/player_api', HMI_FEATURE_PATH + 'jsc/jsfiles.php'];
	}
	else {
		var jsFiles = [ location.protocol + '//www.youtube.com/player_api', HMI_FEATURE_PATH + 'jsc/application.js'];
	}

	var ClientDetect = function(){

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

	};

	ClientDetect.prototype.config = function(){
		this.supportedBrowsers = {
			//firefox: {minVersion: 4},
			//chrome: {minVersion: 9},
			safari: {minVersion: 5, os: ['ipad']},
			//opera: {minVersion: 10},
			android: {minVersion: 2}
		};

		//		this.exceptionBrowsers = {
		//			chrome: {minVersion: 10, maxVersion:10, os:['windows'], osVersion:['seven']}
		//		};
	}

	ClientDetect.prototype.setUp = function(){
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
	}

	ClientDetect.prototype.inArray = function(item, arr){
		for (var i = 0; i < arr.length; i++) {
			if (arr[i] == item) {
				return i;
			}
		}
		return -1;
	}

	ClientDetect.prototype.isSupportedClient = function(){

		if (this.exceptionBrowsers[this.browser]) {
			if (this.exceptionBrowsers[this.browser].minVersion >= this.version &&
			this.exceptionBrowsers[this.browser].maxVersion <= this.version &&
			(this.exceptionBrowsers[this.browser].os && this.inArray(this.os, this.exceptionBrowsers[this.browser].os) != -1) &&
			(this.exceptionBrowsers[this.browser].osVersion && this.inArray(this.osVersion, this.exceptionBrowsers[this.browser].osVersion) != -1)) {
				return false;
			}
			var HMI_FEATURE_SOCIAL_MEDIA_FILES = {
				stories: '../../../../../../apps/socialmedia/data.php',
				story: '../../../../../../apps/socialmedia/data.php'
			};
		}

		if (this.supportedBrowsers[this.browser] && this.supportedBrowsers[this.browser].minVersion <= this.version) {
			if (this.supportedBrowsers[this.browser].os && this.inArray(this.os, this.supportedBrowsers[this.browser].os) == -1) {
				return false;
			}
			if (this.supportedBrowsers[this.browser].maxVersion && this.supportedBrowsers[this.browser].maxVersion < this.version) {
				return false;
			}
			return true;
		}
		return false;
	}

	var client = new ClientDetect();

	if (client.hasSupport) {

		try {
			featureVars = {
				name: "",
				country: "",
				featureType: ""
			};
			clearInterval(featureInterval);
		}
		catch (e) {
		}

		var head = document.getElementsByTagName('head')[0];

		var meta = document.createElement('meta');
		meta.setAttribute('http-equiv', 'imagetoolbar');
		meta.setAttribute('content', 'no');
		head.appendChild(meta);

		var meta = document.createElement('meta');
		meta.setAttribute('name', 'viewport');
		meta.setAttribute('content', 'width=device-width; initial-scale=1.0; maximum-scale=1.0; user-scalable=0;');
		head.appendChild(meta);

		for (var i = 0; i < cssFiles.length; i++) {
			var link = document.createElement('link');
			link.setAttribute('href', cssFiles[i]);
			link.setAttribute('rel', 'stylesheet');
			link.setAttribute('type', 'text/css');
			head.appendChild(link);
		}

		for (var i = 0; i < jsFiles.length; i++) {
			var script = document.createElement('script');
			script.setAttribute('type', 'text/javascript');
			script.setAttribute('src', jsFiles[i] + '?r=' + Math.random().toString().replace('0.', ''));
			head.appendChild(script);
		}
	} else {
		try {
			FlashInit();
		} catch (e) {}
	}

})();
