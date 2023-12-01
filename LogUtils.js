class LogUtils {
	compact = false;

	constructor(enabled){
		this.enabled = (enabled !== false); //caring for undefined
	}

	init(...args) {
		this.info(args);

	}

	info(...args) {
		this._log('', ...args)
	}

	warn (...args) {
		this._log('Warning', ...args)
	}

	error(...args) {
		this._log('Error', ...args)
	}

	debug(...args) {
		this._log('DEBUG',...args)
	}

	_log(level, ...args) {
		if (!this.enabled) return;
		let stack =	new Error()
			.stack
			.replaceAll(/(\/<)?\@.+$/gm, '')
			.replaceAll(/main.+/gs,'');
		if (LogUtils.compact) {
			stack = stack.replaceAll(/(((?<!_)[a-z])|_)+/gs,'');
		}
		
		stack = stack.split(/\n/).slice(2).reverse().join('::');
		if (args.length == 1){
			global[`log${level == 'DEBUG' ? '' : level}`](`${level == 'DEBUG' ? 'DEBUG' : 'LOG'}${stack}::${args[0]}`);
		} else {
			global[`log${level == 'DEBUG' ? '' : level}`](`${level == 'DEBUG' ? 'DEBUG' : 'LOG'}${stack}::`, args);

		}
	}
}