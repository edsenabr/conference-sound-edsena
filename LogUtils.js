class LogUtils {
	compact = false;

	constructor(){
	}

	init(...args) {
		this.info(args);

	}

	info(message) {
		this._log('', message)
	}

	warn (message) {
		this._log('Warning', message)
	}

	error(message) {
		this._log('Error', message)
	}

	debug(message) {
		this._log('DEBUG',message)
	}

	_log(level, message) {
		let stack =	new Error()
			.stack
			.replaceAll(/(\/<)?\@.+$/gm, '')
			.replaceAll(/main.+/gs,'');
		if (LogUtils.compact) {
			stack = stack.replaceAll(/(((?<!_)[a-z])|_)+/gs,'');
		}
		
		stack = stack.split(/\n/).slice(2).reverse().join('::');
		global[`log${level == 'DEBUG' ? '' : level}`](`${level == 'DEBUG' ? 'DEBUG' : 'LOG'}${stack}::${message}`);
	}
}