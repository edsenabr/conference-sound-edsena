const Cvc = imports.gi.Cvc;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Main = imports.ui.main;
const SignalManager = imports.misc.signalManager.SignalManager;
const {LogUtils} = require(`./LogUtils`)
const LOG = new LogUtils();

const CINNAMON_DESKTOP_SOUNDS = "org.cinnamon.desktop.sound";
const MAXIMUM_VOLUME_KEY = "maximum-volume";
const Signals = imports.signals;

class AudioController {
	constructor(){
        this._signalManager = new SignalManager(null);
		this._mute_id = [];
		this._stream = [];
		this._devices = {
			"_output": [],
			"_input": []
		};
		this.teste = "controller";
        this.volumeMax = 0;
        this.volumeNorm = 0;
		this._setupMixerControls();
    }

	setDefaults(sink, source) {
		let input = this._devices["_input"][source];
		let output = this._devices["_output"][sink];

		if (input == undefined) {
			LOG.error(`The input {${source}} does not exists on the system. Wrong configuration?`)
		}

		if (output == undefined) {
			LOG.error(`The output {${sink}} does not exists on the system. Wrong configuration?`)
		} 
		
		if (input && output) {
			this._control.change_input(input);
			this._control.change_output(output);
		}
	}

	_setupMixerControls() {
		this._control = new Cvc.MixerControl({ name: 'Cinnamon Volume Control' });
		this._sound_settings = new Gio.Settings({ schema_id: CINNAMON_DESKTOP_SOUNDS });

		this._control.open();

		this.volumeMax = this._sound_settings.get_int(MAXIMUM_VOLUME_KEY) / 100 * this._control.get_vol_max_norm();
		this.volumeNorm = this._control.get_vol_max_norm();

		this._control.connect('output-added', (...args) => this._onDeviceAdded(...args, "_output"));
		this._control.connect('input-added', (...args) => this._onDeviceAdded(...args, "_input"));


		this._control.connect('output-removed', (...args) => this._onDeviceRemoved(...args, "_output"));
		this._control.connect('input-removed', (...args) => this._onDeviceRemoved(...args, "_input"));


		this._control.connect('state-changed', this._onMixerControlStateChanged.bind(this));
		this._control.connect('default-sink-changed', this._onDefaultChanged.bind(this, '_output'));
		this._control.connect('default-source-changed', this._onDefaultChanged.bind(this, '_input'));

    }

	_onMixerControlStateChanged(){
		this.emit('control-state-changed', (this._control.get_state() == Cvc.MixerControlState.READY));
	}

	toggle_mute(property) {
		global.log(`_toggle_mute:: ${property}`)
		if (!this._stream[property])
				return;

		this._stream[property].change_is_muted(
			!this._stream[property].is_muted
		);
	}

	_generateSettingsOptions(type) {
		let options = {};
		for (let device in this._devices[type]) {
			options[device] = device;
		}
        return options;
	}

    _onDeviceAdded(control, id, type) {
		let device = this._control[`lookup${type}_id`](id);
		let full_name = `${device.origin}::${device.description}`;
		this._devices[type][full_name] = device;
        this.emit('devices-updated', type, this._generateSettingsOptions(type));
		global.log(`_onDeviceAddedd::id=${id}, type=${type}, => ${full_name}`);
	}

	_onDeviceRemoved(control, id, type) {
		let device = this._control[`lookup${type}_id`](id);
		let full_name = `${device.origin}::${device.description}`;
		this._devices[type][full_name] = device;
        this.emit('devices-updated', type, this._generateSettingsOptions(type));
		global.log(`_onDeviceRemoved::id=${id}, type=${type}, => ${full_name}`);
	}

	_onDefaultChanged(type, control, id) {
		global.log(`_onDefaultChanged:: id=${id}, type=${type}`);
		let stream = control.lookup_stream_id(id);
		if (!stream) {
			return;
		}
		let device = control.lookup_device_from_stream(stream);
		let full_name = `${device.origin}::${device.description}`;
		this._rebindMute(type, stream);
		this.emit('default-changed', full_name, type, stream);
		this.emit('change-mute', type, this._stream[type].is_muted);
	}

	_onDeviceUpdate(control, id, type) {
		let device = this._control[`lookup${type}_id`](id);
		let stream =  this._control.get_stream_from_device(device);
		let full_name = `${device.origin}::${device.description}`;


		global.log(`_onDeviceUpdate:: id=${id}, type=${type}, card=${device.port_name} => |${full_name}|,  setup=> |${setup.HEADSET._output}| is muted ? ${stream.is_muted}`);
		this.emit('default-changed', full_name, type, stream);
		this.emit('change-mute', type, this._stream[type].is_muted);
	}

	_rebindMute(type, stream) {
		if (this._mute_id[type]) {
			this._stream[type].disconnect(this._mute_id[type]);
			this._mute_id[type] = 0;
		}
		
		this._stream[type] = stream;
		this._mute_id[type] = stream.connect('notify::is-muted', () => this.emit('change-mute', type, this._stream[type].is_muted)); //adjust >> receives state?
	}
    destroy() {
		Main.keybindingManager.removeHotKey("use-headset-" + this.instance_id);
		Main.keybindingManager.removeHotKey("use-speakers-" + this.instance_id);
    }

}
Signals.addSignalMethods(AudioController.prototype);