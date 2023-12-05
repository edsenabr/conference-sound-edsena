class LogUtils {
	compact = false;
	static levels = {
		Info: 1,
		Warning: 2,
		Error: 3,
		Debug: 4
	};

	constructor(level, name){
		this._level = Number.isInteger(level) && 
						level > 0 && 
						level < 5
					? level 
					: LogUtils.levels.Info;
		this._name = name;
	}

	init(...args) {
		this._log('Debug',...args)

	}

	done(...args) {
		this._log('Debug',...args)
	}

	info(...args) {
		this._log('Info', ...args)
	}

	warn (...args) {
		this._log('Warning', ...args)
	}

	error(...args) {
		this._log('Error', ...args)
	}

	debug(...args) {
		this._log('Debug',...args)
	}

	_getStack() {
		let stack =	new Error()
			.stack
			.replaceAll(/(\/<)?\@.+$/gm, '')
			.replaceAll(/main.+/gs,'');
		if (LogUtils.compact) {
			stack = stack.replace(/(((?<!_)[a-z])|_)+/gs,'');
		}
		stack = stack.replace(/.+\/</mg, 'anonymous')
		return stack.split(/\n/).slice(2).reverse().join('::');
	}


	_log(level_name, ...args) {
		let level = LogUtils.levels[level_name];
		if ( level > this._level) return;
		let stack = this._getStack();
		if (!stack.startsWith(`::${this._name}`))
			stack = `::${this._name}${stack}`;
		
		let header = `${level == LogUtils.levels.Debug ? 'DEBUG' : 'LOG'}${stack}`;
		let method = global[`log${[LogUtils.levels.Debug, LogUtils.levels.Info].includes(level) ? '' : level_name}`];
		let message;
		if (args.length == 0)
			method(header);
		else if (args.length == 1)
			method(`${header}::${args[0]}`);
		else
			method(header, args);
	}
}